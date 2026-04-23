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
});

const adminUpdateAgentAssignmentSchema = z.object({
  can_edit: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  allowed_features: z.array(z.string()).nullable().optional(),
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
};