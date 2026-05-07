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
  { value: 'eleven_v3_conversational', label: 'V3 Conversational' },
  { value: 'eleven_flash_v2', label: 'Flash (Fastest)' },
  { value: 'eleven_turbo_v2', label: 'Turbo' },
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
  { key: 'asr', label: 'ASR & Detection', icon: 'ear' },
  { key: 'safety', label: 'Safety & Guardrails', icon: 'shield-check' },
  { key: 'advanced', label: 'Advanced Settings', icon: 'wrench' },
  { key: 'call', label: 'Quick Call', icon: 'phone-call' },
] as const;

/* ─── Agent Providers ────────────────────────────────────── */

export const AGENT_PROVIDERS = [
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'vapi', label: 'Vapi' },
];

/* ─── Vapi — Model Providers ─────────────────────────────── */

export const VAPI_MODEL_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'groq', label: 'Groq' },
  { value: 'deepinfra', label: 'DeepInfra' },
  { value: 'together-ai', label: 'Together AI' },
];

export const VAPI_LLM_OPTIONS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
  google: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
  groq: [
    { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
  ],
  'deepinfra': [
    { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct', label: 'Llama 3.1 70B' },
  ],
  'together-ai': [
    { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B Turbo' },
  ],
};

/* ─── Vapi — Voice Providers ─────────────────────────────── */

export const VAPI_VOICE_PROVIDERS = [
  { value: '11labs', label: 'ElevenLabs' },
  { value: 'playht', label: 'PlayHT' },
  { value: 'deepgram', label: 'Deepgram' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure', label: 'Azure' },
  { value: 'cartesia', label: 'Cartesia' },
];

/* ─── Vapi — Transcriber Providers ───────────────────────── */

export const VAPI_TRANSCRIBER_PROVIDERS = [
  { value: 'deepgram', label: 'Deepgram' },
  { value: 'gladia', label: 'Gladia' },
  { value: 'talkscriber', label: 'Talkscriber' },
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
];

/* ─── Vapi — Transcriber Models (per provider) ──────────── */

export const VAPI_TRANSCRIBER_MODELS: Record<string, { value: string; label: string }[]> = {
  deepgram: [
    { value: 'nova-2', label: 'Nova 2 (Recommended)' },
    { value: 'nova-2-general', label: 'Nova 2 General' },
    { value: 'nova-2-phonecall', label: 'Nova 2 Phone Call' },
    { value: 'nova-2-meeting', label: 'Nova 2 Meeting' },
    { value: 'nova-2-conversationalai', label: 'Nova 2 Conversational AI' },
    { value: 'nova-3', label: 'Nova 3' },
  ],
  gladia: [
    { value: 'default', label: 'Default' },
  ],
  talkscriber: [
    { value: 'default', label: 'Default' },
  ],
};
