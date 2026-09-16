/**
 * Gemini Live API Service
 * Handles real-time bidirectional audio/text conversations via WebSocket.
 * Uses Google's Gemini 3.1 Flash Live Preview model (bidiGenerateContent).
 *
 * All API keys stay server-side only — NEVER exposed to the frontend.
 *
 * Protocol: WebSocket to
 *   wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent
 *
 * Session flow:
 *   1. Connect WebSocket with API key
 *   2. Send setup message (model, config, voice)
 *   3. Receive { setupComplete: {} }
 *   4. Stream audio/text bidirectionally
 *   5. Close when done
 */

const WebSocket = require('ws');
const { EventEmitter } = require('events');

const GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const DEFAULT_MODEL = 'models/gemini-2.5-flash-native-audio-latest';
const SESSION_TIMEOUT = 600000; // 10 minutes max session

// Built-in Gemini voices (30 HD voices from Google AI Studio Voice Library)
const GEMINI_VOICES = [
  'Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam',
  'Aoede', 'Autonoe', 'Callirrhoe', 'Charon', 'Despina',
  'Enceladus', 'Erinome', 'Fenrir', 'Gacrux', 'Iapetus',
  'Kore', 'Laomedeia', 'Leda', 'Orus', 'Puck',
  'Pulcherrima', 'Rasalgethi', 'Sadachbia', 'Sadaltager',
  'Schedar', 'Sulafat', 'Umbriel', 'Vindemiatrix', 'Zephyr',
  'Zubenelgenubi',
];

// Active sessions map: sessionId -> GeminiSession
const activeSessions = new Map();

/**
 * GeminiSession — manages a single Gemini Live WebSocket session.
 * Extends EventEmitter:
 *   - 'ready'          : session setup complete
 *   - 'audio'          : audio chunk received (base64 PCM16)
 *   - 'text'           : text response received
 *   - 'user_transcript': user complete turn speech
 *   - 'agent_response' : agent complete turn speech
 *   - 'interrupted'    : barge-in detected, agent interrupted
 *   - 'turn_complete'  : model finished speaking
 *   - 'error'          : error occurred
 *   - 'closed'         : session ended
 */
class GeminiSession extends EventEmitter {
  constructor(sessionId, config = {}) {
    super();
    this.sessionId = sessionId;
    this.ws = null;
    this.ready = false;
    this.closed = false;
    this.startTime = Date.now();
    this.transcript = [];
    this._currentUserSpeech = '';
    this._currentTurnSpokenText = '';
    this._currentTurnModelText = '';
    this._isTurnInterrupted = false;

    let requestedModel = config.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
    // For real-time bidirectional calls, only live-capable models work
    if (!requestedModel || (!requestedModel.includes('native-audio') && !requestedModel.includes('live'))) {
      requestedModel = DEFAULT_MODEL;
    }

    // Extended thinking model requires thinkingConfig
    let thinkingConfig = config.thinkingConfig;
    if (requestedModel.includes('extended-thinking') && !thinkingConfig) {
      thinkingConfig = { thinkingLevel: 'medium' };
    }

    this.config = {
      voice: config.voice || 'Kore',
      systemPrompt: config.systemPrompt || 'You are a helpful AI assistant.',
      temperature: config.temperature ?? 1.0,
      language: config.language || 'en',
      responseModalities: config.responseModalities || ['AUDIO'],
      thinkingConfig,
      ...config,
      model: requestedModel,
    };

    this._timeoutId = setTimeout(() => {
      this.close('session_timeout');
    }, SESSION_TIMEOUT);
  }

  /**
   * Connect to Gemini Live API and set up the session.
   */
  async connect() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY not configured');
    }

    const url = `${GEMINI_WS_URL}?key=${apiKey}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log(`[Gemini] Session ${this.sessionId} connected`);
        this._sendSetup();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this._handleMessage(msg);

          if (msg.setupComplete && !this.ready) {
            this.ready = true;
            this.emit('ready');
            resolve();
          }
        } catch (err) {
          console.error(`[Gemini] Session ${this.sessionId} parse error:`, err.message);
          this.emit('error', err);
        }
      });

      this.ws.on('error', (err) => {
        console.error(`[Gemini] Session ${this.sessionId} WS error:`, err.message);
        this.emit('error', err);
        if (!this.ready) reject(err);
      });

      this.ws.on('close', (code, reason) => {
        const reasonStr = reason ? reason.toString() : '';
        console.log(`[Gemini] Session ${this.sessionId} closed: ${code} ${reasonStr}`);
        this._cleanup();
        this.emit('closed', { code, reason: reasonStr });
        if (!this.ready) {
          reject(new Error(`Gemini connection closed before ready (${code}): ${reasonStr || 'connection closed'}`));
        }
      });
    });
  }

  /**
   * Send the initial setup message to configure the model.
   */
  _sendSetup() {
    const generationConfig = {
      responseModalities: this.config.responseModalities,
      temperature: this.config.temperature,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.config.voice,
          },
        },
      },
    };

    // Thinking config
    if (this.config.thinkingConfig) {
      generationConfig.thinkingConfig = this.config.thinkingConfig;
    }

    const voiceDirectives = 
      '\n\n[NATURAL CONVERSATIONAL VOICE & INTERRUPTION GUIDELINES]' +
      '\n- You are having a real-time spoken telephone conversation. You MUST sound like a real, warm, spontaneous human speaker—not a formal AI reading text.' +
      '\n- Use natural casual filler words, hesitation sounds, and conversational vocal nods throughout your speech: "Hmm...", "Uh-huh", "Yeah", "Right", "Gotcha", "Mm-hmm", "Well...", "Ah, sure".' +
      '\n- CRITICAL: WHEN THE CALLER INTERRUPTS YOU (BARGE-IN):' +
      '\n  * The caller may speak or interrupt you mid-sentence. When this happens, STOP immediately and yield.' +
      '\n  * When you respond to the interruption, you MUST ALWAYS start naturally with a casual filler word or conversational acknowledgment like:' +
      '\n    "Hmm, yeah, go ahead...", "Ah, got it, sure...", "Mm-hmm, right...", "Hmm, yeah so...", "Oh, gotcha, yeah...", or "Well, sure...".' +
      '\n  * Never sound startled, defensive, or annoyed by interruptions. Treat interruptions smoothly and naturally like a real human telephone conversation.' +
      '\n- Turn length: Keep your spoken answers concise and punchy (1 to 2 spoken sentences per turn) so the conversation flows back and forth effortlessly.' +
      '\n- ABSOLUTE PROHIBITION ON WRITTEN ARTIFACTS:' +
      '\n  * NO asterisks (*), NO markdown formatting, NO bullet points, NO numbered lists, NO emojis.' +
      '\n  * NO stage directions or parenthetical tags like (laughs) or [clears throat].' +
      '\n  * Speak strictly natural English words that can be pronounced aloud over the telephone.';

    const setup = {
      model: this.config.model,
      generationConfig,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: {
        parts: [{ text: (this.config.systemPrompt || 'You are a helpful AI voice assistant.') + voiceDirectives }],
      },
    };

    // Tools (e.g. Google Search grounding)
    if (this.config.tools && this.config.tools.length > 0) {
      setup.tools = this.config.tools;
    }

    // Context window compression
    if (this.config.contextWindowCompression) {
      setup.contextWindowCompression = {
        slidingWindow: {
          targetTokens: this.config.contextWindowCompression.targetTokens,
        },
      };
    }

    // Affective dialog & proactive audio — only supported by gemini-3.8-live models
    const supports38Features = this.config.model && this.config.model.includes('3.8-live');
    if (supports38Features) {
      if (this.config.enableAffectiveDialog) {
        setup.enableAffectiveDialog = true;
      }
      if (this.config.proactivity) {
        setup.proactivity = this.config.proactivity;
      }
    }

    this.ws.send(JSON.stringify({ setup }));
  }

  /**
   * Handle incoming messages from Gemini.
   */
  _handleMessage(msg) {
    if (msg.setupComplete) {
      return; // handled in connect()
    }

    if (msg.serverContent) {
      const sc = msg.serverContent;

      // User interruption signal (barge-in detected by Google's VAD)
      if (sc.interrupted) {
        console.log(`[Gemini] Barge-in interrupted in session ${this.sessionId}`);
        this._isTurnInterrupted = true;
        this._currentTurnSpokenText = '';
        this._currentTurnModelText = '';
        this.emit('interrupted');
      }

      // Accumulate output audio transcription (actual words spoken by model)
      if (sc.outputTranscription) {
        const chunk = sc.outputTranscription.text || (sc.outputTranscription.parts && sc.outputTranscription.parts.map(p => p.text).join('')) || '';
        if (chunk && !this._isTurnInterrupted) {
          this._currentTurnSpokenText = (this._currentTurnSpokenText || '') + chunk;
        }
      }

      // Model turn — audio or text parts
      if (sc.modelTurn && sc.modelTurn.parts) {
        // Finalize user transcript now that model is answering
        if (this._currentUserSpeech && this._currentUserSpeech.trim()) {
          const userFinal = this._currentUserSpeech.trim();
          this.emit('user_transcript', userFinal);
          this.transcript.push({ role: 'user', text: userFinal, time: Date.now() });
          this._currentUserSpeech = '';
        }

        for (const part of sc.modelTurn.parts) {
          if (part.inlineData && !this._isTurnInterrupted) {
            // Audio response
            this.emit('audio', {
              data: part.inlineData.data, // base64-encoded PCM16
              mimeType: part.inlineData.mimeType,
            });
          }
          if (part.text && !this._currentTurnSpokenText) {
            this._currentTurnModelText = (this._currentTurnModelText || '') + part.text;
          }
        }
      }

      // Turn complete — emit the spoken agent text
      if (sc.turnComplete) {
        if (this._currentUserSpeech && this._currentUserSpeech.trim()) {
          const userFinal = this._currentUserSpeech.trim();
          this.emit('user_transcript', userFinal);
          this.transcript.push({ role: 'user', text: userFinal, time: Date.now() });
          this._currentUserSpeech = '';
        }

        const spoken = (this._currentTurnSpokenText || this._currentTurnModelText || '').trim();
        if (spoken) {
          const cleaned = spoken.replace(/^\*\*.*?\*\*\s*/s, '').trim();
          const finalAgentText = cleaned || spoken;
          this.emit('agent_response', finalAgentText);
          this.transcript.push({ role: 'agent', text: finalAgentText, time: Date.now() });
        }
        this._currentTurnSpokenText = '';
        this._currentTurnModelText = '';
        this._isTurnInterrupted = false;
        this.emit('turn_complete');
      }

      // Input transcription (user speech streaming tokens → accumulated silently)
      const inputTx = sc.inputTranscription || sc.interimInputTranscription;
      if (inputTx) {
        const chunk = inputTx.text || (inputTx.parts && inputTx.parts.map(p => p.text).join('')) || '';
        if (chunk) {
          this._currentUserSpeech = (this._currentUserSpeech || '') + chunk;
        }
      }
    }

    // Tool calls (future expansion)
    if (msg.toolCall) {
      this.emit('tool_call', msg.toolCall);
    }
  }

  /**
   * Send audio data to Gemini (from user's microphone or SIP stream).
   * @param {string} base64Audio - Base64-encoded PCM16 audio
   * @param {string} mimeType - e.g., 'audio/pcm;rate=16000'
   */
  sendAudio(base64Audio, mimeType = 'audio/pcm;rate=16000') {
    if (!this.ready || this.closed) return;

    const msg = {
      realtimeInput: {
        audio: {
          data: base64Audio,
          mimeType,
        },
      },
    };

    try {
      this.ws.send(JSON.stringify(msg));
    } catch (err) {
      console.error(`[Gemini] Session ${this.sessionId} send audio error:`, err.message);
    }
  }

  /**
   * Send a text message to Gemini.
   * @param {string} text - User text input
   */
  sendText(text) {
    if (!this.ready || this.closed) return;

    const msg = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text }],
        }],
        turnComplete: true,
      },
    };

    try {
      this.ws.send(JSON.stringify(msg));
      this.transcript.push({ role: 'user', text, time: Date.now() });
    } catch (err) {
      console.error(`[Gemini] Session ${this.sessionId} send text error:`, err.message);
    }
  }

  /**
   * Interrupt the current agent speech turn (client-side or VAD barge-in).
   */
  interrupt() {
    this._isTurnInterrupted = true;
    this._currentTurnSpokenText = '';
    this._currentTurnModelText = '';
    this.emit('interrupted');
  }

  /**
   * Send tool response back to Gemini (for function calling).
   */
  sendToolResponse(functionResponses) {
    if (!this.ready || this.closed) return;

    const msg = {
      toolResponse: { functionResponses },
    };

    try {
      this.ws.send(JSON.stringify(msg));
    } catch (err) {
      console.error(`[Gemini] Session ${this.sessionId} tool response error:`, err.message);
    }
  }

  /**
   * Get session duration in seconds.
   */
  getDuration() {
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  /**
   * Close the session gracefully.
   */
  close(reason = 'user_ended') {
    if (this.closed) return;
    this.closed = true;

    console.log(`[Gemini] Closing session ${this.sessionId}: ${reason}`);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, reason);
    }

    this._cleanup();
  }

  _cleanup() {
    this.closed = true;
    clearTimeout(this._timeoutId);
    activeSessions.delete(this.sessionId);
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Create a new Gemini Live session.
 * @param {string} sessionId - Unique session identifier
 * @param {object} config - Session config { model, voice, systemPrompt, temperature, language, responseModalities }
 * @returns {GeminiSession}
 */
async function createSession(sessionId, config = {}) {
  if (activeSessions.has(sessionId)) {
    throw new Error(`Session ${sessionId} already exists`);
  }

  const session = new GeminiSession(sessionId, config);
  activeSessions.set(sessionId, session);

  await session.connect();
  return session;
}

/**
 * Get an active session by ID.
 */
function getSession(sessionId) {
  return activeSessions.get(sessionId) || null;
}

/**
 * Close and remove a session.
 */
function closeSession(sessionId, reason) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.close(reason);
  }
}

/**
 * List all active sessions (for monitoring/admin).
 */
function listActiveSessions() {
  const sessions = [];
  for (const [id, session] of activeSessions) {
    sessions.push({
      sessionId: id,
      ready: session.ready,
      duration: session.getDuration(),
      model: session.config.model,
      voice: session.config.voice,
    });
  }
  return sessions;
}

/**
 * Test the Gemini API connectivity with a simple text exchange.
 * Returns the response text or throws on failure.
 */
async function testConnection() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not configured');
  }

  return new Promise((resolve, reject) => {
    const url = `${GEMINI_WS_URL}?key=${apiKey}`;
    const ws = new WebSocket(url);
    let response = '';

    ws.on('open', () => {
      ws.send(JSON.stringify({
        setup: {
          model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
          generationConfig: { responseModalities: ['TEXT'] },
        },
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.setupComplete) {
        ws.send(JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: 'Say "Gemini connected" in one short sentence.' }] }],
            turnComplete: true,
          },
        }));
      } else if (msg.serverContent) {
        const parts = msg.serverContent.modelTurn?.parts || [];
        for (const p of parts) {
          if (p.text) response += p.text;
        }
        if (msg.serverContent.turnComplete) {
          ws.close();
          resolve({ status: 'ok', model: process.env.GEMINI_MODEL || DEFAULT_MODEL, response });
        }
      }
    });

    ws.on('error', (err) => {
      reject(new Error(`Gemini connection test failed: ${err.message}`));
    });

    setTimeout(() => {
      ws.close();
      reject(new Error('Gemini connection test timed out'));
    }, 15000);
  });
}

/**
 * Get available Gemini voices.
 */
function getVoices() {
  return GEMINI_VOICES.map(v => ({
    voice_id: v.toLowerCase(),
    name: v,
    provider: 'gemini',
  }));
}

module.exports = {
  GeminiSession,
  createSession,
  getSession,
  closeSession,
  listActiveSessions,
  testConnection,
  getVoices,
  GEMINI_VOICES,
  DEFAULT_MODEL,
};
