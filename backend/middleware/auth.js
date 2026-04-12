const jwt = require('jsonwebtoken');
const { get } = require('../db');

/**
 * JWT authentication middleware.
 * Verifies the Bearer token and attaches the client object to req.client.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const client = get('SELECT id, name, email, is_admin FROM clients WHERE id = ?', [payload.clientId]);
    if (!client) {
      return res.status(401).json({ error: 'Client not found' });
    }
    req.client = client;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Admin-only middleware. Must be used AFTER authenticate.
 */
function requireAdmin(req, res, next) {
  if (!req.client || req.client.is_admin !== 1) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
