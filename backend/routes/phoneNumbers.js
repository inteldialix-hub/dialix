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
    const { label, phone_number, account_sid, auth_token, phone_number_sid } = req.body;

    // Auto-fetch Phone Number SID from Twilio if not provided
    if (!phone_number_sid) {
      try {
        const cleanNumber = phone_number.replace(/[\s\-()]/g, '');
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(cleanNumber)}`;
        const twilioRes = await fetch(twilioUrl, {
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${account_sid}:${auth_token}`).toString('base64'),
          },
        });
        const twilioData = await twilioRes.json();

        if (!twilioRes.ok) {
          return res.status(400).json({ error: `Twilio lookup failed: ${twilioData.message || 'Invalid credentials'}` });
        }
        if (!twilioData.incoming_phone_numbers || twilioData.incoming_phone_numbers.length === 0) {
          return res.status(400).json({ error: `Phone number ${cleanNumber} not found in your Twilio account` });
        }
        phone_number_sid = twilioData.incoming_phone_numbers[0].sid;
        console.log(`Auto-resolved Phone Number SID: ${phone_number_sid}`);
      } catch (lookupErr) {
        console.error('Twilio lookup error:', lookupErr);
        return res.status(400).json({ error: 'Failed to look up Phone Number SID from Twilio. Please enter it manually.' });
      }
    }

    const result = await elevenlabs.createPhoneNumber({
      provider: 'twilio',
      label,
      phone_number,
      sid: account_sid,
      token: auth_token,
      phone_number_sid,
    });

    const elevenlabsPhoneId = result.phone_number_id || result.id;
    await run(
      `INSERT INTO phone_numbers (client_id, elevenlabs_phone_number_id, phone_number, label, provider)
       VALUES (?, ?, ?, ?, 'twilio') RETURNING id`,
      [req.client.id, elevenlabsPhoneId, phone_number, label]
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

    const phoneNum = await get(
      'SELECT * FROM phone_numbers WHERE id = ? AND client_id = ?',
      [id, req.client.id]
    );
    if (!phoneNum) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    const agent = await get(
      'SELECT id FROM client_agents WHERE client_id = ? AND agent_id = ?',
      [req.client.id, agent_id]
    );
    if (!agent) {
      return res.status(403).json({ error: 'Agent not assigned to your account' });
    }

    await elevenlabs.assignPhoneNumber(phoneNum.elevenlabs_phone_number_id, agent_id);
    await run('UPDATE phone_numbers SET assigned_agent_id = ? WHERE id = ?', [agent_id, id]);

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/phone-numbers/:id/assign error:', err);
    res.status(500).json({ error: 'Failed to assign phone number' });
  }
});

/**
 * DELETE /api/phone-numbers/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Admins can delete any phone number; regular users only their own
    const phoneNum = req.client.is_admin === 1
      ? await get('SELECT * FROM phone_numbers WHERE id = ?', [id])
      : await get('SELECT * FROM phone_numbers WHERE id = ? AND client_id = ?', [id, req.client.id]);

    if (!phoneNum) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    await elevenlabs.deletePhoneNumber(phoneNum.elevenlabs_phone_number_id);
    await run('DELETE FROM phone_numbers WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/phone-numbers/:id error:', err);
    res.status(500).json({ error: 'Failed to delete phone number' });
  }
});

module.exports = router;
