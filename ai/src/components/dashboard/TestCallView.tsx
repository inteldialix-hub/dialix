'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Icon } from '@/components/dashboard/shared/Icon';
import { VoicePoweredOrb } from '@/components/dashboard/shared/VoicePoweredOrb';
import { api } from '@/lib/api';
import Vapi from '@vapi-ai/web';

/* ──────────────────────────────────────────────────────── */
/*  TestCallView — ElevenLabs-style full-screen call UI    */
/* ──────────────────────────────────────────────────────── */

interface TestCallViewProps {
  agentId: string;
  agentName: string;
  leadName: string;
  token: string;
  provider?: 'elevenlabs' | 'vapi' | 'gemini';
  onClose: () => void;
}

type CallStatus = 'connecting' | 'active' | 'ended' | 'error';

interface TranscriptEntry {
  role: 'agent' | 'user' | 'system';
  text: string;
  time: number;
}

/* ── Call History (persisted to localStorage) ── */

interface SavedCall {
  id: string;
  agentId: string;
  agentName: string;
  leadName: string;
  transcript: TranscriptEntry[];
  duration: number; // seconds
  timestamp: number; // unix ms
}

const HISTORY_KEY = 'dialix_call_history';
const MAX_HISTORY = 50;

function loadCallHistory(): SavedCall[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCall(call: SavedCall) {
  try {
    const history = loadCallHistory();
    history.unshift(call);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

function deleteCallFromHistory(callId: string) {
  try {
    const history = loadCallHistory().filter(c => c.id !== callId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

/* ══════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                          */
/* ══════════════════════════════════════════════════════════ */

export default function TestCallView({ agentId, agentName, leadName, token, provider = 'elevenlabs', onClose }: TestCallViewProps) {
  const [status, setStatus] = useState<CallStatus>('connecting');
  const [callTime, setCallTime] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVapiCall, setIsVapiCall] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);

  // History drawer
  const [showHistory, setShowHistory] = useState(false);
  const [callHistory, setCallHistory] = useState<SavedCall[]>([]);
  const [viewingCall, setViewingCall] = useState<SavedCall | null>(null);
  const callSaved = useRef(false);

  // Audio level ref for orb (updated per audio chunk, read by orb's rAF loop — no re-renders)
  const audioLevelRef = useRef(0);
  const audioDecayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastChunkTimeRef = useRef(0); // when the last audio chunk arrived
  const playEndWallTimeRef = useRef(0); // wall-clock time when buffered audio finishes
  const peakRmsRef = useRef(0); // rolling peak RMS for variation

  // WebSocket + Audio refs
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputSRRef = useRef(16000);
  const nextPlayTimeRef = useRef(0);
  const isMutedRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // Load history on mount
  useEffect(() => {
    setCallHistory(loadCallHistory().filter(c => c.agentId === agentId));
  }, [agentId]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Save call when it ends
  useEffect(() => {
    if ((status === 'ended' || status === 'error') && transcript.length > 1 && !callSaved.current) {
      callSaved.current = true;
      const nonSystemEntries = transcript.filter(e => e.role !== 'system');
      if (nonSystemEntries.length > 0) {
        const call: SavedCall = {
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          agentId,
          agentName,
          leadName,
          transcript,
          duration: callTime,
          timestamp: Date.now(),
        };
        saveCall(call);
        setCallHistory(loadCallHistory().filter(c => c.agentId === agentId));
      }
    }
  }, [status, transcript, callTime, agentId, agentName, leadName]);

  /* ══════════════════════════════════════════════════════════ */
  /*  AUDIO LEVEL — "Playback-aware" approach                  */
  /*                                                            */
  /*  KEY INSIGHT: ElevenLabs sends audio chunks in BURSTS.     */
  /*  A 5-second sentence arrives as a burst of chunks in       */
  /*  ~200ms, then nothing. Tracking chunk arrival time is      */
  /*  wrong — the orb dies when chunks stop arriving even       */
  /*  though audio is still PLAYING for seconds more.           */
  /*                                                            */
  /*  FIX: Track when buffered playback actually ends.          */
  /*  The orb stays alive until playback finishes + 400ms       */
  /*  grace period, then fades out slowly.                      */
  /* ══════════════════════════════════════════════════════════ */
  useEffect(() => {
    audioDecayRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastChunk = now - lastChunkTimeRef.current;
      const playbackRemaining = playEndWallTimeRef.current - now;

      // Agent is "speaking" if:
      //   1) Chunks arrived recently (within 800ms) — covers gaps between bursts, OR
      //   2) There's still buffered audio being played back
      const isSpeaking = timeSinceLastChunk < 800 || playbackRemaining > 0;

      if (isSpeaking) {
        // Agent is speaking — keep orb alive
        // Floor of 0.5, plus RMS peak variation up to 0.95
        const rmsBoost = peakRmsRef.current * 0.45;
        const target = 0.5 + rmsBoost;
        // Quick rise, gentle settling
        audioLevelRef.current += (target - audioLevelRef.current) * 0.25;
        // Slowly decay the peak RMS so we get natural pulsing
        peakRmsRef.current *= 0.95;
      } else {
        // Agent stopped speaking — fade out gracefully over ~1.5 seconds
        audioLevelRef.current *= 0.95;
        if (audioLevelRef.current < 0.01) audioLevelRef.current = 0;
        peakRmsRef.current = 0;
      }
    }, 30);
    return () => { if (audioDecayRef.current) clearInterval(audioDecayRef.current); };
  }, []);

  /* ── Compute RMS from agent PCM chunk ── */
  const computeLevel = (b64: string): number => {
    try {
      const raw = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const pcm16 = new Int16Array(bytes.buffer);
      let sum = 0;
      for (let i = 0; i < pcm16.length; i++) { const v = pcm16[i] / 32768; sum += v * v; }
      // Aggressive multiplier — speech PCM is quiet, need to amplify
      return Math.min(Math.sqrt(sum / pcm16.length) * 12.0, 1.0);
    } catch { return 0; }
  };

  /* ── Play agent audio chunk ── */
  const playChunk = useCallback((b64: string) => {
    const ctx = playCtxRef.current;
    if (!b64 || !ctx) return;
    try {
      // Mark that chunks are arriving
      lastChunkTimeRef.current = Date.now();
      // Compute RMS and update peak for orb variation
      const rms = computeLevel(b64);
      peakRmsRef.current = Math.max(peakRmsRef.current, rms);

      const raw = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
      const buffer = ctx.createBuffer(1, float32.length, outputSRRef.current);
      buffer.getChannelData(0).set(float32);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const now = ctx.currentTime;
      const startAt = Math.max(now, nextPlayTimeRef.current);
      src.start(startAt);
      nextPlayTimeRef.current = startAt + buffer.duration;

      // Track when ALL buffered audio will finish in wall-clock time
      // This is the key: even though chunks arrive in a burst,
      // this tells us when playback actually ends
      const playbackEndCtxTime = startAt + buffer.duration;
      const ctxElapsed = playbackEndCtxTime - ctx.currentTime;
      playEndWallTimeRef.current = Math.max(
        playEndWallTimeRef.current,
        Date.now() + ctxElapsed * 1000
      );
    } catch (e) { console.warn('[TestCall] Audio decode:', e); }
  }, []);

  /* ── Setup microphone ── */
  const setupMic = useCallback((stream: MediaStream, micCtx: AudioContext, ws: WebSocket) => {
    const source = micCtx.createMediaStreamSource(stream);
    sourceRef.current = source;
    const nativeSR = micCtx.sampleRate;
    const processor = micCtx.createScriptProcessor(2048, 1, 1);
    processorRef.current = processor;
    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN || isMutedRef.current) return;
      const input = e.inputBuffer.getChannelData(0);
      let samples: Float32Array;
      if (nativeSR === 16000) { samples = input; }
      else {
        const ratio = nativeSR / 16000;
        const len = Math.floor(input.length / ratio);
        samples = new Float32Array(len);
        for (let i = 0; i < len; i++) samples[i] = input[Math.floor(i * ratio)];
      }
      const pcm16 = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      const bts = new Uint8Array(pcm16.buffer);
      let bin = '';
      for (let i = 0; i < bts.length; i++) bin += String.fromCharCode(bts[i]);
      ws.send(JSON.stringify({ type: 'user_audio_chunk', user_audio_chunk: btoa(bin) }));
    };
    source.connect(processor);
    const silentGain = micCtx.createGain();
    silentGain.gain.value = 0;
    processor.connect(silentGain);
    silentGain.connect(micCtx.destination);
  }, []);

  /* ── Cleanup all resources ── */
  const doCleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    // Vapi SDK cleanup
    if (vapiRef.current) { try { vapiRef.current.stop(); } catch {} vapiRef.current = null; }
    // ElevenLabs cleanup
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current = null; }
    if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch {} sourceRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (micCtxRef.current) { try { micCtxRef.current.close(); } catch {} micCtxRef.current = null; }
    if (playCtxRef.current) { try { playCtxRef.current.close(); } catch {} playCtxRef.current = null; }
    // Reset audio refs so the orb stops animating
    audioLevelRef.current = 0;
    peakRmsRef.current = 0;
    lastChunkTimeRef.current = 0;
    playEndWallTimeRef.current = 0;
    nextPlayTimeRef.current = 0;
  }, []);

  /* ── Start the call on mount ── */
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await api<any>(`/agents/${agentId}/test-call/signed-url`, { token });
        if (cancelled) return;

        // ── Vapi flow: use Vapi Web SDK ──
        if (data.provider === 'vapi' || provider === 'vapi') {
          setIsVapiCall(true);
          const vapiInstance = new Vapi(data.public_key);
          vapiRef.current = vapiInstance;

          // Helper: activate the call UI (idempotent — only runs once)
          let activated = false;
          const activateCall = () => {
            if (activated || cancelled) return;
            activated = true;
            setStatus('active');
            setTranscript(prev => [...prev, { role: 'system', text: 'Call started', time: Date.now() }]);
            timerRef.current = setInterval(() => setCallTime(t => t + 1), 1000);
          };

          vapiInstance.on('call-start', activateCall);

          // Fallback: if call-start doesn't fire, speech-start will
          vapiInstance.on('speech-start', activateCall);

          vapiInstance.on('call-end', () => {
            if (cancelled) return;
            setStatus('ended');
            setTranscript(prev => [...prev, { role: 'system', text: 'Call ended', time: Date.now() }]);
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          vapiInstance.on('message', (msg: any) => {
            // Ultimate fallback: first transcript message means call is live
            activateCall();
            if (msg.type === 'transcript') {
              if (msg.transcriptType === 'final') {
                const role = msg.role === 'assistant' ? 'agent' : 'user';
                setTranscript(prev => [...prev, { role, text: msg.transcript, time: Date.now() }]);
              }
            }
          });

          vapiInstance.on('volume-level', (level: number) => {
            audioLevelRef.current = level;
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          vapiInstance.on('error', (err: any) => {
            console.error('[Vapi] Error:', err);
            // Ignore non-fatal errors (e.g. Krisp noise filter worklet)
            const errMsg = err?.error?.message || err?.message || String(err);
            const isFatal = errMsg.includes('call') || errMsg.includes('auth') || errMsg.includes('403') || errMsg.includes('401');
            if (isFatal && !cancelled) setStatus('error');
          });

          await vapiInstance.start(data.assistant_id);
          return;
        }

        // ── Gemini flow: Backend WebSocket bridge + PCM audio ──
        if (data.provider === 'gemini' || provider === 'gemini') {
          const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
          const wsProto = apiBase.startsWith('https') ? 'wss' : 'ws';
          const wsHost = apiBase.replace(/^https?:\/\//, '');
          const geminiWsUrl = `${wsProto}://${wsHost}/ws/gemini-call?agent_id=${agentId}&token=${token}`;

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
          });
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = stream;

          const micCtx = new AudioContext({ sampleRate: 16000 });
          micCtxRef.current = micCtx;
          const playCtx = new AudioContext({ sampleRate: 24000 });
          playCtxRef.current = playCtx;
          nextPlayTimeRef.current = 0;

          const ws = new WebSocket(geminiWsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            if (cancelled) return;
            setStatus('active');
            setTranscript(prev => [...prev, { role: 'system', text: 'Gemini call started', time: Date.now() }]);
            timerRef.current = setInterval(() => setCallTime(t => t + 1), 1000);
            setupMic(stream, micCtx, ws);
          };

          ws.onmessage = (evt) => {
            try {
              const msg = JSON.parse(evt.data.toString());
              if (msg.type === 'audio') {
                if (msg.data) playChunk(msg.data);
              } else if (msg.type === 'text') {
                if (msg.text) setTranscript(prev => [...prev, { role: 'agent', text: msg.text, time: Date.now() }]);
              } else if (msg.type === 'transcript') {
                if (msg.text) setTranscript(prev => [...prev, { role: 'user', text: msg.text, time: Date.now() }]);
              } else if (msg.type === 'error') {
                console.error('[Gemini] Error:', msg.message);
              } else if (msg.type === 'session_ended') {
                setStatus('ended');
                setTranscript(prev => [...prev, { role: 'system', text: 'Call ended', time: Date.now() }]);
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
              }
            } catch {}
          };

          ws.onerror = () => { if (!cancelled) setStatus('error'); };
          ws.onclose = () => {
            if (!cancelled) {
              setStatus('ended');
              setTranscript(prev => [...prev, { role: 'system', text: 'Call ended', time: Date.now() }]);
              if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            }
          };
          return;
        }

        // ── ElevenLabs flow: WebSocket + PCM audio ──
        // 1. Mic
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        // 2. Audio contexts
        const micCtx = new AudioContext();
        micCtxRef.current = micCtx;
        const playCtx = new AudioContext();
        playCtxRef.current = playCtx;
        nextPlayTimeRef.current = 0;

        // 3. WebSocket
        const ws = new WebSocket(data.signed_url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) return;
          ws.send(JSON.stringify({
            type: 'conversation_initiation_client_data',
            dynamic_variables: { lead_name: leadName, LEAD_NAME: leadName },
          }));
          setStatus('active');
          setTranscript(prev => [...prev, { role: 'system', text: 'Call started', time: Date.now() }]);
          timerRef.current = setInterval(() => setCallTime(t => t + 1), 1000);
          setupMic(stream, micCtx, ws);
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === 'conversation_initiation_metadata') {
              const meta = msg.conversation_initiation_metadata_event || msg;
              const fmt = meta?.agent_output_audio_format || '';
              const m = fmt.match(/(\d{4,6})/);
              if (m) outputSRRef.current = parseInt(m[1], 10);
            } else if (msg.type === 'audio') {
              const chunk = msg.audio?.chunk || msg.audio_event?.audio_base_64 || '';
              if (chunk) playChunk(chunk);
            } else if (msg.type === 'agent_response') {
              const text = msg.agent_response_event?.agent_response || '';
              if (text) setTranscript(prev => [...prev, { role: 'agent', text, time: Date.now() }]);
            } else if (msg.type === 'user_transcript') {
              const text = msg.user_transcription_event?.user_transcript || '';
              if (text) setTranscript(prev => [...prev, { role: 'user', text, time: Date.now() }]);
            } else if (msg.type === 'interruption') {
              nextPlayTimeRef.current = 0;
            } else if (msg.type === 'ping') {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'pong', event_id: msg.ping_event?.event_id || 0 }));
              }
            }
          } catch {}
        };

        ws.onerror = () => { if (!cancelled) setStatus('error'); };
        ws.onclose = () => {
          if (!cancelled) {
            setStatus('ended');
            setTranscript(prev => [...prev, { role: 'system', text: 'Call ended', time: Date.now() }]);
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          }
        };
      } catch (err) {
        if (!cancelled) setStatus('error');
        console.error('[TestCall] Start error:', err);
      }
    };

    start();

    return () => {
      cancelled = true;
      doCleanup();
    };
  }, [agentId, token, leadName, provider, setupMic, playChunk, doCleanup]);

  const endCall = () => { doCleanup(); setStatus('ended'); setTranscript(prev => [...prev, { role: 'system', text: 'You ended the call', time: Date.now() }]); };

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (streamRef.current) streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
      if (vapiRef.current) { try { vapiRef.current.setMuted(next); } catch {} }
      return next;
    });
  };

  const handleDeleteHistory = (callId: string) => {
    deleteCallFromHistory(callId);
    setCallHistory(prev => prev.filter(c => c.id !== callId));
    if (viewingCall?.id === callId) setViewingCall(null);
  };

  /* ══════════════════════════════════════════════════════════ */
  /*  RENDER                                                  */
  /* ══════════════════════════════════════════════════════════ */

  // Viewing a past call's transcript
  if (viewingCall) {
    return (
      <div className="tcv-overlay">
        <div className="tcv-header">
          <button className="tcv-back-btn" onClick={() => setViewingCall(null)}>
            <Icon name="arrow-left" size={14} /> Back
          </button>
          <div className="tcv-agent-name">{viewingCall.agentName}</div>
          <div className="tcv-timer">
            <span>{fmtDate(viewingCall.timestamp)} · {fmtTime(viewingCall.duration)}</span>
          </div>
          <button className="tcv-close-btn" onClick={onClose}>
            <Icon name="x" size={14} /> Close
          </button>
        </div>
        <div className="tcv-body">
          {/* Left — info */}
          <div className="tcv-orb-panel" style={{ justifyContent: 'flex-start', paddingTop: '48px' }}>
            <div className="tcv-history-call-info">
              <div className="tcv-hci-icon"><Icon name="phone" size={24} /></div>
              <h3>Past Call</h3>
              <div className="tcv-hci-meta">
                <span>Lead: {viewingCall.leadName}</span>
                <span>Duration: {fmtTime(viewingCall.duration)}</span>
                <span>{fmtDate(viewingCall.timestamp)}</span>
              </div>
              <div className="tcv-hci-stats">
                <div className="tcv-hci-stat">
                  <span className="tcv-hci-stat-num">{viewingCall.transcript.filter(e => e.role === 'agent').length}</span>
                  <span className="tcv-hci-stat-label">Agent Messages</span>
                </div>
                <div className="tcv-hci-stat">
                  <span className="tcv-hci-stat-num">{viewingCall.transcript.filter(e => e.role === 'user').length}</span>
                  <span className="tcv-hci-stat-label">User Messages</span>
                </div>
              </div>
            </div>
          </div>
          {/* Right — saved transcript */}
          <div className="tcv-transcript-panel">
            <div className="tcv-transcript-header">
              <Icon name="message-square" size={14} /> Transcript
            </div>
            <div className="tcv-transcript-body">
              {viewingCall.transcript.map((entry, i) => (
                <div key={i} className={`tcv-msg ${entry.role}`}>
                  {entry.role === 'system' ? (
                    <div className="tcv-msg-system">{entry.text}</div>
                  ) : (
                    <div className="tcv-msg-bubble">
                      <div className="tcv-msg-role">
                        <Icon name={entry.role === 'agent' ? 'bot' : 'user'} size={12} />
                        {entry.role === 'agent' ? viewingCall.agentName : 'You'}
                      </div>
                      <div className="tcv-msg-text">{entry.text}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tcv-overlay">
      {/* ── Header ── */}
      <div className="tcv-header">
        <button className="tcv-back-btn" onClick={() => { doCleanup(); onClose(); }}>
          <Icon name="arrow-left" size={14} /> Back
        </button>
        <div className="tcv-agent-name">{agentName}</div>
        <div className="tcv-timer">
          <div className={`tcv-status-dot ${status}`} />
          {status === 'active' && <span>{fmtTime(callTime)}</span>}
          {status === 'connecting' && <span>Connecting…</span>}
          {status === 'ended' && <span>Ended · {fmtTime(callTime)}</span>}
          {status === 'error' && <span>Failed</span>}
        </div>
        {/* History button */}
        {callHistory.length > 0 && (
          <button
            className={`tcv-history-toggle ${showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(prev => !prev)}
            title="Call History"
          >
            <Icon name="clock" size={14} />
            <span className="tcv-history-count">{callHistory.length}</span>
          </button>
        )}
        {status === 'active' && (
          <button className="tcv-end-btn" onClick={endCall}>
            <Icon name="phone-off" size={13} /> End Call
          </button>
        )}
        {(status === 'ended' || status === 'error') && (
          <button className="tcv-close-btn" onClick={onClose}>
            <Icon name="x" size={14} /> Close
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div className="tcv-body">
        {/* Left — Orb + Controls (ElevenLabs) or Vapi iframe */}
        <div className="tcv-orb-panel">
            <div className="tcv-orb-wrapper">
              <VoicePoweredOrb
                audioLevelRef={audioLevelRef}
                hue={isVapiCall ? 210 : 0}
                maxRotationSpeed={1.4}
                maxHoverIntensity={0.9}
              />
            </div>

            {/* Speaking indicator */}
            {status === 'active' && (
              <div className="tcv-speaking-indicator">
                <div className="tcv-speaking-bars">
                  <span /><span /><span /><span /><span />
                </div>
                <span className="tcv-speaking-label">Listening…</span>
              </div>
            )}

            {/* Controls */}
            <div className="tcv-controls">
              {status === 'active' && (
                <>
                  <button className={`tcv-mute-btn ${isMuted ? 'muted' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                    <Icon name={isMuted ? 'mic-off' : 'mic'} size={18} />
                  </button>
                  <button className="tcv-hangup-btn" onClick={endCall} title="End Call">
                    <Icon name="phone-off" size={18} />
                  </button>
                </>
              )}
              {status === 'connecting' && (
                <div className="tcv-connecting-label">
                  <div className="spinner" style={{ width: 16, height: 16 }} />
                  Requesting microphone…
                </div>
              )}
              {(status === 'ended' || status === 'error') && (
                <button className="tcv-new-call-btn" onClick={onClose}>
                  <Icon name="arrow-left" size={14} /> Back to Agent
                </button>
              )}
            </div>
        </div>

        {/* Right — Transcript (live or history drawer) */}
        {showHistory ? (
          <div className="tcv-transcript-panel">
            <div className="tcv-transcript-header">
              <Icon name="clock" size={14} /> Call History
              <button className="tcv-history-close" onClick={() => setShowHistory(false)}>
                <Icon name="x" size={12} />
              </button>
            </div>
            <div className="tcv-history-list">
              {callHistory.length === 0 ? (
                <div className="tcv-transcript-empty">No past calls yet</div>
              ) : (
                callHistory.map((call) => (
                  <div key={call.id} className="tcv-history-item" onClick={() => { setViewingCall(call); setShowHistory(false); }}>
                    <div className="tcv-history-item-top">
                      <div className="tcv-history-item-icon"><Icon name="phone" size={12} /></div>
                      <div className="tcv-history-item-info">
                        <span className="tcv-history-item-name">{call.agentName}</span>
                        <span className="tcv-history-item-lead">Lead: {call.leadName}</span>
                      </div>
                      <span className="tcv-history-item-time">{relativeTime(call.timestamp)}</span>
                    </div>
                    <div className="tcv-history-item-bottom">
                      <span className="tcv-history-item-duration">
                        <Icon name="clock" size={10} /> {fmtTime(call.duration)}
                      </span>
                      <span className="tcv-history-item-msgs">
                        {call.transcript.filter(e => e.role !== 'system').length} messages
                      </span>
                      <button
                        className="tcv-history-item-delete"
                        onClick={(e) => { e.stopPropagation(); handleDeleteHistory(call.id); }}
                        title="Delete"
                      >
                        <Icon name="trash-2" size={11} />
                      </button>
                    </div>
                    {/* Preview — first agent message */}
                    {(() => {
                      const firstAgent = call.transcript.find(e => e.role === 'agent');
                      return firstAgent ? (
                        <div className="tcv-history-item-preview">
                          &quot;{firstAgent.text.length > 80 ? firstAgent.text.slice(0, 80) + '…' : firstAgent.text}&quot;
                        </div>
                      ) : null;
                    })()}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="tcv-transcript-panel">
            <div className="tcv-transcript-header">
              <Icon name="message-square" size={14} /> Transcript
            </div>
            <div className="tcv-transcript-body">
              {transcript.length === 0 && (
                <div className="tcv-transcript-empty">Waiting for conversation…</div>
              )}
              {transcript.map((entry, i) => (
                <div key={i} className={`tcv-msg ${entry.role}`}>
                  {entry.role === 'system' ? (
                    <div className="tcv-msg-system">{entry.text}</div>
                  ) : (
                    <div className="tcv-msg-bubble">
                      <div className="tcv-msg-role">
                        <Icon name={entry.role === 'agent' ? 'bot' : 'user'} size={12} />
                        {entry.role === 'agent' ? agentName : 'You'}
                      </div>
                      <div className="tcv-msg-text">{entry.text}</div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
