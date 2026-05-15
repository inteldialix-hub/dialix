const express = require('express');
const { get } = require('../db');
const { authenticate } = require('../middleware/auth');
const { validateSchema } = require('../middleware/validate');
const { callOutboundSchema } = require('../lib/schemas');
const elevenlabs = require('../services/elevenlabs');
const vapi = require('../services/vapi');
const callMonitor = require('../lib/call-monitoring');
const { checkCallLimit } = require('../lib/plan-limits');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

/** Determine provider for an agent: checks DB first, falls back to ID pattern */
function detectProvider(agentId, dbRow) {
  if (dbRow?.provider) return dbRow.provider;
  if (agentId.startsWith('gemini_')) return 'gemini';
  // ElevenLabs agent IDs start with "agent_"
  return agentId.startsWith('agent_') ? 'elevenlabs' : 'vapi';
}

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

    // Enforce monthly call limit from plan
    const callLimitCheck = await checkCallLimit(req.client.id);
    if (!callLimitCheck.allowed) {
      return res.status(403).json({ error: callLimitCheck.reason });
    }

    const agent = await get(
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
      const phoneNum = await get(
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
 * Gracefully handles 404 when agent has no conversations yet.
 * Works with both ElevenLabs and Vapi agents.
 */
router.get('/history/:agent_id', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    const agentRow = get(
      "SELECT id, COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE client_id = ? AND agent_id = ?",
      [req.client.id, agent_id]
    );
    if (!agentRow) {
      return res.status(403).json({ error: 'Agent not assigned to your account' });
    }

    const provider = detectProvider(agent_id, agentRow);

    if (provider === 'gemini') {
      // Gemini calls are tracked in our local call_history table
      try {
        const { all } = require('../db');
        const calls = await all(
          'SELECT * FROM call_history WHERE agent_id = ? ORDER BY created_at DESC LIMIT 100',
          [agent_id]
        );
        const conversations = (calls || []).map(c => ({
          conversation_id: c.conversation_id,
          agent_id: agent_id,
          status: c.status === 'completed' ? 'done' : c.status,
          call_successful: c.success ? 'success' : 'unknown',
          start_time_unix_secs: c.started_at ? Math.floor(new Date(c.started_at).getTime() / 1000) : undefined,
          call_duration_secs: c.duration || 0,
          message_count: 0,
          metadata: { type: 'gemini', provider: 'gemini' },
        }));
        return res.json({ conversations });
      } catch (geminiErr) {
        console.error('Gemini call history error:', geminiErr);
        return res.json({ conversations: [] });
      }
    }

    if (provider === 'vapi') {
      // Fetch from Vapi API
      try {
        const calls = await vapi.listCalls({ assistantId: agent_id, limit: 100 });
        // Map Vapi calls to the same shape the frontend expects
        const conversations = (calls || []).map(c => ({
          conversation_id: c.id,
          agent_id: agent_id,
          status: c.status === 'ended' ? 'done' : c.status,
          call_successful: c.endedReason === 'assistant-ended-call' || c.endedReason === 'customer-ended-call' ? 'success' : (c.endedReason === 'assistant-error' ? 'failure' : c.endedReason || 'unknown'),
          start_time_unix_secs: c.startedAt ? Math.floor(new Date(c.startedAt).getTime() / 1000) : undefined,
          call_duration_secs: c.startedAt && c.endedAt ? Math.round((new Date(c.endedAt) - new Date(c.startedAt)) / 1000) : 0,
          message_count: c.messages?.length || 0,
          metadata: { cost: c.cost, type: c.type, endedReason: c.endedReason },
        }));
        return res.json({ conversations });
      } catch (vapiErr) {
        console.error('Vapi listCalls error:', vapiErr);
        return res.json({ conversations: [] });
      }
    }

    // ElevenLabs flow
    try {
      const data = await elevenlabs.getConversations(agent_id);
      res.json({ conversations: data.conversations || [] });
    } catch (elErr) {
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

/**
 * GET /api/calls/conversation/:conversation_id
 * Get full conversation detail including transcript, analysis, and metadata.
 * Detects provider via ?provider= query param or falls back to ElevenLabs.
 */
router.get('/conversation/:conversation_id', authenticate, async (req, res) => {
  try {
    const { conversation_id } = req.params;
    // Auto-detect provider: if explicitly set use that, otherwise infer from ID format
    // Vapi conversation IDs are UUIDs (contain hyphens, don't start with "agent_")
    const explicitProvider = req.query.provider;
    const provider = explicitProvider || (conversation_id.includes('-') && !conversation_id.startsWith('agent_') ? 'vapi' : 'elevenlabs');

    if (provider === 'vapi') {
      // Fetch from Vapi
      const call = await vapi.getCall(conversation_id);
      // Extract messages with latency
      const allMessages = call.artifact?.messages || call.messages || [];
      const transcript = allMessages
        .filter(m => m.role === 'assistant' || m.role === 'user' || m.role === 'bot')
        .map(m => ({
          role: m.role === 'assistant' || m.role === 'bot' ? 'agent' : 'user',
          message: m.message || m.content || '',
          time_in_call_secs: m.secondsFromStart || undefined,
          // Latency data from Vapi message objects
          latency: m.duration ? Math.round(m.duration * 1000) : undefined,
          llm_latency: m.llmProcessingDuration ? Math.round(m.llmProcessingDuration * 1000) : undefined,
          tts_latency: m.voiceProcessingDuration ? Math.round(m.voiceProcessingDuration * 1000) : undefined,
          asr_latency: m.transcriptionDuration ? Math.round(m.transcriptionDuration * 1000) : undefined,
        }));

      // Determine call duration
      const callDuration = call.startedAt && call.endedAt
        ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) : 0;

      // Model/voice/transcriber config from the call
      const modelConfig = call.assistant?.model || call.model || null;
      const voiceConfig = call.assistant?.voice || call.voice || null;
      const transcriberConfig = call.assistant?.transcriber || call.transcriber || null;

      // Map to the shape the frontend expects
      const mapped = {
        conversation_id: call.id,
        agent_id: call.assistantId || '',
        status: call.status === 'ended' ? 'done' : call.status,
        provider: 'vapi',
        transcript,
        metadata: {
          start_time_unix_secs: call.startedAt ? Math.floor(new Date(call.startedAt).getTime() / 1000) : undefined,
          call_duration_secs: callDuration,
          cost: call.cost || 0,
          costBreakdown: call.costBreakdown || null,
          authorization_method: 'vapi',
          endedReason: call.endedReason || null,
          type: call.type || null,
          // Recording URLs
          recordingUrl: call.artifact?.recordingUrl || call.recordingUrl || null,
          stereoRecordingUrl: call.artifact?.stereoRecordingUrl || null,
          videoRecordingUrl: call.artifact?.videoRecordingUrl || null,
          // Config used for this call
          model: modelConfig ? {
            provider: modelConfig.provider || null,
            model: modelConfig.model || null,
            temperature: modelConfig.temperature ?? null,
          } : null,
          voice: voiceConfig ? {
            provider: voiceConfig.provider || null,
            voiceId: voiceConfig.voiceId || null,
          } : null,
          transcriber: transcriberConfig ? {
            provider: transcriberConfig.provider || null,
            model: transcriberConfig.model || null,
            language: transcriberConfig.language || null,
          } : null,
        },
        analysis: {
          call_successful: call.endedReason === 'assistant-ended-call' || call.endedReason === 'customer-ended-call' ? 'success' : 'unknown',
          transcript_summary: call.analysis?.summary || null,
          successEvaluation: call.analysis?.successEvaluation || null,
          structuredData: call.analysis?.structuredData || null,
        },
        conversation_initiation_client_data: {
          dynamic_variables: {},
          conversation_config_override: {},
        },
      };
      return res.json(mapped);
    }

    // ElevenLabs flow
    const data = await elevenlabs.getConversation(conversation_id);
    res.json(data);
  } catch (err) {
    console.error('GET /api/calls/conversation error:', err);
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.status(500).json({ error: 'Failed to fetch conversation detail' });
  }
});

/**
 * GET /api/calls/conversation/:conversation_id/audio
 * Stream the conversation audio recording.
 * For Vapi calls, attempts to return the recording URL if available.
 */
router.get('/conversation/:conversation_id/audio', authenticate, async (req, res) => {
  try {
    const { conversation_id } = req.params;
    // Auto-detect provider: if explicitly set use that, otherwise infer from ID format
    const explicitProvider = req.query.provider;
    const provider = explicitProvider || (conversation_id.includes('-') && !conversation_id.startsWith('agent_') ? 'vapi' : 'elevenlabs');
    console.log(`[Audio] Fetching audio for conversation: ${conversation_id} (provider: ${provider})`);

    if (provider === 'vapi') {
      // Vapi stores recordings differently — try to get the recording URL
      try {
        const call = await vapi.getCall(conversation_id);
        const recordingUrl = call.artifact?.recordingUrl || call.recordingUrl;
        if (recordingUrl) {
          // Proxy the recording to avoid CORS/CSP issues on the frontend
          const vapiAudioResp = await fetch(recordingUrl);
          if (!vapiAudioResp.ok) {
            throw new Error(`Vapi storage responded with ${vapiAudioResp.status}`);
          }
          
          const arrayBuf = await vapiAudioResp.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          
          if (buffer.length === 0) {
            return res.status(404).json({ error: 'Empty recording from Vapi' });
          }
          
          const contentType = vapiAudioResp.headers.get('content-type') || 'audio/wav';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'private, max-age=3600');
          
          return res.send(buffer);
        }
      } catch (e) {
        console.error('[Audio] Vapi audio proxy error:', e);
      }
      return res.status(404).json({ error: 'No audio recording available for this Vapi call' });
    }
    
    const audioResp = await elevenlabs.getConversationAudio(conversation_id);
    console.log(`[Audio] ElevenLabs response status: ${audioResp.status}, content-type: ${audioResp.headers.get('content-type')}, content-length: ${audioResp.headers.get('content-length')}`);
    
    // Read the full audio into a buffer
    const arrayBuf = await audioResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    console.log(`[Audio] Buffer size: ${buffer.length} bytes`);
    
    if (buffer.length === 0) {
      console.log('[Audio] Empty buffer — no recording available');
      return res.status(404).json({ error: 'No audio recording available' });
    }
    
    // Forward headers
    const contentType = audioResp.headers.get('content-type') || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    
    console.log(`[Audio] Sending ${buffer.length} bytes as ${contentType}`);
    res.send(buffer);
  } catch (err) {
    console.error('[Audio] Error fetching audio:', err.message, 'statusCode:', err.statusCode);
    if (err.statusCode === 404 || err.statusCode === 422) {
      return res.status(404).json({ error: 'Audio not available — recording may be disabled for this agent' });
    }
    res.status(500).json({ error: 'Failed to fetch audio' });
  }
});

/**
 * GET /api/calls/analytics
 * Get comprehensive call analytics for the client
 */
router.get('/analytics', authenticate, async (req, res) => {
  try {
    const analytics = await callMonitor.getClientAnalytics(req.client.id);
    res.json(analytics);
  } catch (err) {
    console.error('GET /api/calls/analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/calls/agent/:agent_id/metrics
 * Get performance metrics for a specific agent
 */
router.get('/agent/:agent_id/metrics', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    // Verify agent belongs to client
    const agent = await get(
      'SELECT id FROM client_agents WHERE client_id = ? AND agent_id = ?',
      [req.client.id, agent_id]
    );
    if (!agent) {
      return res.status(403).json({ error: 'Agent not assigned to your account' });
    }

    const metrics = await callMonitor.getAgentMetrics(agent_id);
    res.json(metrics);
  } catch (err) {
    console.error('GET /api/calls/agent/:agent_id/metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch agent metrics' });
  }
});

/**
 * GET /api/calls/list
 * Get paginated call history with optional filters
 * Query params: limit, offset, agent_id, status
 */
router.get('/list', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0, agent_id, status } = req.query;

    const history = await callMonitor.getCallHistory(req.client.id, {
      limit: Math.min(parseInt(limit) || 50, 500),
      offset: parseInt(offset) || 0,
      agentId: agent_id,
      status,
    });

    res.json(history);
  } catch (err) {
    console.error('GET /api/calls/list error:', err);
    res.status(500).json({ error: 'Failed to fetch call list' });
  }
});

/**
 * GET /api/calls/active
 * Get active calls (real-time monitoring)
 */
router.get('/active', authenticate, async (req, res) => {
  try {
    const activeCalls = callMonitor.getActiveCalls().filter(call => call.clientId === req.client.id);
    res.json({ activeCalls });
  } catch (err) {
    console.error('GET /api/calls/active error:', err);
    res.status(500).json({ error: 'Failed to fetch active calls' });
  }
});

/**
 * GET /api/calls/dashboard/metrics
 * Admin endpoint - get system-wide metrics (requires admin)
 */
router.get('/dashboard/metrics', authenticate, async (req, res) => {
  try {
    if (req.client.is_admin !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const metrics = await callMonitor.getDashboardMetrics();
    res.json(metrics);
  } catch (err) {
    console.error('GET /api/calls/dashboard/metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

/**
 * POST /api/calls/:conversation_id/status
 * Update call status (for WebSocket integration)
 * Body: { status, metrics }
 */
router.post('/:conversation_id/status', authenticate, async (req, res) => {
  try {
    const { conversation_id } = req.params;
    const { status, metrics } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const call = await callMonitor.updateCallStatus(conversation_id, status, metrics || {});
    res.json({ success: true, call });
  } catch (err) {
    console.error('POST /api/calls/:conversation_id/status error:', err);
    res.status(500).json({ error: 'Failed to update call status' });
  }
});

/**
 * GET /api/calls/export/csv
 * Export call history as CSV
 */
router.get('/export/csv', authenticate, async (req, res) => {
  try {
    const { limit = 1000, offset = 0, agent_id, status } = req.query;

    const history = await callMonitor.getCallHistory(req.client.id, {
      limit: Math.min(parseInt(limit) || 1000, 10000), // Max 10k records
      offset: parseInt(offset) || 0,
      agentId: agent_id,
      status,
    });

    const fields = [
      'id',
      'conversation_id',
      'agent_id',
      'to_number',
      'lead_name',
      'status',
      'duration',
      'success',
      'quality_score',
      'error_message',
      'started_at',
      'ended_at',
      'created_at'
    ];

    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(history.calls);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="call-history.csv"');
    res.send(csv);
  } catch (err) {
    console.error('GET /api/calls/export/csv error:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

/**
 * GET /api/calls/export/pdf
 * Export call analytics as PDF report
 */
router.get('/export/pdf', authenticate, async (req, res) => {
  try {
    const analytics = await callMonitor.getClientAnalytics(req.client.id);

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="call-analytics.pdf"');

    doc.pipe(res);

    // Title
    doc.fontSize(20).text('Call Analytics Report', { align: 'center' });
    doc.moveDown();

    // Stats
    doc.fontSize(14).text('Summary Statistics:');
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Total Calls: ${analytics.stats.total_calls || 0}`);
    doc.text(`Successful Calls: ${analytics.stats.successful_calls || 0}`);
    doc.text(`Average Duration: ${Math.round(analytics.stats.avg_duration || 0)} seconds`);
    doc.text(`Average Quality Score: ${(analytics.stats.avg_quality || 0).toFixed(2)}`);
    doc.text(`Best Quality Score: ${(analytics.stats.best_quality || 0).toFixed(2)}`);
    doc.moveDown();

    // Recent Calls
    doc.fontSize(14).text('Recent Calls:');
    doc.moveDown(0.5);
    doc.fontSize(10);

    analytics.recentCalls.forEach(call => {
      doc.text(`ID: ${call.conversation_id} | Agent: ${call.agent_id} | To: ${call.to_number} | Status: ${call.status} | Duration: ${call.duration}s | Quality: ${call.quality_score || 'N/A'}`);
      doc.moveDown(0.2);
    });

    doc.end();
  } catch (err) {
    console.error('GET /api/calls/export/pdf error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
