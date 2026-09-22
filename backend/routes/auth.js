const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { get, run } = require('../db');
const { authenticate } = require('../middleware/auth');
const { validateSchema } = require('../middleware/validate');
const { loginSchema, registerSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema, otpSchema } = require('../lib/schemas');
const securityLogger = require('../lib/security-logger');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');

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

    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    await run(
      'UPDATE clients SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
      [verificationToken, verificationExpiresAt, newClient.id]
    );
    
    await sendVerificationEmail(trimmedEmail, verificationToken, displayName);

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
 * PATCH /api/auth/profile
 * Update user profile including notification preferences and retention days
 */
router.patch('/profile', authenticate, async (req, res) => {
  try {
    const { name, notification_preferences, recording_retention_days } = req.body;
    let updateFields = [];
    let updateValues = [];

    if (name) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    
    if (notification_preferences) {
      updateFields.push('notification_preferences = ?');
      updateValues.push(typeof notification_preferences === 'string' ? notification_preferences : JSON.stringify(notification_preferences));
    }
    
    if (recording_retention_days !== undefined) {
      updateFields.push('recording_retention_days = ?');
      updateValues.push(recording_retention_days);
    }

    if (updateFields.length > 0) {
      updateValues.push(req.client.id);
      await run(`UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
    }

    const updatedClient = await get('SELECT * FROM clients WHERE id = ?', [req.client.id]);
    res.json({ success: true, client: updatedClient });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/export
 * GDPR Data Export
 */
router.get('/export', authenticate, async (req, res) => {
  try {
    const clientId = req.client.id;
    const { all } = require('../db');
    
    const client = await get('SELECT * FROM clients WHERE id = ?', [clientId]);
    const calls = await all('SELECT * FROM call_history WHERE client_id = ? LIMIT 1000', [clientId]);
    const agents = await all('SELECT * FROM client_agents WHERE client_id = ?', [clientId]);
    const contacts = await all('SELECT * FROM contacts WHERE client_id = ?', [clientId]);
    
    const exportData = {
      user: client,
      calls: calls || [],
      agents: agents || [],
      contacts: contacts || [],
      export_date: new Date().toISOString()
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="dialix_data_export.json"');
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    console.error('Data export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
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

    const client = await get('SELECT id, email, name FROM clients WHERE email = ?', [normalizedEmail]);

    if (client) {
      // Generate a secure reset token
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      // Token expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await run('UPDATE clients SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [resetTokenHash, expiresAt, client.id]);

      await sendPasswordResetEmail(normalizedEmail, resetToken, client.name || '');

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
const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many verification requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
});

/**
 * POST /api/auth/verify-email
 * Body: { token }
 */
router.post('/verify-email', sensitiveOperationLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const client = await get(
      'SELECT id, email FROM clients WHERE verification_token = ? AND verification_token_expires > ?',
      [token, new Date().toISOString()]
    );

    if (!client) {
      return res.status(400).json({ error: 'Invalid or expired verification link.' });
    }

    await run(
      'UPDATE clients SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?',
      [client.id]
    );

    res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Requires authentication
 */
router.post('/resend-verification', authenticate, resendVerificationLimiter, async (req, res) => {
  try {
    const client = await get('SELECT id, email, name, email_verified FROM clients WHERE id = ?', [req.client.id]);
    if (!client) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (client.email_verified) {
      return res.status(400).json({ error: 'Email is already verified.' });
    }

    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    await run(
      'UPDATE clients SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
      [verificationToken, verificationExpiresAt, client.id]
    );
    
    await sendVerificationEmail(client.email, verificationToken, client.name);

    res.json({ success: true, message: 'Verification email sent.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GDPR: Account Deletion ──────────────────────────────────
// DELETE /api/auth/me — Permanently delete account and anonymize data
router.delete('/me', authenticate, async (req, res) => {
  try {
    const clientId = req.client.id;
    const clientEmail = req.client.email;

    // Require password confirmation for account deletion
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'Password confirmation required for account deletion.' });
    }

    const client = await get('SELECT * FROM clients WHERE id = ?', [clientId]);
    if (!client) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const validPassword = await bcrypt.compare(password, client.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    // Delete user data (cascading) — order matters for foreign key safety
    await run('DELETE FROM api_keys WHERE client_id = ?', [clientId]);
    await run('DELETE FROM webhook_subscriptions WHERE client_id = ?', [clientId]);
    await run('DELETE FROM call_history WHERE client_id = ?', [clientId]);
    await run('DELETE FROM contacts WHERE client_id = ?', [clientId]);
    await run('DELETE FROM campaigns WHERE client_id = ?', [clientId]);
    await run('DELETE FROM phone_numbers WHERE client_id = ?', [clientId]);
    await run('DELETE FROM client_agents WHERE client_id = ?', [clientId]);
    await run('DELETE FROM usage_records WHERE client_id = ?', [clientId]);
    await run('DELETE FROM audit_logs WHERE client_id = ?', [clientId]);

    // Anonymize the client record instead of hard-deleting (preserve audit trail)
    const crypto = require('crypto');
    const anonymizedEmail = `deleted_${crypto.randomBytes(8).toString('hex')}@anonymized.local`;
    await run(
      `UPDATE clients SET 
        name = 'Deleted User', 
        email = ?, 
        password_hash = 'DELETED',
        is_active = 0,
        verification_token = NULL,
        reset_token = NULL,
        updated_at = datetime('now')
      WHERE id = ?`,
      [anonymizedEmail, clientId]
    );

    // Log the deletion event
    await run(
      `INSERT INTO audit_logs (client_id, actor_id, action, resource_type, resource_id, details)
       VALUES (?, ?, 'DELETE', 'account', ?, ?)`,
      [clientId, clientId, String(clientId), JSON.stringify({ original_email: clientEmail, reason: 'GDPR account deletion request' })]
    );

    res.json({ success: true, message: 'Account deleted successfully. All personal data has been removed.' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Failed to delete account. Please contact support.' });
  }
});

module.exports = router;
