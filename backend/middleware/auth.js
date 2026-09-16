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

// ─── RBAC: Role-Based Access Control ──────────────────────────
// Role hierarchy: higher roles inherit all lower permissions
// Think of it like a pyramid — owner at the top can do everything
const ROLE_HIERARCHY = {
  owner: 7,
  admin: 6,
  manager: 5,
  supervisor: 4,
  analyst: 3,
  billing: 2,
  viewer: 1,
};

/**
 * Middleware factory: require at least one of the given roles.
 * Must be used AFTER authenticate.
 * Example: requireRole('owner', 'admin', 'manager')
 *
 * If useHierarchy is true (default), a higher role can access
 * endpoints that require a lower role. For example, an 'owner'
 * can access anything that requires 'viewer'.
 */
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.client) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Platform admins bypass role checks
    if (req.client.is_admin === 1) {
      return next();
    }

    // Account owners (the client themselves) get 'owner' role
    const userRole = req.client._teamRole || 'owner';
    const userLevel = ROLE_HIERARCHY[userRole] || 0;

    // Check if user's role level meets the minimum required
    const minRequiredLevel = Math.min(
      ...allowedRoles.map(r => ROLE_HIERARCHY[r] || 0)
    );

    if (userLevel >= minRequiredLevel) {
      return next();
    }

    securityLogger.logAccessDenied(
      req.client.email,
      `role_required: ${allowedRoles.join(',')}; has: ${userRole}`,
      req
    );
    return res.status(403).json({
      error: 'You do not have permission to perform this action.',
      required_roles: allowedRoles,
    });
  };
}

module.exports = { authenticate, requireAdmin, requireRole, ROLE_HIERARCHY };
