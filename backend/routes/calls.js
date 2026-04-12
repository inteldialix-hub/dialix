const express = require('express');
const { get } = require('../db');
const { authenticate } = require('../middleware/auth');
const elevenlabs = require('../services/elevenlabs');

const router = express.Router();

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * POST /api/calls/outbound
 * Supports both local DB phone numbers AND ElevenLabs phone numbers (id starts with "el_")
 */
router.post('/outbound', authenticate, async (req, res) => {
  try {
    const { agent_id, phone_number_id, to_number, lead_name, dynamic_variables } = req.body;

    if (!agent_id || !phone_number_id || !to_number) {
      return res.status(400).json({ error: 'agent_id, phone_number_id, and to_number are required' });
    }

    if (!E164_REGEX.test(to_number)) {
      return res.status(400).json({ error: 'to_number must be in E.164 format (e.g., +12125551234)' });
    }

    const agent = get(
      'SELECT id FROM client_agents WHERE client_id = ? AND agent_id = ?',
      [req.client.id, agent_id]
    );
    if (!agent) {
      return res.status(403).json({ error: 'Agent not assigned to your account' });
    }

    let elevenlabsPhoneId;
    let provider = 'twilio';

    // Check if this is an ElevenLabs-native phone number (prefixed with "el_")
    if (String(phone_number_id).startsWith('el_')) {
      elevenlabsPhoneId = phone_number_id.replace('el_', '');
    } else {
      // Local DB phone number
      const phoneNum = get(
        'SELECT * FROM phone_numbers WHERE id = ? AND client_id = ?',
        [phone_number_id, req.client.id]
      );
      if (!phoneNum) {
        return res.status(404).json({ error: 'Phone number not found' });
      }
      if (phoneNum.assigned_agent_id !== agent_id) {
        return res.status(400).json({ error: 'Phone number is not assigned to this agent' });
      }
      elevenlabsPhoneId = phoneNum.elevenlabs_phone_number_id;
      provider = phoneNum.provider;
    }

    // Build dynamic variables for ElevenLabs agent's first message
    // Agents use {{lead_name}} or {{LEAD_NAME}} in their greeting
    const vars = { ...(dynamic_variables || {}) };
    if (lead_name) {
      vars.lead_name = lead_name;
      vars.LEAD_NAME = lead_name; // Cover both casings used by different agents
    }

    const callPayload = {
      agent_id,
      agent_phone_number_id: elevenlabsPhoneId,
      to_number,
    };

    // Only include conversation_initiation_client_data if we have variables
    if (Object.keys(vars).length > 0) {
      callPayload.conversation_initiation_client_data = {
        dynamic_variables: vars,
      };
    }

    console.log(`Outbound call: agent=${agent_id}, to=${to_number}, vars=${JSON.stringify(vars)}`);

    const result = await elevenlabs.makeOutboundCall(provider, callPayload);

    res.json({
      success: true,
      conversation_id: result.conversation_id || result.id,
    });
  } catch (err) {
    console.error('POST /api/calls/outbound error:', err);
    res.status(500).json({ error: err.body || 'Failed to initiate call' });
  }
});

/**
 * GET /api/calls/history/:agent_id
 * Gracefully handles 404 when agent has no conversations yet
 */
router.get('/history/:agent_id', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    const agent = get(
      'SELECT id FROM client_agents WHERE client_id = ? AND agent_id = ?',
      [req.client.id, agent_id]
    );
    if (!agent) {
      return res.status(403).json({ error: 'Agent not assigned to your account' });
    }

    try {
      const data = await elevenlabs.getConversations(agent_id);
      res.json({ conversations: data.conversations || [] });
    } catch (elErr) {
      // If ElevenLabs returns 404 (agent not found or no conversations), return empty
      if (elErr.statusCode === 404) {
        return res.json({ conversations: [] });
      }
      throw elErr;
    }
  } catch (err) {
    console.error('GET /api/calls/history error:', err);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

module.exports = router;
