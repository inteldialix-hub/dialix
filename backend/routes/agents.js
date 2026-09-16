const express = require('express');
const { Readable } = require('stream');
const { all, get, run } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateSchema } = require('../middleware/validate');
const { addSharedVoiceSchema, createAgentSchema } = require('../lib/schemas');
const { checkAgentLimit } = require('../lib/plan-limits');
const elevenlabs = require('../services/elevenlabs');
const vapi = require('../services/vapi');
const gemini = require('../services/gemini');

// ═══════════════════════════════════════════════════════════════
// AGENT TEMPLATES — Ready-made configurations for quick creation
// ═══════════════════════════════════════════════════════════════
const AGENT_TEMPLATES = {
  sales_outbound: {
    id: 'sales_outbound',
    name: 'Sales Outbound',
    description: 'Proactive outbound sales agent that qualifies leads, pitches your product, and books meetings.',
    icon: 'phone-outgoing',
    category: 'Sales',
    defaults: {
      first_message: "Hi {{name}}, this is {{agent_name}} from {{company}}. I'm reaching out because I noticed you might be interested in our solution. Do you have a quick moment?",
      prompt: `You are a professional outbound sales agent. Your goal is to:
1. Build rapport quickly and be personable
2. Qualify the lead by asking about their current challenges
3. Present the value proposition clearly and concisely
4. Handle objections with empathy and data
5. Book a follow-up meeting or demo if there's interest
6. Always be respectful if they're not interested — leave the door open

Rules:
- Never be pushy or aggressive
- Keep responses concise (2-3 sentences max)
- Ask one question at a time
- If they say they're busy, offer to call back at a better time
- Always confirm next steps before ending the call`,
      temperature: 0.7,
      max_duration_seconds: 300,
      language: 'en',
      llm: 'gpt-4o-mini',
    },
  },
  customer_support: {
    id: 'customer_support',
    name: 'Customer Support',
    description: 'Handles inbound support calls with empathy, troubleshoots issues, and escalates when needed.',
    icon: 'headphones',
    category: 'Support',
    defaults: {
      first_message: "Thank you for calling {{company}} support. My name is {{agent_name}}. How can I help you today?",
      prompt: `You are a friendly and knowledgeable customer support agent. Your goal is to:
1. Listen carefully to the customer's issue
2. Show empathy and acknowledge their frustration
3. Ask clarifying questions to understand the problem
4. Provide step-by-step solutions when possible
5. Escalate to a human agent if you cannot resolve the issue
6. Always confirm the issue is resolved before ending

Rules:
- Be patient and never rush the customer
- Use simple, non-technical language unless the customer is technical
- Apologize sincerely for any inconvenience
- Always provide a ticket/reference number if available
- End every call by asking "Is there anything else I can help you with?"`,
      temperature: 0.5,
      max_duration_seconds: 600,
      language: 'en',
      llm: 'gpt-4o-mini',
    },
  },
  receptionist: {
    id: 'receptionist',
    name: 'Receptionist',
    description: 'Professional front-desk agent that answers calls, routes inquiries, and takes messages.',
    icon: 'building',
    category: 'General',
    defaults: {
      first_message: "Good {{time_of_day}}! Thank you for calling {{company}}. How may I direct your call?",
      prompt: `You are a professional receptionist/front-desk agent. Your role is to:
1. Greet callers warmly and professionally
2. Determine the purpose of their call
3. Route them to the appropriate department or person
4. Take detailed messages if the person is unavailable
5. Provide basic company information (hours, location, services)
6. Schedule appointments when requested

Rules:
- Always be courteous and professional
- Collect the caller's name and phone number
- Repeat back messages to confirm accuracy
- If unsure where to route, ask clarifying questions
- Keep responses brief and efficient
- Never share internal/confidential information`,
      temperature: 0.4,
      max_duration_seconds: 180,
      language: 'en',
      llm: 'gpt-4o-mini',
    },
  },
  appointment_scheduler: {
    id: 'appointment_scheduler',
    name: 'Appointment Scheduler',
    description: 'Books, reschedules, and confirms appointments efficiently.',
    icon: 'calendar',
    category: 'Operations',
    defaults: {
      first_message: "Hi! I'm {{agent_name}} from {{company}}. I'm calling to help you schedule your appointment. When works best for you?",
      prompt: `You are an appointment scheduling assistant. Your goal is to:
1. Help callers book new appointments
2. Reschedule or cancel existing appointments
3. Confirm upcoming appointments
4. Collect necessary information (name, contact, preferred time, service type)
5. Handle scheduling conflicts gracefully

Rules:
- Always confirm the date, time, and type of appointment before finalizing
- Offer alternative times if the preferred slot is unavailable
- Send a summary of the booking details at the end
- Be efficient — don't waste the caller's time
- If you can't find a suitable time, offer to put them on a waitlist`,
      temperature: 0.3,
      max_duration_seconds: 240,
      language: 'en',
      llm: 'gpt-4o-mini',
    },
  },
  lead_qualifier: {
    id: 'lead_qualifier',
    name: 'Lead Qualifier',
    description: 'Qualifies inbound leads with BANT criteria and routes hot prospects to sales.',
    icon: 'filter',
    category: 'Sales',
    defaults: {
      first_message: "Hi {{name}}! Thanks for your interest in {{company}}. I'd love to learn more about what you're looking for. Can I ask you a few quick questions?",
      prompt: `You are a lead qualification agent. Your goal is to qualify leads using BANT criteria:
- Budget: Can they afford the solution?
- Authority: Are they the decision-maker?
- Need: Do they have a genuine need for the product?
- Timeline: When are they looking to make a decision?

Conversation flow:
1. Start friendly — ask about their role and company
2. Understand their current pain points
3. Gauge budget range (don't ask directly — infer from company size/needs)
4. Determine decision-making process
5. Understand timeline and urgency
6. Rate the lead as Hot, Warm, or Cold based on responses

Rules:
- Ask open-ended questions, not yes/no
- Don't interrogate — keep it conversational
- If they're a hot lead, express excitement and offer to connect them with sales
- If cold, thank them and offer to send information`,
      temperature: 0.6,
      max_duration_seconds: 300,
      language: 'en',
      llm: 'gpt-4o-mini',
    },
  },
  survey_collector: {
    id: 'survey_collector',
    name: 'Survey & Feedback',
    description: 'Collects customer feedback and survey responses in a conversational way.',
    icon: 'clipboard-list',
    category: 'Research',
    defaults: {
      first_message: "Hi {{name}}! I'm calling from {{company}}. We value your feedback and would love to hear about your recent experience. Do you have 2 minutes?",
      prompt: `You are a survey collection agent. Your goal is to gather honest feedback from customers.

Survey flow:
1. Ask about their overall satisfaction (1-10 scale)
2. Ask what they liked most about the product/service
3. Ask what could be improved
4. Ask if they would recommend to a friend (NPS)
5. Ask if there's anything else they'd like to share
6. Thank them for their time

Rules:
- Be warm and appreciative of their time
- Don't lead or bias their answers
- Accept all feedback — positive or negative — without being defensive
- Keep the survey under 3 minutes
- If they rate low, empathize and assure their feedback will be heard
- Thank them regardless of their responses`,
      temperature: 0.5,
      max_duration_seconds: 240,
      language: 'en',
      llm: 'gpt-4o-mini',
    },
  },
};

const router = express.Router();

/**
 * GET /api/agents
 * Returns a list of agents assigned to the current client
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const assignments = await all(
      "SELECT agent_id, agent_name, can_edit, COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE client_id = ?",
      [req.client.id]
    );

    if (assignments.length === 0) {
      return res.json({ agents: [] });
    }

    const agents = await Promise.all(
      assignments.map(async (a) => {
        // Auto-detect: if agent_id is NOT ElevenLabs format but DB says elevenlabs, fix it
        let effectiveProvider = a.provider;
        if (effectiveProvider === 'elevenlabs' && !a.agent_id.startsWith('agent_')) {
          effectiveProvider = 'vapi';
          run("UPDATE client_agents SET provider = 'vapi' WHERE agent_id = ?", [a.agent_id]).catch(() => {});
        }

        try {
          if (effectiveProvider === 'gemini') {
            const geminiData = await get('SELECT * FROM gemini_agents WHERE agent_id = ?', [a.agent_id]);
            return {
              agent_id: a.agent_id,
              name: geminiData?.name || a.agent_name,
              voice_id: geminiData?.voice || 'kore',
              language: geminiData?.language || 'en',
              llm: geminiData?.model || 'gemini-3.1-flash-live-preview',
              status: 'active',
              can_edit: a.can_edit ?? 1,
              provider: 'gemini',
            };
          }
          if (effectiveProvider === 'vapi') {
            const liveData = await vapi.getAssistant(a.agent_id);
            return {
              agent_id: a.agent_id,
              name: liveData.name || a.agent_name,
              voice_id: liveData.voice?.voiceId || null,
              language: liveData.transcriber?.language || 'en',
              llm: liveData.model?.model || null,
              status: 'active',
              can_edit: a.can_edit ?? 1,
              provider: 'vapi',
            };
          }
          // ElevenLabs (default)
          const liveData = await elevenlabs.getAgent(a.agent_id);
          return {
            agent_id: a.agent_id,
            name: liveData.name || a.agent_name,
            voice_id: liveData.conversation_config?.tts?.voice_id || null,
            language: liveData.conversation_config?.agent?.language || 'en',
            llm: liveData.conversation_config?.agent?.prompt?.llm || null,
            status: 'active',
            can_edit: a.can_edit ?? 1,
            provider: 'elevenlabs',
          };
        } catch (err) {
          return {
            agent_id: a.agent_id,
            name: a.agent_name,
            voice_id: null,
            language: null,
            llm: null,
            status: 'unavailable',
            can_edit: a.can_edit ?? 1,
            provider: effectiveProvider,
          };
        }
      })
    );

    res.json({ agents });
  } catch (err) {
    console.error('GET /api/agents error:', err);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * GET /api/agents/all  (Admin only — returns ALL agents from ElevenLabs)
 */
router.get('/all', authenticate, async (req, res) => {
  try {
    if (req.client.is_admin !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Fetch from all providers in parallel
    const [elAgents, vapiAgents, geminiAgents] = await Promise.all([
      elevenlabs.getAgents().catch(err => {
        console.warn('Failed to fetch ElevenLabs agents:', err.message);
        return [];
      }),
      (process.env.VAPI_API_KEY ? vapi.listAssistants() : Promise.resolve([])).catch(err => {
        console.warn('Failed to fetch Vapi agents:', err.message);
        return [];
      }),
      (process.env.GOOGLE_API_KEY ? all('SELECT * FROM gemini_agents') : Promise.resolve([])).catch(err => {
        console.warn('Failed to fetch Gemini agents:', err.message);
        return [];
      }),
    ]);

    const mapped = [
      ...elAgents.map(a => ({
        agent_id: a.agent_id,
        name: a.name || 'Unnamed Agent',
        tags: a.tags || [],
        last_call: a.last_call_time_unix_secs ? new Date(a.last_call_time_unix_secs * 1000).toISOString() : null,
        provider: 'elevenlabs',
      })),
      ...vapiAgents.map(a => ({
        agent_id: a.id,
        name: a.name || 'Unnamed Agent',
        tags: [],
        last_call: a.updatedAt || null,
        provider: 'vapi',
      })),
      ...geminiAgents.map(a => ({
        agent_id: a.agent_id,
        name: a.name || 'Unnamed Agent',
        tags: [],
        last_call: a.updated_at || null,
        provider: 'gemini',
      })),
    ];
    res.json({ agents: mapped });
  } catch (err) {
    console.error('GET /api/agents/all error:', err);
    res.status(500).json({ error: 'Failed to fetch all agents' });
  }
});

/**
 * GET /api/agents/voices
 * Returns ALL voices from the account (paginated under the hood)
 */
router.get('/voices', authenticate, async (req, res) => {
  try {
    const voices = await elevenlabs.getVoices();
    res.json({ voices, total: voices.length });
  } catch (err) {
    console.error('GET /api/agents/voices error:', err);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

/**
 * GET /api/agents/voices/search?q=...
 * Search the ElevenLabs shared/community voice library
 */
router.get('/voices/search', authenticate, async (req, res) => {
  try {
    const query = req.query.q || '';
    const voices = await elevenlabs.getSharedVoices(query, 50);
    res.json({ voices, total: voices.length });
  } catch (err) {
    console.error('GET /api/agents/voices/search error:', err);
    res.status(500).json({ error: 'Failed to search voices' });
  }
});

/**
 * POST /api/agents/voices/refresh
 * Force-clear the voice cache so next fetch gets fresh data
 */
router.post('/voices/refresh', authenticate, async (req, res) => {
  try {
    elevenlabs.invalidateVoiceCache();
    const voices = await elevenlabs.getVoices();
    res.json({ voices, total: voices.length, refreshed: true });
  } catch (err) {
    console.error('POST /api/agents/voices/refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh voices' });
  }
});

/**
 * POST /api/agents/voices/add-shared
 * Add a community/shared voice to the user's ElevenLabs library.
 * Required before assigning a community voice to an agent.
 * Body: { public_owner_id, voice_id, name }
 */
router.post('/voices/add-shared', authenticate, validateSchema(addSharedVoiceSchema), async (req, res) => {
  try {
    const { public_owner_id, voice_id, name } = req.body;
    const result = await elevenlabs.addSharedVoice(public_owner_id, voice_id, name);
    res.json({ success: true, voice_id, ...result });
  } catch (err) {
    console.error('POST /api/agents/voices/add-shared error:', err);
    res.status(500).json({ error: err.message || 'Failed to add shared voice' });
  }
});

/**
 * GET /api/agents/:agent_id/test-call/signed-url
 * Generate a signed WebSocket URL for test-calling an agent
 * directly from the browser. The URL is temporary (15 min).
 *
 * For ElevenLabs agents: returns { signed_url }
 * For Vapi agents: returns { provider: 'vapi', web_call_url, call_id }
 */
router.get('/:agent_id/test-call/signed-url', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    // Check provider — ElevenLabs vs Vapi
    let provider = 'elevenlabs';
    const assignment = await get(
      "SELECT COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE agent_id = ? LIMIT 1",
      [agent_id]
    );
    if (assignment) provider = assignment.provider || 'elevenlabs';
    if (provider === 'elevenlabs' && !agent_id.startsWith('agent_')) provider = 'vapi';

    if (provider === 'gemini') {
      // Gemini test calls are handled via a backend WebSocket bridge.
      // Return agent config so the frontend can start a browser-based call.
      const geminiData = await get('SELECT * FROM gemini_agents WHERE agent_id = ?', [agent_id]);
      if (!geminiData) {
        return res.status(404).json({ error: 'Gemini agent not found' });
      }
      return res.json({
        provider: 'gemini',
        agent_id,
        voice: geminiData.voice || 'Kore',
        model: geminiData.model || 'models/gemini-3.1-flash-live-preview',
      });
    }

    if (provider === 'vapi') {
      // Vapi web calls are initiated client-side via @vapi-ai/web SDK.
      // The server-side /call endpoint only supports phone calls.
      // Return the assistant ID + public key so the frontend can start the call.
      const publicKey = process.env.VAPI_PUBLIC_KEY;
      if (!publicKey) {
        return res.status(500).json({ error: 'VAPI_PUBLIC_KEY not configured on the server' });
      }
      return res.json({
        provider: 'vapi',
        assistant_id: agent_id,
        public_key: publicKey,
      });
    }

    const signedUrl = await elevenlabs.getSignedUrl(agent_id);
    res.json({ signed_url: signedUrl });
  } catch (err) {
    console.error('GET test-call/signed-url error:', err.message);
    if (err.body) console.error('  Vapi error body:', err.body);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Failed to get test call URL', details: err.body || null });
  }
});

/**
 * GET /api/agents/models
 * Returns all available TTS models from ElevenLabs with their
 * supported languages, capabilities, and metadata.
 * The frontend uses this to populate model & language dropdowns dynamically.
 */
router.get('/models', authenticate, async (req, res) => {
  try {
    const rawModels = await elevenlabs.getModels();

    // Only these TTS model IDs are valid for conversational AI agents
    const VALID_CONV_TTS = new Set([
      'eleven_turbo_v2',
      'eleven_flash_v2',
      'eleven_v3_conversational',
    ]);

    // Voice parameter support per model family
    const MODEL_CAPABILITIES = {
      'eleven_turbo_v2':          { supports_speed: false, supports_style: false, supports_speaker_boost: true,  latency_ms: 300 },
      'eleven_flash_v2':          { supports_speed: true,  supports_style: false, supports_speaker_boost: true,  latency_ms: 150 },
      'eleven_v3_conversational': { supports_speed: false, supports_style: false, supports_speaker_boost: false, latency_ms: 250 },
    };

    // Shape models into a clean format for the frontend
    // Filter to only valid conversational models and include parameter support info
    const models = rawModels
      .filter(m => VALID_CONV_TTS.has(m.model_id))
      .map(m => {
        const caps = MODEL_CAPABILITIES[m.model_id] || {};
        return {
          model_id: m.model_id,
          name: m.name,
          description: m.description || '',
          can_do_text_to_speech: m.can_do_text_to_speech || false,
          can_do_voice_conversion: m.can_do_voice_conversion || false,
          can_be_finetuned: m.can_be_finetuned || false,
          language_count: (m.languages || []).length,
          supported_language_ids: (m.languages || []).map(l => l.language_id),
          languages: (m.languages || []).map(l => ({
            language_id: l.language_id,
            name: l.name,
          })),
          max_characters_request: m.max_characters_request_free_user || 0,
          // Voice parameter support flags
          supports_speed: caps.supports_speed || false,
          supports_style: caps.supports_style || false,
          supports_speaker_boost: caps.supports_speaker_boost || false,
          latency_ms: caps.latency_ms || null,
        };
      });

    // Extract a deduplicated list of ALL supported languages across all models
    const langMap = new Map();
    rawModels.forEach(m => {
      (m.languages || []).forEach(l => {
        if (!langMap.has(l.language_id)) {
          langMap.set(l.language_id, l.name);
        }
      });
    });
    const languages = Array.from(langMap.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Also fetch LLM models for conversational AI
    let llmModels = [];
    try {
      const rawLLMs = await elevenlabs.getLLMs();
      llmModels = rawLLMs
        .filter(l => {
          if (l.deprecation_info && l.deprecation_info.is_deprecated) return false;
          if (l.is_checkpoint) return false;
          return true;
        })
        .map(l => {
          const id = l.llm || '';
          // Derive provider from ID prefix
          let provider = 'Other';
          if (/^gpt-/i.test(id)) provider = 'OpenAI';
          else if (/^claude/i.test(id)) provider = 'Anthropic';
          else if (/^gemini/i.test(id)) provider = 'Google';
          else if (/^qwen/i.test(id)) provider = 'ElevenLabs';
          else if (/^glm-/i.test(id)) provider = 'ElevenLabs';
          else if (/^gpt-oss/i.test(id)) provider = 'ElevenLabs';
          else if (/^deepseek/i.test(id)) provider = 'DeepSeek';

          // Estimate first-token latency in ms based on known benchmarks
          const lo = id.toLowerCase();
          let latency_ms = 500; // default for unknown models
          // ElevenLabs hosted — optimized infra, lowest latency
          if (lo.includes('glm-')) latency_ms = 150;
          else if (lo.includes('qwen')) latency_ms = 180;
          else if (lo.includes('gpt-oss')) latency_ms = 200;
          // OpenAI
          else if (lo.includes('gpt-4o-mini') || lo.includes('gpt-4.1-nano')) latency_ms = 200;
          else if (lo.includes('gpt-4.1-mini') || lo.includes('gpt-5-nano')) latency_ms = 250;
          else if (lo.includes('gpt-3.5')) latency_ms = 220;
          else if (lo.includes('gpt-4o') && !lo.includes('mini')) latency_ms = 350;
          else if (lo.includes('gpt-4.1') && !lo.includes('mini') && !lo.includes('nano')) latency_ms = 400;
          else if (lo.includes('gpt-4-turbo')) latency_ms = 500;
          else if (lo.includes('gpt-5-mini')) latency_ms = 300;
          else if (lo.includes('gpt-5') && !lo.includes('mini') && !lo.includes('nano')) latency_ms = 600;
          // Anthropic
          else if (lo.includes('haiku')) latency_ms = 200;
          else if (lo.includes('sonnet') && lo.includes('3.5')) latency_ms = 400;
          else if (lo.includes('sonnet') && (lo.includes('3.7') || lo.includes('4'))) latency_ms = 450;
          else if (lo.includes('sonnet-4.5')) latency_ms = 500;
          else if (lo.includes('opus')) latency_ms = 900;
          // Google
          else if (lo.includes('flash-lite') || lo.includes('flash_lite')) latency_ms = 150;
          else if (lo.includes('flash')) latency_ms = 180;
          else if (lo.includes('pro')) latency_ms = 600;
          // DeepSeek
          else if (lo.includes('deepseek')) latency_ms = 350;

          // Human-friendly label
          const label = id
            .replace(/^gpt-/i, 'GPT-')
            .replace(/^claude-/i, 'Claude ')
            .replace(/^gemini-/i, 'Gemini ')
            .replace(/^qwen/i, 'Qwen ')
            .replace(/^glm-/i, 'GLM ')
            .replace(/^deepseek-/i, 'DeepSeek ')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
            || id;

          return {
            value: id,
            label,
            provider,
            latency_ms,
            max_tokens: l.max_tokens_limit || null,
            context_window: l.max_context_limit || null,
            supports_image: l.supports_image_input || false,
            supports_document: l.supports_document_input || false,
            supports_parallel_tools: l.supports_parallel_tool_calls || false,
          };
        })
        .filter(l => l.value);
    } catch (llmErr) {
      console.warn('Failed to fetch LLMs, using empty list:', llmErr.message);
    }

    res.json({ models, languages, llms: llmModels });
  } catch (err) {
    console.error('GET /api/agents/models error:', err);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

/**
 * GET /api/agents/voices/:voice_id/preview
 * Proxies the ElevenLabs voice preview audio so the API key stays server-side.
 * Returns audio/mpeg stream for the browser to play.
 */
router.get('/voices/:voice_id/preview', authenticate, async (req, res) => {
  try {
    const { voice_id } = req.params;
    const BASE_URL = 'https://api.elevenlabs.io';

    // Use the text-to-speech endpoint with a short sample text
    const ttsRes = await fetch(`${BASE_URL}/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: 'Hello! This is a preview of my voice. How does it sound?',
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!ttsRes.ok) {
      const errBody = await ttsRes.text();
      console.error(`Voice preview error: ${ttsRes.status}`, errBody);
      return res.status(ttsRes.status).json({ error: 'Failed to generate voice preview' });
    }

    // Stream the audio directly to the browser
    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=3600',
    });

    const readable = Readable.fromWeb(ttsRes.body);
    readable.pipe(res);
  } catch (err) {
    console.error('GET /api/agents/voices/:id/preview error:', err);
    res.status(500).json({ error: 'Failed to generate voice preview' });
  }
});

/**
 * GET /api/agents/templates
 * Returns the list of ready-made agent templates available for quick creation.
 * Available to all authenticated clients.
 */
router.get('/templates', authenticate, (req, res) => {
  const templates = Object.values(AGENT_TEMPLATES).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.icon,
    category: t.category,
    defaults: t.defaults,
  }));
  res.json({ templates });
});

/**
 * Parse a provider error body into a readable user-facing message.
 */
function parseProviderError(err) {
  let body = err.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { /* keep string */ }
  }
  if (body && typeof body === 'object') {
    // ElevenLabs: { detail: { message, status } | string }
    if (body.detail) {
      if (typeof body.detail === 'string') return body.detail;
      if (body.detail.message) return body.detail.message;
    }
    // Vapi: { message: string | string[] }
    if (body.message) {
      return Array.isArray(body.message) ? body.message.join('; ') : body.message;
    }
    if (body.error) return typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
  }
  if (typeof body === 'string' && body.length < 500) return body;
  return err.message || 'Failed to create agent';
}

/**
 * POST /api/agents
 * Create a new agent on ElevenLabs or Vapi and auto-assign it to the
 * requesting client. Plan-agent-limit enforced for non-admin clients.
 * Body validated by `createAgentSchema`.
 * Supports `template` field to pre-fill defaults from `AGENT_TEMPLATES`.
 */
router.post('/', authenticate, validateSchema(createAgentSchema), async (req, res) => {
  try {
    // Enforce plan limit for non-admin clients
    if (req.client.is_admin !== 1) {
      const limit = await checkAgentLimit(req.client.id);
      if (!limit.allowed) {
        return res.status(403).json({ error: limit.reason });
      }
    }

    // Merge template defaults (if specified) with request body — request body wins
    let merged = { ...req.body };
    if (req.body.template && AGENT_TEMPLATES[req.body.template]) {
      const tpl = AGENT_TEMPLATES[req.body.template].defaults;
      merged = { ...tpl, ...req.body };
    }

    const {
      name,
      first_message,
      language = 'en',
      llm = 'gpt-4o-mini',
      voice_id,
      tts_model_id = 'eleven_v3_conversational',
      temperature = 0.7,
      prompt = '',
      max_duration_seconds = 300,
      provider = 'elevenlabs',
      voice_provider,
      model_provider,
      transcriber_provider,
      gemini_voice,
      gemini_model,
      thinking_level,
      media_resolution,
      max_context_size,
      target_context_size,
      grounding_google_search,
      affective_dialog,
      proactive_audio,
    } = merged;

    // ── Gemini creation ──
    if (provider === 'gemini') {
      if (!process.env.GOOGLE_API_KEY) {
        return res.status(503).json({ error: 'Gemini is not configured on this server. Contact your administrator.' });
      }

      // Generate a unique agent ID for local storage
      const agentId = 'gemini_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);

      const geminiConfig = {
        agent_id: agentId,
        name,
        system_prompt: prompt || `You are ${name}, a helpful AI assistant.`,
        voice: gemini_voice || voice_id || 'Kore',
        model: gemini_model || 'models/gemini-3.1-flash-live-preview',
        temperature: parseFloat(temperature) || 1.0,
        language: language || 'en',
        max_duration_seconds: parseInt(max_duration_seconds, 10) || 600,
        first_message: first_message || '',
        thinking_level: thinking_level || 'none',
        media_resolution: media_resolution || 'medium',
        max_context_size: parseInt(max_context_size, 10) || 128000,
        target_context_size: parseInt(target_context_size, 10) || 64000,
        grounding_google_search: grounding_google_search ? 1 : 0,
        affective_dialog: affective_dialog ? 1 : 0,
        proactive_audio: proactive_audio ? 1 : 0,
      };

      console.log(`Creating Gemini agent for client ${req.client.id}:`, name);

      // Store in gemini_agents table
      await run(
        `INSERT INTO gemini_agents (agent_id, name, system_prompt, voice, model, temperature, language, max_duration_seconds, first_message, thinking_level, media_resolution, max_context_size, target_context_size, grounding_google_search, affective_dialog, proactive_audio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [geminiConfig.agent_id, geminiConfig.name, geminiConfig.system_prompt, geminiConfig.voice,
         geminiConfig.model, geminiConfig.temperature, geminiConfig.language,
         geminiConfig.max_duration_seconds, geminiConfig.first_message,
         geminiConfig.thinking_level, geminiConfig.media_resolution, geminiConfig.max_context_size,
         geminiConfig.target_context_size, geminiConfig.grounding_google_search,
         geminiConfig.affective_dialog, geminiConfig.proactive_audio]
      );

      // Link to client
      await run(
        'INSERT OR IGNORE INTO client_agents (client_id, agent_id, agent_name, can_edit, provider) VALUES (?, ?, ?, 1, ?)',
        [req.client.id, agentId, name, 'gemini']
      );

      return res.status(201).json({
        agent: {
          agent_id: agentId,
          name,
          language,
          llm: geminiConfig.model,
          voice_id: geminiConfig.voice,
          provider: 'gemini',
          can_edit: 1,
        },
      });
    }

    // ── Vapi creation ──
    if (provider === 'vapi') {
      if (!process.env.VAPI_API_KEY) {
        return res.status(503).json({ error: 'Vapi is not configured on this server. Contact your administrator.' });
      }

      const vapiBody = {
        name,
        firstMessage: first_message || `Hello! I'm ${name}. How can I help you today?`,
        model: {
          provider: model_provider || 'openai',
          model: llm || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: prompt || `You are ${name}, a helpful AI assistant.`,
            },
          ],
          temperature: parseFloat(temperature),
        },
        transcriber: {
          provider: transcriber_provider || 'deepgram',
          model: 'nova-2',
          language: language || 'en',
        },
        maxDurationSeconds: parseInt(max_duration_seconds, 10),
      };

      if (voice_id) {
        vapiBody.voice = {
          provider: voice_provider || '11labs',
          voiceId: voice_id,
        };
      }

      console.log(`Creating Vapi agent for client ${req.client.id}:`, name);
      const created = await vapi.createAssistant(vapiBody);

      await run(
        'INSERT OR IGNORE INTO client_agents (client_id, agent_id, agent_name, can_edit, provider) VALUES (?, ?, ?, 1, ?)',
        [req.client.id, created.id, name, 'vapi']
      );

      return res.status(201).json({
        agent: {
          agent_id: created.id,
          name: created.name || name,
          language: created.transcriber?.language || language,
          llm: created.model?.model || llm,
          provider: 'vapi',
          can_edit: 1,
        },
      });
    }

    // ── ElevenLabs creation (default) ──
    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: 'ElevenLabs is not configured on this server. Contact your administrator.' });
    }

    const agentBody = {
      name,
      conversation_config: {
        agent: {
          first_message: first_message || `Hello! I'm ${name}. How can I help you today?`,
          language,
          prompt: {
            prompt: prompt || `You are ${name}, a helpful AI assistant.`,
            llm,
            temperature: parseFloat(temperature),
            max_tokens: -1,
          },
        },
        tts: {
          model_id: tts_model_id,
          ...(voice_id ? { voice_id } : {}),
        },
        conversation: {
          max_duration_seconds: parseInt(max_duration_seconds, 10),
        },
      },
      platform_settings: {
        privacy: {
          record_voice: true,
          retention_days: 90,
        },
      },
    };

    console.log(`Creating ElevenLabs agent for client ${req.client.id}:`, name);
    const created = await elevenlabs.createAgent(agentBody);

    await run(
      'INSERT OR IGNORE INTO client_agents (client_id, agent_id, agent_name, can_edit, provider) VALUES (?, ?, ?, 1, ?)',
      [req.client.id, created.agent_id, name, 'elevenlabs']
    );

    res.status(201).json({
      agent: {
        agent_id: created.agent_id,
        name: created.name || name,
        language,
        llm,
        provider: 'elevenlabs',
        can_edit: 1,
      },
    });
  } catch (err) {
    console.error('POST /api/agents error:', err.message, err.body || '');
    // Map provider errors to client-facing status codes.
    // Don't blindly forward provider status (e.g. 405) — use 502 for upstream failures.
    let status = 500;
    if (err.statusCode === 400 || err.statusCode === 422) status = 400;
    else if (err.statusCode === 401 || err.statusCode === 403) status = 503; // provider auth issue
    else if (err.statusCode === 429) status = 429;
    else if (err.statusCode >= 400) status = 502; // upstream error
    res.status(status).json({ error: parseProviderError(err) });
  }
});

/**
 * DELETE /api/agents/:agent_id  (Admin only — delete from provider + cleanup DB)
 */
router.delete('/:agent_id', authenticate, async (req, res) => {
  try {
    if (req.client.is_admin !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { agent_id } = req.params;

    // Check which provider this agent belongs to
    const assignment = await get(
      "SELECT COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE agent_id = ? LIMIT 1",
      [agent_id]
    );
    let provider = assignment?.provider || 'elevenlabs';

    // Auto-detect: if agent_id is NOT ElevenLabs format, assume Vapi
    if (provider === 'elevenlabs' && !agent_id.startsWith('agent_')) {
      provider = 'vapi';
    }

    // Delete from the correct provider
    if (provider === 'gemini') {
      await run('DELETE FROM gemini_agents WHERE agent_id = ?', [agent_id]);
    } else if (provider === 'vapi') {
      await vapi.deleteAssistant(agent_id);
    } else {
      await elevenlabs.deleteAgent(agent_id);
    }

    // Remove all DB assignments for this agent
    const result = await run('DELETE FROM client_agents WHERE agent_id = ?', [agent_id]);
    console.log(`Deleted ${provider} agent ${agent_id}, removed ${result.changes} DB assignments`);

    res.json({ success: true, assignments_removed: result.changes });
  } catch (err) {
    console.error('DELETE /api/agents/:id error:', err);
    res.status(500).json({ error: err.body || 'Failed to delete agent' });
  }
});

/**
 * POST /api/agents/:agent_id/duplicate — Clone an agent with a new name
 */
router.post('/:agent_id/duplicate', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    // Check agent belongs to this client
    const assignment = await get(
      "SELECT agent_id, agent_name, provider FROM client_agents WHERE client_id = ? AND agent_id = ?",
      [req.client.id, agent_id]
    );
    if (!assignment) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check plan limit
    const limitCheck = await checkAgentLimit(req.client.id);
    if (!limitCheck.allowed) {
      return res.status(403).json({ error: limitCheck.reason });
    }

    const provider = assignment.provider || 'elevenlabs';
    const newName = `${assignment.agent_name} (Copy)`;
    let newAgentId;

    if (provider === 'gemini') {
      // Clone from gemini_agents table
      const original = await get('SELECT * FROM gemini_agents WHERE agent_id = ?', [agent_id]);
      if (!original) return res.status(404).json({ error: 'Gemini agent config not found' });

      newAgentId = `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await run(
        `INSERT INTO gemini_agents (agent_id, name, system_prompt, first_message, language, voice, model, temperature, max_duration_seconds, client_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [newAgentId, newName, original.system_prompt, original.first_message, original.language, original.voice, original.model, original.temperature, original.max_duration_seconds, req.client.id]
      );
    } else if (provider === 'vapi') {
      // Fetch from Vapi and recreate
      const original = await vapi.getAssistant(agent_id);
      const clonePayload = {
        name: newName,
        model: original.model,
        voice: original.voice,
        firstMessage: original.firstMessage,
        ...(original.transcriber && { transcriber: original.transcriber }),
      };
      const newAgent = await vapi.createAssistant(clonePayload);
      newAgentId = newAgent.id;
    } else {
      // ElevenLabs — fetch config and recreate
      const original = await elevenlabs.getAgentConfig(agent_id);
      const cloneConfig = {
        ...original,
        name: newName,
      };
      // Remove IDs and timestamps that shouldn't be cloned
      delete cloneConfig.agent_id;
      delete cloneConfig.created_at;
      const newAgent = await elevenlabs.createAgent(cloneConfig);
      newAgentId = newAgent.agent_id;
    }

    // Assign to client
    await run(
      'INSERT INTO client_agents (client_id, agent_id, agent_name, provider) VALUES (?, ?, ?, ?)',
      [req.client.id, newAgentId, newName, provider]
    );

    // Copy agent settings if they exist
    const settings = await get('SELECT * FROM agent_settings WHERE agent_id = ?', [agent_id]);
    if (settings) {
      await run(
        'INSERT OR IGNORE INTO agent_settings (agent_id, tts_model_id, stability, similarity_boost, speed, streaming_latency) VALUES (?, ?, ?, ?, ?, ?)',
        [newAgentId, settings.tts_model_id, settings.stability, settings.similarity_boost, settings.speed, settings.streaming_latency]
      );
    }

    // Log audit
    await run(
      "INSERT INTO audit_logs (client_id, actor, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
      [req.client.id, req.client.email, 'agent.duplicated', 'agent', newAgentId, JSON.stringify({ source_agent: agent_id, new_name: newName })]
    );

    res.json({ success: true, agent_id: newAgentId, name: newName, provider });
  } catch (err) {
    console.error('POST /api/agents/:id/duplicate error:', err);
    res.status(500).json({ error: err.body || 'Failed to duplicate agent' });
  }
});

/**
 * POST /api/agents/:agent_id/archive — Soft-archive an agent (mark inactive, keep data)
 */
router.post('/:agent_id/archive', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    const assignment = await get(
      'SELECT agent_id, agent_name FROM client_agents WHERE client_id = ? AND agent_id = ?',
      [req.client.id, agent_id]
    );
    if (!assignment) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Toggle archive status in agent_settings
    const current = await get('SELECT status FROM agent_settings WHERE agent_id = ?', [agent_id]);
    const newStatus = current?.status === 'archived' ? 'active' : 'archived';

    await run(
      'INSERT INTO agent_settings (agent_id, status) VALUES (?, ?) ON CONFLICT(agent_id) DO UPDATE SET status = ?',
      [agent_id, newStatus, newStatus]
    );

    // Log audit
    await run(
      "INSERT INTO audit_logs (client_id, actor, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
      [req.client.id, req.client.email, newStatus === 'archived' ? 'agent.archived' : 'agent.unarchived', 'agent', agent_id, JSON.stringify({ name: assignment.agent_name })]
    );

    res.json({ success: true, agent_id, status: newStatus });
  } catch (err) {
    console.error('POST /api/agents/:id/archive error:', err);
    res.status(500).json({ error: 'Failed to archive agent' });
  }
});

/**
 * GET /api/agents/:agent_id/raw — Debug: raw Vapi response (admin only)
 */
router.get('/:agent_id/raw', authenticate, async (req, res) => {
  try {
    if (req.client.is_admin !== 1) return res.status(403).json({ error: 'Admin only' });
    const raw = await vapi.getAssistant(req.params.agent_id);
    res.json(raw);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/agents/:agent_id
 * Returns the FULL agent configuration (provider-aware)
 * Flattened into a clean shape for the frontend
 */
router.get('/:agent_id', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    // Admin can access any agent; regular clients need assignment
    let clientCanEdit = 1;
    let allowedFeatures = null;

    // Check provider from DB
    let provider = 'elevenlabs';

    if (req.client.is_admin !== 1) {
      const assignment = await get(
        "SELECT id, can_edit, allowed_features, COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE client_id = ? AND agent_id = ?",
        [req.client.id, agent_id]
      );
      if (!assignment) {
        return res.status(403).json({ error: 'Agent not assigned to your account' });
      }
      clientCanEdit = assignment.can_edit ?? 1;
      provider = assignment.provider || 'elevenlabs';
      try { allowedFeatures = assignment.allowed_features ? JSON.parse(assignment.allowed_features) : null; } catch(e) {}
    } else {
      // Admin: check DB for provider, or auto-detect by ID format
      const assignment = await get(
        "SELECT COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE agent_id = ? LIMIT 1",
        [agent_id]
      );
      if (assignment) {
        provider = assignment.provider || 'elevenlabs';
      }

      // Auto-detect: if agent_id is NOT an ElevenLabs format (agent_xxxx), assume Vapi
      if (provider === 'elevenlabs' && !agent_id.startsWith('agent_')) {
        provider = 'vapi';
        // Also fix the DB entry so future lookups are correct
        await run("UPDATE client_agents SET provider = 'vapi' WHERE agent_id = ?", [agent_id]).catch(() => {});
      }
    }

    // ── Gemini agent detail ──
    if (provider === 'gemini') {
      const geminiData = await get('SELECT * FROM gemini_agents WHERE agent_id = ?', [agent_id]);
      if (!geminiData) {
        return res.status(404).json({ error: 'Gemini agent configuration not found' });
      }

      const config = {
        agent_id: geminiData.agent_id,
        name: geminiData.name,
        provider: 'gemini',

        // General
        first_message: geminiData.first_message || '',
        language: geminiData.language || 'en',

        // Prompt / Model
        prompt: geminiData.system_prompt || '',
        llm: geminiData.model || 'models/gemini-3.1-flash-live-preview',
        temperature: geminiData.temperature ?? 1.0,

        // Voice (built-in Gemini voices)
        voice_id: geminiData.voice || 'Kore',
        gemini_voice: geminiData.voice || 'Kore',
        gemini_model: geminiData.model || 'models/gemini-3.1-flash-live-preview',

        // Call behavior
        max_duration_seconds: geminiData.max_duration_seconds ?? 600,

        // Gemini-specific features
        thinking_level: geminiData.thinking_level || 'none',
        media_resolution: geminiData.media_resolution || 'medium',
        max_context_size: geminiData.max_context_size ?? 128000,
        target_context_size: geminiData.target_context_size ?? 64000,
        grounding_google_search: !!geminiData.grounding_google_search,
        affective_dialog: !!geminiData.affective_dialog,
        proactive_audio: !!geminiData.proactive_audio,

        // Timestamps
        created_at: geminiData.created_at || null,
        updated_at: geminiData.updated_at || null,
      };

      res.json({ config, can_edit: clientCanEdit, allowed_features: allowedFeatures });
      return;
    }

    // ── Vapi agent detail ──
    if (provider === 'vapi') {
      const raw = await vapi.getAssistant(agent_id);

      const config = {
        agent_id: raw.id,
        name: raw.name || '',
        tags: [],
        provider: 'vapi',

        // General
        first_message: raw.firstMessage || '',
        first_message_mode: raw.firstMessageMode || 'assistant-speaks-first',
        first_message_interruptions_enabled: raw.firstMessageInterruptionsEnabled ?? false,
        language: raw.transcriber?.language || 'en',

        // Prompt / Model
        prompt: (raw.model?.messages || []).find(m => m.role === 'system')?.content || '',
        llm: raw.model?.model || '',
        model_provider: raw.model?.provider || 'openai',
        temperature: raw.model?.temperature ?? 0.7,
        max_tokens: raw.model?.maxTokens ?? -1,
        emotion_recognition_enabled: raw.model?.emotionRecognitionEnabled ?? false,
        num_fast_turns: raw.model?.numFastTurns ?? 0,

        // Voice
        voice_id: raw.voice?.voiceId || '',
        voice_provider: raw.voice?.provider || '',
        voice_model: raw.voice?.model ?? undefined,
        voice_caching_enabled: raw.voice?.cachingEnabled ?? true,
        voice_speed: raw.voice?.speed ?? undefined,
        voice_stability: raw.voice?.stability ?? undefined,
        voice_similarity_boost: raw.voice?.similarityBoost ?? undefined,
        voice_style: raw.voice?.style ?? undefined,
        voice_input_preprocessing_enabled: raw.voice?.inputPreprocessingEnabled ?? undefined,
        voice_input_reformatting_enabled: raw.voice?.inputReformattingEnabled ?? undefined,
        voice_input_min_characters: raw.voice?.inputMinCharacters ?? undefined,
        voice_filler_injection_enabled: raw.voice?.fillerInjectionEnabled ?? undefined,

        // Transcriber
        transcriber_provider: raw.transcriber?.provider || 'deepgram',
        transcriber_model: raw.transcriber?.model || 'nova-2',
        transcriber_language: raw.transcriber?.language || 'en',
        transcriber_confidence_threshold: raw.transcriber?.confidenceThreshold ?? undefined,
        transcriber_smart_format: raw.transcriber?.smartFormat ?? undefined,
        transcriber_keywords: raw.transcriber?.keywords || [],
        transcriber_endpointing: raw.transcriber?.endpointing ?? undefined,

        // Call behavior
        max_duration_seconds: raw.maxDurationSeconds ?? 600,
        silence_timeout_seconds: raw.silenceTimeoutSeconds ?? 30,
        end_call_after_silence_seconds: raw.endCallAfterSilenceSeconds ?? 30,
        end_call_message: raw.endCallMessage || '',
        end_call_phrases: raw.endCallPhrases || [],
        end_call_function_enabled: raw.endCallFunctionEnabled ?? true,
        voicemail_message: raw.voicemailMessage || '',
        voicemail_detection: raw.voicemailDetection?.provider || 'off',
        background_sound: raw.backgroundSound || 'off',
        background_denoising_enabled: raw.backgroundDenoisingEnabled ?? false,

        // Start Speaking Plan
        start_speaking_wait_seconds: raw.startSpeakingPlan?.waitSeconds ?? 0.4,
        smart_endpointing_enabled: raw.startSpeakingPlan?.smartEndpointingEnabled ?? false,
        transcription_endpointing_plan: raw.startSpeakingPlan?.transcriptionEndpointingPlan ?? undefined,

        // Stop Speaking Plan
        stop_speaking_num_words: raw.stopSpeakingPlan?.numWords ?? 0,
        stop_speaking_voice_seconds: raw.stopSpeakingPlan?.voiceSeconds ?? 0.2,
        stop_speaking_backoff_seconds: raw.stopSpeakingPlan?.backoffSeconds ?? 1,

        // Compliance
        hipaa_enabled: raw.compliancePlan?.hipaaEnabled ?? false,

        // Recording / Artifacts
        recording_enabled: raw.artifactPlan?.recordingEnabled ?? true,
        video_recording_enabled: raw.artifactPlan?.videoRecordingEnabled ?? false,

        // Background Denoising
        smart_denoising_enabled: raw.backgroundSpeechDenoisingPlan?.smartDenoisingPlan?.enabled ?? true,

        // Monitor
        monitor_listen_enabled: raw.monitorPlan?.listenEnabled ?? false,
        monitor_control_enabled: raw.monitorPlan?.controlEnabled ?? false,

        // Server URL
        server_url: raw.server?.url || '',

        // Keypad Input
        keypad_enabled: raw.keypadInputPlan?.enabled ?? false,
        keypad_timeout_seconds: raw.keypadInputPlan?.timeoutSeconds ?? 3,
        keypad_delimiters: raw.keypadInputPlan?.delimiters || '#',

        // Message configuration
        client_messages: raw.clientMessages || [],
        server_messages: raw.serverMessages || [],

        // Timestamps
        created_at: raw.createdAt || null,
        updated_at: raw.updatedAt || null,
      };

      res.json({ config, can_edit: clientCanEdit, allowed_features: allowedFeatures });
      return;
    }

    // ── ElevenLabs agent detail (default) ──
    const raw = await elevenlabs.getAgent(agent_id);

    const config = {
      agent_id: raw.agent_id,
      name: raw.name || '',
      tags: raw.tags || [],
      provider: 'elevenlabs',

      // Agent / General
      first_message: raw.conversation_config?.agent?.first_message || '',
      language: raw.conversation_config?.agent?.language || 'en',
      disable_first_message_interruptions: raw.conversation_config?.agent?.disable_first_message_interruptions || false,
      max_conversation_duration_message: raw.conversation_config?.agent?.max_conversation_duration_message || '',
      hinglish_mode: raw.conversation_config?.agent?.hinglish_mode || false,
      ignore_default_personality: raw.conversation_config?.agent?.prompt?.ignore_default_personality || false,

      // Dynamic variables
      dynamic_variables: raw.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders || {},

      // Prompt
      prompt: raw.conversation_config?.agent?.prompt?.prompt || '',
      llm: raw.conversation_config?.agent?.prompt?.llm || '',
      temperature: raw.conversation_config?.agent?.prompt?.temperature ?? 0.7,
      max_tokens: raw.conversation_config?.agent?.prompt?.max_tokens ?? -1,

      // TTS / Voice
      voice_id: raw.conversation_config?.tts?.voice_id || '',
      tts_model_id: raw.conversation_config?.tts?.model_id || '',
      stability: raw.conversation_config?.tts?.stability ?? 0.5,
      speed: raw.conversation_config?.tts?.speed ?? 1.0,
      similarity_boost: raw.conversation_config?.tts?.similarity_boost ?? 0.75,
      optimize_streaming_latency: raw.conversation_config?.tts?.optimize_streaming_latency ?? 0,
      agent_output_audio_format: raw.conversation_config?.tts?.agent_output_audio_format || 'pcm_16000',
      text_normalisation_type: raw.conversation_config?.tts?.text_normalisation_type || 'auto',

      // V3 Conversational config
      expressive_mode: raw.tts_conversational_config?.expressive_mode ?? true,
      suggested_audio_tags: raw.tts_conversational_config?.suggested_audio_tags || [],

      // ASR
      asr_quality: raw.conversation_config?.asr?.quality || 'high',
      asr_provider: raw.conversation_config?.asr?.provider || 'scribe_realtime',
      asr_keywords: raw.conversation_config?.asr?.keywords || [],

      // VAD
      background_voice_detection: raw.conversation_config?.vad?.background_voice_detection ?? true,

      // Turn / Call behavior
      turn_timeout: raw.conversation_config?.turn?.turn_timeout ?? 2.0,
      silence_end_call_timeout: raw.conversation_config?.turn?.silence_end_call_timeout ?? 10.0,
      turn_eagerness: raw.conversation_config?.turn?.turn_eagerness || 'normal',
      mode: raw.conversation_config?.turn?.mode || 'turn',
      max_duration_seconds: raw.conversation_config?.conversation?.max_duration_seconds ?? 300,

      // Conversation
      text_only: raw.conversation_config?.conversation?.text_only ?? false,
      monitoring_enabled: raw.conversation_config?.conversation?.monitoring_enabled ?? false,

      // Privacy
      record_voice: raw.platform_settings?.privacy?.record_voice ?? true,
      retention_days: raw.platform_settings?.privacy?.retention_days ?? 90,
      delete_transcript_and_pii: raw.platform_settings?.privacy?.delete_transcript_and_pii ?? false,
      zero_retention_mode: raw.platform_settings?.privacy?.zero_retention_mode ?? false,

      // Guardrails
      guardrail_focus: raw.platform_settings?.guardrails?.focus?.is_enabled ?? false,
      guardrail_prompt_injection: raw.platform_settings?.guardrails?.prompt_injection?.is_enabled ?? false,

      // Call limits
      agent_concurrency_limit: raw.platform_settings?.call_limits?.agent_concurrency_limit ?? -1,
      daily_limit: raw.platform_settings?.call_limits?.daily_limit ?? 100000,

      // Auth
      enable_auth: raw.platform_settings?.auth?.enable_auth ?? false,
    };

    res.json({ config, can_edit: clientCanEdit, allowed_features: allowedFeatures });
  } catch (err) {
    console.error('GET /api/agents/:id error:', err.message || err);
    try {
      const fallback = await get("SELECT agent_name, COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE agent_id = ? LIMIT 1", [req.params.agent_id]);
      if (fallback) {
        return res.json({
          config: {
            agent_id: req.params.agent_id,
            name: fallback.agent_name || 'AI Voice Agent',
            provider: fallback.provider || 'elevenlabs',
            first_message: 'Hello! How can I assist you today?',
            language: 'en',
            prompt: 'You are a professional voice assistant.',
            llm: 'gpt-4o-mini',
            temperature: 0.7,
            voice_id: '',
            dynamic_variables: {},
            tags: [],
          },
          can_edit: 1,
          allowed_features: null,
          fallback: true,
        });
      }
    } catch (fallbackErr) {
      console.error('Fallback agent lookup failed:', fallbackErr);
    }
    res.status(500).json({ error: 'Failed to fetch agent details' });
  }
});

/**
 * PATCH /api/agents/:agent_id
 * Generic agent update — accepts flat fields and maps them to the correct API structure.
 * Provider-aware: detects whether agent is ElevenLabs or Vapi.
 * Only the fields you send will be updated (sparse PATCH).
 */
router.patch('/:agent_id', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    // Detect provider from DB
    let provider = 'elevenlabs';

    // Admin can update any agent; regular clients need assignment + edit permission
    if (req.client.is_admin !== 1) {
      const assignment = await get(
        "SELECT id, can_edit, COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE client_id = ? AND agent_id = ?",
        [req.client.id, agent_id]
      );
      if (!assignment) {
        return res.status(403).json({ error: 'Agent not assigned to your account' });
      }
      if (!assignment.can_edit) {
        return res.status(403).json({ error: 'You have view-only access to this agent. Contact your admin for edit permissions.' });
      }
      provider = assignment.provider || 'elevenlabs';
    } else {
      const assignment = await get(
        "SELECT COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE agent_id = ? LIMIT 1",
        [agent_id]
      );
      provider = assignment?.provider || 'elevenlabs';

      // Auto-detect: if agent_id is NOT an ElevenLabs format (agent_xxxx), assume Vapi
      if (provider === 'elevenlabs' && !agent_id.startsWith('agent_')) {
        provider = 'vapi';
        await run("UPDATE client_agents SET provider = 'vapi' WHERE agent_id = ?", [agent_id]).catch(() => {});
      }
    }

    const body = req.body;

    // ════════════════════════════════════════════════
    // ── Gemini PATCH ──
    // ════════════════════════════════════════════════
    if (provider === 'gemini') {
      const updates = [];
      const params = [];

      if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
      if (body.prompt !== undefined) { updates.push('system_prompt = ?'); params.push(body.prompt); }
      if (body.gemini_voice !== undefined || body.voice_id !== undefined) {
        updates.push('voice = ?'); params.push(body.gemini_voice || body.voice_id);
      }
      if (body.gemini_model !== undefined) { updates.push('model = ?'); params.push(body.gemini_model); }
      if (body.temperature !== undefined) { updates.push('temperature = ?'); params.push(parseFloat(body.temperature)); }
      if (body.language !== undefined) { updates.push('language = ?'); params.push(body.language); }
      if (body.max_duration_seconds !== undefined) { updates.push('max_duration_seconds = ?'); params.push(parseInt(body.max_duration_seconds, 10)); }
      if (body.first_message !== undefined) { updates.push('first_message = ?'); params.push(body.first_message); }
      if (body.thinking_level !== undefined) { updates.push('thinking_level = ?'); params.push(body.thinking_level); }
      if (body.media_resolution !== undefined) { updates.push('media_resolution = ?'); params.push(body.media_resolution); }
      if (body.max_context_size !== undefined) { updates.push('max_context_size = ?'); params.push(parseInt(body.max_context_size, 10)); }
      if (body.target_context_size !== undefined) { updates.push('target_context_size = ?'); params.push(parseInt(body.target_context_size, 10)); }
      if (body.grounding_google_search !== undefined) { updates.push('grounding_google_search = ?'); params.push(body.grounding_google_search ? 1 : 0); }
      if (body.affective_dialog !== undefined) { updates.push('affective_dialog = ?'); params.push(body.affective_dialog ? 1 : 0); }
      if (body.proactive_audio !== undefined) { updates.push('proactive_audio = ?'); params.push(body.proactive_audio ? 1 : 0); }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push("updated_at = datetime('now')");
      params.push(agent_id);

      await run(`UPDATE gemini_agents SET ${updates.join(', ')} WHERE agent_id = ?`, params);

      // Also update name in client_agents if changed
      if (body.name !== undefined) {
        await run('UPDATE client_agents SET agent_name = ? WHERE agent_id = ?', [body.name, agent_id]);
      }

      const updated = await get('SELECT * FROM gemini_agents WHERE agent_id = ?', [agent_id]);
      return res.json({ config: updated });
    }

    // ════════════════════════════════════════════════
    // ── Vapi PATCH ──
    // ════════════════════════════════════════════════
    if (provider === 'vapi') {
      const vapiPatch = {};

      if (body.name !== undefined) vapiPatch.name = body.name;
      if (body.first_message !== undefined) vapiPatch.firstMessage = body.first_message;
      if (body.max_duration_seconds !== undefined) {
        vapiPatch.maxDurationSeconds = parseInt(body.max_duration_seconds, 10);
      }

      // Model
      const hasModelChanges = body.prompt !== undefined || body.llm !== undefined ||
        body.temperature !== undefined || body.model_provider !== undefined;
      if (hasModelChanges) {
        vapiPatch.model = {};
        if (body.model_provider !== undefined) vapiPatch.model.provider = body.model_provider;
        if (body.llm !== undefined) vapiPatch.model.model = body.llm;
        if (body.temperature !== undefined) {
          const temp = parseFloat(body.temperature);
          if (isNaN(temp) || temp < 0 || temp > 2) {
            return res.status(400).json({ error: 'Temperature must be between 0 and 2' });
          }
          vapiPatch.model.temperature = temp;
        }
        if (body.prompt !== undefined) {
          if (typeof body.prompt === 'string' && body.prompt.length > 100000) {
            return res.status(400).json({ error: 'Prompt text exceeds maximum length (100KB)' });
          }
          vapiPatch.model.messages = [{ role: 'system', content: body.prompt }];
        }
      }

      // Voice — build voice object with supported fields per provider
      const SPEED_PROVIDERS = ['openai', 'playht', 'lmnt', 'azure'];
      const hasVoiceChanges = body.voice_id !== undefined || body.voice_provider !== undefined ||
        body.voice_model !== undefined || body.voice_speed !== undefined ||
        body.voice_caching_enabled !== undefined || body.voice_filler_injection_enabled !== undefined;
      if (hasVoiceChanges) {
        vapiPatch.voice = {};
        if (body.voice_provider !== undefined) vapiPatch.voice.provider = body.voice_provider;
        if (body.voice_id !== undefined) vapiPatch.voice.voiceId = body.voice_id;
        if (body.voice_model !== undefined) vapiPatch.voice.model = body.voice_model;
        if (body.voice_caching_enabled !== undefined) vapiPatch.voice.cachingEnabled = !!body.voice_caching_enabled;
        if (body.voice_filler_injection_enabled !== undefined) vapiPatch.voice.fillerInjectionEnabled = !!body.voice_filler_injection_enabled;
        // Speed is only supported by some providers — others reject it with 400
        const effectiveProvider = body.voice_provider || '';
        if (body.voice_speed !== undefined && SPEED_PROVIDERS.includes(effectiveProvider)) {
          vapiPatch.voice.speed = parseFloat(body.voice_speed);
        }
      }

      // NOTE: silenceTimeoutSeconds and endCallAfterSilenceSeconds are read-only
      // on Vapi's PATCH endpoint — they cannot be updated after creation.
      // Sending them causes a 400 "property should not exist" error.

      // General / Call-level fields
      if (body.first_message_mode !== undefined) vapiPatch.firstMessageMode = body.first_message_mode;
      if (body.first_message_interruptions_enabled !== undefined) vapiPatch.firstMessageInterruptionsEnabled = !!body.first_message_interruptions_enabled;
      if (body.end_call_message !== undefined) vapiPatch.endCallMessage = body.end_call_message;
      if (body.end_call_phrases !== undefined) vapiPatch.endCallPhrases = body.end_call_phrases;
      if (body.end_call_function_enabled !== undefined) vapiPatch.endCallFunctionEnabled = !!body.end_call_function_enabled;
      if (body.voicemail_message !== undefined) vapiPatch.voicemailMessage = body.voicemail_message;
      if (body.background_sound !== undefined) vapiPatch.backgroundSound = body.background_sound;
      if (body.background_denoising_enabled !== undefined) vapiPatch.backgroundDenoisingEnabled = !!body.background_denoising_enabled;

      // Voicemail Detection
      if (body.voicemail_detection !== undefined) {
        if (body.voicemail_detection === 'off' || !body.voicemail_detection) {
          // Don't send voicemailDetection to disable it — Vapi uses absence to mean off
        } else {
          vapiPatch.voicemailDetection = { provider: body.voicemail_detection };
        }
      }

      // Model extras
      if (body.emotion_recognition_enabled !== undefined && vapiPatch.model) {
        vapiPatch.model.emotionRecognitionEnabled = !!body.emotion_recognition_enabled;
      }
      if (body.num_fast_turns !== undefined && vapiPatch.model) {
        vapiPatch.model.numFastTurns = parseInt(body.num_fast_turns, 10);
      }
      if (body.max_tokens !== undefined && vapiPatch.model) {
        const mt = parseInt(body.max_tokens, 10);
        if (mt >= 50) vapiPatch.model.maxTokens = mt;
        // Skip if <= 0 (means "default / unlimited") — Vapi requires >= 50
      }

      // (voice_caching_enabled is handled in the voice block above)

      // Transcriber
      const hasTranscriberChanges = body.language !== undefined || body.transcriber_provider !== undefined ||
        body.transcriber_model !== undefined || body.transcriber_language !== undefined ||
        body.transcriber_keywords !== undefined || body.transcriber_endpointing !== undefined ||
        body.transcriber_confidence_threshold !== undefined || body.transcriber_smart_format !== undefined;
      if (hasTranscriberChanges) {
        vapiPatch.transcriber = {};
        if (body.transcriber_provider !== undefined) vapiPatch.transcriber.provider = body.transcriber_provider;
        if (body.transcriber_model !== undefined) vapiPatch.transcriber.model = body.transcriber_model;
        if (body.language !== undefined) vapiPatch.transcriber.language = body.language;
        if (body.transcriber_language !== undefined) vapiPatch.transcriber.language = body.transcriber_language;
        if (body.transcriber_keywords !== undefined) vapiPatch.transcriber.keywords = body.transcriber_keywords;
        if (body.transcriber_endpointing !== undefined) vapiPatch.transcriber.endpointing = parseFloat(body.transcriber_endpointing);
        if (body.transcriber_confidence_threshold !== undefined) vapiPatch.transcriber.confidenceThreshold = parseFloat(body.transcriber_confidence_threshold);
        if (body.transcriber_smart_format !== undefined) vapiPatch.transcriber.smartFormat = !!body.transcriber_smart_format;
      }

      // Start Speaking Plan
      if (body.start_speaking_wait_seconds !== undefined || body.smart_endpointing_enabled !== undefined) {
        vapiPatch.startSpeakingPlan = {};
        if (body.start_speaking_wait_seconds !== undefined) vapiPatch.startSpeakingPlan.waitSeconds = parseFloat(body.start_speaking_wait_seconds);
        if (body.smart_endpointing_enabled !== undefined) vapiPatch.startSpeakingPlan.smartEndpointingEnabled = !!body.smart_endpointing_enabled;
      }

      // Stop Speaking Plan
      if (body.stop_speaking_num_words !== undefined || body.stop_speaking_voice_seconds !== undefined || body.stop_speaking_backoff_seconds !== undefined) {
        vapiPatch.stopSpeakingPlan = {};
        if (body.stop_speaking_num_words !== undefined) vapiPatch.stopSpeakingPlan.numWords = parseInt(body.stop_speaking_num_words, 10);
        if (body.stop_speaking_voice_seconds !== undefined) vapiPatch.stopSpeakingPlan.voiceSeconds = parseFloat(body.stop_speaking_voice_seconds);
        if (body.stop_speaking_backoff_seconds !== undefined) vapiPatch.stopSpeakingPlan.backoffSeconds = parseFloat(body.stop_speaking_backoff_seconds);
      }

      // Compliance
      if (body.hipaa_enabled !== undefined) {
        vapiPatch.compliancePlan = { hipaaEnabled: !!body.hipaa_enabled };
      }

      // Artifact / Recording
      if (body.recording_enabled !== undefined || body.video_recording_enabled !== undefined) {
        vapiPatch.artifactPlan = {};
        if (body.recording_enabled !== undefined) vapiPatch.artifactPlan.recordingEnabled = !!body.recording_enabled;
        if (body.video_recording_enabled !== undefined) vapiPatch.artifactPlan.videoRecordingEnabled = !!body.video_recording_enabled;
      }

      // Background Speech Denoising
      if (body.smart_denoising_enabled !== undefined) {
        vapiPatch.backgroundSpeechDenoisingPlan = { smartDenoisingPlan: { enabled: !!body.smart_denoising_enabled } };
      }

      // Monitor
      if (body.monitor_listen_enabled !== undefined || body.monitor_control_enabled !== undefined) {
        vapiPatch.monitorPlan = {};
        if (body.monitor_listen_enabled !== undefined) vapiPatch.monitorPlan.listenEnabled = !!body.monitor_listen_enabled;
        if (body.monitor_control_enabled !== undefined) vapiPatch.monitorPlan.controlEnabled = !!body.monitor_control_enabled;
      }

      // Server URL
      if (body.server_url !== undefined) {
        if (body.server_url) {
          vapiPatch.server = { url: body.server_url };
        } else {
          vapiPatch.server = null; // Remove server URL
        }
      }

      // Keypad Input
      if (body.keypad_enabled !== undefined || body.keypad_timeout_seconds !== undefined || body.keypad_delimiters !== undefined) {
        vapiPatch.keypadInputPlan = {};
        if (body.keypad_enabled !== undefined) vapiPatch.keypadInputPlan.enabled = !!body.keypad_enabled;
        if (body.keypad_timeout_seconds !== undefined) vapiPatch.keypadInputPlan.timeoutSeconds = parseFloat(body.keypad_timeout_seconds);
        if (body.keypad_delimiters !== undefined) vapiPatch.keypadInputPlan.delimiters = body.keypad_delimiters;
      }

      if (Object.keys(vapiPatch).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      console.log(`PATCH Vapi agent ${agent_id}:`, JSON.stringify(vapiPatch, null, 2));
      await vapi.updateAssistant(agent_id, vapiPatch);
      res.json({ success: true });
      return;
    }

    // ════════════════════════════════════════════════
    // ── ElevenLabs PATCH (default) ──
    // ════════════════════════════════════════════════
    const patchBody = {};

    // ── Top-level fields ──
    if (body.name !== undefined) {
      patchBody.name = body.name;
    }
    if (body.tags !== undefined) {
      patchBody.tags = body.tags;
    }

    // ── conversation_config.agent ──
    const agentPatch = {};
    if (body.first_message !== undefined) agentPatch.first_message = body.first_message;
    if (body.language !== undefined) agentPatch.language = body.language;
    if (body.disable_first_message_interruptions !== undefined) {
      agentPatch.disable_first_message_interruptions = body.disable_first_message_interruptions;
    }
    if (body.max_conversation_duration_message !== undefined) {
      agentPatch.max_conversation_duration_message = body.max_conversation_duration_message;
    }
    if (body.hinglish_mode !== undefined) {
      agentPatch.hinglish_mode = body.hinglish_mode;
    }

    // ── conversation_config.agent.prompt ──
    const promptPatch = {};
    if (body.prompt !== undefined) {
      // Basic prompt length guard (100KB max)
      if (typeof body.prompt === 'string' && body.prompt.length > 100000) {
        return res.status(400).json({ error: 'Prompt text exceeds maximum length (100KB)' });
      }
      promptPatch.prompt = body.prompt;
    }
    if (body.llm !== undefined) promptPatch.llm = body.llm;
    if (body.temperature !== undefined) {
      const temp = parseFloat(body.temperature);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        return res.status(400).json({ error: 'Temperature must be between 0 and 2' });
      }
      promptPatch.temperature = temp;
    }
    if (body.max_tokens !== undefined) promptPatch.max_tokens = parseInt(body.max_tokens, 10);
    if (body.ignore_default_personality !== undefined) {
      promptPatch.ignore_default_personality = body.ignore_default_personality;
    }

    if (Object.keys(promptPatch).length > 0) {
      agentPatch.prompt = promptPatch;
    }

    if (Object.keys(agentPatch).length > 0) {
      patchBody.conversation_config = patchBody.conversation_config || {};
      patchBody.conversation_config.agent = agentPatch;
    }

    // ── conversation_config.tts ──
    const ttsPatch = {};
    if (body.voice_id !== undefined) ttsPatch.voice_id = body.voice_id;

    // ALWAYS include model_id so ElevenLabs updates it atomically with other settings.
    const requestedModel = body.tts_model_id || 'eleven_flash_v2';
    const agentLang = body.language || '';

    // Auto-correct: English agents can't use multilingual_v2
    if (agentLang === 'en' && requestedModel === 'eleven_multilingual_v2') {
      ttsPatch.model_id = 'eleven_flash_v2'; // force to a valid model
    } else {
      ttsPatch.model_id = requestedModel;
    }

    // V3 models do NOT support custom voice settings
    const isV3 = ttsPatch.model_id.startsWith('eleven_v3');

    if (!isV3) {
      if (body.stability !== undefined) ttsPatch.stability = parseFloat(body.stability);
      if (body.speed !== undefined) ttsPatch.speed = Math.min(1.2, Math.max(0.7, parseFloat(body.speed)));
      if (body.similarity_boost !== undefined) ttsPatch.similarity_boost = parseFloat(body.similarity_boost);
    }

    if (body.optimize_streaming_latency !== undefined) {
      ttsPatch.optimize_streaming_latency = parseInt(body.optimize_streaming_latency, 10);
    }
    if (body.agent_output_audio_format !== undefined) {
      ttsPatch.agent_output_audio_format = body.agent_output_audio_format;
    }
    if (body.text_normalisation_type !== undefined) ttsPatch.text_normalisation_type = body.text_normalisation_type;

    if (Object.keys(ttsPatch).length > 0) {
      patchBody.conversation_config = patchBody.conversation_config || {};
      patchBody.conversation_config.tts = ttsPatch;
    }

    // ── V3 expressive mode + audio tags (try API, skip if plan-gated) ──
    if (isV3 && (body.expressive_mode !== undefined || body.suggested_audio_tags !== undefined)) {
      const ttsConvConfig = {};
      if (body.expressive_mode !== undefined) ttsConvConfig.expressive_mode = !!body.expressive_mode;
      if (body.suggested_audio_tags !== undefined) {
        ttsConvConfig.suggested_audio_tags = Array.isArray(body.suggested_audio_tags)
          ? body.suggested_audio_tags.slice(0, 20) : [];
      }
      if (Object.keys(ttsConvConfig).length > 0) {
        patchBody.tts_conversational_config = ttsConvConfig;
      }
    }

    // ── conversation_config.asr ──
    const asrPatch = {};
    if (body.asr_quality !== undefined) asrPatch.quality = body.asr_quality;
    if (body.asr_provider !== undefined) asrPatch.provider = body.asr_provider;
    if (body.asr_keywords !== undefined) asrPatch.keywords = body.asr_keywords;

    if (Object.keys(asrPatch).length > 0) {
      patchBody.conversation_config = patchBody.conversation_config || {};
      patchBody.conversation_config.asr = asrPatch;
    }

    // ── conversation_config.vad ──
    if (body.background_voice_detection !== undefined) {
      patchBody.conversation_config = patchBody.conversation_config || {};
      patchBody.conversation_config.vad = {
        background_voice_detection: body.background_voice_detection,
      };
    }

    // ── conversation_config.turn ──
    const turnPatch = {};
    if (body.turn_timeout !== undefined) turnPatch.turn_timeout = parseFloat(body.turn_timeout);
    if (body.silence_end_call_timeout !== undefined) {
      turnPatch.silence_end_call_timeout = parseFloat(body.silence_end_call_timeout);
    }
    if (body.turn_eagerness !== undefined) turnPatch.turn_eagerness = body.turn_eagerness;
    if (body.mode !== undefined) turnPatch.mode = body.mode;

    if (Object.keys(turnPatch).length > 0) {
      patchBody.conversation_config = patchBody.conversation_config || {};
      patchBody.conversation_config.turn = turnPatch;
    }

    // ── conversation_config.conversation ──
    const convPatch = {};
    if (body.max_duration_seconds !== undefined) {
      convPatch.max_duration_seconds = parseInt(body.max_duration_seconds, 10);
    }
    if (body.text_only !== undefined) convPatch.text_only = body.text_only;
    if (body.monitoring_enabled !== undefined) convPatch.monitoring_enabled = body.monitoring_enabled;

    if (Object.keys(convPatch).length > 0) {
      patchBody.conversation_config = patchBody.conversation_config || {};
      patchBody.conversation_config.conversation = convPatch;
    }

    // ── platform_settings.privacy ──
    const privacyPatch = {};
    if (body.record_voice !== undefined) privacyPatch.record_voice = body.record_voice;
    if (body.retention_days !== undefined) privacyPatch.retention_days = parseInt(body.retention_days, 10);
    if (body.delete_transcript_and_pii !== undefined) {
      privacyPatch.delete_transcript_and_pii = body.delete_transcript_and_pii;
    }
    if (body.zero_retention_mode !== undefined) {
      privacyPatch.zero_retention_mode = body.zero_retention_mode;
    }

    if (Object.keys(privacyPatch).length > 0) {
      patchBody.platform_settings = patchBody.platform_settings || {};
      patchBody.platform_settings.privacy = privacyPatch;
    }

    // ── platform_settings.guardrails ──
    const guardrailsPatch = {};
    if (body.guardrail_focus !== undefined) {
      guardrailsPatch.focus = { is_enabled: body.guardrail_focus };
    }
    if (body.guardrail_prompt_injection !== undefined) {
      guardrailsPatch.prompt_injection = { is_enabled: body.guardrail_prompt_injection };
    }

    if (Object.keys(guardrailsPatch).length > 0) {
      patchBody.platform_settings = patchBody.platform_settings || {};
      patchBody.platform_settings.guardrails = guardrailsPatch;
    }

    // ── platform_settings.call_limits ──
    const limitsPatch = {};
    if (body.agent_concurrency_limit !== undefined) {
      limitsPatch.agent_concurrency_limit = parseInt(body.agent_concurrency_limit, 10);
    }
    if (body.daily_limit !== undefined) {
      limitsPatch.daily_limit = parseInt(body.daily_limit, 10);
    }

    if (Object.keys(limitsPatch).length > 0) {
      patchBody.platform_settings = patchBody.platform_settings || {};
      patchBody.platform_settings.call_limits = limitsPatch;
    }

    // ── platform_settings.auth ──
    if (body.enable_auth !== undefined) {
      patchBody.platform_settings = patchBody.platform_settings || {};
      patchBody.platform_settings.auth = { enable_auth: body.enable_auth };
    }

    // ── Send to ElevenLabs ──
    if (Object.keys(patchBody).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    console.log(`PATCH ElevenLabs agent ${agent_id}:`, JSON.stringify(patchBody, null, 2));

    try {
      await elevenlabs.updateAgent(agent_id, patchBody);
    } catch (apiErr) {
      // If expressive TTS is plan-gated, strip it and retry with everything else
      const errBody = typeof apiErr.body === 'string' ? apiErr.body : '';
      if (errBody.includes('expressive_tts_not_allowed') && patchBody.tts_conversational_config) {
        console.log('[ElevenLabs] Expressive TTS not available on this plan — saving without it');
        delete patchBody.tts_conversational_config;
        if (Object.keys(patchBody).length > 0) {
          await elevenlabs.updateAgent(agent_id, patchBody);
        }
      } else {
        throw apiErr; // re-throw other errors
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/agents/:id error:', err);
    const status = err.statusCode || 500;
    let errorMsg = 'Failed to update agent';
    try { errorMsg = JSON.parse(err.body)?.message || err.body || errorMsg; } catch(e) { errorMsg = err.body || errorMsg; }
    res.status(status).json({ error: errorMsg });
  }
});

/**
 * PATCH /api/agents/:agent_id/voice  (Legacy convenience endpoint)
 */
router.patch('/:agent_id/voice', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { voice_id } = req.body;

    if (!voice_id) {
      return res.status(400).json({ error: 'voice_id is required' });
    }

    // Admin bypass or assignment check
    if (req.client.is_admin !== 1) {
      const assignment = await get(
        'SELECT id FROM client_agents WHERE client_id = ? AND agent_id = ?',
        [req.client.id, agent_id]
      );
      if (!assignment) {
        return res.status(403).json({ error: 'Agent not assigned to your account' });
      }
    }

    await elevenlabs.updateAgentVoice(agent_id, voice_id);
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/agents/:id/voice error:', err);
    res.status(500).json({ error: 'Failed to update agent voice' });
  }
});

// ═══════════════════════════════════════════════════════════════
// VAPI CALL ANALYTICS (Client-facing)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/agents/:agent_id/vapi/calls
 * List Vapi calls for a specific assistant
 * Client must have the agent assigned to them
 */
router.get('/:agent_id/vapi/calls', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    // Verify assignment
    if (req.client.is_admin !== 1) {
      const assignment = await get(
        'SELECT id FROM client_agents WHERE client_id = ? AND agent_id = ?',
        [req.client.id, agent_id]
      );
      if (!assignment) {
        return res.status(403).json({ error: 'Agent not assigned to your account' });
      }
    }

    const limit = parseInt(req.query.limit) || 50;
    const calls = await vapi.listCalls({ assistantId: agent_id, limit });
    
    // Return clean call list
    const mapped = calls.map(c => ({
      id: c.id,
      type: c.type,
      status: c.status,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      duration: c.startedAt && c.endedAt
        ? Math.round((new Date(c.endedAt) - new Date(c.startedAt)) / 1000)
        : 0,
      cost: c.cost || 0,
      endedReason: c.endedReason || null,
      customer: c.customer || null,
      summary: c.analysis?.summary || null,
    }));

    res.json({ calls: mapped, total: mapped.length });
  } catch (err) {
    console.error('GET /api/agents/:id/vapi/calls error:', err);
    res.status(500).json({ error: 'Failed to fetch Vapi calls' });
  }
});

/**
 * GET /api/agents/:agent_id/vapi/calls/:call_id
 * Full call detail for a specific Vapi call
 */
router.get('/:agent_id/vapi/calls/:call_id', authenticate, async (req, res) => {
  try {
    const { agent_id, call_id } = req.params;

    // Verify assignment
    if (req.client.is_admin !== 1) {
      const assignment = await get(
        'SELECT id FROM client_agents WHERE client_id = ? AND agent_id = ?',
        [req.client.id, agent_id]
      );
      if (!assignment) {
        return res.status(403).json({ error: 'Agent not assigned to your account' });
      }
    }

    const call = await vapi.getCall(call_id);
    res.json({ call });
  } catch (err) {
    console.error('GET /api/agents/:id/vapi/calls/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch Vapi call details' });
  }
});

/**
 * GET /api/agents/:agent_id/vapi/analytics
 * Aggregated analytics for a Vapi assistant
 */
router.get('/:agent_id/vapi/analytics', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    // Verify assignment
    if (req.client.is_admin !== 1) {
      const assignment = await get(
        'SELECT id FROM client_agents WHERE client_id = ? AND agent_id = ?',
        [req.client.id, agent_id]
      );
      if (!assignment) {
        return res.status(403).json({ error: 'Agent not assigned to your account' });
      }
    }

    const analytics = await vapi.getAssistantAnalytics(agent_id);
    res.json({ analytics });
  } catch (err) {
    console.error('GET /api/agents/:id/vapi/analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch Vapi analytics' });
  }
});

// ═══════════════════════════════════════════════════════════════
// LIVE PROVIDER SYNC
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/agents/:agent_id/sync
 * Live sync with provider: re-fetches latest configuration from provider API
 * and updates local database cache without requiring page reload.
 */
router.post('/:agent_id/sync', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    // Check assignment & provider
    let provider = 'elevenlabs';
    if (agent_id.startsWith('gemini_')) {
      provider = 'gemini';
    } else if (req.client.is_admin !== 1) {
      const assignment = await get(
        "SELECT id, can_edit, COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE client_id = ? AND agent_id = ?",
        [req.client.id, agent_id]
      );
      if (!assignment) {
        return res.status(403).json({ error: 'Agent not assigned to your account' });
      }
      provider = assignment.provider || (agent_id.startsWith('agent_') ? 'elevenlabs' : 'vapi');
    } else {
      const assignment = await get(
        "SELECT COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE agent_id = ? LIMIT 1",
        [agent_id]
      );
      if (assignment?.provider) {
        provider = assignment.provider;
      } else {
        provider = agent_id.startsWith('agent_') ? 'elevenlabs' : 'vapi';
      }
    }

    let freshConfig = null;
    let freshName = '';

    if (provider === 'elevenlabs') {
      const raw = await elevenlabs.getAgent(agent_id);
      freshName = raw.name || '';
      freshConfig = {
        agent_id: raw.agent_id,
        name: raw.name || '',
        provider: 'elevenlabs',
        first_message: raw.conversation_config?.agent?.first_message || '',
        language: raw.conversation_config?.agent?.language || 'en',
        prompt: raw.conversation_config?.agent?.prompt?.prompt || '',
        llm: raw.conversation_config?.agent?.prompt?.llm || 'gpt-4o-mini',
        temperature: raw.conversation_config?.agent?.prompt?.temperature ?? 0.7,
        max_tokens: raw.conversation_config?.agent?.prompt?.max_tokens ?? -1,
        tts_model_id: raw.conversation_config?.tts?.model_id || 'eleven_v3_conversational',
        voice_id: raw.conversation_config?.tts?.voice_id || '',
        stability: raw.conversation_config?.tts?.voice_settings?.stability ?? 0.5,
        speed: raw.conversation_config?.tts?.voice_settings?.speed ?? 1.0,
        similarity_boost: raw.conversation_config?.tts?.voice_settings?.similarity_boost ?? 0.75,
        turn_timeout: raw.conversation_config?.turn?.turn_timeout ?? 2.0,
        silence_end_call_timeout: raw.conversation_config?.turn?.silence_end_call_timeout ?? 10.0,
        turn_eagerness: raw.conversation_config?.turn?.turn_eagerness || 'normal',
        max_duration_seconds: raw.conversation_config?.conversation?.max_duration_seconds ?? 300,
        record_voice: raw.platform_settings?.privacy?.record_voice !== false,
        retention_days: raw.platform_settings?.privacy?.retention_days ?? 90,
      };
    } else if (provider === 'vapi') {
      const raw = await vapi.getAssistant(agent_id);
      freshName = raw.name || '';
      freshConfig = {
        agent_id: raw.id,
        name: raw.name || '',
        provider: 'vapi',
        first_message: raw.firstMessage || '',
        first_message_mode: raw.firstMessageMode || 'assistant-speaks-first',
        language: raw.transcriber?.language || 'en',
        prompt: (raw.model?.messages || []).find(m => m.role === 'system')?.content || '',
        llm: raw.model?.model || 'gpt-4o-mini',
        model_provider: raw.model?.provider || 'openai',
        temperature: raw.model?.temperature ?? 0.7,
        voice_provider: raw.voice?.provider || '11labs',
        voice_id: raw.voice?.voiceId || '',
        transcriber_provider: raw.transcriber?.provider || 'deepgram',
        transcriber_model: raw.transcriber?.model || 'nova-2',
        max_duration_seconds: raw.maxDurationSeconds || 300,
        recording_enabled: raw.artifactPlan?.recordingEnabled !== false,
      };
    } else {
      // Gemini from DB
      const geminiData = await get('SELECT * FROM gemini_agents WHERE agent_id = ?', [agent_id]);
      if (geminiData) {
        freshName = geminiData.name;
        freshConfig = {
          agent_id: geminiData.agent_id,
          name: geminiData.name,
          provider: 'gemini',
          first_message: geminiData.first_message || '',
          language: geminiData.language || 'en',
          prompt: geminiData.system_prompt || '',
          llm: geminiData.model || 'models/gemini-3.1-flash-live-preview',
          gemini_model: geminiData.model,
          voice_id: geminiData.voice || 'Kore',
          gemini_voice: geminiData.voice,
          temperature: geminiData.temperature ?? 1.0,
          max_duration_seconds: geminiData.max_duration_seconds ?? 600,
        };
      }
    }

    if (freshName) {
      await run(
        'UPDATE client_agents SET agent_name = ? WHERE agent_id = ?',
        [freshName, agent_id]
      ).catch(() => {});
    }

    console.log(`[AgentSync] Live sync completed for ${provider} agent ${agent_id}`);

    res.json({
      success: true,
      provider,
      synced_at: new Date().toISOString(),
      agent: freshConfig,
      config: freshConfig,
    });
  } catch (err) {
    console.error('POST /api/agents/:id/sync error:', err);
    res.status(500).json({ error: err.body || err.message || 'Failed to sync with provider' });
  }
});

// ═══════════════════════════════════════════════════════════════
// AGENT KNOWLEDGE BASE ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/agents/:agent_id/knowledge
 * List knowledge base documents for an agent
 */
router.get('/:agent_id/knowledge', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const documents = await all(
      'SELECT id, file_name, file_type, file_size, url, status, created_at FROM agent_knowledge WHERE client_id = ? AND agent_id = ? ORDER BY created_at DESC',
      [req.client.id, agent_id]
    );
    res.json({ success: true, documents: documents || [] });
  } catch (err) {
    console.error('GET /api/agents/:id/knowledge error:', err);
    res.status(500).json({ error: 'Failed to fetch knowledge documents' });
  }
});

/**
 * POST /api/agents/:agent_id/knowledge/upload
 * Upload document (PDF, TXT, DOCX) and attach to provider & agent knowledge base
 */
router.post('/:agent_id/knowledge/upload', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { file_name, file_type, file_content_base64, file_size } = req.body;

    if (!file_name || !file_content_base64) {
      return res.status(400).json({ error: 'file_name and file_content_base64 are required' });
    }

    // Verify assignment
    const assignment = await get(
      "SELECT COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE client_id = ? AND agent_id = ?",
      [req.client.id, agent_id]
    );
    if (!assignment && req.client.is_admin !== 1) {
      return res.status(403).json({ error: 'Agent not assigned to your account' });
    }
    const provider = assignment?.provider || 'elevenlabs';

    let externalFileId = null;

    // Direct provider upload if API key configured
    if (provider === 'elevenlabs' && process.env.ELEVENLABS_API_KEY) {
      try {
        const buffer = Buffer.from(file_content_base64, 'base64');
        const formData = new FormData();
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        formData.append('file', blob, file_name);
        formData.append('name', file_name);

        const elRes = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base', {
          method: 'POST',
          headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
          body: formData,
        });

        if (elRes.ok) {
          const elData = await elRes.json();
          externalFileId = elData.id || elData.document_id || null;
        }
      } catch (uploadErr) {
        console.warn('[KnowledgeBase] ElevenLabs upload notice:', uploadErr.message);
      }
    } else if (provider === 'vapi' && process.env.VAPI_API_KEY) {
      try {
        const buffer = Buffer.from(file_content_base64, 'base64');
        const formData = new FormData();
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        formData.append('file', blob, file_name);

        const vapiRes = await fetch('https://api.vapi.ai/file', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.VAPI_API_KEY}` },
          body: formData,
        });

        if (vapiRes.ok) {
          const vapiData = await vapiRes.json();
          externalFileId = vapiData.id || null;
        }
      } catch (uploadErr) {
        console.warn('[KnowledgeBase] Vapi file upload notice:', uploadErr.message);
      }
    }

    const result = await run(
      `INSERT INTO agent_knowledge (
        client_id, agent_id, provider, external_file_id, file_name, file_type, file_size, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', datetime('now'))`,
      [req.client.id, agent_id, provider, externalFileId, file_name, file_type || 'txt', file_size || 0]
    );

    const docId = result.lastInsertRowid;

    res.status(201).json({
      success: true,
      document: {
        id: docId,
        file_name,
        file_type: file_type || 'txt',
        file_size: file_size || 0,
        status: 'ready',
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('POST /api/agents/:id/knowledge/upload error:', err);
    res.status(500).json({ error: 'Failed to upload knowledge document' });
  }
});

/**
 * POST /api/agents/:agent_id/knowledge/url
 * Add documentation or website URL to agent knowledge base
 */
router.post('/:agent_id/knowledge/url', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { url, name } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Valid URL is required' });
    }

    const assignment = await get(
      "SELECT COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE client_id = ? AND agent_id = ?",
      [req.client.id, agent_id]
    );
    if (!assignment && req.client.is_admin !== 1) {
      return res.status(403).json({ error: 'Agent not assigned to your account' });
    }
    const provider = assignment?.provider || 'elevenlabs';

    const docName = name || url;

    // ElevenLabs URL Knowledge Base integration
    if (provider === 'elevenlabs' && process.env.ELEVENLABS_API_KEY) {
      try {
        await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base', {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, name: docName }),
        });
      } catch (err) {
        console.warn('[KnowledgeBase] ElevenLabs URL registration notice:', err.message);
      }
    }

    const result = await run(
      `INSERT INTO agent_knowledge (
        client_id, agent_id, provider, file_name, file_type, url, status, created_at
      ) VALUES (?, ?, ?, ?, 'url', ?, 'ready', datetime('now'))`,
      [req.client.id, agent_id, provider, docName, url]
    );

    res.status(201).json({
      success: true,
      document: {
        id: result.lastInsertRowid,
        file_name: docName,
        file_type: 'url',
        url,
        status: 'ready',
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('POST /api/agents/:id/knowledge/url error:', err);
    res.status(500).json({ error: 'Failed to add knowledge URL' });
  }
});

/**
 * DELETE /api/agents/:agent_id/knowledge/:id
 * Remove document from knowledge base
 */
router.delete('/:agent_id/knowledge/:id', authenticate, async (req, res) => {
  try {
    const { agent_id, id } = req.params;

    const doc = await get(
      'SELECT id, external_file_id, provider FROM agent_knowledge WHERE id = ? AND client_id = ? AND agent_id = ?',
      [id, req.client.id, agent_id]
    );
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Try deleting from ElevenLabs if external_file_id exists
    if (doc.provider === 'elevenlabs' && doc.external_file_id && process.env.ELEVENLABS_API_KEY) {
      try {
        await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base/${doc.external_file_id}`, {
          method: 'DELETE',
          headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
        });
      } catch (e) {
        // Continue
      }
    }

    await run('DELETE FROM agent_knowledge WHERE id = ? AND client_id = ?', [id, req.client.id]);
    res.json({ success: true, message: 'Document removed from knowledge base' });
  } catch (err) {
    console.error('DELETE /api/agents/:id/knowledge/:id error:', err);
    res.status(500).json({ error: 'Failed to delete knowledge document' });
  }
});

// ═══════════════════════════════════════════════════════════════
// AGENT TOOLS & ACTIONS ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/agents/:agent_id/tools
 * List tools configured for an agent
 */
router.get('/:agent_id/tools', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const tools = await all(
      'SELECT id, tool_name, tool_type, description, parameters, endpoint_url, is_enabled, created_at FROM agent_tools WHERE client_id = ? AND agent_id = ? ORDER BY created_at DESC',
      [req.client.id, agent_id]
    );

    const formattedTools = (tools || []).map(t => ({
      ...t,
      parameters: t.parameters ? (typeof t.parameters === 'string' ? JSON.parse(t.parameters) : t.parameters) : {},
      is_enabled: !!t.is_enabled,
    }));

    res.json({ success: true, tools: formattedTools });
  } catch (err) {
    console.error('GET /api/agents/:id/tools error:', err);
    res.status(500).json({ error: 'Failed to fetch agent tools' });
  }
});

/**
 * POST /api/agents/:agent_id/tools
 * Add an action template or custom webhook tool to an agent
 */
router.post('/:agent_id/tools', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { tool_name, tool_type, description, parameters, endpoint_url } = req.body;

    if (!tool_name || !tool_type) {
      return res.status(400).json({ error: 'tool_name and tool_type are required' });
    }

    const assignment = await get(
      "SELECT COALESCE(provider, 'elevenlabs') as provider FROM client_agents WHERE client_id = ? AND agent_id = ?",
      [req.client.id, agent_id]
    );
    if (!assignment && req.client.is_admin !== 1) {
      return res.status(403).json({ error: 'Agent not assigned to your account' });
    }
    const provider = assignment?.provider || 'elevenlabs';

    // Provider sync
    if (provider === 'elevenlabs' && process.env.ELEVENLABS_API_KEY) {
      try {
        // Build tool definition for ElevenLabs
        let elTool;
        if (tool_type === 'end_call') {
          elTool = {
            type: 'system',
            name: tool_name || 'end_call',
            description: description || 'End the current call when conversation is finished',
          };
        } else if (tool_type === 'transfer_call') {
          elTool = {
            type: 'system',
            name: tool_name || 'transfer_call',
            description: description || 'Transfer the call to a live agent or support phone number',
            params: parameters || {},
          };
        } else {
          elTool = {
            type: tool_type === 'webhook' ? 'webhook' : 'system',
            name: tool_name,
            description: description || '',
            ...(endpoint_url ? { api_schema: { url: endpoint_url, method: 'POST', request_body_schema: parameters || {} } } : {}),
          };
        }
        // Retrieve and update agent tools
        const agentData = await elevenlabs.getAgent(agent_id);
        const currentTools = agentData.conversation_config?.agent?.prompt?.tools || [];
        await elevenlabs.updateAgent(agent_id, {
          conversation_config: {
            agent: {
              prompt: {
                tools: [...currentTools, elTool],
              },
            },
          },
        });
      } catch (err) {
        console.warn('[Tools] ElevenLabs tool config notice:', err.message);
      }
    } else if (provider === 'vapi' && process.env.VAPI_API_KEY) {
      try {
        let vapiTool;
        if (tool_type === 'transfer_call') {
          vapiTool = {
            type: 'transferCall',
            destinations: parameters?.destinations || (parameters?.phone_number ? [{ type: 'number', number: parameters.phone_number }] : []),
          };
        } else if (tool_type === 'end_call') {
          vapiTool = {
            type: 'endCallFunction',
          };
        } else {
          vapiTool = {
            type: tool_type === 'webhook' ? 'function' : tool_type,
            function: {
              name: tool_name,
              description: description || '',
              parameters: parameters || {},
            },
            ...(endpoint_url ? { server: { url: endpoint_url } } : {}),
          };
        }
        const assistant = await vapi.getAssistant(agent_id);
        const currentTools = assistant.model?.tools || [];
        await vapi.updateAssistant(agent_id, {
          model: {
            tools: [...currentTools, vapiTool],
          },
        });
      } catch (err) {
        console.warn('[Tools] Vapi tool config notice:', err.message);
      }
    }

    const result = await run(
      `INSERT INTO agent_tools (
        client_id, agent_id, provider, tool_name, tool_type, description, parameters, endpoint_url, is_enabled, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      [
        req.client.id,
        agent_id,
        provider,
        tool_name,
        tool_type,
        description || '',
        JSON.stringify(parameters || {}),
        endpoint_url || '',
      ]
    );

    res.status(201).json({
      success: true,
      tool: {
        id: result.lastInsertRowid,
        tool_name,
        tool_type,
        description: description || '',
        parameters: parameters || {},
        endpoint_url: endpoint_url || '',
        is_enabled: true,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('POST /api/agents/:id/tools error:', err);
    res.status(500).json({ error: 'Failed to add agent tool' });
  }
});

/**
 * DELETE /api/agents/:agent_id/tools/:tool_id
 * Remove a tool from an agent
 */
router.delete('/:agent_id/tools/:tool_id', authenticate, async (req, res) => {
  try {
    const { agent_id, tool_id } = req.params;

    const tool = await get(
      'SELECT id, tool_name FROM agent_tools WHERE id = ? AND client_id = ? AND agent_id = ?',
      [tool_id, req.client.id, agent_id]
    );
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    await run('DELETE FROM agent_tools WHERE id = ? AND client_id = ?', [tool_id, req.client.id]);
    res.json({ success: true, message: 'Tool removed from agent' });
  } catch (err) {
    console.error('DELETE /api/agents/:id/tools/:id error:', err);
    res.status(500).json({ error: 'Failed to remove agent tool' });
  }
});

/**
 * PATCH /api/agents/:agent_id/tools/:tool_id/toggle
 * Toggle tool enabled status
 */
router.patch('/:agent_id/tools/:tool_id/toggle', authenticate, async (req, res) => {
  try {
    const { agent_id, tool_id } = req.params;

    const tool = await get(
      'SELECT id, is_enabled FROM agent_tools WHERE id = ? AND client_id = ? AND agent_id = ?',
      [tool_id, req.client.id, agent_id]
    );
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    const nextVal = tool.is_enabled ? 0 : 1;
    await run('UPDATE agent_tools SET is_enabled = ? WHERE id = ?', [nextVal, tool_id]);

    res.json({ success: true, is_enabled: nextVal === 1 });
  } catch (err) {
    console.error('PATCH /api/agents/:id/tools/:id/toggle error:', err);
    res.status(500).json({ error: 'Failed to toggle tool status' });
  }
});

module.exports = router;

