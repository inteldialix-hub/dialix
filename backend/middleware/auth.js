const jwt = require('jsonwebtoken');
const { get } = require('../db');
const securityLogger = require('../lib/security-logger');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required to start the server');
}

/**
 * JWT authentication middleware.
 * Verifies the Bearer token and attaches the client object to req.client.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  let token;
  
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query.token) {
    // Fallback: accept token as query param (needed for audio streaming via <audio src>)
    token = req.query.token;
  } else {
    securityLogger.logInvalidToken('missing_bearer_header', req);
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (!payload || !payload.clientId) {
      securityLogger.logInvalidToken('invalid_payload', req);
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const client = await get('SELECT id, name, email, is_admin FROM clients WHERE id = ?', [payload.clientId]);
    if (!client) {
      securityLogger.logInvalidToken('client_not_found', req);
      return res.status(401).json({ error: 'Client not found' });
    }

    req.client = client;
    req.user = {
      ...client,
      id: client.id,
      client_id: client.id,
      clientId: client.id,
    };
    securityLogger.logAuthSuccess(client.email, req);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      securityLogger.logExpiredToken(req);
      return res.status(401).json({ error: 'Token expired' });
    } else {
      securityLogger.logInvalidToken(err.message, req);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
}

/**
 * Admin-only middleware. Must be used AFTER authenticate.
 */
function requireAdmin(req, res, next) {
  if (!req.client || req.client.is_admin !== 1) {
    securityLogger.logAccessDenied(req.client?.email || 'unauthenticated', 'admin_resource', req);
    return res.status(403).json({ error: 'Admin access required' });
  }
  securityLogger.logAdminAccess(req.client.email, req.url, req);
  next();
}

module.exports = { authenticate, requireAdmin };
