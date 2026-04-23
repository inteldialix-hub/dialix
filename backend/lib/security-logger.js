const fs = require('fs');
const path = require('path');

// Security event types
const SECURITY_EVENTS = {
  AUTH_SUCCESS: 'auth_success',
  AUTH_FAILURE: 'auth_failure',
  AUTH_LOGOUT: 'auth_logout',
  PASSWORD_CHANGE: 'password_change',
  ADMIN_ACCESS: 'admin_access',
  ADMIN_ACTION: 'admin_action',
  ACCESS_DENIED: 'access_denied',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  WEBSOCKET_ACCESS: 'websocket_access',
  WEBSOCKET_DENIED: 'websocket_denied',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  INVALID_TOKEN: 'invalid_token',
  EXPIRED_TOKEN: 'expired_token',
  CONFIG_CHANGE: 'config_change',
  BACKUP_STARTED: 'backup_started',
  BACKUP_COMPLETED: 'backup_completed',
  BACKUP_FAILED: 'backup_failed',
  DB_CONNECTION_ERROR: 'db_connection_error',
  DB_QUERY_ANOMALY: 'db_query_anomaly'
};

// Log levels
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

class SecurityLogger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logFile = process.env.LOG_FILE || path.join(__dirname, '..', 'logs', 'app.log');
    this.securityLogFile = process.env.SECURITY_LOG_FILE || path.join(__dirname, '..', 'logs', 'security.log');

    // Ensure log directories exist
    this.ensureLogDirectories();
  }

  ensureLogDirectories() {
    const logDir = path.dirname(this.logFile);
    const securityLogDir = path.dirname(this.securityLogFile);

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    if (!fs.existsSync(securityLogDir)) {
      fs.mkdirSync(securityLogDir, { recursive: true });
    }
  }

  shouldLog(level) {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  formatLogEntry(level, event, data, req = null) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      event,
      data,
      ...(req && this.extractRequestInfo(req))
    };
    return JSON.stringify(entry) + '\n';
  }

  extractRequestInfo(req) {
    return {
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      method: req.method,
      url: req.url,
      clientId: req.client?.id || null,
      userEmail: req.client?.email || null,
      isAdmin: req.client?.is_admin || false
    };
  }

  writeToFile(filePath, content) {
    try {
      fs.appendFileSync(filePath, content);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(level, event, data, req = null) {
    if (!this.shouldLog(level)) return;

    const logEntry = this.formatLogEntry(level, event, data, req);

    // Write to general log
    this.writeToFile(this.logFile, logEntry);

    // Write security events to security log
    if (this.isSecurityEvent(event)) {
      this.writeToFile(this.securityLogFile, logEntry);
    }

    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${level.toUpperCase()}] ${event}:`, data);
    }
  }

  isSecurityEvent(event) {
    return Object.values(SECURITY_EVENTS).includes(event);
  }

  // Convenience methods for different log levels
  error(event, data, req = null) {
    this.log(LOG_LEVELS.ERROR, event, data, req);
  }

  warn(event, data, req = null) {
    this.log(LOG_LEVELS.WARN, event, data, req);
  }

  info(event, data, req = null) {
    this.log(LOG_LEVELS.INFO, event, data, req);
  }

  debug(event, data, req = null) {
    this.log(LOG_LEVELS.DEBUG, event, data, req);
  }

  // Specific security event methods
  logAuthSuccess(email, req) {
    this.info(SECURITY_EVENTS.AUTH_SUCCESS, { email }, req);
  }

  logAuthFailure(email, reason, req) {
    this.warn(SECURITY_EVENTS.AUTH_FAILURE, { email, reason }, req);
  }

  logAuthLogout(email, req) {
    this.info(SECURITY_EVENTS.AUTH_LOGOUT, { email }, req);
  }

  logPasswordChange(email, req) {
    this.info(SECURITY_EVENTS.PASSWORD_CHANGE, { email }, req);
  }

  logAdminAccess(email, action, req) {
    this.info(SECURITY_EVENTS.ADMIN_ACCESS, { email, action }, req);
  }

  logAdminAction(email, action, details, req) {
    this.info(SECURITY_EVENTS.ADMIN_ACTION, { email, action, details }, req);
  }

  logAccessDenied(email, resource, req) {
    this.warn(SECURITY_EVENTS.ACCESS_DENIED, { email, resource }, req);
  }

  logSuspiciousActivity(activity, details, req) {
    this.error(SECURITY_EVENTS.SUSPICIOUS_ACTIVITY, { activity, details }, req);
  }

  logWebsocketAccess(email, conversationId, req) {
    this.info(SECURITY_EVENTS.WEBSOCKET_ACCESS, { email, conversationId }, req);
  }

  logWebsocketDenied(reason, req) {
    this.warn(SECURITY_EVENTS.WEBSOCKET_DENIED, { reason }, req);
  }

  logRateLimitExceeded(endpoint, req) {
    this.warn(SECURITY_EVENTS.RATE_LIMIT_EXCEEDED, { endpoint }, req);
  }

  logInvalidToken(reason, req) {
    this.warn(SECURITY_EVENTS.INVALID_TOKEN, { reason }, req);
  }

  logExpiredToken(req) {
    this.warn(SECURITY_EVENTS.EXPIRED_TOKEN, {}, req);
  }

  logConfigChange(change, req) {
    this.info(SECURITY_EVENTS.CONFIG_CHANGE, { change }, req);
  }

  logBackupStarted(type, req) {
    this.info(SECURITY_EVENTS.BACKUP_STARTED, { type }, req);
  }

  logBackupCompleted(type, duration, req) {
    this.info(SECURITY_EVENTS.BACKUP_COMPLETED, { type, duration }, req);
  }

  logBackupFailed(type, error, req) {
    this.error(SECURITY_EVENTS.BACKUP_FAILED, { type, error }, req);
  }

  logDbConnectionError(error, req) {
    this.error(SECURITY_EVENTS.DB_CONNECTION_ERROR, { error: error.message }, req);
  }

  logDbQueryAnomaly(query, duration, req) {
    this.warn(SECURITY_EVENTS.DB_QUERY_ANOMALY, { query, duration }, req);
  }
}

// Export singleton instance
module.exports = new SecurityLogger();
module.exports.SECURITY_EVENTS = SECURITY_EVENTS;
module.exports.LOG_LEVELS = LOG_LEVELS;