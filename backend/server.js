require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const http = require('http');
const jwt = require('jsonwebtoken');
const { WebSocketServer, WebSocket } = require('ws');
const { initDb } = require('./db');
const { authenticate } = require('./middleware/auth');
const securityMiddleware = require('./middleware/security');
const webSecurity = require('./middleware/web-security');
const { getMonitoringUrl } = require('./services/elevenlabs');
const callMonitor = require('./lib/call-monitoring');
const securityLogger = require('./lib/security-logger');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required and must be set in the environment');
}

const allowedOrigins = [
  FRONTEND_URL,
  'https://dialix-frontend.fly.dev',
  'http://localhost:3000',
].filter(Boolean);

// ─── CORS ───────────────────────────────────────────────────────
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Middleware ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // disabled — SPA loads CDN scripts
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false, // allow cross-origin audio/media loading
}));
app.use(helmet.hsts({
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true,
}));
app.use(helmet.noSniff());
app.use(helmet.referrerPolicy({ policy: 'same-origin' }));
app.use(webSecurity.securityHeaders);
app.use(webSecurity.createRequestSizeLimiter('10mb'));
app.use(webSecurity.sanitizeMiddleware);
app.use(webSecurity.validateUrlMiddleware);
app.use(securityMiddleware.securityHeaders);
app.use(securityMiddleware.monitorRequestSize());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── API Routes ─────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/phone-numbers', require('./routes/phoneNumbers'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/stats', require('./routes/stats'));

// ─── Health check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Serve frontend in production ───────────────────────────────
const frontendPath = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendPath)) {
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
} else {
  console.warn('Frontend static folder not found at', frontendPath);
}

// ─── HTTP + WebSocket Server ────────────────────────────────────
const server = http.createServer(app);

/**
 * WebSocket Proxy for Live Call Monitoring
 * 
 * How it works (think of it as a translator between two walkie-talkies):
 * 1. Browser connects to our server via WebSocket at /ws?conversation_id=...&token=...
 * 2. Our server connects to ElevenLabs' monitoring WebSocket (with the secret API key)
 * 3. Everything ElevenLabs sends → we forward to the browser + track metrics
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
    securityLogger.logWebsocketDenied('missing_parameters', req);
    clientWs.close(4001, 'Missing conversation_id or token');
    return;
  }

  // Verify JWT token (reuse our auth middleware logic)
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (!decoded || decoded.is_admin !== 1) {
      securityLogger.logWebsocketDenied('insufficient_permissions', req);
      clientWs.close(4003, 'Admin access required for monitoring');
      return;
    }
  } catch (err) {
    securityLogger.logWebsocketDenied('invalid_token', req);
    clientWs.close(4001, 'Invalid token');
    return;
  }

  securityLogger.logWebsocketAccess(decoded.email, conversationId, req);
  console.log(`[WS] Monitor connected: conversation=${conversationId} by user=${decoded.email}`);

  // Connect to ElevenLabs monitoring WebSocket
  const elUrl = getMonitoringUrl(conversationId);
  const elWs = new WebSocket(elUrl, {
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
    },
  });

  // Track metrics from ElevenLabs events
  const messageHandler = (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Update call status based on message type
      if (message.type === 'status_update') {
        callMonitor.updateCallStatus(conversationId, message.status, {
          duration: message.duration || 0,
          mq_quality: message.mq_quality,
          fq_quality: message.fq_quality,
        });
      } else if (message.type === 'conversation_end') {
        callMonitor.updateCallStatus(conversationId, 'completed', {
          duration: message.duration || 0,
          mq_quality: message.mq_quality,
          fq_quality: message.fq_quality,
          transcript: message.transcript,
        });
      }
    } catch (e) {
      // Message might not be JSON, just forward it
    }

    // Forward to browser
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data.toString());
    }
  };

  // Forward ElevenLabs events → Browser
  elWs.on('message', messageHandler);

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
        timestamp: new Date().toISOString(),
      }));
    }
  });

  elWs.on('error', (err) => {
    console.error(`[WS] ElevenLabs WS error:`, err.message);
    callMonitor.updateCallStatus(conversationId, 'error', { error_message: err.message });
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'monitor_status',
        status: 'error',
        message: err.message,
        timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
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

  server.listen(PORT, '0.0.0.0', () => {
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
