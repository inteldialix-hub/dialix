const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');

// Rate limiter for action routes
const actionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10,
  message: { error: 'Too many requests, please try again later.' }
});

router.use(authenticate);

const campaignSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  agent_id: z.union([z.string(), z.number()]).optional().nullable(),
  phone_number_id: z.union([z.string(), z.number()]).optional().nullable(),
  contact_list: z.array(z.union([z.string(), z.number()])).optional().nullable(),
  schedule_start: z.string().optional().nullable(),
  schedule_end: z.string().optional().nullable(),
  calling_days: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  calling_start_time: z.string().optional().nullable(),
  calling_end_time: z.string().optional().nullable(),
  calling_timezone: z.string().optional().nullable(),
  max_concurrent: z.number().optional().nullable(),
  max_calls_per_hour: z.number().optional().nullable(),
  max_retries: z.number().optional().nullable(),
  retry_delay_minutes: z.number().optional().nullable(),
  goal: z.string().optional().nullable()
});

// GET / - List campaigns
router.get('/', async (req, res) => {
  try {
    const { client_id } = req.user;
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM campaigns WHERE client_id = ?';
    const params = [client_id];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const campaigns = await all(query, params);
    
    let countQuery = 'SELECT COUNT(*) as total FROM campaigns WHERE client_id = ?';
    const countParams = [client_id];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    const countRow = await get(countQuery, countParams);
    const total = countRow?.total || 0;

    res.json({ data: { campaigns: campaigns || [], total, page: Number(page), limit: Number(limit) } });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// POST / - Create campaign
router.post('/', async (req, res) => {
  try {
    const { client_id } = req.user;
    const parsed = campaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    const data = parsed.data;
    const callingDaysStr = Array.isArray(data.calling_days)
      ? JSON.stringify(data.calling_days)
      : (data.calling_days || '["mon","tue","wed","thu","fri"]');

    const result = await run(
      `INSERT INTO campaigns (
        client_id, name, description, agent_id, phone_number_id, status, contact_list, 
        total_contacts, valid_contacts, dnc_excluded, calls_completed, calls_answered, calls_failed, 
        schedule_start, schedule_end, calling_days, calling_start_time, calling_end_time, calling_timezone, 
        max_concurrent, max_calls_per_hour, max_retries, retry_delay_minutes, goal, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        client_id, data.name, data.description || null, data.agent_id ? String(data.agent_id) : null, data.phone_number_id || null,
        data.contact_list ? JSON.stringify(data.contact_list) : '[]',
        data.schedule_start || null, data.schedule_end || null, callingDaysStr,
        data.calling_start_time || '09:00', data.calling_end_time || '18:00', data.calling_timezone || 'UTC',
        data.max_concurrent || 1, data.max_calls_per_hour || null, data.max_retries || 0, data.retry_delay_minutes || 0,
        data.goal || null
      ]
    );

    const campaign = await get('SELECT * FROM campaigns WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ data: campaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// GET /:id - Get campaign details
router.get('/:id', async (req, res) => {
  try {
    const campaign = await get('SELECT * FROM campaigns WHERE id = ? AND client_id = ?', [req.params.id, req.user.client_id]);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    if (campaign.contact_list) {
      try {
        campaign.contact_list = typeof campaign.contact_list === 'string'
          ? JSON.parse(campaign.contact_list)
          : campaign.contact_list;
      } catch {
        campaign.contact_list = [];
      }
    }
    res.json({ data: campaign });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// PUT /:id - Update campaign
router.put('/:id', async (req, res) => {
  try {
    const { client_id } = req.user;
    const campaignId = req.params.id;
    
    const campaign = await get('SELECT status FROM campaigns WHERE id = ? AND client_id = ?', [campaignId, client_id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return res.status(400).json({ error: 'Can only update draft or scheduled campaigns' });
    }

    const parsed = campaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    
    const data = parsed.data;
    const callingDaysStr = data.calling_days !== undefined
      ? (Array.isArray(data.calling_days) ? JSON.stringify(data.calling_days) : data.calling_days)
      : null;
    
    await run(
      `UPDATE campaigns SET 
        name = coalesce(?, name),
        description = coalesce(?, description),
        agent_id = coalesce(?, agent_id),
        phone_number_id = coalesce(?, phone_number_id),
        contact_list = coalesce(?, contact_list),
        schedule_start = coalesce(?, schedule_start),
        schedule_end = coalesce(?, schedule_end),
        calling_days = coalesce(?, calling_days),
        calling_start_time = coalesce(?, calling_start_time),
        calling_end_time = coalesce(?, calling_end_time),
        calling_timezone = coalesce(?, calling_timezone),
        max_concurrent = coalesce(?, max_concurrent),
        max_calls_per_hour = coalesce(?, max_calls_per_hour),
        max_retries = coalesce(?, max_retries),
        retry_delay_minutes = coalesce(?, retry_delay_minutes),
        goal = coalesce(?, goal),
        updated_at = datetime('now')
      WHERE id = ? AND client_id = ?`,
      [
        data.name, data.description, data.agent_id ? String(data.agent_id) : null, data.phone_number_id,
        data.contact_list ? JSON.stringify(data.contact_list) : null,
        data.schedule_start, data.schedule_end, callingDaysStr,
        data.calling_start_time, data.calling_end_time, data.calling_timezone,
        data.max_concurrent, data.max_calls_per_hour, data.max_retries, data.retry_delay_minutes,
        data.goal, campaignId, client_id
      ]
    );

    const updated = await get('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
    if (updated?.contact_list) {
      try {
        updated.contact_list = typeof updated.contact_list === 'string'
          ? JSON.parse(updated.contact_list)
          : updated.contact_list;
      } catch {
        updated.contact_list = [];
      }
    }
    res.json({ data: updated });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// DELETE /:id - Delete campaign
router.delete('/:id', async (req, res) => {
  try {
    const { client_id } = req.user;
    const campaignId = req.params.id;
    
    const campaign = await get('SELECT status FROM campaigns WHERE id = ? AND client_id = ?', [campaignId, client_id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status !== 'draft' && campaign.status !== 'cancelled') {
      return res.status(400).json({ error: 'Can only delete draft or cancelled campaigns' });
    }

    await run('DELETE FROM campaigns WHERE id = ? AND client_id = ?', [campaignId, client_id]);
    res.json({ data: { success: true } });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// POST /:id/start - Start/schedule campaign
router.post('/:id/start', actionLimiter, async (req, res) => {
  try {
    const { client_id } = req.user;
    const campaignId = req.params.id;

    const campaign = await get('SELECT * FROM campaigns WHERE id = ? AND client_id = ?', [campaignId, client_id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled' && campaign.status !== 'paused') {
      return res.status(400).json({ error: 'Campaign must be draft, scheduled, or paused to start' });
    }

    if (!campaign.agent_id) return res.status(400).json({ error: 'Campaign must have an agent assigned' });
    if (!campaign.phone_number_id) return res.status(400).json({ error: 'Campaign must have a phone number assigned' });
    
    let contactIds = [];
    if (campaign.contact_list) {
      try {
        contactIds = typeof campaign.contact_list === 'string'
          ? JSON.parse(campaign.contact_list)
          : campaign.contact_list;
      } catch (e) {
        contactIds = [];
      }
    }
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: 'Campaign must have contacts assigned' });
    }

    // Verify agent in client_agents or gemini_agents
    let agent = await get(
      'SELECT agent_name as name FROM client_agents WHERE (agent_id = ? OR id = ?) AND client_id = ?',
      [String(campaign.agent_id), campaign.agent_id, client_id]
    );
    if (!agent) {
      agent = await get('SELECT name FROM gemini_agents WHERE agent_id = ?', [String(campaign.agent_id)]);
    }
    if (!agent && req.user.is_admin === 1) {
      agent = { name: `Agent ${campaign.agent_id}` };
    }
    if (!agent) return res.status(400).json({ error: 'Assigned agent not found' });

    // Verify phone number exists
    const phone = await get(
      'SELECT phone_number FROM phone_numbers WHERE (id = ? OR elevenlabs_phone_number_id = ?) AND client_id = ?',
      [campaign.phone_number_id, String(campaign.phone_number_id), client_id]
    );
    if (!phone) return res.status(400).json({ error: 'Assigned phone number not found' });

    const placeholders = contactIds.map(() => '?').join(',');
    const contactsInfo = await all(
      `SELECT id, phone, phone_e164 FROM contacts WHERE id IN (${placeholders}) AND client_id = ?`,
      [...contactIds, client_id]
    );
    
    // DNC list check with proper phone_e164 field
    const dncRows = await all(
      'SELECT phone_e164 FROM dnc_list WHERE client_id = ? OR client_id IS NULL',
      [client_id]
    );
    const dncSet = new Set((dncRows || []).map(r => r.phone_e164));

    let validCount = 0;
    let dncExcluded = 0;

    for (const c of (contactsInfo || [])) {
      const num = c.phone_e164 || c.phone;
      if (!num) continue;
      if (dncSet.has(num) || (c.phone && dncSet.has(c.phone))) {
        dncExcluded++;
      } else {
        validCount++;
      }
    }

    if (validCount === 0) {
      return res.status(400).json({ error: 'No valid contacts after applying DNC list' });
    }

    const newStatus = 'running';

    await run(
      `UPDATE campaigns SET 
        status = ?, 
        total_contacts = ?, 
        valid_contacts = ?, 
        dnc_excluded = ?,
        started_at = coalesce(started_at, datetime('now')),
        updated_at = datetime('now')
       WHERE id = ?`,
      [newStatus, contactIds.length, validCount, dncExcluded, campaignId]
    );

    res.json({ 
      data: { 
        status: newStatus,
        summary: {
          agent_name: agent.name,
          phone_number: phone.phone_number,
          total_contacts: contactIds.length,
          valid_contacts: validCount,
          dnc_excluded: dncExcluded
        }
      } 
    });
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// POST /:id/pause - Pause running campaign
router.post('/:id/pause', actionLimiter, async (req, res) => {
  try {
    const { client_id } = req.user;
    const campaignId = req.params.id;

    const campaign = await get('SELECT status FROM campaigns WHERE id = ? AND client_id = ?', [campaignId, client_id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    
    if (campaign.status !== 'running') {
      return res.status(400).json({ error: 'Only running campaigns can be paused' });
    }

    await run("UPDATE campaigns SET status = 'paused', updated_at = datetime('now') WHERE id = ?", [campaignId]);
    res.json({ data: { success: true, status: 'paused' } });
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
});

// POST /:id/resume - Resume paused campaign
router.post('/:id/resume', actionLimiter, async (req, res) => {
  try {
    const { client_id } = req.user;
    const campaignId = req.params.id;

    const campaign = await get('SELECT status FROM campaigns WHERE id = ? AND client_id = ?', [campaignId, client_id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    
    if (campaign.status !== 'paused') {
      return res.status(400).json({ error: 'Only paused campaigns can be resumed' });
    }

    await run("UPDATE campaigns SET status = 'running', updated_at = datetime('now') WHERE id = ?", [campaignId]);
    res.json({ data: { success: true, status: 'running' } });
  } catch (error) {
    console.error('Error resuming campaign:', error);
    res.status(500).json({ error: 'Failed to resume campaign' });
  }
});

// POST /:id/cancel - Cancel campaign
router.post('/:id/cancel', actionLimiter, async (req, res) => {
  try {
    const { client_id } = req.user;
    const campaignId = req.params.id;

    const campaign = await get('SELECT status FROM campaigns WHERE id = ? AND client_id = ?', [campaignId, client_id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    
    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
      return res.status(400).json({ error: 'Campaign is already finished' });
    }

    await run("UPDATE campaigns SET status = 'cancelled', cancelled_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", [campaignId]);
    res.json({ data: { success: true, status: 'cancelled' } });
  } catch (error) {
    console.error('Error cancelling campaign:', error);
    res.status(500).json({ error: 'Failed to cancel campaign' });
  }
});

// POST /:id/duplicate - Duplicate a campaign
router.post('/:id/duplicate', actionLimiter, async (req, res) => {
  try {
    const { client_id } = req.user;
    const campaignId = req.params.id;

    const campaign = await get('SELECT * FROM campaigns WHERE id = ? AND client_id = ?', [campaignId, client_id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const newName = campaign.name + ' (Copy)';

    const result = await run(
      `INSERT INTO campaigns (
        client_id, name, description, agent_id, phone_number_id, status, contact_list, 
        total_contacts, valid_contacts, dnc_excluded, calls_completed, calls_answered, calls_failed, 
        schedule_start, schedule_end, calling_days, calling_start_time, calling_end_time, calling_timezone, 
        max_concurrent, max_calls_per_hour, max_retries, retry_delay_minutes, goal, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        client_id, newName, campaign.description, campaign.agent_id, campaign.phone_number_id,
        campaign.contact_list || '[]',
        campaign.schedule_start, campaign.schedule_end, campaign.calling_days,
        campaign.calling_start_time, campaign.calling_end_time, campaign.calling_timezone,
        campaign.max_concurrent, campaign.max_calls_per_hour, campaign.max_retries, campaign.retry_delay_minutes,
        campaign.goal
      ]
    );

    const duplicated = await get('SELECT * FROM campaigns WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ data: duplicated });
  } catch (error) {
    console.error('Error duplicating campaign:', error);
    res.status(500).json({ error: 'Failed to duplicate campaign' });
  }
});

// GET /:id/analytics - Campaign analytics
router.get('/:id/analytics', async (req, res) => {
  try {
    const { client_id } = req.user;
    const campaignId = req.params.id;

    const campaign = await get('SELECT id, calls_completed, calls_answered, calls_failed FROM campaigns WHERE id = ? AND client_id = ?', [campaignId, client_id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const analytics = {
      calls_completed: campaign.calls_completed || 0,
      calls_answered: campaign.calls_answered || 0,
      calls_failed: campaign.calls_failed || 0
    };

    res.json({ data: analytics });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
