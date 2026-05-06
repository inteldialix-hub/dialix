const express = require('express');
const { Readable } = require('stream');
const { all, get, run } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateSchema } = require('../middleware/validate');
const { addSharedVoiceSchema } = require('../lib/schemas');
const elevenlabs = require('../services/elevenlabs');
const vapi = require('../services/vapi');

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

    // Fetch from both providers in parallel
    const [elAgents, vapiAgents] = await Promise.all([
      elevenlabs.getAgents().catch(err => {
        console.warn('Failed to fetch ElevenLabs agents:', err.message);
        return [];
      }),
      (process.env.VAPI_API_KEY ? vapi.listAssistants() : Promise.resolve([])).catch(err => {
        console.warn('Failed to fetch Vapi agents:', err.message);
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
 * POST /api/agents  (Admin only — create a new agent)
 * Accepts a `provider` field: 'elevenlabs' (default) or 'vapi'
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
      provider = 'elevenlabs',
      // Vapi-specific fields
      voice_provider,
      model_provider,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    // ── Vapi creation ──
    if (provider === 'vapi') {
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
          provider: 'deepgram',
          model: 'nova-2',
          language: language || 'en',
        },
        maxDurationSeconds: parseInt(max_duration_seconds, 10),
      };

      // Add voice if provided
      if (voice_id) {
        vapiBody.voice = {
          provider: voice_provider || '11labs',
          voiceId: voice_id,
        };
      }

      console.log('Creating Vapi agent:', JSON.stringify(vapiBody, null, 2));
      const created = await vapi.createAssistant(vapiBody);

      // Auto-assign to admin's account in DB
      await run(
        'INSERT OR IGNORE INTO client_agents (client_id, agent_id, agent_name, can_edit, provider) VALUES (?, ?, ?, 1, ?)',
        [req.client.id, created.id, name, 'vapi']
      );

      res.status(201).json({ agent: { agent_id: created.id, ...created, provider: 'vapi' } });
      return;
    }

    // ── ElevenLabs creation (default) ──
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

    console.log('Creating ElevenLabs agent:', JSON.stringify(agentBody, null, 2));
    const created = await elevenlabs.createAgent(agentBody);

    // Auto-assign to admin's account in DB
    await run(
      'INSERT OR IGNORE INTO client_agents (client_id, agent_id, agent_name, can_edit, provider) VALUES (?, ?, ?, 1, ?)',
      [req.client.id, created.agent_id, name, 'elevenlabs']
    );

    res.status(201).json({ agent: { ...created, provider: 'elevenlabs' } });
  } catch (err) {
    console.error('POST /api/agents error:', err);
    res.status(500).json({ error: err.body || 'Failed to create agent' });
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
    if (provider === 'vapi') {
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
        speed: raw.voice?.speed ?? 1.0,
        voice_caching_enabled: raw.voice?.cachingEnabled ?? true,

        // Transcriber
        transcriber_provider: raw.transcriber?.provider || 'deepgram',
        transcriber_model: raw.transcriber?.model || 'nova-2',

        // Call behavior
        max_duration_seconds: raw.maxDurationSeconds ?? 600,
        silence_timeout_seconds: raw.silenceTimeoutSeconds ?? 30,
        end_call_after_silence_seconds: raw.endCallAfterSilenceSeconds ?? 30,
        end_call_message: raw.endCallMessage || '',
        end_call_phrases: raw.endCallPhrases || [],
        voicemail_message: raw.voicemailMessage || '',
        voicemail_detection: raw.voicemailDetection || 'off',
        background_sound: raw.backgroundSound || 'off',

        // Start Speaking Plan
        start_speaking_wait_seconds: raw.startSpeakingPlan?.waitSeconds ?? 0.4,
        smart_endpointing_enabled: raw.startSpeakingPlan?.smartEndpointingEnabled ?? false,

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
    console.error('GET /api/agents/:id error:', err);
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

      // Voice — Vapi only accepts: provider, voiceId, speed
      // (stability, similarity_boost etc. are ElevenLabs-only and will cause 400 errors)
      const hasVoiceChanges = body.voice_id !== undefined || body.voice_provider !== undefined ||
        body.speed !== undefined;
      if (hasVoiceChanges) {
        vapiPatch.voice = {};
        if (body.voice_provider !== undefined) vapiPatch.voice.provider = body.voice_provider;
        if (body.voice_id !== undefined) vapiPatch.voice.voiceId = body.voice_id;
        if (body.speed !== undefined) vapiPatch.voice.speed = parseFloat(body.speed);
      }

      // NOTE: silenceTimeoutSeconds and endCallAfterSilenceSeconds are read-only
      // on Vapi's PATCH endpoint — they cannot be updated after creation.
      // Sending them causes a 400 "property should not exist" error.

      // General / Call-level fields
      if (body.first_message_mode !== undefined) vapiPatch.firstMessageMode = body.first_message_mode;
      if (body.first_message_interruptions_enabled !== undefined) vapiPatch.firstMessageInterruptionsEnabled = !!body.first_message_interruptions_enabled;
      if (body.end_call_message !== undefined) vapiPatch.endCallMessage = body.end_call_message;
      if (body.end_call_phrases !== undefined) vapiPatch.endCallPhrases = body.end_call_phrases;
      if (body.voicemail_message !== undefined) vapiPatch.voicemailMessage = body.voicemail_message;
      if (body.background_sound !== undefined) vapiPatch.backgroundSound = body.background_sound;

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
        vapiPatch.model.maxTokens = parseInt(body.max_tokens, 10);
      }

      // Voice extras
      if (body.voice_caching_enabled !== undefined) {
        if (!vapiPatch.voice) vapiPatch.voice = {};
        vapiPatch.voice.cachingEnabled = !!body.voice_caching_enabled;
      }

      // Transcriber
      const hasTranscriberChanges = body.language !== undefined || body.transcriber_provider !== undefined ||
        body.transcriber_model !== undefined;
      if (hasTranscriberChanges) {
        vapiPatch.transcriber = {};
        if (body.transcriber_provider !== undefined) vapiPatch.transcriber.provider = body.transcriber_provider;
        if (body.transcriber_model !== undefined) vapiPatch.transcriber.model = body.transcriber_model;
        if (body.language !== undefined) vapiPatch.transcriber.language = body.language;
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

module.exports = router;

