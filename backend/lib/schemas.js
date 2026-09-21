const { z } = require('zod');

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).*$/;
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

const registerSchema = z.object({
  name: z.string().trim().min(2, { message: 'Name must be at least 2 characters' }).max(100, { message: 'Name must be at most 100 characters' }),
  email: z.string().trim().email({ message: 'Invalid email address' }),
  password: z.string().min(12, { message: 'Password must be at least 12 characters' }).max(128).regex(passwordRegex, { message: 'Password must include uppercase, lowercase, number, and symbol' }),
  company: z.string().trim().max(100).optional(),
  invite_token: z.string().trim().optional(),
  invite: z.string().trim().optional(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, { message: 'Current password is required' }),
  new_password: z.string().min(12, { message: 'New password must be at least 12 characters' }).max(128).regex(passwordRegex, { message: 'New password must include uppercase, lowercase, number, and symbol' }),
});

const twilioPhoneNumberSchema = z.object({
  label: z.string().trim().min(1, { message: 'Label is required' }).max(100, { message: 'Label is too long' }),
  phone_number: z.string().trim().min(6, { message: 'Phone number is required' }).max(32, { message: 'Phone number is too long' }),
  account_sid: z.string().trim().min(1, { message: 'Account SID is required' }),
  auth_token: z.string().trim().min(1, { message: 'Auth token is required' }),
  phone_number_sid: z.string().trim().optional(),
});

const sipPhoneNumberSchema = z.object({
  label: z.string().trim().min(1, { message: 'Label is required' }).max(100, { message: 'Label is too long' }),
  phone_number: z.string().trim().min(6, { message: 'Phone number is required' }).max(32, { message: 'Phone number is too long' }),
  termination_uri: z.string().trim().min(1, { message: 'Termination URI is required' }),
  username: z.string().trim().max(100).optional(),
  password: z.string().trim().max(128).optional(),
  transport: z.enum(['tls', 'udp', 'tcp']).optional(),
});

const phoneNumberAssignSchema = z.object({
  agent_id: z.string().trim().min(1, { message: 'agent_id is required' }),
});

const callOutboundSchema = z.object({
  agent_id: z.string().trim().min(1, { message: 'agent_id is required' }),
  phone_number_id: z.string().trim().min(1, { message: 'phone_number_id is required' }),
  to_number: z.string().trim().regex(E164_REGEX, { message: 'to_number must be in E.164 format' }),
  lead_name: z.string().trim().max(100).optional(),
  dynamic_variables: z.record(z.string()).optional(),
});

const addSharedVoiceSchema = z.object({
  public_owner_id: z.string().trim().min(1, { message: 'public_owner_id is required' }),
  voice_id: z.string().trim().min(1, { message: 'voice_id is required' }),
  name: z.string().trim().min(1, { message: 'name is required' }).max(100, { message: 'Name is too long' }),
});

const adminCreateClientSchema = z.object({
  name: z.string().trim().min(2, { message: 'Name must be at least 2 characters' }).max(100, { message: 'Name must be at most 100 characters' }),
  email: z.string().trim().email({ message: 'Invalid email address' }),
  password: z.string().min(12, { message: 'Password must be at least 12 characters' }).max(128).regex(passwordRegex, { message: 'Password must include uppercase, lowercase, number, and symbol' }),
});

const adminUpdateClientSchema = z.object({
  name: z.string().trim().min(2, { message: 'Name must be at least 2 characters' }).max(100, { message: 'Name must be at most 100 characters' }).optional(),
  email: z.string().trim().email({ message: 'Invalid email address' }).optional(),
  password: z.string().min(12, { message: 'Password must be at least 12 characters' }).max(128).regex(passwordRegex, { message: 'Password must include uppercase, lowercase, number, and symbol' }).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided to update',
});

const adminAssignAgentSchema = z.object({
  agent_id: z.string().trim().min(1, { message: 'agent_id is required' }),
  agent_name: z.string().trim().min(1, { message: 'agent_name is required' }).max(100, { message: 'agent_name is too long' }),
  can_edit: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  provider: z.enum(['elevenlabs', 'vapi', 'gemini']).optional(),
});

const adminUpdateAgentAssignmentSchema = z.object({
  can_edit: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  allowed_features: z.record(z.string(), z.boolean()).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided to update',
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: 'Invalid email address' }),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, { message: 'Reset token is required' }),
  new_password: z.string().min(12, { message: 'New password must be at least 12 characters' }).max(128).regex(passwordRegex, { message: 'New password must include uppercase, lowercase, number, and symbol' }),
});

const otpSchema = z.object({
  email: z.string().trim().email({ message: 'Invalid email address' }),
  otp_code: z.string().trim().length(6, { message: 'OTP code must be 6 digits' }).regex(/^\d{6}$/, { message: 'OTP code must contain only digits' }),
});

const createPlanSchema = z.object({
  name: z.string().trim().min(1, { message: 'Plan name is required' }).max(100),
  slug: z.string().trim().min(1).max(50).regex(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens only' }),
  price: z.number().min(0).optional().default(0),
  billing_period: z.enum(['monthly', 'yearly']).optional().default('monthly'),
  max_agents: z.number().int().optional().default(-1),
  max_calls_per_month: z.number().int().optional().default(-1),
  max_phone_numbers: z.number().int().optional().default(-1),
  features: z.record(z.boolean()).optional().default({}),
  is_default: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional().default(0),
});

const updatePlanSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  price: z.number().min(0).optional(),
  billing_period: z.enum(['monthly', 'yearly']).optional(),
  max_agents: z.number().int().optional(),
  max_calls_per_month: z.number().int().optional(),
  max_phone_numbers: z.number().int().optional(),
  features: z.record(z.boolean()).optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

const assignPlanSchema = z.object({
  plan_id: z.number().int().positive().nullable(),
});

const createAgentSchema = z.object({
  name: z.string().trim().min(1, { message: 'Agent name is required' }).max(100, { message: 'Agent name is too long' }),
  provider: z.enum(['elevenlabs', 'vapi', 'gemini']).optional().default('elevenlabs'),
  template: z.string().trim().max(50).optional(),
  first_message: z.string().max(2000).optional(),
  language: z.string().max(20).optional().default('en'),
  llm: z.string().max(100).optional().default('gpt-4o-mini'),
  voice_id: z.string().max(200).optional(),
  tts_model_id: z.string().max(100).optional().default('eleven_v3_conversational'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  prompt: z.string().max(100000).optional(),
  max_duration_seconds: z.number().int().min(30).max(7200).optional().default(300),
  // Vapi-specific
  model_provider: z.string().max(50).optional(),
  voice_provider: z.string().max(50).optional(),
  transcriber_provider: z.string().max(50).optional(),
  // Gemini-specific
  gemini_voice: z.string().max(50).optional(),
  gemini_model: z.string().max(100).optional(),
  thinking_level: z.enum(['none', 'low', 'medium', 'high']).optional(),
  media_resolution: z.enum(['low', 'medium', 'high']).optional(),
  max_context_size: z.number().int().min(1000).max(200000).optional(),
  target_context_size: z.number().int().min(1000).max(200000).optional(),
  grounding_google_search: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  affective_dialog: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  proactive_audio: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
});

const createContactSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().max(100).optional(),
  company: z.string().trim().max(200).optional(),
  phone: z.string().trim().min(6).max(20),
  email: z.string().trim().email().optional().or(z.literal('')),
  language: z.string().max(10).optional(),
  country: z.string().max(2).optional(),
  timezone: z.string().max(50).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'lead', 'customer', 'archived']).optional(),
  consent_status: z.enum(['unknown', 'given', 'withdrawn', 'pending']).optional(),
  consent_source: z.string().max(100).optional(),
  source: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
  custom_fields: z.record(z.string()).optional(),
});

const updateContactSchema = createContactSchema.partial();

const importContactsSchema = z.object({
  rows: z.array(z.record(z.string().max(5000))).min(1).max(10000),
  column_mapping: z.record(z.string().max(100)).optional(),
});

module.exports = {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  twilioPhoneNumberSchema,
  sipPhoneNumberSchema,
  phoneNumberAssignSchema,
  callOutboundSchema,
  addSharedVoiceSchema,
  adminCreateClientSchema,
  adminUpdateClientSchema,
  adminAssignAgentSchema,
  adminUpdateAgentAssignmentSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  otpSchema,
  createPlanSchema,
  updatePlanSchema,
  assignPlanSchema,
  createAgentSchema,
  createContactSchema,
  updateContactSchema,
  importContactsSchema,
};