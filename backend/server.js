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
const { attachGeminiCallBridge } = require('./lib/gemini-call-bridge');

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
  'https://inteldialix.online',
  'https://www.inteldialix.online',
  'http://localhost:3000',
].filter(Boolean);

// ─── CORS ───────────────────────────────────────────────────────
app.use(cors({
  origin: function (reqOrigin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!reqOrigin) return callback(null, true);
    // Allow exact matches
    if (allowedOrigins.includes(reqOrigin)) return callback(null, true);
    // Allow any *.vercel.app preview deployments
    if (reqOrigin.endsWith('.vercel.app')) return callback(null, true);
    // Allow any *.onrender.com domains
    if (reqOrigin.endsWith('.onrender.com')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
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
// ─── PayPal webhook needs raw body for signature verification ──
// Must be registered BEFORE the global JSON parser
app.post('/api/webhooks/paypal', express.raw({ type: 'application/json' }));

app.use(webSecurity.securityHeaders);
app.use(webSecurity.createRequestSizeLimiter('10mb'));
app.use(webSecurity.sanitizeMiddleware);
app.use(webSecurity.validateUrlMiddleware);
app.use(securityMiddleware.securityHeaders);
app.use(securityMiddleware.monitorRequestSize());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request logging ────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api/') && duration > 50) {
      console.log(`[REQ] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// ─── API Routes ─────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/phone-numbers', require('./routes/phoneNumbers'));
app.use('/api/calls', authenticate, require('./routes/analysis'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/pricing', require('./routes/pricing'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/paypal', require('./routes/paypal'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/api-keys', require('./routes/api-keys'));
app.use('/api/telemetry', require('./routes/telemetry'));
app.use('/api/team', require('./routes/team'));

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

// ─── Global error handler ────────────────────────────────────
// Must be defined after all routes. Catches unhandled errors and
// prevents stack traces from leaking to clients in production.
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  console.error(`[ERROR] ${req.method} ${req.url}:`, err.message || err);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
});

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
const wss = new WebSocketServer({ noServer: true });

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

// ─── Gemini Live Call Bridge WebSocket ───────────────────────────
const geminiWss = attachGeminiCallBridge(server);

// ─── Unified WebSocket Upgrade Handler ──────────────────────────
// Route upgrade requests to the correct WSS based on pathname
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://localhost:${PORT}`).pathname;

  if (pathname === '/ws/gemini-call') {
    geminiWss.handleUpgrade(request, socket, head, (ws) => {
      geminiWss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ─── Start server (async because sql.js init is async) ──────────
async function start() {
  await initDb();

  // Start automated campaign dialing worker
  const campaignWorker = require('./services/campaign-worker');
  campaignWorker.start();

  server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ╔═══════════════════════════════════════╗');
    console.log('  ║   DIALIX API Server                   ║');
    console.log(`  ║   Running on port ${PORT}               ║`);
    console.log('  ║   WebSocket monitoring: /ws            ║');
    console.log('  ║   Gemini Live calls: /ws/gemini-call   ║');
    console.log('  ╚═══════════════════════════════════════╝');
    console.log('');
    console.log(`  → API:      http://localhost:${PORT}/api`);
    console.log(`  → Frontend: http://localhost:${PORT}`);
    console.log(`  → WS:       ws://localhost:${PORT}/ws`);
    console.log(`  → Gemini:   ws://localhost:${PORT}/ws/gemini-call`);
    console.log('');
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
