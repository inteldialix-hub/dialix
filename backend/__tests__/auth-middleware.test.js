process.env.JWT_SECRET = 'test-secret';

const jwt = require('jsonwebtoken');
const { get } = require('../db');
const securityLogger = require('../lib/security-logger');
const { authenticate, requireAdmin, requireRole, ROLE_HIERARCHY } = require('../middleware/auth');

jest.mock('jsonwebtoken');
jest.mock('../db', () => ({
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn()
}));
jest.mock('../lib/security-logger', () => ({
  logInvalidToken: jest.fn(),
  logAuthSuccess: jest.fn(),
  logExpiredToken: jest.fn(),
  logAccessDenied: jest.fn(),
  logAdminAccess: jest.fn(),
}));

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    req = {
      headers: {},
      query: {},
      url: '/test'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should reject missing authorization header', async () => {
      await authenticate(req, res, next);
      expect(securityLogger.logInvalidToken).toHaveBeenCalledWith('missing_bearer_header', req);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid authorization header' });
    });

    it('should extract token from Bearer header', async () => {
      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ clientId: 1 });
      get.mockResolvedValue({ id: 1, email: 'test@example.com' });

      await authenticate(req, res, next);
      
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret', { algorithms: ['HS256'] });
      expect(next).toHaveBeenCalled();
    });

    it('should accept token as query param', async () => {
      req.query.token = 'query-token';
      jwt.verify.mockReturnValue({ clientId: 1 });
      get.mockResolvedValue({ id: 1, email: 'test@example.com' });

      await authenticate(req, res, next);
      
      expect(jwt.verify).toHaveBeenCalledWith('query-token', 'test-secret', { algorithms: ['HS256'] });
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid token payload', async () => {
      req.headers.authorization = 'Bearer bad-token';
      jwt.verify.mockReturnValue({});

      await authenticate(req, res, next);
      
      expect(securityLogger.logInvalidToken).toHaveBeenCalledWith('invalid_payload', req);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle token expiration', async () => {
      req.headers.authorization = 'Bearer expired-token';
      const expiredError = new Error('jwt expired');
      expiredError.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => { throw expiredError; });

      await authenticate(req, res, next);
      
      expect(securityLogger.logExpiredToken).toHaveBeenCalledWith(req);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
    });

    it('should reject if client not found in db', async () => {
      req.headers.authorization = 'Bearer token';
      jwt.verify.mockReturnValue({ clientId: 1 });
      get.mockResolvedValue(null);

      await authenticate(req, res, next);
      
      expect(securityLogger.logInvalidToken).toHaveBeenCalledWith('client_not_found', req);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin access', () => {
      req.client = { email: 'admin@test.com', is_admin: 1 };
      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(securityLogger.logAdminAccess).toHaveBeenCalled();
    });

    it('should block non-admin access', () => {
      req.client = { email: 'user@test.com', is_admin: 0 };
      requireAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(securityLogger.logAccessDenied).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should enforce role hierarchy correctly', async () => {
      req.client = { email: 'user@test.com', _teamRole: 'manager', is_admin: 0 };
      const middleware = requireRole('viewer', 'billing');
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled(); // manager > viewer
    });

    it('should allow platform admin regardless of role', async () => {
      req.client = { email: 'admin@test.com', is_admin: 1 }; // No _teamRole
      const middleware = requireRole('owner');
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should deny if role level is insufficient', async () => {
      req.client = { email: 'user@test.com', _teamRole: 'viewer', is_admin: 0 };
      const middleware = requireRole('manager');
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(securityLogger.logAccessDenied).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should block unauthenticated access', async () => {
      const middleware = requireRole('viewer');
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
