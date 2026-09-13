const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { get, run } = require('../db');
const { authenticate } = require('../middleware/auth');
const { validateSchema } = require('../middleware/validate');
const { loginSchema, registerSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema, otpSchema } = require('../lib/schemas');
const securityLogger = require('../lib/security-logger');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required to start the auth routes');
}

function createAuthToken(client) {
  return jwt.sign(
    { clientId: client.id, is_admin: client.is_admin },
    JWT_SECRET,
    { expiresIn: '24h', algorithm: 'HS256' }
  );
}

const router = express.Router();

// ─── Rate Limiters ───────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per window (relaxed for proxy environments)
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req, res) => {
    // Use IPv6-safe IP + email combination to prevent abuse
    return `${ipKeyGenerator(req, res)}-${req.body?.email || 'unknown'}`;
  },
  handler: (req, res) => {
    securityLogger.logAuthFailure({
      email: req.body?.email,
      reason: 'rate_limit_exceeded',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'Too many login attempts. Please try again in 15 minutes.'
    });
  }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,                    // 3 registrations per window
  message: { error: 'Too many accounts created. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res), // IP-based limiting for registration
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // 5 password reset requests per hour
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
});

// General API rate limiting for sensitive operations
const sensitiveOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 sensitive operations per 15 minutes
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
});

// IP-based brute force protection for password operations
const ipBruteForceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per IP per window
  message: { error: 'Too many password operations. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many OTP verification attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => `${ipKeyGenerator(req, res)}-${req.body?.email || 'unknown'}`,
});

const otpHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many OTP attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
});

// ─── Routes ───────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, client: { id, name, email, is_admin } }
 */
router.post('/login', loginLimiter, validateSchema(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email).toLowerCase().trim();
    const client = await get('SELECT * FROM clients WHERE email = ?', [normalizedEmail]);
    if (!client) {
      securityLogger.logAuthFailure(normalizedEmail, 'user_not_found', req);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = bcrypt.compareSync(password, client.password_hash);
    if (!valid) {
      securityLogger.logAuthFailure(normalizedEmail, 'invalid_password', req);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = createAuthToken(client);

    res.json({
      token,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        is_admin: client.is_admin,
        must_change_password: client.must_change_password || 0,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/register
 * Body: { name, email, password, company? }
 * Returns: { token, client: { id, name, email, is_admin } }
 */
router.post('/register', registerLimiter, validateSchema(registerSchema), async (req, res) => {
  try {
    const { name, email, password, company } = req.body;
    const trimmedName = String(name).trim();
    const trimmedEmail = String(email).toLowerCase().trim();

    const existing = await get('SELECT id FROM clients WHERE email = ?', [trimmedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const displayName = company ? `${trimmedName} (${String(company).trim()})` : trimmedName;

    const result = await run(
      'INSERT INTO clients (name, email, password_hash, is_admin) VALUES (?, ?, ?, 0)',
      [displayName, trimmedEmail, passwordHash]
    );

    let newClient = await get('SELECT * FROM clients WHERE id = ?', [result.lastInsertRowid || result.changes]);
    if (!newClient) {
      newClient = await get('SELECT * FROM clients WHERE email = ?', [trimmedEmail]);
      if (!newClient) {
        return res.status(500).json({ error: 'Account created but failed to retrieve. Please sign in.' });
      }
    }

    const token = createAuthToken(newClient);

    // If registered via team invitation token, link to organization and accept invitation
    const inviteToken = req.body.invite_token || req.body.invite;
    if (inviteToken) {
      try {
        const inv = await get(
          "SELECT id, client_id, email, role, expires_at FROM team_invitations WHERE token = ? AND status = 'pending'",
          [inviteToken]
        );
        if (inv && (!inv.expires_at || new Date(inv.expires_at) >= new Date())) {
          await run(
            `INSERT INTO team_members (client_id, email, name, role, created_at)
             VALUES (?, ?, ?, ?, datetime('now'))`,
            [inv.client_id, trimmedEmail, displayName, inv.role]
          );
          await run(
            "UPDATE team_invitations SET status = 'accepted' WHERE id = ?",
            [inv.id]
          );
          console.log(`[Team] User ${trimmedEmail} joined team #${inv.client_id} with role ${inv.role}`);
        }
      } catch (invErr) {
        console.warn('[Team] Notice redeeming invite token on register:', invErr.message);
      }
    }

    res.status(201).json({
      token,
      client: {
        id: newClient.id,
        name: newClient.name,
        email: newClient.email,
        is_admin: newClient.is_admin,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, async (req, res) => {
  res.json({ client: req.client });
});

/**
 * POST /api/auth/change-password
 * Body: { current_password, new_password }
 * Requires authentication. Clears must_change_password flag.
 */
router.post('/change-password', authenticate, validateSchema(changePasswordSchema), async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    // Verify current password
    const client = await get('SELECT * FROM clients WHERE id = ?', [req.client.id]);
    const valid = bcrypt.compareSync(current_password, client.password_hash);
    if (!valid) {
      securityLogger.logAuthFailure(req.client.email, 'current_password_incorrect', req);
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password and clear the flag
    const newHash = bcrypt.hashSync(new_password, 12);
    await run('UPDATE clients SET password_hash = ?, must_change_password = 0 WHERE id = ?', [newHash, req.client.id]);

    securityLogger.logPasswordChange(req.client.email, req);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Initiates password reset process with rate limiting
 */
router.post('/forgot-password', ipBruteForceLimiter, sensitiveOperationLimiter, validateSchema(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email).toLowerCase().trim();

    const client = await get('SELECT id, email FROM clients WHERE email = ?', [normalizedEmail]);

    if (client) {
      // Generate a secure reset token
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      // Token expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await run('UPDATE clients SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [resetTokenHash, expiresAt, client.id]);

      // Build reset URL
      const frontendUrl = process.env.FRONTEND_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
      const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

      // If SMTP is configured, send email. Otherwise log to console for dev.
      if (process.env.SMTP_HOST || process.env.SENDGRID_API_KEY) {
        // TODO: integrate email service when credentials are available
        console.log(`[AUTH] Password reset email would be sent to ${normalizedEmail}`);
      } else {
        console.log(`[AUTH] Password reset link for ${normalizedEmail}: ${resetUrl}`);
      }

      securityLogger.logAuthFailure(normalizedEmail, 'password_reset_generated', req);
    }

    // Always return success to prevent email enumeration
    res.json({ message: 'If an account with this email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/reset-password
 * Body: { token, new_password }
 * Resets password with token validation and rate limiting
 */
router.post('/reset-password', ipBruteForceLimiter, sensitiveOperationLimiter, validateSchema(resetPasswordSchema), async (req, res) => {
  try {
    const { token, new_password } = req.body;
    const crypto = require('crypto');

    // Hash the provided token to compare against stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find client with matching non-expired reset token
    const client = await get(
      'SELECT id, email FROM clients WHERE reset_token = ? AND reset_token_expires > ?',
      [tokenHash, new Date().toISOString()]
    );

    if (!client) {
      securityLogger.logAuthFailure('unknown', 'invalid_or_expired_reset_token', req);
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    // Update password and clear reset token
    const newHash = bcrypt.hashSync(new_password, 12);
    await run(
      'UPDATE clients SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, must_change_password = 0 WHERE id = ?',
      [newHash, client.id]
    );

    securityLogger.logPasswordChange(client.email, req);
    res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/verify-otp
 * Body: { email, otp_code }
 * Verifies OTP code with rate limiting
 */
router.post('/verify-otp', otpLimiter, otpHourlyLimiter, validateSchema(otpSchema), async (req, res) => {
  try {
    const { email, otp_code } = req.body;
    securityLogger.logAuthFailure(email, 'otp_verification_attempted', req);
    res.status(501).json({ error: 'OTP verification not yet implemented' });
  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
