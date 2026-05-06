/**
 * Vapi AI API Service
 * All Vapi API calls go through here — NEVER from the frontend.
 * The API key stays server-side only.
 *
 * Vapi Assistants API:
 *   GET    /assistant       — list
 *   POST   /assistant       — create
 *   GET    /assistant/:id   — get
 *   PATCH  /assistant/:id   — update
 *   DELETE /assistant/:id   — delete
 *
 * Auth: Bearer token in Authorization header.
 */

const BASE_URL = 'https://api.vapi.ai';
const REQUEST_TIMEOUT = 30000; // 30 seconds

// ─── In-memory cache ─────────────────────────────────────────────
let assistantListCache = null;
let assistantListCacheTime = 0;
const LIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Helper: Make authenticated request to Vapi API
 */
async function vapiFetch(path, options = {}) {
  const fullUrl = `${BASE_URL}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Dialix-Server/1.0',
        ...(options.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text();
      const error = new Error(`Vapi API error: ${res.status} ${res.statusText}`);
      error.statusCode = res.status;
      error.body = body;
      throw error;
    }

    // DELETE may return 204
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return null;
    }

    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Vapi API request timeout');
    }
    throw error;
  }
}

// ─── Assistant endpoints ─────────────────────────────────────────

/**
 * List all assistants — GET /assistant
 */
async function listAssistants() {
  const now = Date.now();
  if (assistantListCache && now - assistantListCacheTime < LIST_CACHE_TTL) {
    return assistantListCache;
  }

  const data = await vapiFetch('/assistant');
  // Returns an array of assistant objects
  assistantListCache = Array.isArray(data) ? data : [];
  assistantListCacheTime = now;
  console.log(`[Vapi] Fetched ${assistantListCache.length} assistants`);
  return assistantListCache;
}

/**
 * Get a single assistant — GET /assistant/:id
 */
async function getAssistant(assistantId) {
  return vapiFetch(`/assistant/${assistantId}`);
}

/**
 * Create a new assistant — POST /assistant
 * Body follows the Vapi assistant schema:
 * {
 *   name, firstMessage, firstMessageMode,
 *   model: { provider, model, messages: [{ role: 'system', content }], temperature },
 *   voice: { provider, voiceId, speed },
 *   transcriber: { provider, model, language },
 *   maxDurationSeconds,
 *   ...
 * }
 */
async function createAssistant(body) {
  // Invalidate cache after creation
  assistantListCache = null;
  assistantListCacheTime = 0;

  return vapiFetch('/assistant', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Update an assistant — PATCH /assistant/:id
 * Sparse update: only the fields you send are changed.
 */
async function updateAssistant(assistantId, patchBody) {
  // Invalidate cache
  assistantListCache = null;
  assistantListCacheTime = 0;

  return vapiFetch(`/assistant/${assistantId}`, {
    method: 'PATCH',
    body: JSON.stringify(patchBody),
  });
}

/**
 * Delete an assistant — DELETE /assistant/:id
 */
async function deleteAssistant(assistantId) {
  // Invalidate cache
  assistantListCache = null;
  assistantListCacheTime = 0;

  return vapiFetch(`/assistant/${assistantId}`, {
    method: 'DELETE',
  });
}

/**
 * Invalidate assistant list cache (e.g. after external changes)
 */
function invalidateCache() {
  assistantListCache = null;
  assistantListCacheTime = 0;
}

/**
 * Create a web call — POST /call/web
 * This creates a browser-based call session via Vapi's Daily.co integration.
 * Returns the call object including `webCallUrl` which can be opened in a browser.
 */
async function createWebCall(assistantId) {
  return vapiFetch('/call/web', {
    method: 'POST',
    body: JSON.stringify({
      assistantId,
    }),
  });
}

// ─── Call analytics endpoints ────────────────────────────────────

/**
 * List calls — GET /call
 * Optional filters: assistantId, limit, createdAtGt, createdAtLt
 * Returns call objects with status, duration, cost, timestamps, etc.
 */
async function listCalls({ assistantId, limit = 100, createdAtGt, createdAtLt } = {}) {
  const params = new URLSearchParams();
  if (assistantId) params.set('assistantId', assistantId);
  if (limit) params.set('limit', String(limit));
  if (createdAtGt) params.set('createdAtGt', createdAtGt);
  if (createdAtLt) params.set('createdAtLt', createdAtLt);
  const qs = params.toString();
  const data = await vapiFetch(`/call${qs ? '?' + qs : ''}`);
  return Array.isArray(data) ? data : [];
}

/**
 * Get a single call — GET /call/:id
 * Returns full call detail: transcript, recording URL, cost, analysis, etc.
 */
async function getCall(callId) {
  return vapiFetch(`/call/${callId}`);
}

/**
 * List phone numbers — GET /phone-number
 */
async function listPhoneNumbers() {
  const data = await vapiFetch('/phone-number');
  return Array.isArray(data) ? data : [];
}

/**
 * Get comprehensive analytics for an assistant.
 * Fetches all calls and computes:
 *   - Summary stats (total, completed, failed, success rate)
 *   - Cost breakdown (total, avg per call, by service)
 *   - Latency metrics (avg LLM, TTS, STT, total E2E)
 *   - Model/Voice/Transcriber metadata
 *   - Per-call detail with full metrics
 */
async function getAssistantAnalytics(assistantId) {
  const calls = await listCalls({ assistantId, limit: 100 });

  const totalCalls = calls.length;
  const completedCalls = calls.filter(c => c.status === 'ended').length;
  const failedCalls = calls.filter(c => c.status === 'failed' || c.status === 'no-answer').length;

  let totalDuration = 0;
  let totalCost = 0;
  const costBuckets = { transport: 0, stt: 0, llm: 0, tts: 0, vapi: 0 };
  const latencies = { llm: [], tts: [], stt: [], total: [] };
  const endedReasons = {};
  let latestModel = null;
  let latestVoice = null;
  let latestTranscriber = null;

  for (const call of calls) {
    // Duration
    if (call.startedAt && call.endedAt) {
      totalDuration += (new Date(call.endedAt) - new Date(call.startedAt)) / 1000;
    }

    // Cost
    if (call.cost) totalCost += call.cost;
    if (call.costBreakdown) {
      for (const key of Object.keys(costBuckets)) {
        if (call.costBreakdown[key]) costBuckets[key] += call.costBreakdown[key];
      }
    }

    // Latency — extract from call.artifact.messages or call.messages
    const msgs = call.artifact?.messages || call.messages || [];
    for (const m of msgs) {
      if (m.role === 'assistant' || m.role === 'bot') {
        if (m.duration) latencies.total.push(m.duration * 1000); // seconds → ms
      }
    }
    // Vapi also puts latency in call.latencyReport or call.analysis
    if (call.artifact?.messagesOpenAIFormatted) {
      // newer Vapi format — skip, handled above
    }

    // Ended reasons histogram
    const reason = call.endedReason || 'unknown';
    endedReasons[reason] = (endedReasons[reason] || 0) + 1;

    // Capture latest model / voice / transcriber config
    if (call.assistant || call.model) {
      latestModel = call.assistant?.model || call.model || latestModel;
    }
    if (call.assistant?.voice || call.voice) {
      latestVoice = call.assistant?.voice || call.voice || latestVoice;
    }
    if (call.assistant?.transcriber || call.transcriber) {
      latestTranscriber = call.assistant?.transcriber || call.transcriber || latestTranscriber;
    }
  }

  const avgDuration = completedCalls > 0 ? totalDuration / completedCalls : 0;
  const avgCost = completedCalls > 0 ? totalCost / completedCalls : 0;
  const successRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;

  // Compute latency averages
  const avg = arr => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const p95 = arr => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    return Math.round(sorted[Math.floor(sorted.length * 0.95)]);
  };

  return {
    summary: {
      totalCalls,
      completedCalls,
      failedCalls,
      successRate,
      totalDuration: Math.round(totalDuration),
      avgDuration: Math.round(avgDuration),
      totalCost: Math.round(totalCost * 100) / 100,
      avgCost: Math.round(avgCost * 10000) / 10000,
    },
    costBreakdown: {
      transport: Math.round(costBuckets.transport * 100) / 100,
      stt: Math.round(costBuckets.stt * 100) / 100,
      llm: Math.round(costBuckets.llm * 100) / 100,
      tts: Math.round(costBuckets.tts * 100) / 100,
      vapi: Math.round(costBuckets.vapi * 100) / 100,
    },
    latency: {
      avgLLM: avg(latencies.llm),
      avgTTS: avg(latencies.tts),
      avgSTT: avg(latencies.stt),
      avgTotal: avg(latencies.total),
      p95Total: p95(latencies.total),
    },
    config: {
      model: latestModel ? {
        provider: latestModel.provider || null,
        model: latestModel.model || null,
        temperature: latestModel.temperature ?? null,
      } : null,
      voice: latestVoice ? {
        provider: latestVoice.provider || null,
        voiceId: latestVoice.voiceId || null,
      } : null,
      transcriber: latestTranscriber ? {
        provider: latestTranscriber.provider || null,
        model: latestTranscriber.model || null,
        language: latestTranscriber.language || null,
      } : null,
    },
    endedReasons,
    calls: calls.map(c => ({
      id: c.id,
      type: c.type,
      status: c.status,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      duration: c.startedAt && c.endedAt
        ? Math.round((new Date(c.endedAt) - new Date(c.startedAt)) / 1000)
        : 0,
      cost: c.cost || 0,
      costBreakdown: c.costBreakdown || null,
      endedReason: c.endedReason || null,
      assistantId: c.assistantId,
      phoneNumberId: c.phoneNumberId,
      customer: c.customer || null,
      transcript: c.transcript || null,
      summary: c.analysis?.summary || null,
      successEvaluation: c.analysis?.successEvaluation || null,
      recordingUrl: c.artifact?.recordingUrl || c.recordingUrl || null,
      stereoRecordingUrl: c.artifact?.stereoRecordingUrl || null,
    })),
  };
}

/**
 * Call the official Vapi POST /analytics endpoint for aggregated metrics.
 * Body supports grouping by dimensions: assistantId, endedReason, type, etc.
 * Returns server-computed aggregations.
 */
async function getVapiAnalytics(queries = []) {
  try {
    return await vapiFetch('/analytics', {
      method: 'POST',
      body: JSON.stringify({ queries }),
    });
  } catch (err) {
    console.warn('[Vapi] POST /analytics failed:', err.message);
    return null;
  }
}

module.exports = {
  listAssistants,
  getAssistant,
  createAssistant,
  updateAssistant,
  deleteAssistant,
  invalidateCache,
  createWebCall,
  listCalls,
  getCall,
  listPhoneNumbers,
  getAssistantAnalytics,
  getVapiAnalytics,
};

