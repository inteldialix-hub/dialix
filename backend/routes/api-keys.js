const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const { authenticate } = require('../middleware/auth');
const crypto = require('crypto');
const { z } = require('zod');

router.use(authenticate);

const availableScopes = [
  'calls:read', 'calls:create',
  'agents:read', 'agents:write',
  'contacts:read', 'contacts:write',
  'campaigns:read', 'campaigns:write',
  'webhooks:read', 'webhooks:write'
];

const apiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.enum([
    'calls:read', 'calls:create',
    'agents:read', 'agents:write',
    'contacts:read', 'contacts:write',
    'campaigns:read', 'campaigns:write',
    'webhooks:read', 'webhooks:write'
  ]))
});

// GET /scopes
router.get('/scopes', (req, res) => {
  res.json({ data: availableScopes });
});

// GET / - List API keys
router.get('/', async (req, res) => {
  try {
    const { client_id } = req.user;
    const keys = await all(
      'SELECT id, name, key_prefix, scopes, last_used_at, expires_at, revoked, created_at FROM api_keys WHERE client_id = ? AND revoked = 0 ORDER BY created_at DESC',
      [client_id]
    );
    
    // Parse scopes
    const formattedKeys = (keys || []).map(k => ({
      ...k,
      prefix: k.key_prefix,
      scopes: k.scopes ? (typeof k.scopes === 'string' ? JSON.parse(k.scopes) : k.scopes) : []
    }));
    
    res.json({ data: formattedKeys, keys: formattedKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// POST / - Create API key
router.post('/', async (req, res) => {
  try {
    const { client_id, email } = req.user;
    const parsed = apiKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    const { name, scopes } = parsed.data;

    // Generate key
    const rawKey = 'dlx_sk_' + crypto.randomBytes(16).toString('hex');
    const keyPrefix = rawKey.substring(0, 10) + '...';
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const result = await run(
      `INSERT INTO api_keys (client_id, name, key_hash, key_prefix, scopes, revoked, created_at)
       VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`,
      [client_id, name, keyHash, keyPrefix, JSON.stringify(scopes)]
    );

    // Audit log
    const { logAudit } = require('./audit');
    if (logAudit) {
      logAudit(client_id, email, 'create', 'api_key', result.lastInsertRowid, { name, scopes }, req.ip);
    }

    res.status(201).json({ 
      message: 'API key created successfully',
      key: rawKey,
      api_key: rawKey,
      data: {
        id: result.lastInsertRowid,
        name,
        prefix: keyPrefix,
        key_prefix: keyPrefix,
        scopes,
        raw_key: rawKey, // Only returned once!
        key: rawKey,
      }
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// DELETE /:id - Revoke API key
router.delete('/:id', async (req, res) => {
  try {
    const { client_id, email } = req.user;
    const keyId = req.params.id;

    const key = await get('SELECT * FROM api_keys WHERE id = ? AND client_id = ?', [keyId, client_id]);
    if (!key) return res.status(404).json({ error: 'API key not found' });
    if (key.revoked) return res.status(400).json({ error: 'API key is already revoked' });

    await run('UPDATE api_keys SET revoked = 1 WHERE id = ?', [keyId]);

    // Audit log
    const { logAudit } = require('./audit');
    if (logAudit) {
      logAudit(client_id, email, 'revoke', 'api_key', keyId, { name: key.name }, req.ip);
    }

    res.json({ data: { success: true } });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

module.exports = router;
