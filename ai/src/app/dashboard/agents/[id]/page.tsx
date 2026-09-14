'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/dashboard/shared/ToastProvider';
import {
  ArrowLeft, Upload, FileText, Globe, Trash2, Plus, PhoneForwarded, PhoneOff,
  Code, AlertCircle, Phone, Play, Square, Mic, AudioLines, Settings, Wrench,
  Brain, Sliders, Shield, Lock, BookOpen, Volume2, Disc, BarChart2, CheckCircle,
  Clock, DollarSign, Headphones, Keyboard, Gauge, ChevronRight, X, Zap, Info,
  User, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkeletonRows } from '@/components/dashboard/shared/SkeletonRows';
import { ConfirmModal } from '@/components/dashboard/shared/ConfirmModal';
import { api } from '@/lib/api';
import { 
  FALLBACK_LLM_OPTIONS, FALLBACK_TTS_MODEL_OPTIONS, FALLBACK_LANGUAGE_OPTIONS,
  VAPI_MODEL_PROVIDERS, VAPI_LLM_OPTIONS, VAPI_VOICE_PROVIDERS, VAPI_TRANSCRIBER_PROVIDERS,
  VAPI_FIRST_MESSAGE_MODES, VAPI_BACKGROUND_SOUNDS, VAPI_TRANSCRIBER_MODELS,
  VAPI_VOICEMAIL_DETECTION, VAPI_VOICE_MODELS, VAPI_VOICE_SPEED_PROVIDERS,
  GEMINI_VOICES, GEMINI_MODELS, GEMINI_THINKING_LEVELS, GEMINI_MEDIA_RESOLUTIONS
} from '@/lib/constants';
import TestCallView from '@/components/dashboard/TestCallView';

interface AgentConfig { [key: string]: unknown; }
interface Voice { voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string; }
interface Agent { agent_id: string; name: string; }
interface PhoneNumber { id: string; label: string; phone_number: string; assigned_agent_id?: string; }

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  const router = useRouter();
  const { token } = useAuth();
  const { addToast } = useToast();

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('configuration');
  const [dirty, setDirty] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [provider, setProvider] = useState<'elevenlabs' | 'vapi' | 'gemini'>('elevenlabs');
  const [allowedFeatures, setAllowedFeatures] = useState<Record<string, boolean> | null>(null);

  const [liveLLMs, setLiveLLMs] = useState<any[]>(FALLBACK_LLM_OPTIONS);
  const [liveTTSModels, setLiveTTSModels] = useState<any[]>(FALLBACK_TTS_MODEL_OPTIONS);
  const [liveLanguages, setLiveLanguages] = useState<any[]>(FALLBACK_LANGUAGE_OPTIONS);
  const [rawTTSData, setRawTTSData] = useState<Record<string, unknown>[]>([]);

  const [leadName, setLeadName] = useState('');
  const [callPhoneId, setCallPhoneId] = useState('');
  const [callToNumber, setCallToNumber] = useState('');
  const [calling, setCalling] = useState(false);

  const [voiceFilter, setVoiceFilter] = useState('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [showTestCall, setShowTestCall] = useState(false);
  const [showLeadNamePrompt, setShowLeadNamePrompt] = useState(false);
  const [testLeadName, setTestLeadName] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const [name, setName] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [language, setLanguage] = useState('en');
  const [disableFirstMsgInterrupt, setDisableFirstMsgInterrupt] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [llm, setLlm] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(-1);
  const [ignoreDefaultPersonality, setIgnoreDefaultPersonality] = useState(false);
  
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
  
  const [turnTimeout, setTurnTimeout] = useState(2.0);
  const [silenceEndCall, setSilenceEndCall] = useState(10.0);
  const [turnEagerness, setTurnEagerness] = useState('normal');
  const [maxDuration, setMaxDuration] = useState(300);
  const [mode, setMode] = useState('turn');
  
  const [asrQuality, setAsrQuality] = useState('high');
  const [asrProvider, setAsrProvider] = useState('scribe_realtime');
  
  const [guardrailFocus, setGuardrailFocus] = useState(false);
  const [guardrailPromptInjection, setGuardrailPromptInjection] = useState(false);
  
  const [concurrencyLimit, setConcurrencyLimit] = useState(-1);
  const [dailyLimit, setDailyLimit] = useState(100000);
  const [enableAuth, setEnableAuth] = useState(false);
  
  const [recordVoice, setRecordVoice] = useState(true);
  const [retentionDays, setRetentionDays] = useState(90);
  const [deleteTranscript, setDeleteTranscript] = useState(false);
  
  const [modelProvider, setModelProvider] = useState('openai');
  const [voiceProvider, setVoiceProvider] = useState('11labs');
  const [transcriberProvider, setTranscriberProvider] = useState('deepgram');
  const [transcriberModel, setTranscriberModel] = useState('nova-2');
  const [zeroRetention, setZeroRetention] = useState(false);
  
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
  
  const [thinkingLevel, setThinkingLevel] = useState('none');
  const [mediaResolution, setMediaResolution] = useState('medium');
  const [maxContextSize, setMaxContextSize] = useState(128000);
  const [targetContextSize, setTargetContextSize] = useState(64000);
  const [groundingGoogleSearch, setGroundingGoogleSearch] = useState(false);
  const [affectiveDialog, setAffectiveDialog] = useState(false);
  const [proactiveAudio, setProactiveAudio] = useState(false);
  
  const [syncing, setSyncing] = useState(false);
  
  interface KnowledgeDoc {
    id: number; file_name: string; file_type: string; file_size: number; url?: string; status: string; created_at: string;
  }
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [knowledgeUrl, setKnowledgeUrl] = useState('');
  const [knowledgeUrlName, setKnowledgeUrlName] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  
  interface AgentToolItem {
    id: number; tool_name: string; tool_type: string; description: string; parameters: Record<string, unknown>; endpoint_url: string; is_enabled: boolean; created_at: string;
  }
  const [toolsList, setToolsList] = useState<AgentToolItem[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [newToolName, setNewToolName] = useState('');
  const [newToolType, setNewToolType] = useState<'transfer_call' | 'end_call' | 'webhook'>('webhook');
  const [newToolDesc, setNewToolDesc] = useState('');
  const [newToolUrl, setNewToolUrl] = useState('');
  const [transferTargetPhone, setTransferTargetPhone] = useState('');
  const [savingTool, setSavingTool] = useState(false);

  const loadAgent = useCallback(async () => {
    try {
      const data = await api<{ config: AgentConfig; allowed_features?: Record<string, boolean> | null }>(`/agents/${agentId}`, { token: token! });
      const a = data.config;
      setConfig(a);
      setAllowedFeatures(data.allowed_features || null);
      setProvider((a.provider as 'elevenlabs' | 'vapi' | 'gemini') || 'elevenlabs');
      setName((a.name as string) || '');
      setFirstMessage((a.first_message as string) || '');
      
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

  const handleSyncWithProvider = async () => {
    if (!token || !agentId) return;
    setSyncing(true);
    try {
      const res = await api<{ success: boolean; config: any; agent: any; synced_at: string }>(`/agents/${agentId}/sync`, {
        method: 'POST',
        token,
      });
      const fresh = res?.config || res?.agent;
      if (fresh) {
        setConfig(fresh);
        if (fresh.name) setName(fresh.name);
        if (fresh.first_message !== undefined) setFirstMessage(fresh.first_message);
        if (fresh.language !== undefined) setLanguage(fresh.language);
        if (fresh.prompt !== undefined) setPrompt(fresh.prompt);
        if (fresh.llm !== undefined) setLlm(fresh.llm);
        if (fresh.temperature !== undefined) setTemperature(fresh.temperature);
        if (fresh.voice_id !== undefined) setVoiceId(fresh.voice_id);
        addToast('Agent in lockstep: fresh configuration synced from provider!', 'success');
        setDirty(false);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to sync with provider', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const loadKnowledgeDocs = useCallback(async () => {
    if (!token || !agentId) return;
    setLoadingKnowledge(true);
    try {
      const res = await api<{ documents: KnowledgeDoc[] }>(`/agents/${agentId}/knowledge`, { token });
      setKnowledgeDocs(res.documents || []);
    } catch {
      // non-critical
    } finally {
      setLoadingKnowledge(false);
    }
  }, [token, agentId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      addToast('File exceeds 10MB limit', 'error');
      return;
    }

    setUploadingDoc(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Content = (reader.result as string).split(',')[1];
          const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
          await api(`/agents/${agentId}/knowledge/upload`, {
            method: 'POST',
            token: token!,
            body: {
              file_name: file.name,
              file_type: ext,
              file_content_base64: base64Content,
              file_size: file.size,
            },
          });
          addToast(`Document "${file.name}" added to knowledge base!`, 'success');
          loadKnowledgeDocs();
        } catch (err) {
          addToast(err instanceof Error ? err.message : 'Upload failed', 'error');
        } finally {
          setUploadingDoc(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingDoc(false);
      addToast(err instanceof Error ? err.message : 'Failed to read file', 'error');
    }
  };

  const handleAddKnowledgeUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!knowledgeUrl.trim()) return;
    setAddingUrl(true);
    try {
      await api(`/agents/${agentId}/knowledge/url`, {
        method: 'POST',
        token: token!,
        body: {
          url: knowledgeUrl.trim(),
          name: knowledgeUrlName.trim() || knowledgeUrl.trim(),
        },
      });
      addToast('Website URL added to knowledge base!', 'success');
      setKnowledgeUrl('');
      setKnowledgeUrlName('');
      loadKnowledgeDocs();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to add URL', 'error');
    } finally {
      setAddingUrl(false);
    }
  };

  const handleDeleteKnowledgeDoc = (id: number) => {
    setConfirmAction({
      title: 'Remove Knowledge Document',
      message: 'Are you sure you want to remove this document from the agent knowledge base?',
      confirmLabel: 'Remove Document',
      danger: true,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await api(`/agents/${agentId}/knowledge/${id}`, {
            method: 'DELETE',
            token: token!,
          });
          addToast('Document removed', 'success');
          loadKnowledgeDocs();
        } catch (err) {
          addToast(err instanceof Error ? err.message : 'Failed to remove document', 'error');
        }
      }
    });
  };

  const loadToolsList = useCallback(async () => {
    if (!token || !agentId) return;
    setLoadingTools(true);
    try {
      const res = await api<{ tools: AgentToolItem[] }>(`/agents/${agentId}/tools`, { token });
      setToolsList(res.tools || []);
    } catch {
      // non-critical
    } finally {
      setLoadingTools(false);
    }
  }, [token, agentId]);

  const handleAddTool = async (typeOverride?: 'transfer_call' | 'end_call' | 'webhook') => {
    const selectedType = typeOverride || newToolType;
    let toolName = newToolName.trim();
    let desc = newToolDesc.trim();
    let endpointUrl = newToolUrl.trim();

    if (selectedType === 'transfer_call') {
      toolName = toolName || 'transfer_to_supervisor';
      desc = desc || `Transfer the caller to phone number: ${transferTargetPhone || '+1234567890'}`;
      endpointUrl = transferTargetPhone;
    } else if (selectedType === 'end_call') {
      toolName = toolName || 'end_call';
      desc = desc || 'Politely conclude and hang up the phone call';
    }

    if (!toolName) {
      addToast('Tool name is required', 'error');
      return;
    }

    setSavingTool(true);
    try {
      await api(`/agents/${agentId}/tools`, {
        method: 'POST',
        token: token!,
        body: {
          tool_name: toolName,
          tool_type: selectedType,
          description: desc,
          endpoint_url: endpointUrl,
        },
      });
      addToast(`Tool "${toolName}" added to agent!`, 'success');
      setNewToolName('');
      setNewToolDesc('');
      setNewToolUrl('');
      setTransferTargetPhone('');
      loadToolsList();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to add tool', 'error');
    } finally {
      setSavingTool(false);
    }
  };

  const handleDeleteTool = (id: number) => {
    setConfirmAction({
      title: 'Remove Tool from Agent',
      message: 'Are you sure you want to remove this tool from the agent configuration?',
      confirmLabel: 'Remove Tool',
      danger: true,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await api(`/agents/${agentId}/tools/${id}`, {
            method: 'DELETE',
            token: token!,
          });
          addToast('Tool removed', 'success');
          loadToolsList();
        } catch (err) {
          addToast(err instanceof Error ? err.message : 'Failed to remove tool', 'error');
        }
      }
    });
  };

  const handleToggleTool = async (id: number) => {
    try {
      await api(`/agents/${agentId}/tools/${id}/toggle`, {
        method: 'PATCH',
        token: token!,
      });
      loadToolsList();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to toggle tool', 'error');
    }
  };

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
      const [v, p, m] = await Promise.allSettled([
        api<{ voices: Voice[] }>('/agents/voices', { token: token! }),
        api<{ phoneNumbers: PhoneNumber[] }>('/phone-numbers', { token: token! }),
        api<{ models: any[]; languages: any[]; llms: any[] }>('/agents/models', { token: token! }),
      ]);
      if (v.status === 'fulfilled') setVoices(v.value.voices || []);
      if (p.status === 'fulfilled') setPhoneNumbers(p.value.phoneNumbers || []);
      if (m.status === 'fulfilled') {
        const md = m.value;
        if (md.llms?.length) {
          setLiveLLMs(md.llms.map((l: any) => ({
            value: l.value as string,
            label: l.label as string,
          })));
        }
        if (md.languages?.length) setLiveLanguages(md.languages);
        if (md.models?.length) {
          setRawTTSData(md.models);
          const ttsOpts = md.models
            .filter((mod: any) => mod.model_id && mod.name)
            .map((mod: any) => ({
              value: mod.model_id as string,
              label: mod.name as string,
            }));
          if (ttsOpts.length) setLiveTTSModels(ttsOpts);
        }
      }
    } catch { /* non-critical */ }
  }, [token]);

  useEffect(() => { if (token && agentId) { loadAgent(); loadExtras(); } }, [token, agentId, loadAgent, loadExtras]);

  useEffect(() => {
    if (activeTab === 'analytics' && provider === 'vapi' && token && !analytics) {
      setAnalyticsLoading(true);
      api<any>(`/agents/${agentId}/vapi/analytics`, { token })
        .then(data => setAnalytics(data))
        .catch(() => setAnalytics({ error: true }))
        .finally(() => setAnalyticsLoading(false));
    }
  }, [activeTab, provider, token, agentId, analytics]);

  useEffect(() => {
    if (activeTab === 'knowledge') {
      loadKnowledgeDocs();
    } else if (activeTab === 'tools') {
      loadToolsList();
    }
  }, [activeTab, loadKnowledgeDocs, loadToolsList]);

  const filteredTTSModels = React.useMemo(() => {
    return liveTTSModels;
  }, [liveTTSModels]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const commonFields: Record<string, unknown> = { name, first_message: firstMessage, prompt, llm, temperature };
      if (maxTokens >= 50) commonFields.max_tokens = maxTokens;

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
            stability, similarity_boost: similarityBoost,
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

  const set = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (v: T) => { setter(v); setDirty(true); };

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-6"><SkeletonRows count={6} /></div>;
  if (!config) return <div className="max-w-7xl mx-auto px-6 py-6 text-muted-foreground">Agent not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <button 
        onClick={() => router.push('/dashboard/agents')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to agents
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{name || config.name as string}</h1>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              provider === 'vapi' ? "bg-blue-500/10 text-blue-400" :
              provider === 'gemini' ? "bg-emerald-500/10 text-emerald-400" :
              "bg-blue-500/10 text-blue-400"
            )}>
              {provider === 'vapi' ? 'Vapi' : provider === 'gemini' ? 'Gemini' : 'ElevenLabs'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">ID: {agentId}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncWithProvider}
            disabled={syncing}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm transition-colors"
          >
            <Zap className={cn("size-4", syncing && "animate-spin")} />
            {syncing ? 'Syncing...' : 'Sync Config'}
          </button>
          <button
            onClick={promptTestCall}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            Test Call
          </button>
        </div>
      </div>

      <div className="border-b border-border mt-6">
        <nav className="flex gap-6 overflow-x-auto pb-[2px]">
          {['Configuration', 'Voice', 'Knowledge', 'Tools', 'Analytics'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 -mb-[2px] transition-colors whitespace-nowrap",
                activeTab === tab.toLowerCase()
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6 pb-24">
        {activeTab === 'configuration' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><User className="size-4" /> General settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Name</label>
                  <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" value={name} onChange={e => set(setName)(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Language</label>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" value={language} onChange={e => set(setLanguage)(e.target.value)}>
                    {liveLanguages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground mb-1.5 block">First message</label>
                  <textarea className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] resize-y" value={firstMessage} onChange={e => set(setFirstMessage)(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground mb-1.5 block">System prompt</label>
                  <textarea className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono min-h-[160px] resize-y" value={prompt} onChange={e => set(setPrompt)(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Brain className="size-4" /> AI Model</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {provider === 'vapi' && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Model provider</label>
                    <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={modelProvider} onChange={e => { set(setModelProvider)(e.target.value); const models = VAPI_LLM_OPTIONS[e.target.value]; if (models?.length) set(setLlm)(models[0].value); }}>
                      {VAPI_MODEL_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Model</label>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={llm} onChange={e => set(setLlm)(e.target.value)}>
                    {(provider === 'gemini' ? GEMINI_MODELS : provider === 'vapi' ? (VAPI_LLM_OPTIONS[modelProvider] || []) : liveLLMs).map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Temperature: {temperature.toFixed(2)}</label>
                  <input type="range" className="w-full accent-primary" min="0" max={provider === 'gemini' ? "2" : "1"} step="0.01" value={temperature} onChange={e => set(setTemperature)(parseFloat(e.target.value))} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Mic className="size-4" /> Voice</h3>
              
              {provider !== 'vapi' && provider !== 'gemini' && (
                <div className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2 max-h-[300px] overflow-y-auto">
                    {voices.map(v => (
                      <div key={v.voice_id} 
                        onClick={() => set(setVoiceId)(v.voice_id)}
                        className={cn("p-4 rounded-lg border cursor-pointer transition-all flex flex-col gap-2", voiceId === v.voice_id ? "border-primary bg-primary/5" : "border-border bg-background hover:border-muted-foreground/50")}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{v.name}</span>
                          <button 
                            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
                            onClick={e => { e.stopPropagation(); playVoicePreview(v.voice_id); }}
                          >
                            {previewingId === v.voice_id ? <Square className="size-4" /> : <Play className="size-4" />}
                          </button>
                        </div>
                        {v.labels && <div className="text-xs text-muted-foreground truncate">{Object.values(v.labels).join(' • ')}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {provider === 'vapi' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Voice provider</label>
                    <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={voiceProvider} onChange={e => set(setVoiceProvider)(e.target.value)}>
                      {VAPI_VOICE_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Voice ID</label>
                    <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" value={voiceId} onChange={e => set(setVoiceId)(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="space-y-6">
            {/* TTS Model selector */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Volume2 className="size-4" /> TTS Model</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Model</label>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" value={ttsModel} onChange={e => set(setTtsModel)(e.target.value)}>
                    {liveTTSModels.map((m: any) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Audio format</label>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" value={audioFormat} onChange={e => set(setAudioFormat)(e.target.value)}>
                    <option value="pcm_16000">PCM 16kHz</option>
                    <option value="pcm_22050">PCM 22.05kHz</option>
                    <option value="pcm_24000">PCM 24kHz</option>
                    <option value="pcm_44100">PCM 44.1kHz</option>
                    <option value="ulaw_8000">uLaw 8kHz</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Voice selection */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Mic className="size-4" /> Voice selection</h3>

              {provider !== 'vapi' && provider !== 'gemini' && (
                <div>
                  <div className="mb-4">
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Search voices..."
                      value={voiceFilter}
                      onChange={e => setVoiceFilter(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                    {voices
                      .filter(v => !voiceFilter || v.name.toLowerCase().includes(voiceFilter.toLowerCase()) || (v.labels && Object.values(v.labels).some(l => l.toLowerCase().includes(voiceFilter.toLowerCase()))))
                      .map(v => (
                      <div key={v.voice_id}
                        onClick={() => set(setVoiceId)(v.voice_id)}
                        className={cn("p-4 rounded-lg border cursor-pointer transition-all flex flex-col gap-2", voiceId === v.voice_id ? "border-foreground bg-foreground/5" : "border-border bg-background hover:border-muted-foreground/50")}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{v.name}</span>
                          <button
                            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
                            onClick={e => { e.stopPropagation(); playVoicePreview(v.voice_id); }}
                          >
                            {previewingId === v.voice_id ? <Square className="size-4" /> : <Play className="size-4" />}
                          </button>
                        </div>
                        {v.labels && <div className="text-xs text-muted-foreground truncate">{Object.values(v.labels).join(' \u2022 ')}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {provider === 'vapi' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Voice provider</label>
                    <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={voiceProvider} onChange={e => set(setVoiceProvider)(e.target.value)}>
                      {VAPI_VOICE_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Voice ID</label>
                    <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" value={voiceId} onChange={e => set(setVoiceId)(e.target.value)} />
                  </div>
                </div>
              )}

              {provider === 'gemini' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Voice</label>
                    <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={voiceId} onChange={e => set(setVoiceId)(e.target.value)}>
                      {GEMINI_VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Voice tuning */}
            {provider !== 'vapi' && provider !== 'gemini' && (
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Sliders className="size-4" /> Voice tuning</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Stability: {stability.toFixed(2)}</label>
                    <input type="range" className="w-full accent-foreground" min="0" max="1" step="0.01" value={stability} onChange={e => set(setStability)(parseFloat(e.target.value))} />
                    <p className="text-xs text-muted-foreground mt-1">Lower = more expressive, higher = more consistent</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Speed: {speed.toFixed(2)}x</label>
                    <input type="range" className="w-full accent-foreground" min="0.5" max="2" step="0.05" value={speed} onChange={e => set(setSpeed)(parseFloat(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Similarity boost: {similarityBoost.toFixed(2)}</label>
                    <input type="range" className="w-full accent-foreground" min="0" max="1" step="0.01" value={similarityBoost} onChange={e => set(setSimilarityBoost)(parseFloat(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Streaming latency: {streamingLatency}</label>
                    <input type="range" className="w-full accent-foreground" min="0" max="4" step="1" value={streamingLatency} onChange={e => set(setStreamingLatency)(parseInt(e.target.value))} />
                    <p className="text-xs text-muted-foreground mt-1">0 = lowest latency, 4 = best quality</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><BookOpen className="size-4" /> Add Knowledge</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors relative">
                  <Upload className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium mb-1">{uploadingDoc ? 'Uploading...' : 'Upload Document'}</p>
                  <p className="text-xs text-muted-foreground">PDF, TXT, DOCX, MD (Max 10MB)</p>
                  <input type="file" accept=".pdf,.txt,.docx,.md" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={uploadingDoc} />
                </div>
                
                <form onSubmit={handleAddKnowledgeUrl} className="border border-border rounded-lg p-6 bg-background flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2"><Globe className="size-4" /> Sync Website</h4>
                    <input className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm mb-3" placeholder="https://example.com" value={knowledgeUrl} onChange={e => setKnowledgeUrl(e.target.value)} required />
                    <input className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" placeholder="Title (optional)" value={knowledgeUrlName} onChange={e => setKnowledgeUrlName(e.target.value)} />
                  </div>
                  <button type="submit" disabled={addingUrl || !knowledgeUrl.trim()} className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors">
                    {addingUrl ? 'Syncing...' : 'Add URL'}
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium flex items-center gap-2"><Layers className="size-4" /> Active Documents ({knowledgeDocs.length})</h3>
              </div>
              
              {knowledgeDocs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                  <FileText className="size-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No knowledge documents connected</p>
                </div>
              ) : (
                <div className="divide-y divide-border border border-border rounded-lg">
                  {knowledgeDocs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-background first:rounded-t-lg last:rounded-b-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent rounded-md">
                          {doc.url ? <Globe className="size-4 text-emerald-400" /> : <FileText className="size-4 text-blue-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {doc.file_type.toUpperCase()} • {doc.file_size ? `${(doc.file_size/1024).toFixed(1)} KB • ` : ''}{new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="bg-emerald-500/10 text-emerald-400 rounded-full px-2 py-0.5 text-xs font-medium">Active</span>
                        <button onClick={() => handleDeleteKnowledgeDoc(doc.id)} className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Wrench className="size-4" /> Built-in actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border rounded-lg p-5 bg-background flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-2"><PhoneForwarded className="size-4 text-blue-400" /> Live Call Transfer</h4>
                    <p className="text-xs text-muted-foreground mb-4">Transfer the caller to a human team member or supervisor.</p>
                    <input className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm mb-4" placeholder="Supervisor phone (+1234567890)" value={transferTargetPhone} onChange={e => setTransferTargetPhone(e.target.value)} />
                  </div>
                  <button onClick={() => handleAddTool('transfer_call')} className="w-full text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md py-2 transition-colors">Add Call Transfer Tool</button>
                </div>
                <div className="border border-border rounded-lg p-5 bg-background flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-2"><PhoneOff className="size-4 text-red-400" /> End Call</h4>
                    <p className="text-xs text-muted-foreground mb-4">Allows the AI to hang up the call after satisfying the user.</p>
                  </div>
                  <button onClick={() => handleAddTool('end_call')} className="w-full text-sm font-medium border border-border hover:bg-accent rounded-md py-2 transition-colors">Add End Call Tool</button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Code className="size-4" /> Custom Webhook</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Function name</label>
                  <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="check_order_status" value={newToolName} onChange={e => setNewToolName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Endpoint URL</label>
                  <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="https://api.example.com/tool" value={newToolUrl} onChange={e => setNewToolUrl(e.target.value)} />
                </div>
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium text-foreground mb-1.5 block">Description</label>
                <textarea className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[80px]" placeholder="Explain when the AI should use this tool..." value={newToolDesc} onChange={e => setNewToolDesc(e.target.value)} />
              </div>
              <button onClick={() => handleAddTool('webhook')} disabled={!newToolName || !newToolUrl || savingTool} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors">Register Webhook Tool</button>
            </div>
            
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-4">Active Configured Tools ({toolsList.length})</h3>
              {toolsList.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                  <Wrench className="size-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No tools configured</p>
                </div>
              ) : (
                <div className="divide-y divide-border border border-border rounded-lg">
                  {toolsList.map(t => (
                    <div key={t.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-background first:rounded-t-lg last:rounded-b-lg gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-medium">{t.tool_name}</span>
                          <span className="bg-accent text-foreground text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm">{t.tool_type}</span>
                          {!t.is_enabled && <span className="bg-red-500/10 text-red-400 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm">Disabled</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                        {t.endpoint_url && <p className="text-xs font-mono text-muted-foreground mt-1 truncate max-w-md">{t.endpoint_url}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggleTool(t.id)} className="text-xs border border-border hover:bg-accent rounded-md px-3 py-1.5 transition-colors">{t.is_enabled ? 'Disable' : 'Enable'}</button>
                        <button onClick={() => handleDeleteTool(t.id)} className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"><Trash2 className="size-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-4">Analytics</h3>
              <p className="text-sm text-muted-foreground">Analytics data view would be displayed here.</p>
            </div>
          </div>
        )}
      </div>

      {dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4 shadow-xl z-50">
          <AlertCircle className="size-4 text-orange-400" />
          <span className="text-sm font-medium">You have unsaved changes</span>
          <button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ml-2">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {showLeadNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <Phone className="size-6 text-emerald-500" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Start test call</h2>
            <p className="text-sm text-muted-foreground mb-4">Enter the lead name the AI agent will greet:</p>
            <input 
              autoFocus
              className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm text-center mb-6 focus:outline-none focus:ring-1 focus:ring-ring"
              value={testLeadName}
              onChange={e => setTestLeadName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && testLeadName.trim() && handleStartTestCall(testLeadName.trim())}
              placeholder="e.g. John"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowLeadNamePrompt(false)} className="flex-1 text-sm font-medium border border-border hover:bg-accent rounded-md py-2 transition-colors">Cancel</button>
              <button onClick={() => testLeadName.trim() && handleStartTestCall(testLeadName.trim())} disabled={!testLeadName.trim()} className="flex-1 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-md py-2 transition-colors flex items-center justify-center gap-2">
                <Phone className="size-4" /> Start Call
              </button>
            </div>
          </div>
        </div>
      )}

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

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
          danger={confirmAction.danger ?? true}
        />
      )}
    </div>
  );
}
