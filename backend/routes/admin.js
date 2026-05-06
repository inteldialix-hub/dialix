const express = require('express');
const bcrypt = require('bcryptjs');
const { all, get, run } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateSchema } = require('../middleware/validate');
const {
  adminCreateClientSchema,
  adminUpdateClientSchema,
  adminAssignAgentSchema,
  adminUpdateAgentAssignmentSchema,
} = require('../lib/schemas');
const elevenlabs = require('../services/elevenlabs');
const securityLogger = require('../lib/security-logger');

const router = express.Router();
router.use(authenticate, requireAdmin);

// ═══════════════════════════════════════════════════════════════
// CLIENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/clients
 */
router.get('/clients', async (req, res) => {
  try {
    const clients = await all('SELECT id, name, email, is_admin, created_at FROM clients ORDER BY created_at DESC');

    const enriched = await Promise.all(clients.map(async (c) => {
      const result = await get('SELECT COUNT(*) as count FROM client_agents WHERE client_id = ?', [c.id]);
      return { ...c, agent_count: result?.count || 0 };
    }));

    res.json({ clients: enriched });
  } catch (err) {
    console.error('GET /api/admin/clients error:', err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

/**
 * POST /api/admin/clients
 */
router.post('/clients', validateSchema(adminCreateClientSchema), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await get('SELECT id FROM clients WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = await run(
      'INSERT INTO clients (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hash]
    );

    const client = await get(
      'SELECT id, name, email, is_admin, created_at FROM clients WHERE id = ?',
      [result.lastInsertRowid]
    );

    securityLogger.logAdminAction(req.client.email, 'create_client', { newClientId: client.id, newClientEmail: client.email }, req);
    res.status(201).json({ client });
  } catch (err) {
    console.error('POST /api/admin/clients error:', err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

/**
 * PATCH /api/admin/clients/:id
 * Update client name, email, or password
 */
router.patch('/clients/:id', validateSchema(adminUpdateClientSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    const client = await get('SELECT id, email FROM clients WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Check email uniqueness if changing email
    if (email && email !== client.email) {
      const existing = await get('SELECT id FROM clients WHERE email = ? AND id != ?', [email, id]);
      if (existing) {
        return res.status(409).json({ error: 'Email already in use by another client' });
      }
    }

    // Build dynamic query
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (email) { updates.push('email = ?'); params.push(email); }
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      updates.push('password_hash = ?');
      params.push(hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await run(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await get('SELECT id, name, email, is_admin, created_at FROM clients WHERE id = ?', [id]);
    res.json({ client: updated });
  } catch (err) {
    console.error('PATCH /api/admin/clients/:id error:', err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

/**
 * DELETE /api/admin/clients/:id
 * Cascade delete: removes client + all agent assignments
 */
router.delete('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const client = await get('SELECT id, name, is_admin FROM clients WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.client.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Prevent deleting other admins
    if (client.is_admin === 1) {
      return res.status(400).json({ error: 'Cannot delete admin accounts' });
    }

    // Cascade delete assignments
    const assignments = await run('DELETE FROM client_agents WHERE client_id = ?', [id]);
    const result = await run('DELETE FROM clients WHERE id = ?', [id]);

    securityLogger.logAdminAction(req.client.email, 'delete_client', {
      deletedClientId: id,
      deletedClientName: client.name,
      assignmentsRemoved: assignments.changes
    }, req);

    console.log(`Deleted client ${client.name} (id=${id}), removed ${assignments.changes} agent assignments`);

    res.json({
      success: true,
      client_name: client.name,
      assignments_removed: assignments.changes,
    });
  } catch (err) {
    console.error('DELETE /api/admin/clients/:id error:', err);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CLIENT ↔ AGENT ASSIGNMENTS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/clients/:id/agents
 */
router.get('/clients/:id/agents', async (req, res) => {
  try {
    const agents = await all(
      'SELECT * FROM client_agents WHERE client_id = ?',
      [req.params.id]
    );
    res.json({ agents });
  } catch (err) {
    console.error('GET /api/admin/clients/:id/agents error:', err);
    res.status(500).json({ error: 'Failed to fetch client agents' });
  }
});

/**
 * POST /api/admin/clients/:id/agents
 * Body: { agent_id, agent_name, can_edit? }
 * can_edit: 1 = client can edit agent config, 0 = view-only (default: 1)
 */
router.post('/clients/:id/agents', validateSchema(adminAssignAgentSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { agent_id, agent_name, can_edit, provider } = req.body;

    const client = await get('SELECT id FROM clients WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const existing = await get(
      'SELECT id FROM client_agents WHERE client_id = ? AND agent_id = ?',
      [id, agent_id]
    );
    if (existing) {
      return res.status(409).json({ error: 'Agent already assigned to this client' });
    }

    const editFlag = can_edit === false || can_edit === 0 ? 0 : 1;
    const agentProvider = provider || 'elevenlabs';
    await run(
      'INSERT INTO client_agents (client_id, agent_id, agent_name, can_edit, provider) VALUES (?, ?, ?, ?, ?)',
      [id, agent_id, agent_name, editFlag, agentProvider]
    );

    securityLogger.logAdminAction(req.client.email, 'assign_agent', {
      clientId: id,
      agentId: agent_id,
      agentName: agent_name,
      canEdit: editFlag
    }, req);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/clients/:id/agents error:', err);
    res.status(500).json({ error: 'Failed to assign agent' });
  }
});

/**
 * PATCH /api/admin/clients/:id/agents/:agent_id
 * Toggle can_edit permission for an existing assignment
 * Body: { can_edit: 0 | 1 }
 */
router.patch('/clients/:id/agents/:agent_id', validateSchema(adminUpdateAgentAssignmentSchema), async (req, res) => {
  try {
    const { id, agent_id } = req.params;
    const { can_edit, allowed_features } = req.body;

    // Build SET clause dynamically 
    const updates = [];
    const params = [];

    if (can_edit !== undefined) {
      updates.push('can_edit = ?');
      params.push(can_edit ? 1 : 0);
    }

    if (allowed_features !== undefined) {
      updates.push('allowed_features = ?');
      params.push(allowed_features === null ? null : JSON.stringify(allowed_features));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    params.push(id, agent_id);
    const result = await run(
      `UPDATE client_agents SET ${updates.join(', ')} WHERE client_id = ? AND agent_id = ?`,
      params
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/admin/clients/:id/agents/:agent_id error:', err);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

/**
 * DELETE /api/admin/clients/:id/agents/:agent_id
 */
router.delete('/clients/:id/agents/:agent_id', async (req, res) => {
  try {
    const { id, agent_id } = req.params;

    const result = await run(
      'DELETE FROM client_agents WHERE client_id = ? AND agent_id = ?',
      [id, agent_id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/clients/:id/agents/:agent_id error:', err);
    res.status(500).json({ error: 'Failed to unassign agent' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CONVERSATION MANAGEMENT (Admin)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/conversations/:conversation_id
 * Returns full conversation detail (transcript, analysis, metadata)
 * Works for both ElevenLabs and Vapi calls
 */
router.get('/conversations/:conversation_id', async (req, res) => {
  try {
    const { provider } = req.query; // ?provider=vapi
    if (provider === 'vapi') {
      const vapi = require('../services/vapi');
      const data = await vapi.getCall(req.params.conversation_id);
      return res.json({ conversation: data });
    }
    // Default: ElevenLabs
    const data = await elevenlabs.getConversation(req.params.conversation_id);
    res.json({ conversation: data });
  } catch (err) {
    console.error('GET /api/admin/conversations/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch conversation details' });
  }
});

/**
 * DELETE /api/admin/conversations/:conversation_id
 * Permanently deletes a conversation from ElevenLabs
 * (Vapi calls cannot be deleted via API)
 */
router.delete('/conversations/:conversation_id', async (req, res) => {
  try {
    await elevenlabs.deleteConversation(req.params.conversation_id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/conversations/:id error:', err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// ═══════════════════════════════════════════════════════════════
// VAPI ANALYTICS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/vapi/calls
 * List all Vapi calls, optionally filtered by assistantId
 * Query: ?assistantId=xxx&limit=100
 */
router.get('/vapi/calls', async (req, res) => {
  try {
    const vapi = require('../services/vapi');
    const { assistantId, limit } = req.query;
    const calls = await vapi.listCalls({
      assistantId,
      limit: limit ? parseInt(limit) : 100,
    });
    res.json({ calls, total: calls.length });
  } catch (err) {
    console.error('GET /api/admin/vapi/calls error:', err);
    res.status(500).json({ error: 'Failed to fetch Vapi calls' });
  }
});

/**
 * GET /api/admin/vapi/calls/:call_id
 * Full detail for a single Vapi call (transcript, recording, cost, analysis)
 */
router.get('/vapi/calls/:call_id', async (req, res) => {
  try {
    const vapi = require('../services/vapi');
    const data = await vapi.getCall(req.params.call_id);
    res.json({ call: data });
  } catch (err) {
    console.error('GET /api/admin/vapi/calls/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch Vapi call details' });
  }
});

/**
 * GET /api/admin/vapi/analytics/:assistant_id
 * Aggregated analytics for a Vapi assistant:
 * total calls, completed, failed, avg duration, total cost, call list
 */
router.get('/vapi/analytics/:assistant_id', async (req, res) => {
  try {
    const vapi = require('../services/vapi');
    const analytics = await vapi.getAssistantAnalytics(req.params.assistant_id);
    res.json({ analytics });
  } catch (err) {
    console.error('GET /api/admin/vapi/analytics/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch Vapi analytics' });
  }
});

/**
 * GET /api/admin/vapi/phone-numbers
 * List all phone numbers from the Vapi account
 */
router.get('/vapi/phone-numbers', async (req, res) => {
  try {
    const vapi = require('../services/vapi');
    const numbers = await vapi.listPhoneNumbers();
    res.json({ phoneNumbers: numbers, total: numbers.length });
  } catch (err) {
    console.error('GET /api/admin/vapi/phone-numbers error:', err);
    res.status(500).json({ error: 'Failed to fetch Vapi phone numbers' });
  }
});

module.exports = router;

