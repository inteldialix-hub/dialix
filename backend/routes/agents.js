const express = require('express');
const { all, get, run } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const elevenlabs = require('../services/elevenlabs');

const router = express.Router();

/**
 * GET /api/agents
 * Returns a list of agents assigned to the current client
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const assignments = all(
      'SELECT agent_id, agent_name, can_edit FROM client_agents WHERE client_id = ?',
      [req.client.id]
    );

    if (assignments.length === 0) {
      return res.json({ agents: [] });
    }

    const agents = await Promise.all(
      assignments.map(async (a) => {
        try {
          const liveData = await elevenlabs.getAgent(a.agent_id);
          return {
            agent_id: a.agent_id,
            name: liveData.name || a.agent_name,
            voice_id: liveData.conversation_config?.tts?.voice_id || null,
            language: liveData.conversation_config?.agent?.language || 'en',
            llm: liveData.conversation_config?.agent?.prompt?.llm || null,
            status: 'active',
            can_edit: a.can_edit ?? 1,
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
    const agents = await elevenlabs.getAgents();
    const mapped = agents.map(a => ({
      agent_id: a.agent_id,
      name: a.name || 'Unnamed Agent',
      tags: a.tags || [],
      last_call: a.last_call_time_unix_secs ? new Date(a.last_call_time_unix_secs * 1000).toISOString() : null,
    }));
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
router.post('/voices/add-shared', authenticate, async (req, res) => {
  try {
    const { public_owner_id, voice_id, name } = req.body;
    if (!public_owner_id || !voice_id || !name) {
      return res.status(400).json({ error: 'public_owner_id, voice_id, and name are required' });
    }
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
 */
router.get('/:agent_id/test-call/signed-url', authenticate, async (req, res) => {
  try {
    const signedUrl = await elevenlabs.getSignedUrl(req.params.agent_id);
    res.json({ signed_url: signedUrl });
  } catch (err) {
    console.error('GET test-call/signed-url error:', err);
    res.status(500).json({ error: err.message || 'Failed to get signed URL' });
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

    // Shape models into a clean format for the frontend
    const models = rawModels.map(m => ({
      model_id: m.model_id,
      name: m.name,
      description: m.description || '',
      can_do_text_to_speech: m.can_do_text_to_speech || false,
      can_do_voice_conversion: m.can_do_voice_conversion || false,
      can_be_finetuned: m.can_be_finetuned || false,
      languages: (m.languages || []).map(l => ({
        language_id: l.language_id,
        name: l.name,
      })),
      max_characters_request: m.max_characters_request_free_user || 0,
    }));

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
          // Skip deprecated models
          if (l.deprecation_info && l.deprecation_info.is_deprecated) return false;
          // Skip checkpoint/dated versions (e.g. gpt-4o-2024-08-06) to keep list clean
          if (l.is_checkpoint) return false;
          return true;
        })
        .map(l => {
          const id = l.llm || '';
          // Create a human-friendly label from the model ID
          // e.g. "gpt-4o-mini" → "GPT-4o Mini", "claude-3-5-sonnet-v2" → "Claude 3.5 Sonnet v2"
          const label = id
            .replace(/^gpt-/i, 'GPT-')
            .replace(/^claude-/i, 'Claude ')
            .replace(/^gemini-/i, 'Gemini ')
            .replace(/^qwen/i, 'Qwen ')
            .replace(/^glm-/i, 'GLM ')
            .replace(/^deepseek-/i, 'DeepSeek ')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase()) // capitalize words
            || id;
          return { value: id, label };
        })
        .filter(l => l.value); // Remove any with empty ID
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

    const { Readable } = require('stream');
    const readable = Readable.fromWeb(ttsRes.body);
    readable.pipe(res);
  } catch (err) {
    console.error('GET /api/agents/voices/:id/preview error:', err);
    res.status(500).json({ error: 'Failed to generate voice preview' });
  }
});

/**
 * POST /api/agents  (Admin only — create a new agent on ElevenLabs)
 */
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.client.is_admin !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
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
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    // Build the ElevenLabs agent creation body
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

    console.log('Creating agent:', JSON.stringify(agentBody, null, 2));
    const created = await elevenlabs.createAgent(agentBody);
    res.status(201).json({ agent: created });
  } catch (err) {
    console.error('POST /api/agents error:', err);
    res.status(500).json({ error: err.body || 'Failed to create agent' });
  }
});

/**
 * DELETE /api/agents/:agent_id  (Admin only — delete from ElevenLabs + cleanup DB)
 */
router.delete('/:agent_id', authenticate, async (req, res) => {
  try {
    if (req.client.is_admin !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { agent_id } = req.params;

    // Delete from ElevenLabs first
    await elevenlabs.deleteAgent(agent_id);

    // Remove all DB assignments for this agent
    const result = run('DELETE FROM client_agents WHERE agent_id = ?', [agent_id]);
    console.log(`Deleted agent ${agent_id}, removed ${result.changes} DB assignments`);

    res.json({ success: true, assignments_removed: result.changes });
  } catch (err) {
    console.error('DELETE /api/agents/:id error:', err);
    res.status(500).json({ error: err.body || 'Failed to delete agent' });
  }
});

/**
 * GET /api/agents/:agent_id
 * Returns the FULL agent configuration from ElevenLabs
 * (flattened into a clean shape for the frontend)
 */
router.get('/:agent_id', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    // Admin can access any agent; regular clients need assignment
    if (req.client.is_admin !== 1) {
      const assignment = get(
        'SELECT id, can_edit, allowed_features FROM client_agents WHERE client_id = ? AND agent_id = ?',
        [req.client.id, agent_id]
      );
      if (!assignment) {
        return res.status(403).json({ error: 'Agent not assigned to your account' });
      }
      var clientCanEdit = assignment.can_edit ?? 1;
      var allowedFeatures = null;
      try { allowedFeatures = assignment.allowed_features ? JSON.parse(assignment.allowed_features) : null; } catch(e) {}
    } else {
      var clientCanEdit = 1;
      var allowedFeatures = null; // null = all features (admin)
    }

    const raw = await elevenlabs.getAgent(agent_id);

    // Flatten into a clean structure for the frontend
    const config = {
      agent_id: raw.agent_id,
      name: raw.name || '',
      tags: raw.tags || [],

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
      expressive_mode: raw.conversation_config?.tts?.expressive_mode ?? false,
      text_normalisation_type: raw.conversation_config?.tts?.text_normalisation_type || 'auto',

      // ASR (Speech Recognition)
      asr_quality: raw.conversation_config?.asr?.quality || 'high',
      asr_provider: raw.conversation_config?.asr?.provider || 'scribe_realtime',
      asr_keywords: raw.conversation_config?.asr?.keywords || [],

      // VAD (Voice Activity Detection)
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
    console.error('GET /api/agents/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch agent details' });
  }
});

/**
 * PATCH /api/agents/:agent_id
 * Generic agent update — accepts flat fields and maps them to the ElevenLabs API structure.
 * Only the fields you send will be updated (sparse PATCH).
 */
router.patch('/:agent_id', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;

    // Admin can update any agent; regular clients need assignment + edit permission
    if (req.client.is_admin !== 1) {
      const assignment = get(
        'SELECT id, can_edit FROM client_agents WHERE client_id = ? AND agent_id = ?',
        [req.client.id, agent_id]
      );
      if (!assignment) {
        return res.status(403).json({ error: 'Agent not assigned to your account' });
      }
      if (!assignment.can_edit) {
        return res.status(403).json({ error: 'You have view-only access to this agent. Contact your admin for edit permissions.' });
      }
    }

    const body = req.body;
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
    if (body.prompt !== undefined) promptPatch.prompt = body.prompt;
    if (body.llm !== undefined) promptPatch.llm = body.llm;
    if (body.temperature !== undefined) promptPatch.temperature = parseFloat(body.temperature);
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
    if (body.tts_model_id !== undefined) ttsPatch.model_id = body.tts_model_id;
    if (body.stability !== undefined) ttsPatch.stability = parseFloat(body.stability);
    if (body.speed !== undefined) ttsPatch.speed = parseFloat(body.speed);
    if (body.similarity_boost !== undefined) ttsPatch.similarity_boost = parseFloat(body.similarity_boost);
    if (body.optimize_streaming_latency !== undefined) {
      ttsPatch.optimize_streaming_latency = parseInt(body.optimize_streaming_latency, 10);
    }
    if (body.expressive_mode !== undefined) ttsPatch.expressive_mode = body.expressive_mode;
    if (body.text_normalisation_type !== undefined) ttsPatch.text_normalisation_type = body.text_normalisation_type;

    if (Object.keys(ttsPatch).length > 0) {
      patchBody.conversation_config = patchBody.conversation_config || {};
      patchBody.conversation_config.tts = ttsPatch;
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

    console.log(`PATCH agent ${agent_id}:`, JSON.stringify(patchBody, null, 2));
    await elevenlabs.updateAgent(agent_id, patchBody);
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/agents/:id error:', err);
    res.status(500).json({ error: err.body || 'Failed to update agent' });
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
      const assignment = get(
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

module.exports = router;
