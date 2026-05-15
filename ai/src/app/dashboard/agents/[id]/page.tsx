'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import { Icon } from '@/components/dashboard/shared/Icon';
import { CustomSelect, type SelectOption } from '@/components/dashboard/shared/CustomSelect';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { api } from '@/lib/api';
import { FALLBACK_LLM_OPTIONS, FALLBACK_TTS_MODEL_OPTIONS, FALLBACK_LANGUAGE_OPTIONS, VAPI_MODEL_PROVIDERS, VAPI_LLM_OPTIONS, VAPI_VOICE_PROVIDERS, VAPI_TRANSCRIBER_PROVIDERS, VAPI_FIRST_MESSAGE_MODES, VAPI_BACKGROUND_SOUNDS, VAPI_TRANSCRIBER_MODELS, VAPI_VOICEMAIL_DETECTION, VAPI_VOICE_MODELS, VAPI_VOICE_SPEED_PROVIDERS, GEMINI_VOICES, GEMINI_MODELS, GEMINI_THINKING_LEVELS, GEMINI_MEDIA_RESOLUTIONS } from '@/lib/constants';
import TestCallView from '@/components/dashboard/TestCallView';
import { SlidePanel } from '@/components/dashboard/shared/SlidePanel';
import { SneakyButton } from '@/components/ui/sneaky-button';

/* ────────────────────────────────────────────────────────── */
/*  Agent Detail — Full 8-tab config (matches old dashboard) */
/* ────────────────────────────────────────────────────────── */

interface AgentConfig { [key: string]: unknown; }
interface Voice { voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string; }
interface Agent { agent_id: string; name: string; }
interface PhoneNumber { id: string; label: string; phone_number: string; assigned_agent_id?: string; }

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  const router = useRouter();
  const { token, client } = useAuth();
  const { addToast } = useToast();

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [dirty, setDirty] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [provider, setProvider] = useState<'elevenlabs' | 'vapi' | 'gemini'>('elevenlabs');
  const [allowedFeatures, setAllowedFeatures] = useState<Record<string, boolean> | null>(null);

  // Live dropdown options from ElevenLabs API (falls back to constants)
  const [liveLLMs, setLiveLLMs] = useState<SelectOption[]>(FALLBACK_LLM_OPTIONS);
  const [liveTTSModels, setLiveTTSModels] = useState<SelectOption[]>(FALLBACK_TTS_MODEL_OPTIONS);
  const [liveLanguages, setLiveLanguages] = useState<SelectOption[]>(FALLBACK_LANGUAGE_OPTIONS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rawTTSData, setRawTTSData] = useState<Record<string, unknown>[]>([]);

  // Quick Call state
  const [leadName, setLeadName] = useState('');
  const [callPhoneId, setCallPhoneId] = useState('');
  const [callToNumber, setCallToNumber] = useState('');
  const [calling, setCalling] = useState(false);

  // Voice picker state
  const [voiceFilter, setVoiceFilter] = useState('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Test Call state (logic moved to TestCallView component)
  const [showTestCall, setShowTestCall] = useState(false);
  const [showLeadNamePrompt, setShowLeadNamePrompt] = useState(false);
  const [testLeadName, setTestLeadName] = useState('');

  // ── All editable fields ──
  const [name, setName] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [language, setLanguage] = useState('en');
  const [disableFirstMsgInterrupt, setDisableFirstMsgInterrupt] = useState(false);
  // Prompt
  const [prompt, setPrompt] = useState('');
  const [llm, setLlm] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(-1);
  const [ignoreDefaultPersonality, setIgnoreDefaultPersonality] = useState(false);
  // Voice
  const [ttsModel, setTtsModel] = useState('eleven_v3_conversational');
  const [voiceId, setVoiceId] = useState('');
  const [stability, setStability] = useState(0.5);
  const [speed, setSpeed] = useState(1.0);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [expressiveMode, setExpressiveMode] = useState(false);
  const [streamingLatency, setStreamingLatency] = useState(0);
  const [audioFormat, setAudioFormat] = useState('pcm_16000');
  const [audioTags, setAudioTags] = useState<Array<{name: string; description?: string}>>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  // Call Behavior
  const [turnTimeout, setTurnTimeout] = useState(2.0);
  const [silenceEndCall, setSilenceEndCall] = useState(10.0);
  const [turnEagerness, setTurnEagerness] = useState('normal');
  const [maxDuration, setMaxDuration] = useState(300);
  const [mode, setMode] = useState('turn');
  // ASR
  const [asrQuality, setAsrQuality] = useState('high');
  const [asrProvider, setAsrProvider] = useState('scribe_realtime');
  // Safety
  const [guardrailFocus, setGuardrailFocus] = useState(false);
  const [guardrailPromptInjection, setGuardrailPromptInjection] = useState(false);
  // Advanced
  const [concurrencyLimit, setConcurrencyLimit] = useState(-1);
  const [dailyLimit, setDailyLimit] = useState(100000);
  const [enableAuth, setEnableAuth] = useState(false);
  // Privacy
  const [recordVoice, setRecordVoice] = useState(true);
  const [retentionDays, setRetentionDays] = useState(90);
  const [deleteTranscript, setDeleteTranscript] = useState(false);
  // Vapi-specific fields
  const [modelProvider, setModelProvider] = useState('openai');
  const [voiceProvider, setVoiceProvider] = useState('11labs');
  const [transcriberProvider, setTranscriberProvider] = useState('deepgram');
  const [transcriberModel, setTranscriberModel] = useState('nova-2');
  const [zeroRetention, setZeroRetention] = useState(false);
  // Vapi expanded fields
  const [firstMessageMode, setFirstMessageMode] = useState('assistant-speaks-first');
  const [firstMsgInterruptionsEnabled, setFirstMsgInterruptionsEnabled] = useState(false);
  const [endCallMessage, setEndCallMessage] = useState('');
  const [endCallPhrases, setEndCallPhrases] = useState<string[]>([]);
  const [endCallPhraseInput, setEndCallPhraseInput] = useState('');
  const [voicemailMessage, setVoicemailMessage] = useState('');
  const [backgroundSound, setBackgroundSound] = useState('off');
  const [emotionRecognitionEnabled, setEmotionRecognitionEnabled] = useState(false);
  const [voiceCachingEnabled, setVoiceCachingEnabled] = useState(true);
  const [startSpeakingWait, setStartSpeakingWait] = useState(0.4);
  const [smartEndpointing, setSmartEndpointing] = useState(false);
  const [stopSpeakingNumWords, setStopSpeakingNumWords] = useState(0);
  const [stopSpeakingVoiceSec, setStopSpeakingVoiceSec] = useState(0.2);
  const [stopSpeakingBackoff, setStopSpeakingBackoff] = useState(1);
  const [hipaaEnabled, setHipaaEnabled] = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [videoRecordingEnabled, setVideoRecordingEnabled] = useState(false);
  const [smartDenoisingEnabled, setSmartDenoisingEnabled] = useState(true);
  const [monitorListenEnabled, setMonitorListenEnabled] = useState(false);
  const [monitorControlEnabled, setMonitorControlEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [keypadEnabled, setKeypadEnabled] = useState(false);
  const [endCallFunctionEnabled, setEndCallFunctionEnabled] = useState(true);
  const [backgroundDenoisingEnabled, setBackgroundDenoisingEnabled] = useState(false);
  const [voicemailDetection, setVoicemailDetection] = useState('off');
  const [transcriberLanguage, setTranscriberLanguage] = useState('en');
  const [transcriberKeywords, setTranscriberKeywords] = useState<string[]>([]);
  const [transcriberEndpointing, setTranscriberEndpointing] = useState<number | undefined>(undefined);
  const [transcriberConfidenceThreshold, setTranscriberConfidenceThreshold] = useState<number | undefined>(undefined);
  const [transcriberSmartFormat, setTranscriberSmartFormat] = useState(false);
  const [fillerInjectionEnabled, setFillerInjectionEnabled] = useState(false);
  const [voiceModel, setVoiceModel] = useState('');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [slidePanel, setSlidePanel] = useState<'voice' | 'transcriber' | null>(null);

  // Gemini-specific state
  const [thinkingLevel, setThinkingLevel] = useState('none');
  const [mediaResolution, setMediaResolution] = useState('medium');
  const [maxContextSize, setMaxContextSize] = useState(128000);
  const [targetContextSize, setTargetContextSize] = useState(64000);
  const [groundingGoogleSearch, setGroundingGoogleSearch] = useState(false);
  const [affectiveDialog, setAffectiveDialog] = useState(false);
  const [proactiveAudio, setProactiveAudio] = useState(false);

  const loadAgent = useCallback(async () => {
    try {
      const data = await api<{ config: AgentConfig; allowed_features?: Record<string, boolean> | null }>(`/agents/${agentId}`, { token: token! });
      const a = data.config;
      setConfig(a);
      setAllowedFeatures(data.allowed_features || null);
      setProvider((a.provider as 'elevenlabs' | 'vapi' | 'gemini') || 'elevenlabs');
      setName((a.name as string) || '');
      setFirstMessage((a.first_message as string) || '');
      // Vapi-specific
      if (a.provider === 'vapi') {
        setModelProvider((a.model_provider as string) || 'openai');
        setVoiceProvider((a.voice_provider as string) || '11labs');
        setTranscriberProvider((a.transcriber_provider as string) || 'deepgram');
        setTranscriberModel((a.transcriber_model as string) || 'nova-2');
        setFirstMessageMode((a.first_message_mode as string) || 'assistant-speaks-first');
        setFirstMsgInterruptionsEnabled(!!a.first_message_interruptions_enabled);
        setEndCallMessage((a.end_call_message as string) || '');
        setEndCallPhrases(Array.isArray(a.end_call_phrases) ? a.end_call_phrases as string[] : []);
        setVoicemailMessage((a.voicemail_message as string) || '');
        setBackgroundSound((a.background_sound as string) || 'off');
        setEmotionRecognitionEnabled(!!a.emotion_recognition_enabled);
        setVoiceCachingEnabled(a.voice_caching_enabled !== false);
        setStartSpeakingWait((a.start_speaking_wait_seconds as number) ?? 0.4);
        setSmartEndpointing(!!a.smart_endpointing_enabled);
        setStopSpeakingNumWords((a.stop_speaking_num_words as number) ?? 0);
        setStopSpeakingVoiceSec((a.stop_speaking_voice_seconds as number) ?? 0.2);
        setStopSpeakingBackoff((a.stop_speaking_backoff_seconds as number) ?? 1);
        setHipaaEnabled(!!a.hipaa_enabled);
        setRecordingEnabled(a.recording_enabled !== false);
        setVideoRecordingEnabled(!!a.video_recording_enabled);
        setSmartDenoisingEnabled(a.smart_denoising_enabled !== false);
        setMonitorListenEnabled(!!a.monitor_listen_enabled);
        setMonitorControlEnabled(!!a.monitor_control_enabled);
        setServerUrl((a.server_url as string) || '');
        setKeypadEnabled(!!a.keypad_enabled);
        setEndCallFunctionEnabled(a.end_call_function_enabled !== false);
        setBackgroundDenoisingEnabled(!!a.background_denoising_enabled);
        setVoicemailDetection((a.voicemail_detection as string) || 'off');
        setTranscriberLanguage((a.transcriber_language as string) || 'en');
        setTranscriberKeywords(Array.isArray(a.transcriber_keywords) ? a.transcriber_keywords as string[] : []);
        setTranscriberEndpointing(a.transcriber_endpointing as number | undefined);
        setTranscriberConfidenceThreshold(a.transcriber_confidence_threshold as number | undefined);
        setTranscriberSmartFormat(!!a.transcriber_smart_format);
        setFillerInjectionEnabled(!!a.voice_filler_injection_enabled);
        setVoiceModel((a.voice_model as string) || '');
        setVoiceSpeed((a.voice_speed as number) ?? 1.0);
      }
      // Gemini-specific: map gemini fields to shared state
      if (a.provider === 'gemini') {
        setLlm((a.gemini_model as string) || 'models/gemini-3.1-flash-live-preview');
        setVoiceId((a.gemini_voice as string) || 'Kore');
        setThinkingLevel((a.thinking_level as string) || 'none');
        setMediaResolution((a.media_resolution as string) || 'medium');
        setMaxContextSize((a.max_context_size as number) ?? 128000);
        setTargetContextSize((a.target_context_size as number) ?? 64000);
        setGroundingGoogleSearch(!!a.grounding_google_search);
        setAffectiveDialog(!!a.affective_dialog);
        setProactiveAudio(!!a.proactive_audio);
      }
      setLanguage((a.language as string) || 'en');
      setDisableFirstMsgInterrupt(!!a.disable_first_message_interruptions);
      setPrompt(typeof a.prompt === 'string' ? a.prompt : '');
      if (a.provider !== 'gemini') setLlm((a.llm as string) || 'gpt-4o-mini');
      setTemperature((a.temperature as number) ?? 0.7);
      setMaxTokens((a.max_tokens as number) ?? -1);
      setIgnoreDefaultPersonality(!!a.ignore_default_personality);
      setTtsModel((a.tts_model_id as string) || 'eleven_v3_conversational');
      if (a.provider !== 'gemini') setVoiceId((a.voice_id as string) || '');
      setStability((a.stability as number) ?? 0.5);
      setSpeed((a.speed as number) ?? 1.0);
      setStreamingLatency((a.optimize_streaming_latency as number) ?? 0);
      setAudioFormat((a.agent_output_audio_format as string) || 'pcm_16000');
      setSimilarityBoost((a.similarity_boost as number) ?? 0.75);
      setExpressiveMode(!!a.expressive_mode);
      setAudioTags(Array.isArray(a.suggested_audio_tags) ? a.suggested_audio_tags as Array<{name: string; description?: string}> : []);
      setTurnTimeout((a.turn_timeout as number) ?? 2.0);
      setSilenceEndCall((a.silence_end_call_timeout as number) ?? 10.0);
      setTurnEagerness((a.turn_eagerness as string) || 'normal');
      setMaxDuration((a.max_duration_seconds as number) ?? 300);
      setMode((a.mode as string) || 'turn');
      setAsrQuality((a.asr_quality as string) || 'high');
      setAsrProvider((a.asr_provider as string) || 'scribe_realtime');
      setGuardrailFocus(!!a.guardrail_focus);
      setGuardrailPromptInjection(!!a.guardrail_prompt_injection);
      setConcurrencyLimit((a.agent_concurrency_limit as number) ?? -1);
      setDailyLimit((a.daily_limit as number) ?? 100000);
      setEnableAuth(!!a.enable_auth);
      setRecordVoice(a.record_voice !== false);
      setRetentionDays((a.retention_days as number) ?? 90);
      setDeleteTranscript(!!a.delete_transcript_and_pii);
      setZeroRetention(!!a.zero_retention_mode);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load agent', 'error');
    } finally { setLoading(false); }
  }, [agentId, token, addToast]);

  // Voice preview — use the preview_url from ElevenLabs API
  const playVoicePreview = (vid: string) => {
    if (previewingId === vid) {
      previewAudioRef.current?.pause();
      setPreviewingId(null);
      return;
    }
    if (previewAudioRef.current) previewAudioRef.current.pause();
    const voice = voices.find(v => v.voice_id === vid);
    if (!voice?.preview_url) { addToast('No preview available for this voice', 'error'); return; }
    const audio = new Audio(voice.preview_url);
    audio.onended = () => setPreviewingId(null);
    audio.onerror = () => { setPreviewingId(null); addToast('Preview unavailable', 'error'); };
    audio.play().catch(() => setPreviewingId(null));
    previewAudioRef.current = audio;
    setPreviewingId(vid);
  };

  // Show lead name prompt before starting the test call
  const promptTestCall = () => {
    setTestLeadName('');
    setShowLeadNamePrompt(true);
  };

  const handleStartTestCall = (nameOverride?: string) => {
    setShowLeadNamePrompt(false);
    setTestLeadName(nameOverride || testLeadName || 'Test User');
    setShowTestCall(true);
  };

  const loadExtras = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [v, p, m] = await Promise.allSettled([
        api<{ voices: Voice[] }>('/agents/voices', { token: token! }),
        api<{ phoneNumbers: PhoneNumber[] }>('/phone-numbers', { token: token! }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        api<{ models: any[]; languages: SelectOption[]; llms: any[] }>('/agents/models', { token: token! }),
      ]);
      if (v.status === 'fulfilled') setVoices(v.value.voices || []);
      if (p.status === 'fulfilled') setPhoneNumbers(p.value.phoneNumbers || []);
      if (m.status === 'fulfilled') {
        const md = m.value;
        // Map LLMs with rich metadata including latency
        if (md.llms?.length) {
          setLiveLLMs(md.llms.map((l: Record<string, unknown>) => ({
            value: l.value as string,
            label: l.label as string,
            provider: (l.provider as string) || undefined,
            latency_ms: (l.latency_ms as number) || null,
            max_tokens: (l.max_tokens as number) || null,
            context_window: (l.context_window as number) || null,
            supports_image: !!l.supports_image,
            supports_document: !!l.supports_document,
            supports_parallel_tools: !!l.supports_parallel_tools,
          })));
        }
        if (md.languages?.length) setLiveLanguages(md.languages);
        // Extract TTS model options with description, language count, supported language IDs, and capability flags
        if (md.models?.length) {
          // Store raw model data for capability lookups
          setRawTTSData(md.models);
          const ttsOpts: SelectOption[] = md.models
            .filter((mod: Record<string, unknown>) => mod.model_id && mod.name)
            .map((mod: Record<string, unknown>) => ({
              value: mod.model_id as string,
              label: mod.name as string,
              description: (mod.description as string) || undefined,
              language_count: (mod.language_count as number) || undefined,
              latency_ms: (mod.latency_ms as number) || undefined,
              supported_language_ids: (mod.supported_language_ids as string[]) || undefined,
            }));
          if (ttsOpts.length) setLiveTTSModels(ttsOpts);
        }
      }
    } catch { /* non-critical */ }
  }, [token]);

  useEffect(() => { if (token && agentId) { loadAgent(); loadExtras(); } }, [token, agentId, loadAgent, loadExtras]);

  // Load Vapi analytics when switching to analytics tab
  useEffect(() => {
    if (activeTab === 'analytics' && provider === 'vapi' && token && !analytics) {
      setAnalyticsLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      api<any>(`/agents/${agentId}/vapi/analytics`, { token })
        .then(data => setAnalytics(data))
        .catch(() => setAnalytics({ error: true }))
        .finally(() => setAnalyticsLoading(false));
    }
  }, [activeTab, provider, token, agentId, analytics]);

  // Dynamically filter/annotate TTS models based on selected language
  // Models that don't support the chosen language get marked "incompatible" and sorted to the bottom
  const filteredTTSModels = React.useMemo(() => {
    if (!language) return liveTTSModels;
    return liveTTSModels
      .map(m => {
        // ElevenLabs rule: English agents must use flash or v3_conversational (NOT multilingual)
        if (language === 'en' && m.value === 'eleven_multilingual_v2') {
          return { ...m, incompatible: true, incompatible_reason: 'Not available for English agents' };
        }
        // If model has no language data, assume it's compatible
        if (!m.supported_language_ids || m.supported_language_ids.length === 0) return m;
        const supports = m.supported_language_ids.some(lid => lid === language || lid.startsWith(language));
        if (supports) return { ...m, incompatible: false, incompatible_reason: undefined };
        return { ...m, incompatible: true, incompatible_reason: `Doesn\u2019t support this language` };
      })
      .sort((a, b) => (a.incompatible ? 1 : 0) - (b.incompatible ? 1 : 0));
  }, [liveTTSModels, language]);

  // Look up voice parameter support for the currently selected TTS model
  // V3 models do NOT support custom voice settings (stability, speed, similarity) per ElevenLabs docs
  const ttsModelCaps = React.useMemo(() => {
    const isV3 = ttsModel?.startsWith('eleven_v3') || false;
    const defaults = { supports_speed: !isV3, supports_voice_settings: !isV3, isV3 };
    if (!ttsModel || rawTTSData.length === 0) return defaults;
    const found = rawTTSData.find(m => m.model_id === ttsModel);
    if (!found) return defaults;
    return {
      supports_speed: !isV3 && !!found.supports_speed,
      supports_voice_settings: !isV3,
      isV3,
    };
  }, [ttsModel, rawTTSData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const commonFields: Record<string, unknown> = { name, first_message: firstMessage, prompt, llm, temperature };
      if (maxTokens >= 50) commonFields.max_tokens = maxTokens; // Vapi requires >= 50; skip otherwise

      const body = provider === 'gemini'
        ? {
            ...commonFields,
            gemini_voice: voiceId || config?.gemini_voice || 'Kore',
            gemini_model: llm || config?.gemini_model || 'models/gemini-3.1-flash-live-preview',
            language,
            max_duration_seconds: maxDuration,
            thinking_level: thinkingLevel,
            media_resolution: mediaResolution,
            max_context_size: maxContextSize,
            target_context_size: targetContextSize,
            grounding_google_search: groundingGoogleSearch,
            affective_dialog: affectiveDialog,
            proactive_audio: proactiveAudio,
          }
        : provider === 'vapi'
        ? {
            ...commonFields,
            model_provider: modelProvider,
            voice_id: voiceId || undefined,
            voice_provider: voiceProvider,
            ...(voiceModel ? { voice_model: voiceModel } : {}),
            ...(VAPI_VOICE_SPEED_PROVIDERS.includes(voiceProvider) ? { voice_speed: voiceSpeed } : {}),
            voice_filler_injection_enabled: fillerInjectionEnabled,
            transcriber_provider: transcriberProvider,
            transcriber_model: transcriberModel,
            max_duration_seconds: maxDuration,
            first_message_mode: firstMessageMode,
            first_message_interruptions_enabled: firstMsgInterruptionsEnabled,
            end_call_message: endCallMessage || undefined,
            end_call_phrases: endCallPhrases.length ? endCallPhrases : undefined,
            voicemail_message: voicemailMessage || undefined,
            background_sound: backgroundSound,
            emotion_recognition_enabled: emotionRecognitionEnabled,
            voice_caching_enabled: voiceCachingEnabled,
            start_speaking_wait_seconds: startSpeakingWait,
            smart_endpointing_enabled: smartEndpointing,
            stop_speaking_num_words: stopSpeakingNumWords,
            stop_speaking_voice_seconds: stopSpeakingVoiceSec,
            stop_speaking_backoff_seconds: stopSpeakingBackoff,
            hipaa_enabled: hipaaEnabled,
            recording_enabled: recordingEnabled,
            video_recording_enabled: videoRecordingEnabled,
            smart_denoising_enabled: smartDenoisingEnabled,
            monitor_listen_enabled: monitorListenEnabled,
            monitor_control_enabled: monitorControlEnabled,
            server_url: serverUrl || undefined,
            keypad_enabled: keypadEnabled,
            end_call_function_enabled: endCallFunctionEnabled,
            background_denoising_enabled: backgroundDenoisingEnabled,
            voicemail_detection: voicemailDetection,
            transcriber_language: transcriberLanguage,
            ...(transcriberKeywords.length ? { transcriber_keywords: transcriberKeywords } : {}),
            ...(transcriberEndpointing !== undefined ? { transcriber_endpointing: transcriberEndpointing } : {}),
            ...(transcriberConfidenceThreshold !== undefined ? { transcriber_confidence_threshold: transcriberConfidenceThreshold } : {}),
            transcriber_smart_format: transcriberSmartFormat,
          }
        : {
            ...commonFields,
            language, disable_first_message_interruptions: disableFirstMsgInterrupt,
            ignore_default_personality: ignoreDefaultPersonality,
            tts_model_id: ttsModel, voice_id: voiceId || undefined,
            optimize_streaming_latency: streamingLatency, agent_output_audio_format: audioFormat,
            ...(ttsModelCaps.isV3 ? {} : { stability, speed: ttsModelCaps.supports_speed ? speed : undefined, similarity_boost: similarityBoost }),
            ...(ttsModelCaps.isV3 ? { expressive_mode: expressiveMode, suggested_audio_tags: audioTags } : {}),
            turn_timeout: turnTimeout, silence_end_call_timeout: silenceEndCall, turn_eagerness: turnEagerness, max_duration_seconds: maxDuration, mode,
            asr_quality: asrQuality, asr_provider: asrProvider,
            guardrail_focus: guardrailFocus, guardrail_prompt_injection: guardrailPromptInjection,
            agent_concurrency_limit: concurrencyLimit, daily_limit: dailyLimit, enable_auth: enableAuth,
            record_voice: recordVoice, retention_days: retentionDays, delete_transcript_and_pii: deleteTranscript, zero_retention_mode: zeroRetention,
          };

      await api(`/agents/${agentId}`, { token: token!, method: 'PATCH', body });
      addToast('Agent updated successfully', 'success');
      setDirty(false);
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleCall = async () => {
    if (!callPhoneId || !callToNumber) { addToast('Select phone number and enter destination', 'error'); return; }
    setCalling(true);
    try {
      await api('/calls/outbound', { token: token!, method: 'POST', body: { agent_id: agentId, phone_number_id: callPhoneId, to_number: callToNumber, lead_name: leadName } });
      addToast('Call initiated!', 'success');
    } catch (err) { addToast(err instanceof Error ? err.message : 'Call failed', 'error'); }
    finally { setCalling(false); }
  };

  // Mark dirty on any field change
  const set = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (v: T) => { setter(v); setDirty(true); };

  if (loading) return <SkeletonRows count={6} />;
  if (!config) return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>Agent not found</div>;



  // Helper: check if a feature is visible for the current client
  const isFeatureVisible = (key: string) => {
    if (!allowedFeatures) return true; // null = no restrictions
    return allowedFeatures[key] !== false;
  };

  // Map feature keys to tab IDs for filtering — every tab is covered
  const tabFeatureMap: Record<string, string[]> = provider === 'gemini'
    ? {
        'prompt': ['prompt', 'llm', 'temperature'],
        'voice': ['voice'],
        'gemini-settings': ['call_behavior'],
      }
    : provider === 'vapi'
    ? {
        'prompt': ['prompt', 'llm', 'temperature'],
        'voice': ['voice'],
        'call-behavior': ['call_behavior'],
        'speaking': ['speaking'],
        'compliance': ['compliance', 'safety'],
        'recording': ['recording'],
        'webhooks': ['webhooks'],
        'analytics': ['analytics'],
      }
    : {
        'prompt': ['prompt', 'llm', 'temperature'],
        'voice': ['voice'],
        'call-behavior': ['call_behavior'],
        'asr': ['asr'],
        'safety': ['safety'],
        'advanced': ['advanced'],
        'privacy': ['privacy'],
      };

  const isTabVisible = (tabId: string) => {
    const features = tabFeatureMap[tabId];
    if (!features) return true; // general tab is always visible
    return features.some(f => isFeatureVisible(f));
  };

  // Count how many features are restricted
  const restrictedCount = allowedFeatures ? Object.values(allowedFeatures).filter(v => v === false).length : 0;

  const tabs = (provider === 'gemini'
    ? [
        { id: 'general', label: 'General', icon: 'settings' },
        { id: 'prompt', label: 'Prompt', icon: 'file-text' },
        { id: 'voice', label: 'Voice', icon: 'mic' },
        { id: 'gemini-settings', label: 'Gemini Settings', icon: 'sliders' },
      ]
    : provider === 'vapi'
    ? [
        { id: 'general', label: 'General', icon: 'settings' },
        { id: 'prompt', label: 'Prompt', icon: 'file-text' },
        { id: 'voice', label: 'Voice & Transcriber', icon: 'mic' },
        { id: 'call-behavior', label: 'Call Behavior', icon: 'phone-call' },
        { id: 'speaking', label: 'Speaking', icon: 'volume-2' },
        { id: 'compliance', label: 'Compliance', icon: 'shield' },
        { id: 'recording', label: 'Recording', icon: 'disc' },
        { id: 'webhooks', label: 'Webhooks', icon: 'globe' },
        { id: 'analytics', label: 'Analytics', icon: 'bar-chart-2' },
      ]
    : [
        { id: 'general', label: 'General', icon: 'settings' },
        { id: 'prompt', label: 'Prompt', icon: 'file-text' },
        { id: 'voice', label: 'Voice', icon: 'mic' },
        { id: 'call-behavior', label: 'Call Behavior', icon: 'phone-call' },
        { id: 'asr', label: 'ASR', icon: 'audio-lines' },
        { id: 'safety', label: 'Safety', icon: 'shield' },
        { id: 'advanced', label: 'Advanced', icon: 'sliders' },
        { id: 'privacy', label: 'Privacy', icon: 'lock' },
      ]
  ).filter(t => isTabVisible(t.id));

  const Toggle = ({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) => (
    <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
      <div><label className="form-label" style={{ margin: 0 }}>{label}</label>{desc && <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 2 }}>{desc}</div>}</div>
      <div className={`toggle ${value ? 'active' : ''}`} onClick={() => onChange(!value)} style={{ cursor: 'pointer', width: 40, height: 22, borderRadius: 11, background: value ? 'var(--brand-accent)' : 'var(--bg-tertiary)', position: 'relative', transition: 'background 0.2s' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: value ? 21 : 3, transition: 'left 0.2s' }} />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header bar */}
      <div className="detail-header">
        <div className="detail-back-btn" onClick={() => router.push('/dashboard/agents')}><Icon name="arrow-left" size={14} /> Back</div>
        <div className="detail-sep" />
        <div className="detail-agent-info">
          <span className="detail-agent-name">{name || config.name as string}</span>
          <span className={`provider-badge provider-${provider}`}>{provider === 'vapi' ? 'Vapi' : provider === 'gemini' ? 'Gemini' : 'ElevenLabs'}</span>
          <span className="detail-agent-id">{agentId.slice(0, 24)}...</span>
        </div>
        <div style={{ flex: 1 }} />
        {isFeatureVisible('test_call') && <SneakyButton text="Test Call" onClick={promptTestCall} />}
        <SneakyButton text={saving ? 'Saving...' : 'Save Changes'} onClick={handleSave} loading={saving} disabled={saving} />
      </div>

      {/* Restricted access banner */}
      {restrictedCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 32px', background: 'rgba(251,191,36,0.06)', borderBottom: '1px solid rgba(251,191,36,0.15)' }}>
          <Icon name="shield" size={14} style={{ color: '#fbbf24' }} />
          <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 500 }}>Some features are restricted by your administrator</span>
        </div>
      )}

      {/* Quick Call bar */}
      {isFeatureVisible('call') && <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 32px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)' }}>Lead Name</span>
          <input className="form-input" value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="e.g. John" style={{ padding: '6px 10px', fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 200 }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)' }}>Phone Number</span>
          <CustomSelect 
            value={callPhoneId} 
            onChange={e => setCallPhoneId(e.target.value)} 
            options={[
              { value: '', label: 'Select...' },
              ...phoneNumbers.filter(p => !p.assigned_agent_id || p.assigned_agent_id === agentId).map(p => ({ value: p.id, label: p.label }))
            ]} 
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)' }}>Phone Number</span>
          <input className="form-input" value={callToNumber} onChange={e => setCallToNumber(e.target.value)} placeholder="+1 234 567 8900" style={{ padding: '6px 10px', fontSize: 13 }} />
        </div>
        <SneakyButton text={calling ? 'Calling...' : 'Call Now'} onClick={handleCall} loading={calling} disabled={calling || !callPhoneId || !callToNumber} />
      </div>}

      {/* Tab strip */}
      <div className="config-tabs">
        {tabs.map(tab => (
          <div key={tab.id} className={`config-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <Icon name={tab.icon} size={14} /> {tab.label}
          </div>
        ))}
      </div>

      {/* Tab content */}
      <div className="page-body">
        <div className="config-panel">

          {activeTab === 'general' && (<>
            <div className="config-section">
              <div className="config-section-title"><Icon name="user" size={14} /> Agent Identity</div>
              <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={name} onChange={e => set(setName)(e.target.value)} /></div>
              {(provider === 'elevenlabs' || provider === 'gemini') && isFeatureVisible('language') && <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">Language</label><CustomSelect value={language} onChange={e => set(setLanguage)(e.target.value)} options={liveLanguages} /></div>}
              {isFeatureVisible('first_message') && <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">First Message</label><div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>The agent&apos;s opening greeting.</div><textarea className="form-input" value={firstMessage} onChange={e => set(setFirstMessage)(e.target.value)} rows={3} style={{ resize: 'vertical' }} /></div>}
              {provider === 'elevenlabs' && isFeatureVisible('first_message') && <Toggle value={disableFirstMsgInterrupt} onChange={set(setDisableFirstMsgInterrupt)} label="Block Interruptions" desc="Prevent users from interrupting the first message." />}
            </div>

            {/* Agent Overview Card — keeps page from looking empty */}
            <div className="config-section" style={{ marginTop: 24 }}>
              <div className="config-section-title"><Icon name="info" size={14} /> Agent Overview</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 8 }}>
                <div style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 4 }}>Provider</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={`provider-badge provider-${provider}`} style={{ fontSize: 11 }}>{provider === 'vapi' ? 'Vapi' : provider === 'gemini' ? 'Gemini' : 'ElevenLabs'}</span>
                  </div>
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 4 }}>Agent ID</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{agentId}</div>
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 4 }}>Language</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{language || 'en'}</div>
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 4 }}>AI Model</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{llm || 'gpt-4o-mini'}</div>
                </div>
              </div>
            </div>
          </>)}

          {activeTab === 'prompt' && (<>
            <div className="config-section">
              <div className="config-section-title"><Icon name="brain" size={14} /> AI Model</div>
              {isFeatureVisible('llm') && provider === 'vapi' && (
                <div className="form-group"><label className="form-label">Model Provider</label><CustomSelect value={modelProvider} onChange={e => { set(setModelProvider)(e.target.value); const models = VAPI_LLM_OPTIONS[e.target.value]; if (models?.length) set(setLlm)(models[0].value); }} options={(() => { const opts = VAPI_MODEL_PROVIDERS.map(p => ({ value: p.value, label: p.label })); if (modelProvider && !opts.find(o => o.value === modelProvider)) opts.unshift({ value: modelProvider, label: modelProvider }); return opts; })()} /></div>
              )}
              {isFeatureVisible('llm') && <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">{provider === 'gemini' ? 'Model' : 'LLM'}</label><CustomSelect value={llm} onChange={e => set(setLlm)(e.target.value)} options={(() => { const opts = provider === 'gemini' ? GEMINI_MODELS : provider === 'vapi' ? (VAPI_LLM_OPTIONS[modelProvider] || []) : liveLLMs; if ((provider === 'vapi' || provider === 'gemini') && llm && !opts.find(o => o.value === llm)) return [{ value: llm, label: llm }, ...opts]; return opts; })()} /></div>}
              {isFeatureVisible('prompt') && <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">System Prompt</label><textarea className="form-input" value={prompt} onChange={e => set(setPrompt)(e.target.value)} rows={10} style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 13 }} placeholder="You are a helpful AI assistant..." /></div>}
              {isFeatureVisible('temperature') && <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">Temperature: {temperature.toFixed(2)}</label><input type="range" className="config-slider" min="0" max={provider === 'gemini' ? '2' : '1'} step="0.01" value={temperature} onChange={e => set(setTemperature)(parseFloat(e.target.value))} />{provider === 'gemini' && <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 4 }}>Recommended: 1.0 for Gemini 3 models</div>}</div>}
              {isFeatureVisible('temperature') && provider === 'elevenlabs' && <Toggle value={ignoreDefaultPersonality} onChange={set(setIgnoreDefaultPersonality)} label="Ignore Default Personality" desc="Disables ElevenLabs default personality traits." />}
            </div>
          </>)}

          {activeTab === 'voice' && (<>
            {provider === 'vapi' ? (<>
              {/* ── Summary Cards ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Voice Card */}
                <div
                  onClick={() => setSlidePanel('voice')}
                  className="vt-card"
                  style={{ cursor: 'pointer', position: 'relative', padding: '22px 24px', background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, transparent 60%)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)', overflow: 'hidden' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(16,185,129,0.08), 0 0 0 1px rgba(16,185,129,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="mic" size={14} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-quaternary)' }}>VOICE</span>
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                      <Icon name="chevron-right" size={13} />
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{(VAPI_VOICE_PROVIDERS.find(p => p.value === voiceProvider)?.label) || voiceProvider || 'Not set'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{voiceId ? voiceId.substring(0, 22) + (voiceId.length > 22 ? '...' : '') : 'No voice selected'}</div>
                  {voiceModel && <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(16,185,129,0.8)', marginTop: 8, padding: '3px 8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: 6, display: 'inline-block' }}>{voiceModel}</div>}
                </div>

                {/* Transcriber Card */}
                <div
                  onClick={() => setSlidePanel('transcriber')}
                  className="vt-card"
                  style={{ cursor: 'pointer', position: 'relative', padding: '22px 24px', background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, transparent 60%)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)', overflow: 'hidden' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(245,158,11,0.08), 0 0 0 1px rgba(245,158,11,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="audio-lines" size={14} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-quaternary)' }}>TRANSCRIBER</span>
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                      <Icon name="chevron-right" size={13} />
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{(VAPI_TRANSCRIBER_PROVIDERS.find(p => p.value === transcriberProvider)?.label) || transcriberProvider}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{(VAPI_TRANSCRIBER_MODELS[transcriberProvider]?.find(m => m.value === transcriberModel)?.label) || transcriberModel}</div>
                  <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(245,158,11,0.8)', marginTop: 8, padding: '3px 8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.12)', borderRadius: 6, display: 'inline-block' }}>{transcriberLanguage}</div>
                </div>
              </div>

              {/* ── Voice Settings Slide Panel ── */}
              <SlidePanel open={slidePanel === 'voice'} onClose={() => setSlidePanel(null)} title="Voice Settings" subtitle="Configure the text-to-speech voice your assistant uses to speak." icon="mic" accentColor="#10b981">
                {/* Provider & Voice section */}
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div className="form-group"><label className="form-label">Provider</label><CustomSelect value={voiceProvider} onChange={e => set(setVoiceProvider)(e.target.value)} options={(() => { const opts = VAPI_VOICE_PROVIDERS.map(p => ({ value: p.value, label: p.label })); if (voiceProvider && !opts.find(o => o.value === voiceProvider)) opts.unshift({ value: voiceProvider, label: voiceProvider }); return opts; })()} /></div>

                  <div className="form-group"><label className="form-label">Voice</label><input className="form-input" value={voiceId} onChange={e => set(setVoiceId)(e.target.value)} placeholder="Enter voice ID from your provider" /><div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 6, lineHeight: 1.5 }}>The unique voice identifier from your selected provider.</div></div>
                </div>

                {/* Model & Speed section */}
                {(VAPI_VOICE_MODELS[voiceProvider] || VAPI_VOICE_SPEED_PROVIDERS.includes(voiceProvider)) && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', padding: '20px', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {VAPI_VOICE_MODELS[voiceProvider] && (
                      <div className="form-group"><label className="form-label">Voice Model</label><CustomSelect value={voiceModel} onChange={e => set(setVoiceModel)(e.target.value)} options={(() => { const opts = VAPI_VOICE_MODELS[voiceProvider] || []; if (voiceModel && !opts.find(o => o.value === voiceModel)) return [{ value: voiceModel, label: voiceModel }, ...opts]; return opts; })()} /><div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 6, lineHeight: 1.5 }}>This is the model that will be used.</div></div>
                    )}

                    {VAPI_VOICE_SPEED_PROVIDERS.includes(voiceProvider) && (
                      <div className="form-group">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label className="form-label" style={{ margin: 0 }}><Icon name="gauge" size={12} style={{ marginRight: 6, opacity: 0.5 }} />Speed</label>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981', fontFeatureSettings: '"tnum"', background: 'rgba(16,185,129,0.08)', padding: '3px 12px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)', letterSpacing: '-0.01em' }}>{voiceSpeed.toFixed(2)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 10, lineHeight: 1.5 }}>The speed of the voice output.</div>
                        <input type="range" min="0.25" max="2.0" step="0.05" value={voiceSpeed} onChange={e => set(setVoiceSpeed)(parseFloat(e.target.value))} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-quaternary)', marginTop: 8 }}><span>Slower</span><span>Faster</span></div>
                      </div>
                    )}
                  </div>
                )}

                {/* Additional Configuration */}
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Icon name="settings" size={13} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Additional Configuration</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', padding: '16px 20px' }}>
                    <Toggle value={voiceCachingEnabled} onChange={set(setVoiceCachingEnabled)} label="Voice Caching" desc="Cache voice responses for faster playback on repeated phrases." />
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '4px 0' }} />
                    <Toggle value={fillerInjectionEnabled} onChange={set(setFillerInjectionEnabled)} label="Filler Injection" desc="Add natural filler words (um, uh) during processing pauses." />
                  </div>
                </div>
              </SlidePanel>

              {/* ── Transcriber Settings Slide Panel ── */}
              <SlidePanel open={slidePanel === 'transcriber'} onClose={() => setSlidePanel(null)} title="Transcriber Settings" subtitle="Configure how speech is converted to text." icon="audio-lines" accentColor="#f59e0b">
                {/* Provider & Model section */}
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div className="form-group"><label className="form-label">Provider</label><CustomSelect value={transcriberProvider} onChange={e => { set(setTranscriberProvider)(e.target.value); const models = VAPI_TRANSCRIBER_MODELS[e.target.value]; if (models?.length) set(setTranscriberModel)(models[0].value); }} options={VAPI_TRANSCRIBER_PROVIDERS.map(p => ({ value: p.value, label: p.label }))} /></div>

                  <div className="form-group"><label className="form-label">Model</label><CustomSelect value={transcriberModel} onChange={e => set(setTranscriberModel)(e.target.value)} options={VAPI_TRANSCRIBER_MODELS[transcriberProvider] || [{ value: transcriberModel, label: transcriberModel }]} /><div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 6, lineHeight: 1.5 }}>The speech recognition model.</div></div>

                  <div className="form-group"><label className="form-label">Language</label><input className="form-input" value={transcriberLanguage} onChange={e => set(setTranscriberLanguage)(e.target.value)} placeholder="en" /><div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 6, lineHeight: 1.5 }}>BCP-47 language code (e.g. en, es, fr, de).</div></div>
                </div>

                {/* Additional Configuration */}
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Icon name="settings" size={13} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Additional Configuration</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', padding: '16px 20px' }}>
                    <Toggle value={transcriberSmartFormat} onChange={set(setTranscriberSmartFormat)} label="Smart Format" desc="Automatically format transcriptions with punctuation and casing." />
                  </div>
                </div>
              </SlidePanel>
            </>) : provider === 'gemini' ? (<>
            {/* Gemini Voice Selection */}
            <div className="config-section">
              <div className="config-section-title"><Icon name="mic" size={14} /> Gemini Voice</div>
              <div className="form-group">
                <label className="form-label">Voice</label>
                <CustomSelect value={voiceId || (config?.gemini_voice as string) || 'Kore'} onChange={e => set(setVoiceId)(e.target.value)} options={GEMINI_VOICES} />
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Max Duration (seconds)</label>
                <input className="form-input" type="number" value={maxDuration} onChange={e => set(setMaxDuration)(parseInt(e.target.value))} min={30} max={3600} />
              </div>
            </div>
            </>) : (<>
            {/* ElevenLabs Voice Selection */}
            <div className="config-section">
              <div className="config-section-title" style={{ justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="mic" size={14} /> Voice Selection <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'none', letterSpacing: 0 }}>{voices.length} voices</span></span>
                <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => loadExtras()}><Icon name="refresh-cw" size={11} /> Refresh</button>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Voice</label>
                <div className="search-bar" style={{ margin: 0, padding: '8px 12px' }}>
                  <Icon name="search" size={13} />
                  <input placeholder="Search voices..." value={voiceFilter} onChange={e => setVoiceFilter(e.target.value)} />
                </div>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {voices.filter(v => !voiceFilter || v.name.toLowerCase().includes(voiceFilter.toLowerCase()) || Object.values(v.labels || {}).some(l => l.toLowerCase().includes(voiceFilter.toLowerCase()))).map(v => {
                  const isSelected = voiceId === v.voice_id;
                  const isPreviewing = previewingId === v.voice_id;
                  const labelStr = Object.values(v.labels || {}).join(' · ');
                  return (
                    <div key={v.voice_id} className={`voice-picker-card ${isSelected ? 'selected' : ''}`} onClick={() => { set(setVoiceId)(v.voice_id); }}>
                      <div className="voice-avatar" style={{ background: `hsl(${v.name.charCodeAt(0) * 37 % 360}, 55%, 45%)`, color: '#fff', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{v.name[0]?.toUpperCase()}</div>
                      <div className="voice-info" style={{ flex: 1, minWidth: 0 }}>
                        <div className="voice-name" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{v.name}</div>
                        {labelStr && <div className="voice-labels" style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{labelStr}</div>}
                      </div>
                      <button className={`voice-preview-btn ${isPreviewing ? 'playing' : ''}`} onClick={e => { e.stopPropagation(); playVoicePreview(v.voice_id); }} title={isPreviewing ? 'Stop' : 'Preview'}>
                        <Icon name={isPreviewing ? 'square' : 'play'} size={14} />
                      </button>
                    </div>
                  );
                })}
                {voices.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-quaternary)', fontSize: 12 }}>No voices loaded</div>}
              </div>
            </div>

            {/* TTS Model */}
            <div className="config-section">
              <div className="form-group"><label className="form-label">TTS Model</label><CustomSelect value={ttsModel} onChange={e => set(setTtsModel)(e.target.value)} options={filteredTTSModels} /></div>
            </div>

            {/* Voice Parameters */}
            <div className="config-section">
              <div className="config-section-title"><Icon name="sliders" size={14} /> Voice Parameters</div>
              {ttsModelCaps.isV3 ? (
                <>
                  {/* ── Expressive Mode Toggle ── */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>✨ Expressive mode</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Context-aware emotional delivery powered by Eleven v3</div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: 42, height: 24, cursor: 'pointer' }}>
                      <input type="checkbox" checked={expressiveMode} onChange={e => set(setExpressiveMode)(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: 'absolute', inset: 0, borderRadius: 12, background: expressiveMode ? 'var(--brand-accent-primary, #6366f1)' : 'var(--bg-tertiary, #374151)', transition: 'background 0.2s' }}>
                        <span style={{ position: 'absolute', top: 2, left: expressiveMode ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                      </span>
                    </label>
                  </div>

                  {/* ── Suggested Audio Tags ── */}
                  {expressiveMode && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Suggested audio tags</span>
                          <span title="Tags guide the model&apos;s emotional delivery. Max 20 tags." style={{ cursor: 'help', fontSize: 12, color: 'var(--text-quaternary)' }}>ⓘ</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>{audioTags.length}/20</span>
                      </div>

                      {/* Selected tags (removable chips) */}
                      {audioTags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {audioTags.map((tag, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12, fontWeight: 500, background: 'rgba(99, 102, 241, 0.12)', color: 'var(--brand-accent-primary, #818cf8)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 16, cursor: 'default' }}>
                              {tag.name}
                              <span onClick={() => { const next = audioTags.filter((_, j) => j !== i); set(setAudioTags)(next); }} style={{ cursor: 'pointer', fontSize: 14, lineHeight: 1, opacity: 0.6, marginLeft: 2 }} title="Remove">×</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Preset suggestions (click to add) */}
                      {audioTags.length < 20 && (() => {
                        const presets = ['Enthusiastic','Patient','Serious','happy','warm','energetic','Empathetically','Confidently','Warmly','Excitedly','Patiently','Enthusiastically','Seriously','Chuckles','Laughing','Sighs','whispers','slow','excited','thoughtful'];
                        const available = presets.filter(p => !audioTags.some(t => t.name.toLowerCase() === p.toLowerCase()));
                        if (available.length === 0) return null;
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {available.slice(0, 14).map(p => (
                              <span key={p} onClick={() => { if (audioTags.length < 20) set(setAudioTags)([...audioTags, { name: p }]); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '4px 10px', fontSize: 12, background: 'var(--bg-tertiary, #1f2937)', color: 'var(--text-tertiary)', border: '1px solid var(--border-primary, #374151)', borderRadius: 16, cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)'; (e.target as HTMLElement).style.color = 'var(--text-primary)'; }} onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-primary, #374151)'; (e.target as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                                + {p}
                              </span>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Custom tag input */}
                      {audioTags.length < 20 && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input className="form-input" placeholder="Add custom tag…" value={customTagInput} onChange={e => setCustomTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customTagInput.trim()) { e.preventDefault(); if (!audioTags.some(t => t.name.toLowerCase() === customTagInput.trim().toLowerCase())) { set(setAudioTags)([...audioTags, { name: customTagInput.trim() }]); } setCustomTagInput(''); }}} style={{ flex: 1, fontSize: 12 }} />
                          <button type="button" onClick={() => { if (customTagInput.trim() && !audioTags.some(t => t.name.toLowerCase() === customTagInput.trim().toLowerCase())) { set(setAudioTags)([...audioTags, { name: customTagInput.trim() }]); setCustomTagInput(''); }}} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>+ Add</button>
                        </div>
                      )}

                      <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 8 }}>Learn more about Eleven v3 and suggested audio tags</div>
                    </div>
                  )}

                  {/* Voice settings notice */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'var(--bg-tertiary, #1f2937)', border: '1px solid var(--border-primary, #374151)', borderRadius: 8 }}>
                    <span style={{ fontSize: 14, marginTop: 1 }}>ℹ️</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Voice settings (Stability, Speed, Similarity) are not customizable for v3 models.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group"><label className="form-label">Stability: {stability.toFixed(2)}</label><div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Higher = more consistent, lower = more expressive</div><input type="range" className="config-slider" min="0" max="1" step="0.01" value={stability} onChange={e => set(setStability)(parseFloat(e.target.value))} /></div>
                  <div className="form-group" style={{ marginTop: 16 }}><label className="form-label">Similarity Boost: {similarityBoost.toFixed(2)}</label><input type="range" className="config-slider" min="0" max="1" step="0.01" value={similarityBoost} onChange={e => set(setSimilarityBoost)(parseFloat(e.target.value))} /></div>
                  {ttsModelCaps.supports_speed && (
                    <div className="form-group" style={{ marginTop: 16 }}><label className="form-label">Speed: {speed.toFixed(2)}</label><div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>0.7 = slow, 1.0 = normal, 1.2 = fast</div><input type="range" className="config-slider" min="0.7" max="1.2" step="0.05" value={speed} onChange={e => set(setSpeed)(parseFloat(e.target.value))} /></div>
                  )}
                  {!ttsModelCaps.supports_speed && (
                    <div className="form-group" style={{ marginTop: 16, opacity: 0.4 }}><label className="form-label">Speed</label><div style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>Not supported by this TTS model</div></div>
                  )}
                </>
              )}
            </div>

            {/* Common Voice Settings */}
            <div className="config-section" style={{ marginTop: 20 }}>
              <div className="config-section-title"><Icon name="settings" size={14} /> Common Voice Settings</div>

              <div className="form-group">
                <label className="form-label">TTS Output Format</label>
                <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Select the output format for ElevenLabs text to speech.</div>
                <CustomSelect value={audioFormat} onChange={e => set(setAudioFormat)(e.target.value)} options={[
                  { value: 'pcm_16000', label: 'PCM 16000 Hz (Recommended)' },
                  { value: 'pcm_22050', label: 'PCM 22050 Hz' },
                  { value: 'pcm_24000', label: 'PCM 24000 Hz' },
                  { value: 'pcm_44100', label: 'PCM 44100 Hz' },
                  { value: 'pcm_48000', label: 'PCM 48000 Hz' },
                  { value: 'ulaw_8000', label: 'μ-law 8000 Hz' },
                ]} />
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Optimize Streaming Latency</label>
                <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 8 }}>Latency for speech generation can be optimized at the cost of quality.</div>
                <div style={{ display: 'flex', gap: 0 }}>
                  {[0, 1, 2, 3, 4].map(v => (
                    <button key={v} type="button" onClick={() => set(setStreamingLatency)(v)} style={{
                      flex: 1, padding: '8px 0', fontSize: 13, fontWeight: streamingLatency === v ? 600 : 400,
                      background: streamingLatency === v ? 'var(--brand-accent)' : 'var(--bg-tertiary)',
                      color: streamingLatency === v ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: v === 0 ? '6px 0 0 6px' : v === 4 ? '0 6px 6px 0' : 0,
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}>{v}</button>
                  ))}
                </div>
              </div>
            </div>
            </>)}
          </>)}

          {activeTab === 'gemini-settings' && provider === 'gemini' && (<>
            {/* ── Thinking & Reasoning ── */}
            <div className="config-section">
              <div className="config-section-title"><Icon name="brain" size={14} /> Thinking & Reasoning</div>
              <div className="form-group">
                <label className="form-label">Thinking Level</label>
                <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Controls the depth of internal reasoning before responding. Higher levels improve complex tasks but add latency.</div>
                <CustomSelect value={thinkingLevel} onChange={e => set(setThinkingLevel)(e.target.value)} options={GEMINI_THINKING_LEVELS} />
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Media Resolution</label>
                <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Controls the number of tokens per image for vision processing.</div>
                <CustomSelect value={mediaResolution} onChange={e => set(setMediaResolution)(e.target.value)} options={GEMINI_MEDIA_RESOLUTIONS} />
              </div>
            </div>

            {/* ── Session Context ── */}
            <div className="config-section" style={{ marginTop: 24 }}>
              <div className="config-section-title"><Icon name="database" size={14} /> Session Context</div>
              <div className="form-group">
                <label className="form-label">Max Context Size: {maxContextSize.toLocaleString()} tokens</label>
                <input type="range" className="config-slider" min={8000} max={128000} step={1000} value={maxContextSize} onChange={e => set(setMaxContextSize)(parseInt(e.target.value))} />
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Target Context Size: {targetContextSize.toLocaleString()} tokens</label>
                <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Target size after context window compression kicks in.</div>
                <input type="range" className="config-slider" min={4000} max={maxContextSize} step={1000} value={targetContextSize} onChange={e => set(setTargetContextSize)(parseInt(e.target.value))} />
              </div>
            </div>

            {/* ── Tools & Capabilities ── */}
            <div className="config-section" style={{ marginTop: 24 }}>
              <div className="config-section-title"><Icon name="tool" size={14} /> Tools & Capabilities</div>
              <Toggle value={groundingGoogleSearch} onChange={set(setGroundingGoogleSearch)} label="Grounding with Google Search" desc="Allow the model to search the web for up-to-date information during conversations." />
              <div style={{ marginTop: 12 }}>
                <Toggle value={affectiveDialog} onChange={set(setAffectiveDialog)} label="Affective Dialog" desc="Adapts response style and tone to match the user's input expression. (v1alpha)" />
              </div>
              <div style={{ marginTop: 12 }}>
                <Toggle value={proactiveAudio} onChange={set(setProactiveAudio)} label="Proactive Audio" desc="Model proactively decides not to respond when content is not relevant. (v1alpha)" />
              </div>
            </div>
          </>)}

          {activeTab === 'call-behavior' && (<>
            <div className="config-section">
              <div className="config-section-title"><Icon name="phone-call" size={14} /> Call Behavior</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {provider === 'elevenlabs' && <div className="form-group"><label className="form-label">Turn Timeout (sec)</label><input className="form-input" type="number" value={turnTimeout} onChange={e => set(setTurnTimeout)(parseFloat(e.target.value))} min="0.5" max="10" step="0.5" /></div>}
                <div className="form-group"><label className="form-label">Silence End Call (sec)</label><input className="form-input" type="number" value={silenceEndCall} onChange={e => set(setSilenceEndCall)(parseFloat(e.target.value))} min="1" max="60" step="1" /></div>
                <div className="form-group"><label className="form-label">Max Duration (sec)</label><input className="form-input" type="number" value={maxDuration} onChange={e => set(setMaxDuration)(parseInt(e.target.value))} min="30" max="3600" /></div>
                {provider === 'elevenlabs' && <div className="form-group"><label className="form-label">Turn Eagerness</label><CustomSelect value={turnEagerness} onChange={e => set(setTurnEagerness)(e.target.value)} options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]} /></div>}
              </div>
              {provider === 'elevenlabs' && <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">Mode</label><CustomSelect value={mode} onChange={e => set(setMode)(e.target.value)} options={[{ value: 'turn', label: 'Turn-based' }, { value: 'off', label: 'Off (free-form)' }]} /></div>}

              {/* Vapi-only call behavior fields */}
              {provider === 'vapi' && (<>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">First Message Mode</label>
                  <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Controls who speaks first when the call begins.</div>
                  <CustomSelect value={firstMessageMode} onChange={e => set(setFirstMessageMode)(e.target.value)} options={VAPI_FIRST_MESSAGE_MODES} />
                </div>
                <Toggle value={firstMsgInterruptionsEnabled} onChange={set(setFirstMsgInterruptionsEnabled)} label="Allow First Message Interruptions" desc="Let the caller interrupt the assistant's first message." />

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">End Call Message</label>
                  <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Message the assistant says before hanging up.</div>
                  <input className="form-input" value={endCallMessage} onChange={e => set(setEndCallMessage)(e.target.value)} placeholder="Goodbye, have a great day!" />
                </div>

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">End Call Phrases</label>
                  <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Phrases that trigger the assistant to end the call.</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {endCallPhrases.map((p, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                        {p}
                        <span style={{ cursor: 'pointer', color: 'var(--text-quaternary)', fontSize: 14, lineHeight: 1 }} onClick={() => set(setEndCallPhrases)(endCallPhrases.filter((_, j) => j !== i))}>×</span>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="form-input" value={endCallPhraseInput} onChange={e => setEndCallPhraseInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && endCallPhraseInput.trim()) { set(setEndCallPhrases)([...endCallPhrases, endCallPhraseInput.trim()]); setEndCallPhraseInput(''); }}} placeholder="Add a phrase…" style={{ flex: 1 }} />
                    <button type="button" onClick={() => { if (endCallPhraseInput.trim()) { set(setEndCallPhrases)([...endCallPhrases, endCallPhraseInput.trim()]); setEndCallPhraseInput(''); }}} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>+ Add</button>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Voicemail Message</label>
                  <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Message left when voicemail is detected.</div>
                  <textarea className="form-textarea" rows={2} value={voicemailMessage} onChange={e => set(setVoicemailMessage)(e.target.value)} placeholder="Hi, this is your AI assistant calling…" style={{ resize: 'vertical', width: '100%' }} />
                </div>

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Background Sound</label>
                  <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Ambient noise added to make the call feel more natural.</div>
                  <CustomSelect value={backgroundSound} onChange={e => set(setBackgroundSound)(e.target.value)} options={VAPI_BACKGROUND_SOUNDS} />
                </div>

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Voicemail Detection</label>
                  <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Provider used to detect when a voicemail answers the call.</div>
                  <CustomSelect value={voicemailDetection} onChange={e => set(setVoicemailDetection)(e.target.value)} options={VAPI_VOICEMAIL_DETECTION} />
                </div>

                <Toggle value={endCallFunctionEnabled} onChange={set(setEndCallFunctionEnabled)} label="End Call Function" desc="Allow the AI to programmatically end the call." />
                <Toggle value={emotionRecognitionEnabled} onChange={set(setEmotionRecognitionEnabled)} label="Emotion Recognition" desc="Detect caller emotions and adjust responses." />
                <Toggle value={backgroundDenoisingEnabled} onChange={set(setBackgroundDenoisingEnabled)} label="Background Denoising" desc="Remove background noise from the caller's audio." />
              </>)}
            </div>
          </>)}

          {/* Speaking Plans (Vapi only) */}
          {activeTab === 'speaking' && (<>
            <div className="config-section">
              <div className="config-section-title"><Icon name="volume-2" size={14} /> Start Speaking Plan</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Controls when the assistant starts speaking after the user finishes talking.</div>
              <div className="form-group">
                <label className="form-label">Wait Seconds: {startSpeakingWait.toFixed(1)}s</label>
                <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>How long to wait after the user stops speaking before the assistant responds.</div>
                <input type="range" className="config-slider" min="0" max="2" step="0.1" value={startSpeakingWait} onChange={e => set(setStartSpeakingWait)(parseFloat(e.target.value))} />
              </div>
              <Toggle value={smartEndpointing} onChange={set(setSmartEndpointing)} label="Smart Endpointing" desc="Use AI to detect when the user has finished their thought (reduces false interruptions)." />
            </div>

            <div className="config-section" style={{ marginTop: 20 }}>
              <div className="config-section-title"><Icon name="volume-x" size={14} /> Stop Speaking Plan</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Controls when the assistant stops speaking if the user interrupts.</div>
              <div className="form-group">
                <label className="form-label">Word Count Threshold: {stopSpeakingNumWords}</label>
                <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Number of words the user must say to interrupt the assistant. 0 = any speech interrupts.</div>
                <input type="range" className="config-slider" min="0" max="10" step="1" value={stopSpeakingNumWords} onChange={e => set(setStopSpeakingNumWords)(parseInt(e.target.value))} />
              </div>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Voice Duration: {stopSpeakingVoiceSec.toFixed(1)}s</label>
                <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>Seconds of continuous speech needed to count as an interruption.</div>
                <input type="range" className="config-slider" min="0" max="2" step="0.1" value={stopSpeakingVoiceSec} onChange={e => set(setStopSpeakingVoiceSec)(parseFloat(e.target.value))} />
              </div>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Backoff Seconds: {stopSpeakingBackoff.toFixed(1)}s</label>
                <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginBottom: 4 }}>How long the assistant waits before speaking again after being interrupted.</div>
                <input type="range" className="config-slider" min="0" max="5" step="0.1" value={stopSpeakingBackoff} onChange={e => set(setStopSpeakingBackoff)(parseFloat(e.target.value))} />
              </div>
            </div>

            <div className="config-section" style={{ marginTop: 20 }}>
              <div className="config-section-title"><Icon name="keyboard" size={14} /> Keypad Input</div>
              <Toggle value={keypadEnabled} onChange={set(setKeypadEnabled)} label="Enable Keypad (DTMF)" desc="Allow callers to use keypad tones to navigate menus or enter data." />
            </div>
          </>)}

          {/* Compliance (Vapi only) */}
          {activeTab === 'compliance' && (<>
            <div className="config-section">
              <div className="config-section-title"><Icon name="shield" size={14} /> HIPAA Compliance</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Enable HIPAA mode for handling protected health information (PHI).</div>
              <Toggle value={hipaaEnabled} onChange={set(setHipaaEnabled)} label="HIPAA Mode" desc="Activates HIPAA-compliant data handling. Requires a BAA with Vapi." />
              {hipaaEnabled && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', marginTop: 12, background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: 8 }}>
                  <span style={{ fontSize: 14, marginTop: 1 }}>⚠️</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>HIPAA mode requires a Business Associate Agreement (BAA) with Vapi. Ensure you have signed one before enabling this in production.</span>
                </div>
              )}
            </div>
          </>)}

          {/* Recording (Vapi only) */}
          {activeTab === 'recording' && (<>
            <div className="config-section">
              <div className="config-section-title"><Icon name="disc" size={14} /> Call Recording</div>
              <Toggle value={recordingEnabled} onChange={set(setRecordingEnabled)} label="Enable Recording" desc="Record audio of all calls for review and training." />
              <Toggle value={videoRecordingEnabled} onChange={set(setVideoRecordingEnabled)} label="Video Recording" desc="Record video alongside audio (for video-enabled calls)." />
              <Toggle value={smartDenoisingEnabled} onChange={set(setSmartDenoisingEnabled)} label="Smart Denoising" desc="Apply AI-based noise reduction to recordings." />
            </div>

            <div className="config-section" style={{ marginTop: 20 }}>
              <div className="config-section-title"><Icon name="headphones" size={14} /> Live Monitoring</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Allow supervisors to listen in or control active calls.</div>
              <Toggle value={monitorListenEnabled} onChange={set(setMonitorListenEnabled)} label="Listen-in" desc="Supervisors can listen to live calls silently." />
              <Toggle value={monitorControlEnabled} onChange={set(setMonitorControlEnabled)} label="Control" desc="Supervisors can take over or whisper during live calls." />
            </div>
          </>)}

          {/* Webhooks / Server URL (Vapi only) */}
          {activeTab === 'webhooks' && (<>
            <div className="config-section">
              <div className="config-section-title"><Icon name="globe" size={14} /> Server URL</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Vapi sends real-time events (call started, ended, function calls, etc.) to this URL.</div>
              <div className="form-group">
                <label className="form-label">Webhook URL</label>
                <input className="form-input" value={serverUrl} onChange={e => set(setServerUrl)(e.target.value)} placeholder="https://your-server.com/vapi-webhook" />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', marginTop: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 8 }}>
                <span style={{ fontSize: 14, marginTop: 1 }}>ℹ️</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Vapi will POST events like <code style={{ fontSize: 11, padding: '1px 4px', background: 'var(--bg-quaternary)', borderRadius: 3 }}>assistant-request</code>, <code style={{ fontSize: 11, padding: '1px 4px', background: 'var(--bg-quaternary)', borderRadius: 3 }}>function-call</code>, and <code style={{ fontSize: 11, padding: '1px 4px', background: 'var(--bg-quaternary)', borderRadius: 3 }}>end-of-call-report</code> to this URL.</span>
              </div>
            </div>
          </>)}

          {activeTab === 'asr' && (<>
            <div className="config-section">
              <div className="config-section-title"><Icon name="audio-lines" size={14} /> Speech Recognition (ASR)</div>
              <div className="form-group"><label className="form-label">Quality</label><CustomSelect value={asrQuality} onChange={e => set(setAsrQuality)(e.target.value)} options={[{ value: 'high', label: 'High' }, { value: 'low', label: 'Low (faster)' }]} /></div>
              <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">Provider</label><CustomSelect value={asrProvider} onChange={e => set(setAsrProvider)(e.target.value)} options={[{ value: 'scribe_realtime', label: 'Scribe Realtime' }, { value: 'custom', label: 'Custom' }]} /></div>
            </div>
          </>)}

          {activeTab === 'safety' && (<>
            <div className="config-section">
              <div className="config-section-title"><Icon name="shield" size={14} /> Safety Guardrails</div>
              <Toggle value={guardrailFocus} onChange={set(setGuardrailFocus)} label="Focus Guard" desc="Keeps the agent on-topic and prevents derailing." />
              <Toggle value={guardrailPromptInjection} onChange={set(setGuardrailPromptInjection)} label="Prompt Injection Guard" desc="Protects against prompt injection attacks." />
            </div>
          </>)}

          {activeTab === 'advanced' && (<>
            <div className="config-section">
              <div className="config-section-title"><Icon name="sliders" size={14} /> Advanced Settings</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group"><label className="form-label">Max Tokens</label><input className="form-input" type="number" value={maxTokens} onChange={e => set(setMaxTokens)(parseInt(e.target.value))} min="-1" max="8000" /></div>
                <div className="form-group"><label className="form-label">Concurrency Limit</label><input className="form-input" type="number" value={concurrencyLimit} onChange={e => set(setConcurrencyLimit)(parseInt(e.target.value))} min="-1" max="100" /></div>
                <div className="form-group"><label className="form-label">Daily Call Limit</label><input className="form-input" type="number" value={dailyLimit} onChange={e => set(setDailyLimit)(parseInt(e.target.value))} min="1" max="1000000" /></div>
              </div>
              <Toggle value={enableAuth} onChange={set(setEnableAuth)} label="Enable Auth" desc="Require authentication for widget/API calls." />
            </div>
          </>)}

          {activeTab === 'privacy' && (<>
            <div className="config-section">
              <div className="config-section-title"><Icon name="lock" size={14} /> Privacy Settings</div>
              <Toggle value={recordVoice} onChange={set(setRecordVoice)} label="Record Voice" desc="Store audio recordings of conversations." />
              <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">Retention Days</label><input className="form-input" type="number" value={retentionDays} onChange={e => set(setRetentionDays)(parseInt(e.target.value))} min="1" max="365" /></div>
              <Toggle value={deleteTranscript} onChange={set(setDeleteTranscript)} label="Delete Transcripts & PII" desc="Auto-delete transcripts and personally identifiable info." />
              <Toggle value={zeroRetention} onChange={set(setZeroRetention)} label="Zero Retention Mode" desc="No data is stored after the call ends." />
            </div>
          </>)}

          {/* ── Vapi Analytics Tab ── */}
          {activeTab === 'analytics' && provider === 'vapi' && (
            <div className="config-section">
              <div className="config-section-title"><Icon name="bar-chart-2" size={14} /> Performance Analytics</div>
              {analyticsLoading ? (
                <SkeletonRows count={4} />
              ) : analytics?.error ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>Failed to load analytics data.</div>
              ) : analytics ? (
                <>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Total Calls', value: analytics.summary?.totalCalls ?? 0, icon: 'phone', color: 'var(--brand-accent)' },
                      { label: 'Avg Duration', value: `${(analytics.summary?.avgDuration ?? 0).toFixed(0)}s`, icon: 'clock', color: 'var(--green)' },
                      { label: 'Success Rate', value: `${(analytics.summary?.successRate ?? 0).toFixed(0)}%`, icon: 'check-circle', color: '#10b981' },
                      { label: 'Total Cost', value: `$${(analytics.summary?.totalCost ?? 0).toFixed(4)}`, icon: 'dollar-sign', color: 'var(--orange)' },
                    ].map((card, i) => (
                      <div key={i} style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '16px 14px', border: '1px solid var(--border-faint)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: `${card.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name={card.icon} size={14} style={{ color: card.color }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)' }}>{card.label}</span>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{card.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Latency Breakdown */}
                  {analytics.latency && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 10 }}>Latency Breakdown (avg / p95)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                        {[
                          { label: 'LLM', avg: analytics.latency.llm?.avg, p95: analytics.latency.llm?.p95, color: '#818cf8' },
                          { label: 'TTS', avg: analytics.latency.tts?.avg, p95: analytics.latency.tts?.p95, color: '#34d399' },
                          { label: 'ASR', avg: analytics.latency.asr?.avg, p95: analytics.latency.asr?.p95, color: '#fbbf24' },
                          { label: 'Total', avg: analytics.latency.total?.avg, p95: analytics.latency.total?.p95, color: 'var(--brand-accent)' },
                        ].map((lat, i) => {
                          const maxVal = Math.max(lat.p95 || 0, 1);
                          const avgPct = Math.min(((lat.avg || 0) / maxVal) * 100, 100);
                          return (
                            <div key={i} style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 12, border: '1px solid var(--border-faint)' }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: lat.color, marginBottom: 6 }}>{lat.label}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>avg <strong>{lat.avg ?? '—'}ms</strong></span>
                                <span style={{ color: 'var(--text-tertiary)' }}>p95 <strong>{lat.p95 ?? '—'}ms</strong></span>
                              </div>
                              <div style={{ height: 4, background: 'var(--bg-primary)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${avgPct}%`, height: '100%', background: lat.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cost Breakdown */}
                  {analytics.costBreakdown && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 10 }}>Cost Distribution</div>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 16, border: '1px solid var(--border-faint)' }}>
                        {Object.entries(analytics.costBreakdown).filter(([, v]) => typeof v === 'number' && (v as number) > 0).map(([key, val]) => {
                          const total = analytics.summary?.totalCost || 1;
                          const pct = ((val as number) / total * 100).toFixed(1);
                          const colors: Record<string, string> = { llm: '#818cf8', tts: '#34d399', stt: '#fbbf24', transport: '#f97316', vapi: '#ef4444' };
                          return (
                            <div key={key} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                <span style={{ textTransform: 'uppercase', fontSize: 10, fontWeight: 600, color: colors[key] || 'var(--text-secondary)' }}>{key}</span>
                                <span style={{ color: 'var(--text-secondary)' }}>${(val as number).toFixed(4)} ({pct}%)</span>
                              </div>
                              <div style={{ height: 4, background: 'var(--bg-primary)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: colors[key] || 'var(--brand-accent)', borderRadius: 2, transition: 'width 0.6s ease' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Config Used */}
                  {analytics.config && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-quaternary)', marginBottom: 10 }}>Agent Configuration</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                        {analytics.config.model && (
                          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 14, border: '1px solid var(--border-faint)' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#818cf8', marginBottom: 8, textTransform: 'uppercase' }}>Model</div>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{analytics.config.model.model || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>via {analytics.config.model.provider || '—'}</div>
                          </div>
                        )}
                        {analytics.config.voice && (
                          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 14, border: '1px solid var(--border-faint)' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#34d399', marginBottom: 8, textTransform: 'uppercase' }}>Voice</div>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{(analytics.config.voice.voiceId || '—').slice(0, 20)}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>via {analytics.config.voice.provider || '—'}</div>
                          </div>
                        )}
                        {analytics.config.transcriber && (
                          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 14, border: '1px solid var(--border-faint)' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#fbbf24', marginBottom: 8, textTransform: 'uppercase' }}>Transcriber</div>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{analytics.config.transcriber.model || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>via {analytics.config.transcriber.provider || '—'} • {analytics.config.transcriber.language || '—'}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Refresh button */}
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 14px' }} onClick={() => { setAnalytics(null); }}>
                      <Icon name="refresh-cw" size={11} /> Refresh Analytics
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>No analytics data available yet.</div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Dirty indicator */}
      {dirty && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <Icon name="alert-circle" size={14} style={{ color: 'var(--orange)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>You have unsaved changes</span>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ marginLeft: 8, padding: '6px 16px', fontSize: 12 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {/* Lead Name Prompt */}
      {showLeadNamePrompt && (
        <div className="modal-overlay" onClick={() => setShowLeadNamePrompt(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
            <div style={{ padding: '32px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--green), #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="phone" size={28} style={{ color: '#fff' }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Start Test Call</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Enter the lead name the AI agent will greet:</div>
              <input
                className="form-input"
                value={testLeadName}
                onChange={e => setTestLeadName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && testLeadName.trim()) handleStartTestCall(testLeadName.trim()); }}
                placeholder="e.g. John"
                autoFocus
                style={{ width: '100%', padding: '10px 14px', fontSize: 15, textAlign: 'center' }}
              />
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button
                  className="btn-primary"
                  onClick={() => setShowLeadNamePrompt(false)}
                  style={{ flex: 1, background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={() => { if (testLeadName.trim()) handleStartTestCall(testLeadName.trim()); }}
                  disabled={!testLeadName.trim()}
                  style={{ flex: 1, background: 'var(--green)', borderColor: 'var(--green)' }}
                >
                  <Icon name="phone" size={13} /> Start Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Call — full-screen overlay (provider-aware) */}
      {showTestCall && token && (
        <TestCallView
          agentId={agentId}
          agentName={name || 'Agent'}
          leadName={testLeadName || 'Test User'}
          token={token}
          provider={provider}
          onClose={() => setShowTestCall(false)}
        />
      )}
    </div>
  );
}
