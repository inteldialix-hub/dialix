const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const { authenticate } = require('../middleware/auth');
const { parsePhoneNumber } = require('libphonenumber-js');
const { enforceLimit } = require('../services/entitlements');
const { validateSchema } = require('../middleware/validate');
const { createContactSchema, updateContactSchema, importContactsSchema } = require('../lib/schemas');

function normalizePhone(phone) {
  if (!phone) return null;
  let normalized = String(phone).replace(/[\s\-\(\)]/g, '');
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.substring(2);
  }
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  return /^\+[1-9]\d{1,14}$/.test(normalized) ? normalized : null;
}

function parseJsonSafe(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// 1. GET /api/contacts - List contacts with pagination, search, filters
router.get('/', authenticate, async (req, res) => {
  try {
    const clientId = req.user?.client_id || req.client?.id;
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
    const params = [clientId];

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

    const countRow = await get(`SELECT COUNT(*) as count ${baseQuery}`, params);
    const total = Number(countRow?.count || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    const query = `
      SELECT * ${baseQuery}
      ORDER BY ${validSort} ${validOrder}
      LIMIT ? OFFSET ?
    `;
    const rowsParams = [...params, limit, offset];

    const rows = await all(query, rowsParams);
    const contacts = (rows || []).map(r => ({
      ...r,
      tags: parseJsonSafe(r.tags, []),
      custom_fields: parseJsonSafe(r.custom_fields, {})
    }));

    res.json({ data: { contacts, total, page, limit, totalPages } });
  } catch (error) {
    console.error('List contacts error:', error);
    res.status(500).json({ error: 'Failed to retrieve contacts' });
  }
});

// 2. POST /api/contacts - Create single contact
router.post('/', authenticate, validateSchema(createContactSchema), async (req, res) => {
  try {
    const clientId = req.user?.client_id || req.client?.id;
    if (req.user?.is_admin !== 1) {
      await enforceLimit(clientId, 'contacts');
    }
    const data = req.body;
    const e164 = normalizePhone(data.phone);

    if (!e164) {
      return res.status(400).json({ error: 'Invalid phone format' });
    }

    const existing = await get(`SELECT id FROM contacts WHERE client_id = ? AND phone_e164 = ?`, [clientId, e164]);
    if (existing) {
      return res.status(400).json({ error: 'Contact with this phone number already exists' });
    }

    const dnc = await get(`SELECT id FROM dnc_list WHERE client_id = ? AND phone_e164 = ?`, [clientId, e164]);
    const do_not_call = dnc ? 1 : 0;

    const tagsStr = JSON.stringify(data.tags || []);
    const customFieldsStr = JSON.stringify(data.custom_fields || {});

    const result = await run(`
      INSERT INTO contacts (
        client_id, first_name, last_name, company, phone, phone_e164, email, language, country,
        timezone, tags, status, consent_status, consent_source, source, notes, custom_fields, do_not_call
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      clientId, data.first_name, data.last_name || null, data.company || null,
      data.phone, e164, data.email || null, data.language || 'en', data.country || null,
      data.timezone || null, tagsStr, data.status || 'active', data.consent_status || 'unknown',
      data.consent_source || null, data.source || null, data.notes || null, customFieldsStr, do_not_call
    ]);

    const contact = await get(`SELECT * FROM contacts WHERE id = ?`, [result.lastInsertRowid]);
    if (contact) {
      contact.tags = parseJsonSafe(contact.tags, []);
      contact.custom_fields = parseJsonSafe(contact.custom_fields, {});
    }

    res.status(201).json({ data: contact });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// 3. GET /api/contacts/:id - Get single contact
router.get('/:id', authenticate, async (req, res) => {
  try {
    const clientId = req.user?.client_id || req.client?.id;
    const contact = await get(`SELECT * FROM contacts WHERE id = ? AND client_id = ?`, [req.params.id, clientId]);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    contact.tags = parseJsonSafe(contact.tags, []);
    contact.custom_fields = parseJsonSafe(contact.custom_fields, {});
    res.json({ data: contact });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Failed to retrieve contact' });
  }
});

// 4. PUT /api/contacts/:id - Update contact
router.put('/:id', authenticate, validateSchema(updateContactSchema), async (req, res) => {
  try {
    const id = req.params.id;
    const clientId = req.user?.client_id || req.client?.id;
    const data = req.body;

    const existing = await get(`SELECT * FROM contacts WHERE id = ? AND client_id = ?`, [id, clientId]);
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
      const phoneExists = await get(`SELECT id FROM contacts WHERE client_id = ? AND phone_e164 = ? AND id != ?`, [clientId, e164, id]);
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

    if (data.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags || []));
    }
    if (data.custom_fields !== undefined) {
      updates.push('custom_fields = ?');
      params.push(JSON.stringify(data.custom_fields || {}));
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      const query = `UPDATE contacts SET ${updates.join(', ')} WHERE id = ? AND client_id = ?`;
      params.push(id, clientId);
      await run(query, params);
    }

    const contact = await get(`SELECT * FROM contacts WHERE id = ?`, [id]);
    if (contact) {
      contact.tags = parseJsonSafe(contact.tags, []);
      contact.custom_fields = parseJsonSafe(contact.custom_fields, {});
    }
    res.json({ data: contact });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// 5. DELETE /api/contacts/:id - Delete contact
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const clientId = req.user?.client_id || req.client?.id;
    const result = await run(`DELETE FROM contacts WHERE id = ? AND client_id = ?`, [req.params.id, clientId]);
    if (!result || result.changes === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ data: { success: true } });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// 6. POST /api/contacts/import - Bulk import CSV contacts
router.post('/import', authenticate, validateSchema(importContactsSchema), async (req, res) => {
  try {
    const clientId = req.user?.client_id || req.client?.id;
    if (req.user?.is_admin !== 1) {
      await enforceLimit(clientId, 'contacts');
    }
    const { rows, column_mapping } = req.body;
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let invalid = 0;
    let dnc_excluded = 0;
    const errors = [];

    const getVal = (row, key) => {
      const mapKey = column_mapping && column_mapping[key] ? column_mapping[key] : key;
      return row[mapKey] || null;
    };

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
        errors.push(`Row ${index + 1}: Invalid phone format (${phone})`);
        continue;
      }

      const dnc = await get(`SELECT id FROM dnc_list WHERE client_id = ? AND phone_e164 = ?`, [clientId, e164]);
      if (dnc) {
        dnc_excluded++;
        continue;
      }

      const existing = await get(`SELECT id FROM contacts WHERE client_id = ? AND phone_e164 = ?`, [clientId, e164]);
      
      const last_name = getVal(row, 'last_name');
      const company = getVal(row, 'company');
      const email = getVal(row, 'email');
      
      if (existing) {
        await run(`UPDATE contacts SET first_name = ?, last_name = ?, company = ?, email = ?, updated_at = datetime('now') WHERE id = ?`, 
          [first_name, last_name, company, email, existing.id]);
        updated++;
      } else {
        await run(`INSERT INTO contacts (client_id, first_name, last_name, company, phone, phone_e164, email) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [clientId, first_name, last_name, company, phone, e164, email]);
        imported++;
      }
    }

    res.json({ data: { imported, updated, skipped, invalid, dnc_excluded, errors } });
  } catch (error) {
    console.error('Import contacts error:', error);
    res.status(500).json({ error: 'Failed to import contacts' });
  }
});

// 7. GET /api/contacts/export - Export contacts as CSV
router.get('/export', authenticate, async (req, res) => {
  try {
    const clientId = req.user?.client_id || req.client?.id;
    const search = req.query.search || '';
    const status = req.query.status || '';
    
    let baseQuery = `FROM contacts WHERE client_id = ?`;
    const params = [clientId];

    if (search) {
      baseQuery += ` AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ? OR company LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    if (status) {
      baseQuery += ` AND status = ?`;
      params.push(status);
    }

    const rows = await all(`SELECT * ${baseQuery} ORDER BY created_at DESC`, params);
    
    if (!rows || rows.length === 0) {
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

// 8. POST /api/contacts/bulk-delete - Bulk delete contacts
router.post('/bulk-delete', authenticate, async (req, res) => {
  try {
    const clientId = req.user?.client_id || req.client?.id;
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const params = [...ids, clientId];
    
    const result = await run(`DELETE FROM contacts WHERE id IN (${placeholders}) AND client_id = ?`, params);
    
    res.json({ data: { deleted: result?.changes || 0 } });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to delete contacts' });
  }
});

// 9. POST /api/contacts/:id/dnc - Mark contact as Do Not Call
router.post('/:id/dnc', authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    const clientId = req.user?.client_id || req.client?.id;
    
    const contact = await get(`SELECT * FROM contacts WHERE id = ? AND client_id = ?`, [id, clientId]);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (contact.do_not_call) {
      return res.json({ data: { success: true, message: 'Already marked as DNC' } });
    }

    await run(`UPDATE contacts SET do_not_call = 1, dnc_at = datetime('now') WHERE id = ?`, [id]);
    
    const existingDnc = await get(`SELECT id FROM dnc_list WHERE client_id = ? AND phone_e164 = ?`, [clientId, contact.phone_e164]);
    if (!existingDnc) {
      await run(`INSERT INTO dnc_list (client_id, phone_e164, reason, source, actor) VALUES (?, ?, ?, ?, ?)`,
        [clientId, contact.phone_e164, req.body.reason || 'Manual entry via Contacts', 'manual', req.user?.email || 'admin']);
    }
    
    res.json({ data: { success: true } });
  } catch (error) {
    console.error('Mark DNC error:', error);
    res.status(500).json({ error: 'Failed to mark as DNC' });
  }
});

// 10. DELETE /api/contacts/:id/dnc - Remove Do Not Call flag
router.delete('/:id/dnc', authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    const clientId = req.user?.client_id || req.client?.id;
    
    const contact = await get(`SELECT * FROM contacts WHERE id = ? AND client_id = ?`, [id, clientId]);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await run(`UPDATE contacts SET do_not_call = 0, dnc_at = NULL WHERE id = ?`, [id]);
    await run(`DELETE FROM dnc_list WHERE client_id = ? AND phone_e164 = ?`, [clientId, contact.phone_e164]);
    
    res.json({ data: { success: true } });
  } catch (error) {
    console.error('Remove DNC error:', error);
    res.status(500).json({ error: 'Failed to remove DNC' });
  }
});

module.exports = router;
