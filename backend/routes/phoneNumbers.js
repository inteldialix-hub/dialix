const express = require('express');
const { all, get, run } = require('../db');
const { authenticate } = require('../middleware/auth');
const { validateSchema } = require('../middleware/validate');
const {
  twilioPhoneNumberSchema,
  sipPhoneNumberSchema,
  phoneNumberAssignSchema,
} = require('../lib/schemas');
const elevenlabs = require('../services/elevenlabs');
const { checkPhoneNumberLimit } = require('../lib/plan-limits');

const router = express.Router();

/**
 * GET /api/phone-numbers
 * Returns local DB phone numbers + any from ElevenLabs not yet in DB
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const localNumbers = await all(
      'SELECT * FROM phone_numbers WHERE client_id = ? ORDER BY created_at DESC',
      [req.client.id]
    );

    // Also fetch phone numbers directly from ElevenLabs
    let elevenLabsNumbers = [];
    try {
      const elNumbers = await elevenlabs.getPhoneNumbers();
      // Convert ElevenLabs numbers into a comparable format
      // Only include ones NOT already in local DB
      const localElIds = new Set(localNumbers.map(n => n.elevenlabs_phone_number_id));
      elevenLabsNumbers = (Array.isArray(elNumbers) ? elNumbers : []).filter(
        n => !localElIds.has(n.phone_number_id || n.id)
      ).map(n => ({
        id: `el_${n.phone_number_id || n.id}`,
        elevenlabs_phone_number_id: n.phone_number_id || n.id,
        phone_number: n.phone_number || n.number || '—',
        label: n.label || n.name || 'ElevenLabs Number',
        provider: n.provider || 'twilio',
        assigned_agent_id: n.agent_id || null,
        source: 'elevenlabs', // flag to distinguish from local
      }));
    } catch (elErr) {
      console.log('Could not fetch ElevenLabs phone numbers:', elErr.message);
    }

    res.json({ phoneNumbers: [...localNumbers, ...elevenLabsNumbers] });
  } catch (err) {
    console.error('GET /api/phone-numbers error:', err);
    res.status(500).json({ error: 'Failed to fetch phone numbers' });
  }
});

/**
 * POST /api/phone-numbers/twilio
 */
router.post('/twilio', authenticate, validateSchema(twilioPhoneNumberSchema), async (req, res) => {
  try {
    // Enforce plan phone number limit
    const limitCheck = await checkPhoneNumberLimit(req.client.id);
    if (!limitCheck.allowed) {
      return res.status(403).json({ error: limitCheck.reason });
    }

    const { label, phone_number, account_sid, auth_token, phone_number_sid } = req.body;

    let resolvedPhoneNumber = phone_number;
    let resolvedPhoneNumberSid = phone_number_sid;

    // Auto-fetch Phone Number SID from Twilio if not provided
    if (!resolvedPhoneNumberSid) {
      try {
        const cleanNumber = phone_number.replace(/[\s\-()]/g, '');
        const twilioAuth = 'Basic ' + Buffer.from(`${account_sid}:${auth_token}`).toString('base64');
        
        // Fetch all incoming phone numbers from Twilio
        const twilioListUrl = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/IncomingPhoneNumbers.json`;
        const twilioRes = await fetch(twilioListUrl, {
          headers: { 'Authorization': twilioAuth },
        });
        const twilioData = await twilioRes.json();

        if (!twilioRes.ok) {
          return res.status(400).json({ error: `Twilio authentication failed: ${twilioData.message || 'Invalid Account SID or Auth Token'}` });
        }

        const incomingNumbers = twilioData.incoming_phone_numbers || [];
        if (incomingNumbers.length === 0) {
          return res.status(400).json({ error: 'No active phone numbers found in your Twilio account. Please purchase or claim a number in Twilio first.' });
        }

        // Try exact match or match digits
        const digitsOnly = cleanNumber.replace(/\D/g, '');
        const match = incomingNumbers.find(n => {
          const nDigits = (n.phone_number || '').replace(/\D/g, '');
          return n.phone_number === cleanNumber || nDigits === digitsOnly;
        });

        if (match) {
          resolvedPhoneNumberSid = match.sid;
          resolvedPhoneNumber = match.phone_number;
        } else {
          // If only 1 number in account, auto-use it!
          if (incomingNumbers.length === 1) {
            resolvedPhoneNumberSid = incomingNumbers[0].sid;
            resolvedPhoneNumber = incomingNumbers[0].phone_number;
            console.log(`[Twilio] Auto-selected available Twilio number: ${resolvedPhoneNumber} (${resolvedPhoneNumberSid})`);
          } else {
            const availableList = incomingNumbers.map(n => n.phone_number).join(', ');
            return res.status(400).json({ 
              error: `Number ${cleanNumber} not found in Twilio. Active numbers in your Twilio account: ${availableList}` 
            });
          }
        }
      } catch (lookupErr) {
        console.error('Twilio lookup error:', lookupErr);
        return res.status(400).json({ error: 'Failed to look up Phone Number SID from Twilio. Please verify your Account SID and Auth Token.' });
      }
    }

    const result = await elevenlabs.createPhoneNumber({
      provider: 'twilio',
      label,
      phone_number: resolvedPhoneNumber,
      sid: account_sid,
      token: auth_token,
      phone_number_sid: resolvedPhoneNumberSid,
    });

    const elevenlabsPhoneId = result.phone_number_id || result.id;
    await run(
      `INSERT INTO phone_numbers (client_id, elevenlabs_phone_number_id, phone_number, label, provider, created_at)
       VALUES (?, ?, ?, ?, 'twilio', datetime('now'))`,
      [req.client.id, elevenlabsPhoneId, resolvedPhoneNumber, label]
    );

    const inserted = await get(
      'SELECT * FROM phone_numbers WHERE elevenlabs_phone_number_id = ?',
      [elevenlabsPhoneId]
    );

    res.json({ phoneNumber: inserted });
  } catch (err) {
    console.error('POST /api/phone-numbers/twilio error:', err);
    res.status(500).json({ error: err.body || 'Failed to register Twilio number' });
  }
});

/**
 * POST /api/phone-numbers/sip
 */
router.post('/sip', authenticate, validateSchema(sipPhoneNumberSchema), async (req, res) => {
  try {
    // Enforce plan phone number limit
    const limitCheck = await checkPhoneNumberLimit(req.client.id);
    if (!limitCheck.allowed) {
      return res.status(403).json({ error: limitCheck.reason });
    }

    const { label, phone_number, termination_uri, username, password, transport } = req.body;

    const result = await elevenlabs.createPhoneNumber({
      provider: 'sip_trunk',
      label,
      phone_number,
      termination_uri,
      username: username || '',
      password: password || '',
      transport: transport || 'tls',
    });

    const elevenlabsPhoneId = result.phone_number_id || result.id;
    await run(
      `INSERT INTO phone_numbers (client_id, elevenlabs_phone_number_id, phone_number, label, provider)
       VALUES (?, ?, ?, ?, 'sip_trunk') RETURNING id`,
      [req.client.id, elevenlabsPhoneId, phone_number, label]
    );

    const inserted = await get(
      'SELECT * FROM phone_numbers WHERE elevenlabs_phone_number_id = ?',
      [elevenlabsPhoneId]
    );

    res.json({ phoneNumber: inserted });
  } catch (err) {
    console.error('POST /api/phone-numbers/sip error:', err);
    res.status(500).json({ error: err.body || 'Failed to register SIP number' });
  }
});

/**
 * POST /api/phone-numbers/:id/assign
 */
router.post('/:id/assign', authenticate, validateSchema(phoneNumberAssignSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { agent_id } = req.body;

    const isNumeric = /^\d+$/.test(String(id));
    const cleanElId = String(id).replace(/^el_/, '');

    let phoneNum = isNumeric
      ? await get('SELECT * FROM phone_numbers WHERE id = ? AND (client_id = ? OR ? = 1)', [parseInt(id), req.client.id, req.client.is_admin ? 1 : 0])
      : await get('SELECT * FROM phone_numbers WHERE (elevenlabs_phone_number_id = ? OR elevenlabs_phone_number_id = ?) AND (client_id = ? OR ? = 1)', [cleanElId, id, req.client.id, req.client.is_admin ? 1 : 0]);

    // Check agent ownership or admin
    const agent = await get(
      'SELECT id FROM client_agents WHERE (client_id = ? OR ? = 1) AND agent_id = ?',
      [req.client.id, req.client.is_admin ? 1 : 0, agent_id]
    );
    if (!agent && req.client.is_admin !== 1) {
      return res.status(403).json({ error: 'Agent not assigned to your account' });
    }

    // Call ElevenLabs API to assign agent to phone number
    const elPhoneId = phoneNum?.elevenlabs_phone_number_id || cleanElId;
    await elevenlabs.assignPhoneNumber(elPhoneId, agent_id);

    // If already in local DB, update it; otherwise auto-import it into DB
    if (phoneNum) {
      await run('UPDATE phone_numbers SET assigned_agent_id = ? WHERE id = ?', [agent_id, phoneNum.id]);
    } else {
      try {
        const allEl = await elevenlabs.getPhoneNumbers();
        const elDetails = (Array.isArray(allEl) ? allEl : []).find(n => (n.phone_number_id || n.id) === cleanElId);
        const phoneStr = elDetails?.phone_number || elDetails?.number || '—';
        const labelStr = elDetails?.label || elDetails?.name || 'ElevenLabs Number';
        const providerStr = elDetails?.provider || 'twilio';

        await run(
          `INSERT INTO phone_numbers (client_id, phone_number, label, provider, elevenlabs_phone_number_id, assigned_agent_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [req.client.id, phoneStr, labelStr, providerStr, cleanElId, agent_id]
        );
      } catch (dbErr) {
        console.warn('Could not auto-import ElevenLabs number to DB:', dbErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/phone-numbers/:id/assign error:', err);
    res.status(500).json({ error: err.message || 'Failed to assign phone number' });
  }
});

/**
 * DELETE /api/phone-numbers/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const isNumeric = /^\d+$/.test(String(id));
    const cleanElId = String(id).replace(/^el_/, '');

    const phoneNum = isNumeric
      ? await get('SELECT * FROM phone_numbers WHERE id = ? AND (client_id = ? OR ? = 1)', [parseInt(id), req.client.id, req.client.is_admin ? 1 : 0])
      : await get('SELECT * FROM phone_numbers WHERE (elevenlabs_phone_number_id = ? OR elevenlabs_phone_number_id = ?) AND (client_id = ? OR ? = 1)', [cleanElId, id, req.client.id, req.client.is_admin ? 1 : 0]);

    const targetElId = phoneNum?.elevenlabs_phone_number_id || cleanElId;
    if (targetElId) {
      try {
        await elevenlabs.deletePhoneNumber(targetElId);
      } catch (elErr) {
        console.warn('ElevenLabs delete warning:', elErr.message);
      }
    }

    if (phoneNum) {
      await run('DELETE FROM phone_numbers WHERE id = ?', [phoneNum.id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/phone-numbers/:id error:', err);
    res.status(500).json({ error: 'Failed to delete phone number' });
  }
});

module.exports = router;
