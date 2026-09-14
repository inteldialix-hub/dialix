/**
 * Shared constants — dropdown options for agent configuration.
 *
 * These lists are used as FALLBACKS when the API call to
 * /api/agents/models fails. The frontend prefers live data
 * from ElevenLabs via that endpoint.
 *
 * Last updated: 2026-04-19 — aligned with ElevenLabs API.
 */

/* ─── LLM Models ─────────────────────────────────────────── */

export const FALLBACK_LLM_OPTIONS = [
  // ElevenLabs Hosted (optimized latency & cost)
  { value: 'glm-4.5-air', label: 'GLM 4.5 Air (EL Hosted)' },
  { value: 'qwen3-30b-a3b', label: 'Qwen3 30B-A3B (EL Hosted)' },
  { value: 'gpt-oss-120b', label: 'GPT-OSS 120B (EL Hosted)' },

  // OpenAI
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'gpt-5-nano', label: 'GPT-5 Nano' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },

  // Anthropic
  { value: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  { value: 'claude-3.7-sonnet', label: 'Claude 3.7 Sonnet' },
  { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },

  // Google
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
];

/* ─── TTS (Text-to-Speech) Models ────────────────────────── */

export const FALLBACK_TTS_MODEL_OPTIONS = [
  { value: 'eleven_v3_conversational', label: 'V3 Conversational', badge: 'Now GA', supportsExpressive: true },
  { value: 'eleven_flash_v2_5', label: 'Flash v2.5', badge: 'Low Latency', supportsExpressive: true },
  { value: 'eleven_flash_v2', label: 'Flash v2', badge: 'Fastest', supportsExpressive: false },
  { value: 'eleven_multilingual_v2', label: 'Multilingual v2', badge: '29 Languages', supportsExpressive: false },
  { value: 'eleven_turbo_v2', label: 'Turbo v2', badge: null, supportsExpressive: false },
];

/* ─── Languages (Flash v2.5 32-language set) ─────────────── */

export const FALLBACK_LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'pl', label: 'Polish' },
  { value: 'ru', label: 'Russian' },
  { value: 'tr', label: 'Turkish' },
  { value: 'sv', label: 'Swedish' },
  { value: 'da', label: 'Danish' },
  { value: 'no', label: 'Norwegian' },
  { value: 'fi', label: 'Finnish' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'cs', label: 'Czech' },
  { value: 'ro', label: 'Romanian' },
  { value: 'el', label: 'Greek' },
  { value: 'he', label: 'Hebrew' },
  { value: 'id', label: 'Indonesian' },
  { value: 'ms', label: 'Malay' },
  { value: 'th', label: 'Thai' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'hu', label: 'Hungarian' },
  { value: 'bg', label: 'Bulgarian' },
  { value: 'hr', label: 'Croatian' },
  { value: 'sk', label: 'Slovak' },
  { value: 'fil', label: 'Filipino' },
  { value: 'ta', label: 'Tamil' },
];

/* ─── Feature Keys (sidebar config features) ────────────── */

export const FEATURE_KEYS = [
  { key: 'first_message', label: 'First Message', icon: 'message-circle' },
  { key: 'language', label: 'Language', icon: 'globe' },
  { key: 'prompt', label: 'System Prompt', icon: 'message-square' },
  { key: 'llm', label: 'AI Model (LLM)', icon: 'brain' },
  { key: 'temperature', label: 'Temperature & Tokens', icon: 'thermometer' },
  { key: 'voice', label: 'Voice Settings', icon: 'mic' },
  { key: 'call_behavior', label: 'Call Behavior', icon: 'phone-call' },
  { key: 'asr', label: 'ASR & Detection', icon: 'ear' },
  { key: 'safety', label: 'Safety & Guardrails', icon: 'shield-check' },
  { key: 'advanced', label: 'Advanced Settings', icon: 'wrench' },
  { key: 'privacy', label: 'Privacy & Data', icon: 'lock' },
  { key: 'call', label: 'Quick Call', icon: 'phone-call' },
  { key: 'test_call', label: 'Test Call', icon: 'phone' },
  { key: 'recording', label: 'Recording', icon: 'disc' },
  { key: 'webhooks', label: 'Webhooks', icon: 'globe' },
  { key: 'analytics', label: 'Analytics', icon: 'bar-chart-2' },
  { key: 'speaking', label: 'Speaking', icon: 'volume-2' },
  { key: 'compliance', label: 'Compliance', icon: 'shield' },
] as const;

/* ─── Agent Providers ────────────────────────────────────── */

export const AGENT_PROVIDERS = [
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'vapi', label: 'Vapi' },
  { value: 'gemini', label: 'Gemini Live' },
];

/* ─── Gemini — Built-in Voices ─────────────────────────── */

export const GEMINI_VOICES = [
  { value: 'Aoede', label: 'Aoede' },
  { value: 'Charon', label: 'Charon' },
  { value: 'Fenrir', label: 'Fenrir' },
  { value: 'Kore', label: 'Kore' },
  { value: 'Puck', label: 'Puck' },
  { value: 'Leda', label: 'Leda' },
  { value: 'Orus', label: 'Orus' },
  { value: 'Zephyr', label: 'Zephyr' },
];

/* ─── Gemini — Models ──────────────────────────────────── */

export const GEMINI_MODELS = [
  { value: 'models/gemini-3.1-flash-live-preview', label: 'Gemini 3.1 Flash Live Preview' },
  { value: 'models/gemini-2.5-flash-exp-native-audio-thinking-dialog', label: 'Gemini 2.5 Flash Native Audio' },
  { value: 'models/gemini-2.0-flash-live-001', label: 'Gemini 2.0 Flash Live' },
];

/* ─── Gemini — Thinking Levels ────────────────────────────── */

export const GEMINI_THINKING_LEVELS = [
  { value: 'none', label: 'No Thinking' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/* ─── Gemini — Media Resolution ──────────────────────────── */

export const GEMINI_MEDIA_RESOLUTIONS = [
  { value: 'low', label: 'Low (64 tokens/image)' },
  { value: 'medium', label: 'Medium (258 tokens/image)' },
  { value: 'high', label: 'High (768 tokens/image)' },
];

/* ─── Vapi — Model Providers ─────────────────────────────── */

export const VAPI_MODEL_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'groq', label: 'Groq' },
  { value: 'deepinfra', label: 'DeepInfra' },
  { value: 'together-ai', label: 'Together AI' },
  { value: 'xai', label: 'xAI (Grok)' },
  { value: 'cerebras', label: 'Cerebras' },
];

export const VAPI_LLM_OPTIONS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
  google: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
  ],
  deepinfra: [
    { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct', label: 'Llama 3.1 70B' },
    { value: 'meta-llama/Meta-Llama-3.1-405B-Instruct', label: 'Llama 3.1 405B' },
  ],
  'together-ai': [
    { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B Turbo' },
    { value: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', label: 'Llama 3.1 405B Turbo' },
  ],
  xai: [
    { value: 'grok-3', label: 'Grok 3' },
    { value: 'grok-3-mini', label: 'Grok 3 Mini' },
    { value: 'grok-2', label: 'Grok 2' },
  ],
  cerebras: [
    { value: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-8b', label: 'Llama 3.1 8B' },
  ],
};

/* ─── Vapi — Voice Providers ─────────────────────────────── */

export const VAPI_VOICE_PROVIDERS = [
  { value: '11labs', label: 'ElevenLabs' },
  { value: 'cartesia', label: 'Cartesia' },
  { value: 'playht', label: 'PlayHT' },
  { value: 'deepgram', label: 'Deepgram' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure', label: 'Azure' },
  { value: 'lmnt', label: 'LMNT' },
  { value: 'rime-ai', label: 'Rime AI' },
  { value: 'neets', label: 'Neets' },
  { value: 'smallest-ai', label: 'Smallest AI' },
  { value: 'tavus', label: 'Tavus' },
  { value: 'sesame', label: 'Sesame' },
  { value: 'hume', label: 'Hume' },
];

/* ─── Vapi — Transcriber Providers ───────────────────────── */

export const VAPI_TRANSCRIBER_PROVIDERS = [
  { value: 'deepgram', label: 'Deepgram' },
  { value: 'gladia', label: 'Gladia' },
  { value: 'talkscriber', label: 'Talkscriber' },
  { value: 'assembly-ai', label: 'AssemblyAI' },
  { value: 'azure', label: 'Azure' },
  { value: 'speechmatics', label: 'Speechmatics' },
];

/* ─── Vapi — First Message Mode ─────────────────────────── */

export const VAPI_FIRST_MESSAGE_MODES = [
  { value: 'assistant-speaks-first', label: 'Assistant Speaks First' },
  { value: 'assistant-waits-for-user', label: 'Wait for User' },
  { value: 'assistant-speaks-first-with-model-generated-message', label: 'Model-Generated First Message' },
];

/* ─── Vapi — Background Sounds ──────────────────────────── */

export const VAPI_BACKGROUND_SOUNDS = [
  { value: 'off', label: 'Off' },
  { value: 'office', label: 'Office' },
  { value: 'static', label: 'Static Noise' },
  { value: 'cafe', label: 'Café' },
];

/* ─── Vapi — Voicemail Detection Providers ─────────────── */

export const VAPI_VOICEMAIL_DETECTION = [
  { value: 'off', label: 'Off' },
  { value: 'twilio', label: 'Twilio' },
  { value: 'vapi', label: 'Vapi' },
];

/* ─── Vapi — Voice Models (per provider) ─────────────────── */

export const VAPI_VOICE_MODELS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'tts-1', label: 'TTS-1' },
    { value: 'tts-1-hd', label: 'TTS-1 HD' },
  ],
  '11labs': [
    { value: 'eleven_multilingual_v2', label: 'Multilingual v2' },
    { value: 'eleven_turbo_v2', label: 'Turbo v2' },
    { value: 'eleven_turbo_v2_5', label: 'Turbo v2.5' },
    { value: 'eleven_flash_v2', label: 'Flash v2' },
    { value: 'eleven_flash_v2_5', label: 'Flash v2.5' },
  ],
  cartesia: [
    { value: 'sonic-2', label: 'Sonic 2' },
    { value: 'sonic-english', label: 'Sonic English' },
    { value: 'sonic-multilingual', label: 'Sonic Multilingual' },
  ],
  playht: [
    { value: 'Play3.0-mini', label: 'Play 3.0 Mini' },
    { value: 'PlayHT2.0', label: 'PlayHT 2.0' },
    { value: 'PlayHT2.0-turbo', label: 'PlayHT 2.0 Turbo' },
  ],
  deepgram: [
    { value: 'aura', label: 'Aura' },
  ],
  azure: [
    { value: 'default', label: 'Default' },
  ],
  lmnt: [
    { value: 'default', label: 'Default' },
  ],
  'rime-ai': [
    { value: 'mist', label: 'Mist' },
    { value: 'v1', label: 'V1' },
  ],
  neets: [
    { value: 'vits', label: 'Vits' },
    { value: 'ar-diff-50k', label: 'AR Diff' },
  ],
};

export const VAPI_VOICE_SPEED_PROVIDERS = ['openai', 'playht', 'lmnt', 'azure'];

/* ─── Vapi — Transcriber Models (per provider) ──────────── */

export const VAPI_TRANSCRIBER_MODELS: Record<string, { value: string; label: string }[]> = {
  deepgram: [
    { value: 'nova-3', label: 'Nova 3 (Latest)' },
    { value: 'nova-3-general', label: 'Nova 3 General' },
    { value: 'nova-2', label: 'Nova 2' },
    { value: 'nova-2-general', label: 'Nova 2 General' },
    { value: 'nova-2-phonecall', label: 'Nova 2 Phone Call' },
    { value: 'nova-2-meeting', label: 'Nova 2 Meeting' },
    { value: 'nova-2-conversationalai', label: 'Nova 2 Conversational AI' },
    { value: 'nova-2-medical', label: 'Nova 2 Medical' },
  ],
  gladia: [
    { value: 'default', label: 'Default' },
    { value: 'fast', label: 'Fast' },
    { value: 'accurate', label: 'Accurate' },
  ],
  talkscriber: [
    { value: 'default', label: 'Default' },
  ],
  'assembly-ai': [
    { value: 'best', label: 'Best (Universal-2)' },
    { value: 'nano', label: 'Nano (Fast)' },
    { value: 'conformer-2', label: 'Conformer-2' },
  ],
  azure: [
    { value: 'default', label: 'Default' },
  ],
  speechmatics: [
    { value: 'default', label: 'Default' },
  ],
};
