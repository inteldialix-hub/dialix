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
      // For real-time bidirectional audio calls, only live-capable models work
      let model = agentConfig.model;
      if (!model || (!model.includes('native-audio') && !model.includes('live'))) {
        model = 'models/gemini-2.5-flash-native-audio-latest';
      }

      const rawThinkingLevel = (agentConfig.thinking_level || '').toLowerCase();
      const thinkingLevel = ['low', 'medium', 'high'].includes(rawThinkingLevel) ? rawThinkingLevel : 'low';

      const sessionOpts = {
        model,
        voice: agentConfig.voice || 'Kore',
        systemPrompt: agentConfig.system_prompt || 'You are a helpful AI assistant.',
        temperature: agentConfig.temperature ?? 1.0,
        responseModalities: ['AUDIO'],
        thinkingLevel,
      };

      // Grounding with Google Search
      if (agentConfig.grounding_google_search) {
        sessionOpts.tools = [{ google_search: {} }];
      }

      // Context window compression — triggerTokens + slidingWindow.targetTokens
      if (agentConfig.max_context_size) {
        const targetTokens = agentConfig.target_context_size || Math.floor(agentConfig.max_context_size / 2);
        sessionOpts.contextWindowCompression = {
          triggerTokens: agentConfig.max_context_size,
          targetTokens,
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

      // Forward clean turn-based transcripts to browser (matching ElevenLabs & Vapi)
      session.on('user_transcript', (text) => {
        if (ws.readyState === ws.OPEN && text) {
          ws.send(JSON.stringify({ type: 'user_transcript', text }));
        }
      });

      session.on('agent_response', (text) => {
        if (ws.readyState === ws.OPEN && text) {
          ws.send(JSON.stringify({ type: 'agent_response', text }));
        }
      });

      // Forward Gemini text to browser
      session.on('text', (text) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'text', text }));
        }
      });

      // Forward transcription to browser (legacy fallback)
      session.on('transcript', (txData) => {
        if (ws.readyState === ws.OPEN) {
          const payload = typeof txData === 'string' ? { type: 'transcript', text: txData, isFinal: true } : { type: 'transcript', ...txData };
          ws.send(JSON.stringify(payload));
        }
      });

      // Forward interruption signal to browser
      session.on('interrupted', () => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'interrupted' }));
          ws.send(JSON.stringify({ type: 'agent_activity', activity: 'listening' }));
        }
      });

      // Forward turn completion — agent is now listening
      session.on('turn_complete', () => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'turn_complete' }));
          ws.send(JSON.stringify({ type: 'agent_activity', activity: 'listening' }));
        }
      });

      // Forward tool calls
      session.on('tool_call', (toolData) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'tool_call', data: toolData }));
          ws.send(JSON.stringify({ type: 'agent_activity', activity: 'tool_calling' }));
        }
      });

      // Track when user starts/stops speaking for activity state
      session.on('user_transcript', () => {
        // User just finished speaking — agent is now thinking
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'agent_activity', activity: 'thinking' }));
        }
      });

      // When audio starts flowing — agent is speaking
      let firstAudioSent = false;
      session.on('audio', () => {
        if (!firstAudioSent && ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'agent_activity', activity: 'speaking' }));
          firstAudioSent = true;
        }
      });
      session.on('turn_complete', () => { firstAudioSent = false; });

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
        } else if (msg.type === 'interrupt' && session) {
          // Browser user interrupted current agent speech
          session.interrupt();
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
