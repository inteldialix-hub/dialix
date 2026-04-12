require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { initDb } = require('./db');
const { authenticate } = require('./middleware/auth');
const { getMonitoringUrl } = require('./services/elevenlabs');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// ─── API Routes ─────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/phone-numbers', require('./routes/phoneNumbers'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/stats', require('./routes/stats'));

// ─── Health check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Serve frontend in production ───────────────────────────────
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath, {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  },
}));

// SPA catch-all
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── HTTP + WebSocket Server ────────────────────────────────────
const server = http.createServer(app);

/**
 * WebSocket Proxy for Live Call Monitoring
 * 
 * How it works (think of it as a translator between two walkie-talkies):
 * 1. Browser connects to our server via WebSocket at /ws/monitor/:conversation_id
 * 2. Our server connects to ElevenLabs' monitoring WebSocket (with the secret API key)
 * 3. Everything ElevenLabs sends → we forward to the browser
 * 4. Everything the browser sends (commands) → we forward to ElevenLabs
 * 
 * This way the API key NEVER leaves the server.
 */
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (clientWs, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const conversationId = url.searchParams.get('conversation_id');
  const token = url.searchParams.get('token');

  if (!conversationId || !token) {
    clientWs.close(4001, 'Missing conversation_id or token');
    return;
  }

  // Verify JWT token (reuse our auth middleware logic)
  const jwt = require('jsonwebtoken');
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.is_admin) {
      clientWs.close(4003, 'Admin access required for monitoring');
      return;
    }
  } catch (err) {
    clientWs.close(4001, 'Invalid token');
    return;
  }

  console.log(`[WS] Monitor connected: conversation=${conversationId} by user=${decoded.email}`);

  // Connect to ElevenLabs monitoring WebSocket
  const elUrl = getMonitoringUrl(conversationId);
  const elWs = new WebSocket(elUrl, {
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
    },
  });

  // Forward ElevenLabs events → Browser
  elWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data.toString());
    }
  });

  // Forward Browser commands → ElevenLabs
  clientWs.on('message', (data) => {
    if (elWs.readyState === WebSocket.OPEN) {
      elWs.send(data.toString());
    }
  });

  // Handle ElevenLabs connection events
  elWs.on('open', () => {
    console.log(`[WS] Connected to ElevenLabs monitoring for ${conversationId}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'monitor_status',
        status: 'connected',
        conversation_id: conversationId,
      }));
    }
  });

  elWs.on('error', (err) => {
    console.error(`[WS] ElevenLabs WS error:`, err.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'monitor_status',
        status: 'error',
        message: err.message,
      }));
    }
  });

  elWs.on('close', (code, reason) => {
    console.log(`[WS] ElevenLabs WS closed: ${code} ${reason}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'monitor_status',
        status: 'disconnected',
        code,
      }));
      clientWs.close(1000, 'ElevenLabs connection closed');
    }
  });

  // Clean up when browser disconnects
  clientWs.on('close', () => {
    console.log(`[WS] Browser disconnected from monitor: ${conversationId}`);
    if (elWs.readyState === WebSocket.OPEN || elWs.readyState === WebSocket.CONNECTING) {
      elWs.close();
    }
  });
});

// ─── Start server (async because sql.js init is async) ──────────
async function start() {
  await initDb();

  server.listen(PORT, () => {
    console.log('');
    console.log('  ╔═══════════════════════════════════════╗');
    console.log('  ║   DIALIX API Server                   ║');
    console.log(`  ║   Running on port ${PORT}               ║`);
    console.log('  ║   WebSocket monitoring: /ws            ║');
    console.log('  ╚═══════════════════════════════════════╝');
    console.log('');
    console.log(`  → API:      http://localhost:${PORT}/api`);
    console.log(`  → Frontend: http://localhost:${PORT}`);
    console.log(`  → WS:       ws://localhost:${PORT}/ws`);
    console.log('');
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
