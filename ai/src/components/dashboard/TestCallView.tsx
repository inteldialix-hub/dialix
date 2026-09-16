'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, X, PhoneOff, Mic, MicOff, Bot, User, Clock, Phone, MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputSRRef = useRef(16000);
  const nextPlayTimeRef = useRef(0);
  const isMutedRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // Immediate interruption / barge-in helper
  const stopAgentPlayback = useCallback(() => {
    if (activeSourcesRef.current.length > 0) {
      activeSourcesRef.current.forEach(src => {
        try {
          src.stop();
          src.disconnect();
        } catch {}
      });
      activeSourcesRef.current = [];
    }
    const ctx = playCtxRef.current;
    nextPlayTimeRef.current = ctx ? ctx.currentTime : 0;
    playEndWallTimeRef.current = 0;
    peakRmsRef.current = 0;
    audioLevelRef.current = 0;
  }, []);

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

      activeSourcesRef.current.push(src);
      src.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== src);
      };

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

      // Instant local barge-in: detect clear user speech while agent is speaking
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      const micRms = Math.sqrt(sum / input.length);
      if (micRms > 0.09 && playEndWallTimeRef.current > Date.now()) {
        stopAgentPlayback();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'interrupt' }));
        }
      }

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
      const b64Data = btoa(bin);
      ws.send(JSON.stringify({
        type: 'user_audio_chunk',
        user_audio_chunk: b64Data,
        data: b64Data,
      }));
    };
    source.connect(processor);
    const silentGain = micCtx.createGain();
    silentGain.gain.value = 0;
    processor.connect(silentGain);
    silentGain.connect(micCtx.destination);
  }, [stopAgentPlayback]);

  /* ── Cleanup all resources ── */
  const doCleanup = useCallback(() => {
    stopAgentPlayback();
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
          const apiBase = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://dialix-backend.onrender.com');
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
          outputSRRef.current = 24000;
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
              } else if (msg.type === 'interrupted') {
                stopAgentPlayback();
              } else if (msg.type === 'user_transcript') {
                const text = (msg.text || '').trim();
                if (text) {
                  setTranscript(prev => [...prev, { role: 'user', text, time: Date.now() }]);
                }
              } else if (msg.type === 'agent_response') {
                const text = (msg.text || '').trim();
                if (text) {
                  setTranscript(prev => [...prev, { role: 'agent', text, time: Date.now() }]);
                }
              } else if (msg.type === 'text') {
                if (msg.text) setTranscript(prev => [...prev, { role: 'agent', text: msg.text, time: Date.now() }]);
              } else if (msg.type === 'transcript') {
                const text = (msg.text || '').trim();
                if (text) {
                  setTranscript(prev => [...prev, { role: 'user', text, time: Date.now() }]);
                }
              } else if (msg.type === 'error') {
                console.error('[Gemini] Error:', msg.message);
                setTranscript(prev => [...prev, { role: 'system', text: `Error: ${msg.message}`, time: Date.now() }]);
                setStatus('error');
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
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={() => setViewingCall(null)}>
            <ArrowLeft className="size-3.5" /> Back
          </button>
          <span className="text-sm font-medium text-foreground">{viewingCall.agentName}</span>
          <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
            <span>{fmtDate(viewingCall.timestamp)} · {fmtTime(viewingCall.duration)}</span>
          </div>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="size-3.5" /> Close
          </button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          {/* Left — info */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="rounded-lg border border-border bg-card p-6 text-center max-w-xs">
              <Phone className="size-8 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-medium text-foreground mb-3">Past Call</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Lead: {viewingCall.leadName}</p>
                <p>Duration: {fmtTime(viewingCall.duration)}</p>
                <p>{fmtDate(viewingCall.timestamp)}</p>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="text-center">
                  <div className="text-lg font-semibold text-foreground">{viewingCall.transcript.filter(e => e.role === 'agent').length}</div>
                  <div className="text-xs text-muted-foreground">Agent messages</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-foreground">{viewingCall.transcript.filter(e => e.role === 'user').length}</div>
                  <div className="text-xs text-muted-foreground">User messages</div>
                </div>
              </div>
            </div>
          </div>
          {/* Right — saved transcript */}
          <div className="w-96 border-l border-border flex flex-col bg-card">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border text-sm font-medium text-foreground">
              <MessageSquare className="size-3.5" /> Transcript
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {viewingCall.transcript.map((entry, i) => (
                <div key={i}>
                  {entry.role === 'system' ? (
                    <div className="text-xs text-muted-foreground text-center py-1">{entry.text}</div>
                  ) : (
                    <div className={cn("rounded-lg p-3 text-sm", entry.role === 'agent' ? "bg-accent" : "bg-muted")}>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        {entry.role === 'agent' ? <Bot className="size-3" /> : <User className="size-3" />}
                        {entry.role === 'agent' ? viewingCall.agentName : 'You'}
                      </div>
                      <div className="text-foreground">{entry.text}</div>
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
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={() => { doCleanup(); onClose(); }}>
          <ArrowLeft className="size-3.5" /> Back
        </button>
        <span className="text-sm font-medium text-foreground">{agentName}</span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
          <span className={cn("size-2 rounded-full", 
            status === 'active' ? "bg-green-500" : 
            status === 'connecting' ? "bg-yellow-500 animate-pulse" : 
            status === 'error' ? "bg-red-500" : "bg-muted-foreground"
          )} />
          {status === 'active' && <span>{fmtTime(callTime)}</span>}
          {status === 'connecting' && <span>Connecting…</span>}
          {status === 'ended' && <span>Ended · {fmtTime(callTime)}</span>}
          {status === 'error' && <span>Failed</span>}
        </div>
        {/* History button */}
        {callHistory.length > 0 && (
          <button
            className={cn("flex items-center gap-1.5 text-sm px-2 py-1 rounded-md transition-colors", showHistory ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
            onClick={() => setShowHistory(prev => !prev)}
            title="Call History"
          >
            <Clock className="size-3.5" /> <span className="text-xs">{callHistory.length}</span>
          </button>
        )}
        {status === 'active' && (
          <button className="flex items-center gap-1.5 bg-red-500 text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-red-600" onClick={endCall}>
            <PhoneOff className="size-3.5" /> End Call
          </button>
        )}
        {(status === 'ended' || status === 'error') && (
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="size-3.5" /> Close
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left — Orb + Controls (ElevenLabs) or Vapi iframe */}
        <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-48 h-48">
              <VoicePoweredOrb
                audioLevelRef={audioLevelRef}
                hue={isVapiCall ? 210 : 0}
                maxRotationSpeed={1.4}
                maxHoverIntensity={0.9}
              />
            </div>

            {/* Speaking indicator */}
            {status === 'active' && (
              <div className="flex items-center gap-2 mt-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-0.5 h-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="w-0.5 bg-foreground/40 rounded-full animate-pulse" style={{height: `${8 + (i % 3) * 4}px`, animationDelay: `${i * 0.1}s`}} />
                  ))}
                </div>
                <span>Listening…</span>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-4 mt-8">
              {status === 'active' && (
                <>
                  <button className={cn("flex size-12 items-center justify-center rounded-full border transition-colors", isMuted ? "border-red-500/50 bg-red-500/10 text-red-400" : "border-border bg-card text-foreground hover:bg-accent")} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                    {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                  </button>
                  <button className="flex size-12 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600" onClick={endCall} title="End Call">
                    <PhoneOff className="size-5" />
                  </button>
                </>
              )}
              {status === 'connecting' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="size-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                  Requesting microphone…
                </div>
              )}
              {(status === 'ended' || status === 'error') && (
                <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
                  <ArrowLeft className="size-3.5" /> Back to Agent
                </button>
              )}
            </div>
        </div>

        {/* Right — Transcript (live or history drawer) */}
        {showHistory ? (
          <div className="w-96 border-l border-border flex flex-col bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="size-3.5" /> Call History
              </div>
              <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {callHistory.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">No past calls yet</div>
              ) : (
                callHistory.map((call) => (
                  <div key={call.id} className="px-4 py-3 border-b border-border cursor-pointer hover:bg-accent transition-colors" onClick={() => { setViewingCall(call); setShowHistory(false); }}>
                    <div className="flex items-center gap-2">
                      <Phone className="size-3 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{call.agentName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{relativeTime(call.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Lead: {call.leadName}</span>
                      <span className="flex items-center gap-1"><Clock className="size-2.5" />{fmtTime(call.duration)}</span>
                      <span>{call.transcript.filter(e => e.role !== 'system').length} messages</span>
                      <button
                        className="ml-auto text-muted-foreground hover:text-red-400"
                        onClick={(e) => { e.stopPropagation(); handleDeleteHistory(call.id); }}
                        title="Delete"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                    {/* Preview — first agent message */}
                    {(() => {
                      const firstAgent = call.transcript.find(e => e.role === 'agent');
                      return firstAgent ? (
                        <div className="mt-1 text-xs text-muted-foreground/60 truncate italic">
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
          <div className="w-96 border-l border-border flex flex-col bg-card">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border text-sm font-medium text-foreground">
              <MessageSquare className="size-3.5" /> Transcript
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {transcript.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">Waiting for conversation…</div>
              )}
              {transcript.map((entry, i) => (
                <div key={i}>
                  {entry.role === 'system' ? (
                    <div className="text-xs text-muted-foreground text-center py-1">{entry.text}</div>
                  ) : (
                    <div className={cn("rounded-lg p-3 text-sm", entry.role === 'agent' ? "bg-accent" : "bg-muted")}>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        {entry.role === 'agent' ? <Bot className="size-3" /> : <User className="size-3" />}
                        {entry.role === 'agent' ? agentName : 'You'}
                      </div>
                      <div className="text-foreground">{entry.text}</div>
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
