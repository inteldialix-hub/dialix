const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const validator = require('validator');

// Initialize DOMPurify with JSDOM
const window = new JSDOM('').window;
const DOMPurifyInstance = DOMPurify(window);

// ─── XSS Protection ──────────────────────────────────────────────────
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  // Use DOMPurify to strip all HTML tags/attributes — safe for DB storage.
  // NOTE: We intentionally do NOT call validator.escape() here because
  // combining escape + DOMPurify causes double-encoding (&amp;amp;).
  // Output encoding should happen at the render layer instead.
  return DOMPurifyInstance.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    return sanitizeInput(obj);
  }

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip sanitizing known safe fields
    const safeFields = ['password', 'token', 'secret', 'key', 'authorization'];
    if (safeFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = value;
    } else {
      sanitized[key] = sanitizeObject(value);
    }
  }

  return sanitized;
}

// ─── SSRF Protection ──────────────────────────────────────────────────
function isValidUrl(url) {
  try {
    const parsedUrl = new URL(url);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    // Block localhost and private IP ranges
    const hostname = parsedUrl.hostname.toLowerCase();

    // Strip IPv6 brackets for analysis
    const bare = hostname.replace(/^\[|\]$/g, '');

    // Block localhost variations (string, IPv4, IPv6)
    if (bare === 'localhost' || bare === '127.0.0.1' ||
        bare.startsWith('127.') || bare === '0.0.0.0' ||
        bare === '::1' || bare === '0000::1' || bare === '::ffff:127.0.0.1') {
      return false;
    }

    // Block octal/hex encoded IPs (e.g. 0177.0.0.1, 0x7f000001)
    if (/^0[0-7]/.test(bare) || /^0x[0-9a-f]/i.test(bare)) {
      return false;
    }

    // Block cloud metadata endpoints
    if (bare === '169.254.169.254' || bare === 'metadata.google.internal') {
      return false;
    }

    // Block private IP ranges
    const ip = bare.split('.').map(Number);
    if (ip.length === 4 && ip.every(n => !isNaN(n))) {
      const [a, b] = ip;
      // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16 (link-local)
      if (a === 10 ||
          (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && b === 168) ||
          (a === 169 && b === 254) ||
          a === 0) {
        return false;
      }
    }

    // Block IPv6 private/link-local ranges
    if (bare.startsWith('fe80:') || bare.startsWith('fc00:') || bare.startsWith('fd')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ─── RCE Protection ──────────────────────────────────────────────────
function validateCommand(command) {
  if (!command || typeof command !== 'string') return false;

  // Block dangerous shell metacharacters
  const dangerousChars = /[;&|`$(){}[\]<>]/;
  if (dangerousChars.test(command)) {
    return false;
  }

  // Block common command injection patterns
  const blockedPatterns = [
    /\b(rm|del|format|shutdown|reboot|halt|poweroff)\b/i,
    /\b(eval|exec|system|spawn|popen)\b/i,
    /\b(node|python|bash|sh|cmd|powershell)\b/i,
    /[\x00-\x1f\x7f-\x9f]/, // Control characters
  ];

  return !blockedPatterns.some(pattern => pattern.test(command));
}

// ─── LFI Protection ──────────────────────────────────────────────────
function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;

  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Block path traversal attempts
  if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
    return false;
  }

  // Block absolute paths that could access system files
  if (normalizedPath.startsWith('/') || normalizedPath.match(/^[A-Za-z]:/)) {
    return false;
  }

  // Block null bytes and other control characters
  if (/[\x00-\x1f\x7f-\x9f]/.test(normalizedPath)) {
    return false;
  }

  return true;
}

// ─── Request Size Limiting ───────────────────────────────────────────
function createRequestSizeLimiter(maxSize = '10mb') {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length']);

    if (contentLength && contentLength > parseSize(maxSize)) {
      return res.status(413).json({
        error: 'Request entity too large',
        maxSize
      });
    }

    next();
  };
}

function parseSize(size) {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);

  if (!match) return 10 * 1024 * 1024; // Default 10MB

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';

  return Math.floor(value * units[unit]);
}

// ─── Security Headers Middleware ─────────────────────────────────────
function securityHeaders(req, res, next) {
  // Additional security headers beyond Helmet
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Remove server information
  res.removeHeader('X-Powered-By');

  next();
}

// ─── Request Monitoring ──────────────────────────────────────────────
function monitorRequestSize(maxSize = '10mb') {
  return (req, res, next) => {
    let dataSize = 0;

    const originalWrite = res.write;
    const originalEnd = res.end;

    res.write = function(chunk) {
      if (chunk) dataSize += chunk.length;
      return originalWrite.apply(this, arguments);
    };

    res.end = function(chunk) {
      if (chunk) dataSize += chunk.length;

      // Log large responses
      if (dataSize > parseSize(maxSize)) {
        console.warn(`Large response detected: ${dataSize} bytes for ${req.method} ${req.path}`);
      }

      return originalEnd.apply(this, arguments);
    };

    next();
  };
}

// ─── Input Sanitization Middleware ───────────────────────────────────
function sanitizeMiddleware(req, res, next) {
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize body parameters (except passwords)
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize route parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
}

// ─── URL Validation Middleware ───────────────────────────────────────
function validateUrlMiddleware(req, res, next) {
  // Check for URLs in common fields
  const urlFields = ['url', 'redirect', 'callback', 'webhook', 'endpoint'];

  for (const field of urlFields) {
    const value = req.body?.[field] || req.query?.[field];
    if (value && !isValidUrl(value)) {
      return res.status(400).json({
        error: `Invalid URL provided for field: ${field}`
      });
    }
  }

  next();
}

module.exports = {
  sanitizeInput,
  sanitizeObject,
  isValidUrl,
  validateCommand,
  validateFilePath,
  createRequestSizeLimiter,
  securityHeaders,
  monitorRequestSize,
  sanitizeMiddleware,
  validateUrlMiddleware,
  DOMPurifyInstance
};