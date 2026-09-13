const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { all, get, run } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const BUG_INBOX_PATH = path.join(__dirname, '..', '..', 'agent_bug_inbox.json');

/**
 * Helper to update agent_bug_inbox.json file
 */
function recordToBugInbox(entry) {
  try {
    let inbox = [];
    if (fs.existsSync(BUG_INBOX_PATH)) {
      try {
        const raw = fs.readFileSync(BUG_INBOX_PATH, 'utf8');
        inbox = JSON.parse(raw);
        if (!Array.isArray(inbox)) inbox = [];
      } catch (err) {
        inbox = [];
      }
    }

    inbox.unshift(entry);
    // Keep the most recent 200 bug reports
    if (inbox.length > 200) {
      inbox = inbox.slice(0, 200);
    }

    fs.writeFileSync(BUG_INBOX_PATH, JSON.stringify(inbox, null, 2), 'utf8');
  } catch (err) {
    console.error('[Telemetry] Failed to write to agent_bug_inbox.json:', err.message);
  }
}

/**
 * Helper to mark bug as resolved in agent_bug_inbox.json
 */
function markBugResolvedInFile(bugId) {
  try {
    if (!fs.existsSync(BUG_INBOX_PATH)) return;
    const raw = fs.readFileSync(BUG_INBOX_PATH, 'utf8');
    let inbox = JSON.parse(raw);
    if (!Array.isArray(inbox)) return;

    inbox = inbox.map(item => {
      if (String(item.id) === String(bugId)) {
        return { ...item, status: 'resolved', resolved_at: new Date().toISOString() };
      }
      return item;
    });

    fs.writeFileSync(BUG_INBOX_PATH, JSON.stringify(inbox, null, 2), 'utf8');
  } catch (err) {
    console.error('[Telemetry] Failed to update bug in inbox file:', err.message);
  }
}

/**
 * POST /api/telemetry/errors
 * Open endpoint (or optionally authenticated) to capture UI and runtime crashes.
 */
router.post('/errors', async (req, res) => {
  try {
    let clientId = null;

    // Try extracting clientId from Authorization header if present
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ') && JWT_SECRET) {
      try {
        const token = header.slice(7);
        const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        if (payload && payload.clientId) {
          clientId = payload.clientId;
        }
      } catch {
        // Unauthenticated or invalid token, proceed with clientId = null
      }
    }

    if (!clientId && req.body.client_id) {
      clientId = parseInt(req.body.client_id) || null;
    }

    const errorMessage = String(req.body.error_message || req.body.message || 'Unknown runtime error').slice(0, 2000);
    const stackTrace = req.body.stack_trace ? String(req.body.stack_trace).slice(0, 10000) : null;
    const componentName = req.body.component_name ? String(req.body.component_name).slice(0, 255) : null;
    const url = req.body.url ? String(req.body.url).slice(0, 1000) : (req.headers.referer || null);
    const userAgent = req.body.user_agent ? String(req.body.user_agent).slice(0, 500) : (req.headers['user-agent'] || null);

    const result = await run(
      `INSERT INTO system_error_logs (
        client_id, error_message, stack_trace, component_name, url, user_agent, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'unresolved', datetime('now'))`,
      [clientId, errorMessage, stackTrace, componentName, url, userAgent]
    );

    const bugId = result.lastInsertRowid || Date.now();

    const inboxEntry = {
      id: bugId,
      client_id: clientId,
      error_message: errorMessage,
      stack_trace: stackTrace,
      component_name: componentName,
      url,
      user_agent: userAgent,
      status: 'unresolved',
      created_at: new Date().toISOString(),
    };

    recordToBugInbox(inboxEntry);

    console.warn(`[Telemetry] Captured error #${bugId}: ${errorMessage.slice(0, 120)}`);

    res.status(201).json({ success: true, id: bugId });
  } catch (err) {
    console.error('[Telemetry] Error logging failure:', err.message);
    res.status(500).json({ error: 'Failed to record telemetry error' });
  }
});

/**
 * GET /api/telemetry/errors
 * List captured runtime errors for admin or current client.
 */
router.get('/errors', authenticate, async (req, res) => {
  try {
    const isAdmin = req.client?.is_admin === 1;
    const clientId = req.client.id;
    const { status, limit = 50 } = req.query;
    const numLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);

    let query = 'SELECT * FROM system_error_logs WHERE 1=1';
    const params = [];

    if (!isAdmin) {
      query += ' AND (client_id = ? OR client_id IS NULL)';
      params.push(clientId);
    }

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(numLimit);

    const errors = await all(query, params);

    const total = errors.length;
    const open = errors.filter(e => e.status === 'unresolved' || e.status === 'open').length;
    const inInvestigation = errors.filter(e => e.status === 'in_investigation' || e.status === 'assigned_to_agent').length;
    const resolved = errors.filter(e => e.status === 'resolved').length;

    res.json({
      success: true,
      errors,
      summary: { total, open, in_investigation: inInvestigation, resolved }
    });
  } catch (err) {
    console.error('GET /api/telemetry/errors error:', err);
    res.status(500).json({ error: 'Failed to fetch telemetry errors' });
  }
});

/**
 * POST /api/telemetry/errors/:id/resolve
 * Mark an error as resolved.
 */
router.post('/errors/:id/resolve', authenticate, async (req, res) => {
  try {
    const errorId = req.params.id;
    const isAdmin = req.client?.is_admin === 1;

    let checkQuery = 'SELECT * FROM system_error_logs WHERE id = ?';
    const checkParams = [errorId];
    if (!isAdmin) {
      checkQuery += ' AND client_id = ?';
      checkParams.push(req.client.id);
    }

    const existing = await get(checkQuery, checkParams);
    if (!existing) {
      return res.status(404).json({ error: 'Error log not found' });
    }

    await run("UPDATE system_error_logs SET status = 'resolved' WHERE id = ?", [errorId]);
    markBugResolvedInFile(errorId);

    res.json({ success: true, status: 'resolved' });
  } catch (err) {
    console.error('POST /api/telemetry/errors/:id/resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve error log' });
  }
});

/**
 * POST /api/telemetry/errors/:id/dispatch
 * Dispatch bug to AI agent fixing queue
 */
router.post('/errors/:id/dispatch', authenticate, async (req, res) => {
  try {
    const errorId = req.params.id;
    const existing = await get('SELECT * FROM system_error_logs WHERE id = ?', [errorId]);
    if (!existing) {
      return res.status(404).json({ error: 'Error log not found' });
    }

    await run("UPDATE system_error_logs SET status = 'in_investigation' WHERE id = ?", [errorId]);

    res.json({
      success: true,
      status: 'in_investigation',
      message: 'Bug dispatched to AI agent queue for automated reproduction & fix analysis'
    });
  } catch (err) {
    console.error('POST /api/telemetry/errors/:id/dispatch error:', err);
    res.status(500).json({ error: 'Failed to dispatch bug fix' });
  }
});

module.exports = router;
