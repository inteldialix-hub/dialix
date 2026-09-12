const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

function logAudit(clientId, actorEmail, action, resourceType, resourceId, details, ipAddress) {
  try {
    run(
      `INSERT INTO audit_logs (client_id, actor_email, action, resource_type, resource_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [clientId, actorEmail, action, resourceType, resourceId, details ? JSON.stringify(details) : null, ipAddress || null]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

router.use(authenticate);

// GET / - List audit logs for current client
router.get('/', (req, res) => {
  try {
    const { client_id } = req.user;
    const { action, resource_type, start_date, end_date, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM audit_logs WHERE client_id = ?';
    const params = [client_id];

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }
    if (resource_type) {
      query += ' AND resource_type = ?';
      params.push(resource_type);
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

    const logs = all(query, params);
    
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE client_id = ?';
    const countParams = [client_id];
    
    if (action) { countQuery += ' AND action = ?'; countParams.push(action); }
    if (resource_type) { countQuery += ' AND resource_type = ?'; countParams.push(resource_type); }
    if (start_date) { countQuery += ' AND created_at >= ?'; countParams.push(start_date); }
    if (end_date) { countQuery += ' AND created_at <= ?'; countParams.push(end_date); }

    const total = get(countQuery, countParams).total;

    res.json({ data: { logs, total, page: Number(page), limit: Number(limit) } });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /admin - Admin-only list all audit logs
router.get('/admin', requireAdmin, (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const logs = all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?', [Number(limit), Number(offset)]);
    const total = get('SELECT COUNT(*) as total FROM audit_logs').total;

    res.json({ data: { logs, total, page: Number(page), limit: Number(limit) } });
  } catch (error) {
    console.error('Error fetching all audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

router.logAudit = logAudit;
module.exports = router;
