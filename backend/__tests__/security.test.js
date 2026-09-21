const securityLogger = require('../lib/security-logger');
const securityMiddleware = require('../middleware/security');

jest.mock('../lib/security-logger', () => ({
  logAuthSuccess: jest.fn(),
  logAuthFailure: jest.fn(),
  logAuthLogout: jest.fn(),
  logPasswordChange: jest.fn(),
  logAdminAccess: jest.fn(),
  logAdminAction: jest.fn(),
  logAccessDenied: jest.fn(),
  logSuspiciousActivity: jest.fn(),
  logWebsocketAccess: jest.fn(),
  logWebsocketDenied: jest.fn(),
  logRateLimitExceeded: jest.fn(),
  logInvalidToken: jest.fn(),
  logExpiredToken: jest.fn(),
  logDbQueryAnomaly: jest.fn(),
  logDbConnectionError: jest.fn(),
}));

describe('Security Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      get: jest.fn(),
      app: { locals: {} }
    };
    res = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('securityHeaders', () => {
    it('should set appropriate security headers', () => {
      securityMiddleware.securityHeaders(req, res, next);
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
      }));
      expect(next).toHaveBeenCalled();
    });

    it('should log suspicious user agents', () => {
      req.get.mockReturnValue('sqlmap/1.0');
      securityMiddleware.securityHeaders(req, res, next);
      expect(securityLogger.logSuspiciousActivity).toHaveBeenCalledWith(
        'suspicious_user_agent',
        { userAgent: 'sqlmap/1.0' },
        req
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe('loggers', () => {
    it('logAuthSuccess should call logger if client exists', () => {
      req.client = { email: 'test@example.com' };
      securityMiddleware.logAuthSuccess(req, res, next);
      expect(securityLogger.logAuthSuccess).toHaveBeenCalledWith('test@example.com', req);
      expect(next).toHaveBeenCalled();
    });
    
    it('logAccessDenied should handle unauthenticated users', () => {
      const middleware = securityMiddleware.logAccessDenied('some_resource');
      middleware(req, res, next);
      expect(securityLogger.logAccessDenied).toHaveBeenCalledWith('unauthenticated', 'some_resource', req);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('monitorRequestSize', () => {
    it('should return a middleware function', () => {
      const middleware = securityMiddleware.monitorRequestSize('1mb');
      expect(typeof middleware).toBe('function');
    });
    // Can't easily test the exact implementation since it modifies write/end which aren't standard on Express req object, 
    // but we can test it at least attaches without crashing.
    it('should attach correctly', () => {
      const middleware = securityMiddleware.monitorRequestSize('1mb');
      req.write = jest.fn();
      req.end = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(typeof req.write).toBe('function');
    });
  });
});
