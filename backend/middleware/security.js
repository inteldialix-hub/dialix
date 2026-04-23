const securityLogger = require('../lib/security-logger');

/**
 * Security middleware for logging and monitoring security events
 */
class SecurityMiddleware {
  /**
   * Log authentication success
   */
  logAuthSuccess(req, res, next) {
    if (req.client) {
      securityLogger.logAuthSuccess(req.client.email, req);
    }
    next();
  }

  /**
   * Log authentication failure
   */
  logAuthFailure(email, reason, req) {
    securityLogger.logAuthFailure(email, reason, req);
  }

  /**
   * Log logout events
   */
  logAuthLogout(req, res, next) {
    if (req.client) {
      securityLogger.logAuthLogout(req.client.email, req);
    }
    next();
  }

  /**
   * Log password changes
   */
  logPasswordChange(req, res, next) {
    if (req.client) {
      securityLogger.logPasswordChange(req.client.email, req);
    }
    next();
  }

  /**
   * Log admin access
   */
  logAdminAccess(req, res, next) {
    if (req.client && req.client.is_admin) {
      securityLogger.logAdminAccess(req.client.email, req.url, req);
    }
    next();
  }

  /**
   * Log admin actions with details
   */
  logAdminAction(action, details) {
    return (req, res, next) => {
      if (req.client && req.client.is_admin) {
        securityLogger.logAdminAction(req.client.email, action, details, req);
      }
      next();
    };
  }

  /**
   * Log access denied events
   */
  logAccessDenied(resource) {
    return (req, res, next) => {
      if (req.client) {
        securityLogger.logAccessDenied(req.client.email, resource, req);
      } else {
        securityLogger.logAccessDenied('unauthenticated', resource, req);
      }
      next();
    };
  }

  /**
   * Log suspicious activities
   */
  logSuspiciousActivity(activity, details) {
    return (req, res, next) => {
      securityLogger.logSuspiciousActivity(activity, details, req);
      next();
    };
  }

  /**
   * Log WebSocket access
   */
  logWebsocketAccess(conversationId) {
    return (req, res, next) => {
      if (req.client) {
        securityLogger.logWebsocketAccess(req.client.email, conversationId, req);
      }
      next();
    };
  }

  /**
   * Log WebSocket access denied
   */
  logWebsocketDenied(reason) {
    return (req, res, next) => {
      securityLogger.logWebsocketDenied(reason, req);
      next();
    };
  }

  /**
   * Log rate limit exceeded
   */
  logRateLimitExceeded(endpoint) {
    return (req, res, next) => {
      securityLogger.logRateLimitExceeded(endpoint, req);
      next();
    };
  }

  /**
   * Log invalid tokens
   */
  logInvalidToken(reason) {
    return (req, res, next) => {
      securityLogger.logInvalidToken(reason, req);
      next();
    };
  }

  /**
   * Log expired tokens
   */
  logExpiredToken(req, res, next) {
    securityLogger.logExpiredToken(req);
    next();
  }

  /**
   * Monitor database query performance
   */
  monitorDbQueries(req, res, next) {
    const startTime = Date.now();

    // Override the db functions to add monitoring
    const originalGet = req.app.locals.db?.get;
    const originalAll = req.app.locals.db?.all;
    const originalRun = req.app.locals.db?.run;

    if (originalGet) {
      req.app.locals.db.get = async function(...args) {
        const queryStart = Date.now();
        try {
          const result = await originalGet.apply(this, args);
          const duration = Date.now() - queryStart;
          if (duration > 1000) { // Log queries taking more than 1 second
            securityLogger.logDbQueryAnomaly(args[0], duration, req);
          }
          return result;
        } catch (error) {
          securityLogger.logDbConnectionError(error, req);
          throw error;
        }
      };
    }

    if (originalAll) {
      req.app.locals.db.all = async function(...args) {
        const queryStart = Date.now();
        try {
          const result = await originalAll.apply(this, args);
          const duration = Date.now() - queryStart;
          if (duration > 1000) {
            securityLogger.logDbQueryAnomaly(args[0], duration, req);
          }
          return result;
        } catch (error) {
          securityLogger.logDbConnectionError(error, req);
          throw error;
        }
      };
    }

    if (originalRun) {
      req.app.locals.db.run = async function(...args) {
        const queryStart = Date.now();
        try {
          const result = await originalRun.apply(this, args);
          const duration = Date.now() - queryStart;
          if (duration > 1000) {
            securityLogger.logDbQueryAnomaly(args[0], duration, req);
          }
          return result;
        } catch (error) {
          securityLogger.logDbConnectionError(error, req);
          throw error;
        }
      };
    }

    next();
  }

  /**
   * Security headers middleware
   */
  securityHeaders(req, res, next) {
    // Add security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    });

    // Log potential security threats
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.includes('sqlmap') || userAgent.includes('nmap') || userAgent.includes('nikto')) {
      securityLogger.logSuspiciousActivity('suspicious_user_agent', { userAgent }, req);
    }

    next();
  }

  /**
   * Request size monitoring
   */
  monitorRequestSize(maxSize = '10mb') {
    return (req, res, next) => {
      let data = '';
      let size = 0;

      const originalWrite = req.write;
      const originalEnd = req.end;

      req.write = function(chunk, encoding) {
        if (chunk) {
          size += Buffer.byteLength(chunk, encoding);
          if (size > parseInt(maxSize) * 1024 * 1024) {
            securityLogger.logSuspiciousActivity('large_request_body', { size }, req);
          }
        }
        return originalWrite.apply(this, arguments);
      };

      req.end = function(chunk, encoding) {
        if (chunk) {
          size += Buffer.byteLength(chunk, encoding);
          if (size > parseInt(maxSize) * 1024 * 1024) {
            securityLogger.logSuspiciousActivity('large_request_body', { size }, req);
          }
        }
        return originalEnd.apply(this, arguments);
      };

      next();
    };
  }
}

// Export singleton instance
module.exports = new SecurityMiddleware();