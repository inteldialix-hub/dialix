/**
 * Gemini Call Bridge
 * Bridges browser WebSocket connections to Gemini Live API sessions.
 *
 * Flow:
 *   Browser (mic → PCM16 → base64) → Backend WS → Gemini Live WS → Backend WS → Browser (audio playback)
 *
 * This module attaches a WebSocket server to the existing Express/HTTP server
 * at path /ws/gemini-call to handle real-time audio streaming for test calls.
 */

const { WebSocketServer } = require('ws');
const { URL } = require('url');
const gemini = require('../services/gemini');
const { get } = require('../db');
const jwt = require('jsonwebtoken');

/**
 * Attach Gemini call bridge WebSocket handler to an HTTP server.
 * @param {import('http').Server} server - The HTTP server instance
 */
function attachGeminiCallBridge(server) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async (ws, request) => {
    let session = null;
    const url = new URL(request.url, `http://${request.headers.host}`);
    const agentId = url.searchParams.get('agent_id');
    const token = url.searchParams.get('token');

    // Authenticate
    if (!token) {
      ws.close(4001, 'Missing token');
      return;
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      ws.close(4001, 'Invalid token');
      return;
    }

    if (!agentId) {
      ws.close(4002, 'Missing agent_id');
      return;
    }

    // Load Gemini agent config from DB
    const agentConfig = await get('SELECT * FROM gemini_agents WHERE agent_id = ?', [agentId]);
    if (!agentConfig) {
      ws.close(4004, 'Agent not found');
      return;
    }

    const sessionId = `call_${agentId}_${Date.now()}`;

    try {
      // Build Gemini session config from agent settings
      let model = agentConfig.model;
      if (!model || !model.includes('native-audio')) {
        model = 'models/gemini-2.5-flash-native-audio-latest';
      }

      const sessionOpts = {
        model,
        voice: agentConfig.voice || 'Kore',
        systemPrompt: agentConfig.system_prompt || 'You are a helpful AI assistant.',
        temperature: agentConfig.temperature ?? 1.0,
        responseModalities: ['AUDIO'],
      };

      // Thinking level
      const tl = agentConfig.thinking_level || 'none';
      if (tl !== 'none') {
        sessionOpts.thinkingConfig = { thinkingLevel: tl === 'low' ? 'low' : tl === 'medium' ? 'medium' : 'high' };
      }

      // Affective dialog
      if (agentConfig.affective_dialog) {
        sessionOpts.enableAffectiveDialog = true;
      }

      // Proactive audio
      if (agentConfig.proactive_audio) {
        sessionOpts.proactivity = { proactive_audio: true };
      }

      // Grounding with Google Search
      if (agentConfig.grounding_google_search) {
        sessionOpts.tools = [{ google_search: {} }];
      }

      // Context window
      if (agentConfig.max_context_size) {
        sessionOpts.contextWindowCompression = {
          maxTokens: agentConfig.max_context_size,
          targetTokens: agentConfig.target_context_size || Math.floor(agentConfig.max_context_size / 2),
        };
      }

      // Create Gemini session with agent config
      session = await gemini.createSession(sessionId, sessionOpts);

      // Forward Gemini audio to browser
      session.on('audio', (audioData) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'audio',
            data: audioData.data,
            mimeType: audioData.mimeType,
          }));
        }
      });

      // Forward Gemini text to browser
      session.on('text', (text) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'text', text }));
        }
      });

      // Forward transcription to browser
      session.on('transcript', (text) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'transcript', text }));
        }
      });

      // Forward turn completion
      session.on('turn_complete', () => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'turn_complete' }));
        }
      });

      session.on('error', (err) => {
        console.error(`[GeminiBridge] Session ${sessionId} error:`, err.message);
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
      });

      session.on('closed', () => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'session_ended', duration: session.getDuration() }));
          ws.close(1000, 'Session ended');
        }
      });

      // Send ready signal to browser with first_message if set
      ws.send(JSON.stringify({
        type: 'ready',
        sessionId,
        voice: agentConfig.voice,
        first_message: agentConfig.first_message || '',
      }));

      // If agent has a first_message, send it as text to Gemini so it speaks first
      if (agentConfig.first_message) {
        session.sendText(agentConfig.first_message);
      }

    } catch (err) {
      console.error(`[GeminiBridge] Failed to create session for ${agentId}:`, err.message);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
        ws.close(4500, err.message);
      }
      return;
    }

    // Handle incoming messages from browser
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if ((msg.type === 'audio' || msg.type === 'user_audio_chunk') && session) {
          // Browser sends audio chunks (supports either format)
          const audioChunk = msg.data || msg.user_audio_chunk;
          if (audioChunk) {
            session.sendAudio(audioChunk, msg.mimeType || 'audio/pcm;rate=16000');
          }
        } else if (msg.type === 'text' && session) {
          // Browser sends text
          session.sendText(msg.text);
        } else if (msg.type === 'end') {
          // Browser wants to end the call
          if (session) session.close('user_ended');
        }
      } catch (err) {
        console.error('[GeminiBridge] Message parse error:', err.message);
      }
    });

    ws.on('close', () => {
      console.log(`[GeminiBridge] Browser disconnected, session: ${sessionId}`);
      if (session) session.close('browser_disconnected');
    });

    ws.on('error', (err) => {
      console.error(`[GeminiBridge] Browser WS error:`, err.message);
      if (session) session.close('browser_error');
    });
  });

  console.log('✓ Gemini call bridge WebSocket attached at /ws/gemini-call');
  return wss;
}

module.exports = { attachGeminiCallBridge };
