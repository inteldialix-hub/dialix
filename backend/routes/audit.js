const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

function logAudit(clientId, actorEmail, action, resourceType, resourceId, details, ipAddress) {
  try {
    run(
      `INSERT INTO audit_logs (client_id, actor_email, action, resource_type, resource_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [clientId, actorEmail, action, resourceType, resourceId ? String(resourceId) : null, details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null, ipAddress || null]
    ).catch(err => console.error('Failed to write audit log async:', err.message));
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

router.use(authenticate);

// GET / - List audit logs for current client
router.get('/', async (req, res) => {
  try {
    const clientId = req.client?.id || req.user?.client_id || req.user?.id;
    const { action, resource_type, start_date, end_date, page = 1, limit = 50, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = 'SELECT * FROM audit_logs WHERE client_id = ?';
    const params = [clientId];

    if (action && action !== 'ALL') {
      query += ' AND action = ?';
      params.push(action);
    }
    if (resource_type) {
      query += ' AND resource_type = ?';
      params.push(resource_type);
    }
    if (search) {
      query += ' AND (action ILIKE ? OR actor_email ILIKE ? OR resource_type ILIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (start_date) {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND created_at <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const rows = await all(query, params);
    
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE client_id = ?';
    const countParams = [clientId];
    
    if (action && action !== 'ALL') { countQuery += ' AND action = ?'; countParams.push(action); }
    if (resource_type) { countQuery += ' AND resource_type = ?'; countParams.push(resource_type); }
    if (search) {
      countQuery += ' AND (action ILIKE ? OR actor_email ILIKE ? OR resource_type ILIKE ?)';
      const term = `%${search}%`;
      countParams.push(term, term, term);
    }
    if (start_date) { countQuery += ' AND created_at >= ?'; countParams.push(start_date); }
    if (end_date) { countQuery += ' AND created_at <= ?'; countParams.push(end_date); }

    const countRes = await get(countQuery, countParams);
    const total = Number(countRes?.total || 0);

    const logs = (rows || []).map(l => ({
      id: l.id,
      timestamp: l.created_at,
      created_at: l.created_at,
      actorEmail: l.actor_email || 'System',
      actor_email: l.actor_email || 'System',
      action: l.action,
      resourceType: l.resource_type || '',
      resource_type: l.resource_type || '',
      resourceId: l.resource_id,
      details: typeof l.details === 'string' ? (() => { try { return JSON.parse(l.details); } catch { return l.details; } })() : l.details,
      ip_address: l.ip_address
    }));

    res.json({
      logs,
      data: logs,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /admin - Admin-only list all audit logs
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const rows = await all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?', [Number(limit), Number(offset)]);
    const countRes = await get('SELECT COUNT(*) as total FROM audit_logs');
    const total = Number(countRes?.total || 0);

    const logs = (rows || []).map(l => ({
      id: l.id,
      timestamp: l.created_at,
      created_at: l.created_at,
      actorEmail: l.actor_email || 'System',
      actor_email: l.actor_email || 'System',
      action: l.action,
      resourceType: l.resource_type || '',
      resource_type: l.resource_type || '',
      resourceId: l.resource_id,
      details: typeof l.details === 'string' ? (() => { try { return JSON.parse(l.details); } catch { return l.details; } })() : l.details,
      ip_address: l.ip_address
    }));

    res.json({
      logs,
      data: logs,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1
    });
  } catch (error) {
    console.error('Error fetching all audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

router.logAudit = logAudit;
module.exports = router;
