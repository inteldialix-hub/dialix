/**
 * ElevenLabs API Service
 * All ElevenLabs API calls go through here — NEVER from the frontend.
 * The API key stays server-side only.
 */

const { isValidUrl } = require('../middleware/web-security');

const BASE_URL = 'https://api.elevenlabs.io';
const ALLOWED_DOMAINS = ['api.elevenlabs.io', 'elevenlabs.io'];
const REQUEST_TIMEOUT = 30000; // 30 seconds

// ─── In-memory caches with TTLs ──────────────────────────────────
let voiceCache = null;
let voiceCacheTime = 0;
const VOICE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

let modelCache = null;
let modelCacheTime = 0;
const MODEL_CACHE_TTL = 30 * 60 * 1000; // 30 minutes (models rarely change)

/**
 * Helper: Make authenticated request to ElevenLabs API with security checks
 */
async function elevenLabsFetch(path, options = {}) {
  // Validate the URL to prevent SSRF
  const fullUrl = `${BASE_URL}${path}`;
  if (!isValidUrl(fullUrl)) {
    throw new Error('Invalid URL for ElevenLabs API call');
  }

  // Additional domain validation
  try {
    const url = new URL(fullUrl);
    if (!ALLOWED_DOMAINS.includes(url.hostname)) {
      throw new Error('Domain not allowed for ElevenLabs API calls');
    }
  } catch (error) {
    throw new Error('Invalid URL format for ElevenLabs API call');
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'Dialix-Server/1.0',
        ...(options.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text();
      const error = new Error(`ElevenLabs API error: ${res.status} ${res.statusText}`);
      error.statusCode = res.status;
      error.body = body;
      throw error;
    }

    // DELETE requests may return empty body
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return null;
    }

    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('ElevenLabs API request timeout');
    }
    throw error;
  }
}

// ─── Agent endpoints ─────────────────────────────────────────────

async function getAgents() {
  const data = await elevenLabsFetch('/v1/convai/agents');
  return data.agents || [];
}

async function getAgent(agentId) {
  return elevenLabsFetch(`/v1/convai/agents/${agentId}`);
}

/**
 * Create a new agent — POST /v1/convai/agents
 * Body should follow the ElevenLabs agent creation schema.
 */
async function createAgent(body) {
  return elevenLabsFetch('/v1/convai/agents', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Generic agent update — accepts any valid PATCH body
 * This is the main function for updating agent configuration.
 * The patchBody should follow the ElevenLabs API schema:
 * {
 *   name: string,
 *   conversation_config: { agent: {}, tts: {}, turn: {}, conversation: {} },
 *   platform_settings: { privacy: {} }
 * }
 */
async function updateAgent(agentId, patchBody) {
  return elevenLabsFetch(`/v1/convai/agents/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify(patchBody),
  });
}

/**
 * Delete an agent — DELETE /v1/convai/agents/:id
 * This is PERMANENT and cannot be undone.
 */
async function deleteAgent(agentId) {
  return elevenLabsFetch(`/v1/convai/agents/${agentId}`, {
    method: 'DELETE',
  });
}

/**
 * Convenience wrapper: update just the voice
 */
async function updateAgentVoice(agentId, voiceId) {
  return updateAgent(agentId, {
    conversation_config: {
      tts: { voice_id: voiceId },
    },
  });
}

// ─── Voice endpoints ─────────────────────────────────────────────

/**
 * Fetch ALL voices by paginating through every page.
 * The default page_size from ElevenLabs is only 10 — we use 100 (the max)
 * and follow next_page_token until has_more is false.
 */
async function getVoices() {
  const now = Date.now();
  if (voiceCache && now - voiceCacheTime < VOICE_CACHE_TTL) {
    return voiceCache;
  }

  let allVoices = [];
  let nextPageToken = null;
  let hasMore = true;

  while (hasMore) {
    let url = '/v1/voices?page_size=100';
    if (nextPageToken) {
      url += `&next_page_token=${encodeURIComponent(nextPageToken)}`;
    }

    const data = await elevenLabsFetch(url);
    const voices = data.voices || [];
    allVoices = allVoices.concat(voices);

    hasMore = data.has_more === true;
    nextPageToken = data.next_page_token || null;

    // Safety: if API doesn't return has_more, stop after first page
    if (data.has_more === undefined) {
      hasMore = false;
    }
  }

  console.log(`[ElevenLabs] Fetched ${allVoices.length} voices (paginated)`);
  voiceCache = allVoices;
  voiceCacheTime = now;
  return voiceCache;
}

/**
 * Search the shared voice library (community voices).
 * Useful for discovering voices not yet added to the account.
 */
async function getSharedVoices(query = '', pageSize = 30) {
  let url = `/v1/shared-voices?page_size=${pageSize}`;
  if (query) {
    url += `&search=${encodeURIComponent(query)}`;
  }
  const data = await elevenLabsFetch(url);
  return data.voices || [];
}

/**
 * Add a shared/community voice to the user's account library.
 * Required before using a community voice with an agent.
 * @param {string} publicUserId - The public_owner_id from the shared voice
 * @param {string} voiceId - The voice_id to add
 * @param {string} name - The name to give the voice in the library
 */
async function addSharedVoice(publicUserId, voiceId, name) {
  const data = await elevenLabsFetch(`/v1/voices/add/${publicUserId}/${voiceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_name: name }),
  });
  // Invalidate cache so the new voice shows up
  invalidateVoiceCache();
  console.log(`[ElevenLabs] Added shared voice "${name}" (${voiceId}) to library`);
  return data;
}

/**
 * Force-refresh the voice cache (e.g. after adding a new voice).
 */
function invalidateVoiceCache() {
  voiceCache = null;
  voiceCacheTime = 0;
}

// ─── Conversational AI ──────────────────────────────────────────

/**
 * Get a signed WebSocket URL for test-calling an agent.
 * The signed URL is temporary (15 minutes) and lets the browser
 * connect directly to ElevenLabs without exposing the API key.
 */
async function getSignedUrl(agentId) {
  const data = await elevenLabsFetch(
    `/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`
  );
  return data.signed_url;
}

// ─── Model endpoints ─────────────────────────────────────────────

/**
 * Fetch all available TTS models from ElevenLabs.
 * Returns their IDs, names, supported languages, and capabilities.
 * Cached for 30 minutes since models rarely change.
 */
async function getModels() {
  const now = Date.now();
  if (modelCache && now - modelCacheTime < MODEL_CACHE_TTL) {
    return modelCache;
  }

  const models = await elevenLabsFetch('/v1/models');
  // The API returns an array directly (not wrapped in { models: [] })
  modelCache = Array.isArray(models) ? models : [];
  modelCacheTime = now;
  console.log(`[ElevenLabs] Fetched ${modelCache.length} TTS models`);
  return modelCache;
}

// ─── LLM endpoints ──────────────────────────────────────────────

let llmCache = null;
let llmCacheTime = 0;

/**
 * Fetch all available LLM models for conversational AI agents.
 * Uses GET /v1/convai/llm/list — returns GPT, Claude, Gemini, Qwen, etc.
 * Cached for 30 minutes.
 */
async function getLLMs() {
  const now = Date.now();
  if (llmCache && now - llmCacheTime < MODEL_CACHE_TTL) {
    return llmCache;
  }

  const data = await elevenLabsFetch('/v1/convai/llm/list');
  // Response may be { llms: [...] } or an array
  llmCache = Array.isArray(data) ? data : (data.llms || data.models || []);
  llmCacheTime = now;
  console.log(`[ElevenLabs] Fetched ${llmCache.length} LLM models`);
  return llmCache;
}

// ─── Phone number endpoints ──────────────────────────────────────

async function getPhoneNumbers() {
  const data = await elevenLabsFetch('/v1/convai/phone-numbers');
  return data.phone_numbers || data || [];
}

async function createPhoneNumber(payload) {
  return elevenLabsFetch('/v1/convai/phone-numbers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function assignPhoneNumber(elevenlabsPhoneId, agentId) {
  return elevenLabsFetch(`/v1/convai/phone-numbers/${elevenlabsPhoneId}`, {
    method: 'PATCH',
    body: JSON.stringify({ agent_id: agentId }),
  });
}

async function deletePhoneNumber(elevenlabsPhoneId) {
  return elevenLabsFetch(`/v1/convai/phone-numbers/${elevenlabsPhoneId}`, {
    method: 'DELETE',
  });
}

// ─── Call endpoints ──────────────────────────────────────────────

async function makeOutboundCall(provider, payload) {
  const endpoint = provider === 'twilio'
    ? '/v1/convai/twilio/outbound-call'
    : '/v1/convai/sip-trunk/outbound-call';

  return elevenLabsFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Conversation history ────────────────────────────────────────

async function getConversations(agentId, pageSize = 10) {
  return elevenLabsFetch(`/v1/convai/conversations?agent_id=${agentId}&page_size=${pageSize}`);
}

/**
 * Get a single conversation with full detail (transcript, analysis, etc.)
 */
async function getConversation(conversationId) {
  return elevenLabsFetch(`/v1/convai/conversations/${conversationId}`);
}

/**
 * Delete a conversation permanently
 */
async function deleteConversation(conversationId) {
  return elevenLabsFetch(`/v1/convai/conversations/${conversationId}`, {
    method: 'DELETE',
  });
}

// ─── Monitoring ──────────────────────────────────────────────────

/**
 * Returns the WebSocket URL for monitoring a live conversation.
 * The backend proxies this so the API key never reaches the browser.
 */
function getMonitoringUrl(conversationId) {
  return `wss://api.elevenlabs.io/v1/convai/conversations/${conversationId}/monitor`;
}

module.exports = {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  updateAgentVoice,
  getVoices,
  getSharedVoices,
  addSharedVoice,
  invalidateVoiceCache,
  getModels,
  getLLMs,
  getPhoneNumbers,
  createPhoneNumber,
  assignPhoneNumber,
  deletePhoneNumber,
  makeOutboundCall,
  getConversations,
  getConversation,
  deleteConversation,
  getMonitoringUrl,
  getSignedUrl,
};
