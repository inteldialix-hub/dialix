const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const { authenticate } = require('../middleware/auth');
const { validateSchema } = require('../middleware/validate');
const { createContactSchema, updateContactSchema, importContactsSchema } = require('../lib/schemas');

function normalizePhone(phone) {
  if (!phone) return null;
  let normalized = phone.replace(/[\s\-\(\)]/g, '');
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.substring(2);
  }
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  return /^\+[1-9]\d{1,14}$/.test(normalized) ? normalized : null;
}

// 1. GET /api/contacts
router.get('/', authenticate, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const tag = req.query.tag || '';
    const sort = req.query.sort || 'created_at';
    const order = (req.query.order || 'desc').toUpperCase();

    const sortColumns = ['first_name', 'last_name', 'company', 'created_at', 'status'];
    const validSort = sortColumns.includes(sort) ? sort : 'created_at';
    const validOrder = order === 'ASC' ? 'ASC' : 'DESC';

    let baseQuery = `FROM contacts WHERE client_id = ?`;
    const params = [req.user.client_id];

    if (search) {
      baseQuery += ` AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ? OR company LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    if (status) {
      baseQuery += ` AND status = ?`;
      params.push(status);
    }

    if (tag) {
      baseQuery += ` AND tags LIKE ?`;
      params.push(`%${tag}%`);
    }

    const countRow = get(`SELECT COUNT(*) as count ${baseQuery}`, params);
    const total = countRow ? countRow.count : 0;
    const totalPages = Math.ceil(total / limit);

    const query = `
      SELECT * ${baseQuery}
      ORDER BY ${validSort} ${validOrder}
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const rows = all(query, params);
    const contacts = rows.map(r => ({
      ...r,
      tags: JSON.parse(r.tags || '[]'),
      custom_fields: JSON.parse(r.custom_fields || '{}')
    }));

    res.json({ data: { contacts, total, page, limit, totalPages } });
  } catch (error) {
    console.error('List contacts error:', error);
    res.status(500).json({ error: 'Failed to retrieve contacts' });
  }
});

// 2. POST /api/contacts
router.post('/', authenticate, validateSchema(createContactSchema), (req, res) => {
  try {
    const data = req.body;
    const e164 = normalizePhone(data.phone);

    if (!e164) {
      return res.status(400).json({ error: 'Invalid phone format' });
    }

    const existing = get(`SELECT id FROM contacts WHERE client_id = ? AND phone_e164 = ?`, [req.user.client_id, e164]);
    if (existing) {
      return res.status(400).json({ error: 'Contact with this phone number already exists' });
    }

    const dnc = get(`SELECT id FROM dnc_list WHERE client_id = ? AND phone_e164 = ?`, [req.user.client_id, e164]);
    const do_not_call = dnc ? 1 : 0;

    const tagsStr = JSON.stringify(data.tags || []);
    const customFieldsStr = JSON.stringify(data.custom_fields || {});

    const result = run(`
      INSERT INTO contacts (
        client_id, first_name, last_name, company, phone, phone_e164, email, language, country,
        timezone, tags, status, consent_status, consent_source, source, notes, custom_fields, do_not_call
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.client_id, data.first_name, data.last_name || null, data.company || null,
      data.phone, e164, data.email || null, data.language || 'en', data.country || null,
      data.timezone || null, tagsStr, data.status || 'active', data.consent_status || 'unknown',
      data.consent_source || null, data.source || null, data.notes || null, customFieldsStr, do_not_call
    ]);

    const contact = get(`SELECT * FROM contacts WHERE id = ?`, [result.lastInsertRowid]);
    contact.tags = JSON.parse(contact.tags || '[]');
    contact.custom_fields = JSON.parse(contact.custom_fields || '{}');

    res.status(201).json({ data: contact });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// 3. GET /api/contacts/:id
router.get('/:id', authenticate, (req, res) => {
  try {
    const contact = get(`SELECT * FROM contacts WHERE id = ? AND client_id = ?`, [req.params.id, req.user.client_id]);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    contact.tags = JSON.parse(contact.tags || '[]');
    contact.custom_fields = JSON.parse(contact.custom_fields || '{}');
    res.json({ data: contact });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Failed to retrieve contact' });
  }
});

// 4. PUT /api/contacts/:id
router.put('/:id', authenticate, validateSchema(updateContactSchema), (req, res) => {
  try {
    const id = req.params.id;
    const client_id = req.user.client_id;
    const data = req.body;

    const existing = get(`SELECT * FROM contacts WHERE id = ? AND client_id = ?`, [id, client_id]);
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const updates = [];
    const params = [];

    if (data.phone) {
      const e164 = normalizePhone(data.phone);
      if (!e164) {
        return res.status(400).json({ error: 'Invalid phone format' });
      }
      const phoneExists = get(`SELECT id FROM contacts WHERE client_id = ? AND phone_e164 = ? AND id != ?`, [client_id, e164, id]);
      if (phoneExists) {
        return res.status(400).json({ error: 'Phone number already exists for another contact' });
      }
      updates.push('phone = ?', 'phone_e164 = ?');
      params.push(data.phone, e164);
    }

    const fields = ['first_name', 'last_name', 'company', 'email', 'language', 'country', 'timezone', 'status', 'consent_status', 'consent_source', 'source', 'notes'];
    for (const f of fields) {
      if (data[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(data[f]);
      }
    }

    if (data.tags) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags));
    }
    if (data.custom_fields) {
      updates.push('custom_fields = ?');
      params.push(JSON.stringify(data.custom_fields));
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      const query = `UPDATE contacts SET ${updates.join(', ')} WHERE id = ? AND client_id = ?`;
      params.push(id, client_id);
      run(query, params);
    }

    const contact = get(`SELECT * FROM contacts WHERE id = ?`, [id]);
    contact.tags = JSON.parse(contact.tags || '[]');
    contact.custom_fields = JSON.parse(contact.custom_fields || '{}');
    res.json({ data: contact });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// 5. DELETE /api/contacts/:id
router.delete('/:id', authenticate, (req, res) => {
  try {
    const result = run(`DELETE FROM contacts WHERE id = ? AND client_id = ?`, [req.params.id, req.user.client_id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ data: { success: true } });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// 6. POST /api/contacts/import
router.post('/import', authenticate, validateSchema(importContactsSchema), (req, res) => {
  try {
    const { rows, column_mapping } = req.body;
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let invalid = 0;
    let dnc_excluded = 0;
    const errors = [];

    // Simple mapping support if provided, otherwise assume keys match
    const getVal = (row, key) => {
      const mapKey = column_mapping && column_mapping[key] ? column_mapping[key] : key;
      return row[mapKey] || null;
    };

    run('BEGIN TRANSACTION');

    for (const [index, row] of rows.entries()) {
      const first_name = getVal(row, 'first_name');
      const phone = getVal(row, 'phone');

      if (!first_name || !phone) {
        invalid++;
        errors.push(`Row ${index + 1}: Missing first_name or phone`);
        continue;
      }

      const e164 = normalizePhone(phone);
      if (!e164) {
        invalid++;
        errors.push(`Row ${index + 1}: Invalid phone format`);
        continue;
      }

      const dnc = get(`SELECT id FROM dnc_list WHERE client_id = ? AND phone_e164 = ?`, [req.user.client_id, e164]);
      if (dnc) {
        dnc_excluded++;
        continue;
      }

      const existing = get(`SELECT id FROM contacts WHERE client_id = ? AND phone_e164 = ?`, [req.user.client_id, e164]);
      
      const last_name = getVal(row, 'last_name');
      const company = getVal(row, 'company');
      const email = getVal(row, 'email');
      
      if (existing) {
        run(`UPDATE contacts SET first_name = ?, last_name = ?, company = ?, email = ?, updated_at = datetime('now') WHERE id = ?`, 
          [first_name, last_name, company, email, existing.id]);
        updated++;
      } else {
        run(`INSERT INTO contacts (client_id, first_name, last_name, company, phone, phone_e164, email) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [req.user.client_id, first_name, last_name, company, phone, e164, email]);
        imported++;
      }
    }

    run('COMMIT');
    res.json({ data: { imported, updated, skipped, invalid, dnc_excluded, errors } });
  } catch (error) {
    run('ROLLBACK');
    console.error('Import contacts error:', error);
    res.status(500).json({ error: 'Failed to import contacts' });
  }
});

// 7. GET /api/contacts/export
router.get('/export', authenticate, (req, res) => {
  try {
    const search = req.query.search || '';
    const status = req.query.status || '';
    
    let baseQuery = `FROM contacts WHERE client_id = ?`;
    const params = [req.user.client_id];

    if (search) {
      baseQuery += ` AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ? OR company LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    if (status) {
      baseQuery += ` AND status = ?`;
      params.push(status);
    }

    const rows = all(`SELECT * ${baseQuery} ORDER BY created_at DESC`, params);
    
    // Create simple CSV
    if (rows.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
      return res.send('first_name,last_name,phone,email,company,status\n');
    }

    const fields = ['id', 'first_name', 'last_name', 'phone', 'email', 'company', 'status', 'created_at'];
    let csv = fields.join(',') + '\n';
    
    for (const r of rows) {
      const line = fields.map(f => {
        let val = r[f];
        if (val === null || val === undefined) return '';
        val = String(val).replace(/"/g, '""');
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val}"`;
        }
        return val;
      }).join(',');
      csv += line + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Export contacts error:', error);
    res.status(500).json({ error: 'Failed to export contacts' });
  }
});

// 8. POST /api/contacts/bulk-delete
router.post('/bulk-delete', authenticate, (req, res) => {
  try {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const params = [...ids, req.user.client_id];
    
    const result = run(`DELETE FROM contacts WHERE id IN (${placeholders}) AND client_id = ?`, params);
    
    res.json({ data: { deleted: result.changes } });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to delete contacts' });
  }
});

// 9. POST /api/contacts/:id/dnc
router.post('/:id/dnc', authenticate, (req, res) => {
  try {
    const id = req.params.id;
    const client_id = req.user.client_id;
    
    const contact = get(`SELECT * FROM contacts WHERE id = ? AND client_id = ?`, [id, client_id]);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (contact.do_not_call) {
      return res.json({ data: { success: true, message: 'Already marked as DNC' } });
    }

    run('BEGIN TRANSACTION');
    
    run(`UPDATE contacts SET do_not_call = 1, dnc_at = datetime('now') WHERE id = ?`, [id]);
    
    const existingDnc = get(`SELECT id FROM dnc_list WHERE client_id = ? AND phone_e164 = ?`, [client_id, contact.phone_e164]);
    if (!existingDnc) {
      run(`INSERT INTO dnc_list (client_id, phone_e164, reason, source, actor) VALUES (?, ?, ?, ?, ?)`,
        [client_id, contact.phone_e164, req.body.reason || 'Manual entry via Contacts', 'manual', req.user.email]);
    }
    
    run('COMMIT');
    res.json({ data: { success: true } });
  } catch (error) {
    run('ROLLBACK');
    console.error('Mark DNC error:', error);
    res.status(500).json({ error: 'Failed to mark as DNC' });
  }
});

// 10. DELETE /api/contacts/:id/dnc
router.delete('/:id/dnc', authenticate, (req, res) => {
  try {
    const id = req.params.id;
    const client_id = req.user.client_id;
    
    const contact = get(`SELECT * FROM contacts WHERE id = ? AND client_id = ?`, [id, client_id]);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    run('BEGIN TRANSACTION');
    
    run(`UPDATE contacts SET do_not_call = 0, dnc_at = NULL WHERE id = ?`, [id]);
    
    run(`DELETE FROM dnc_list WHERE client_id = ? AND phone_e164 = ?`, [client_id, contact.phone_e164]);
    
    run('COMMIT');
    res.json({ data: { success: true } });
  } catch (error) {
    run('ROLLBACK');
    console.error('Remove DNC error:', error);
    res.status(500).json({ error: 'Failed to remove DNC' });
  }
});

module.exports = router;
