const nodemailer = require('nodemailer');

const APP_NAME = process.env.APP_NAME || 'Dialix';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://ai-gamma-drab.vercel.app';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const getBaseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #fafafa; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 8px; overflow: hidden; }
    .header { padding: 32px 24px; text-align: center; border-bottom: 1px solid #27272a; }
    .content { padding: 32px 24px; line-height: 1.6; }
    .button { display: inline-block; padding: 12px 24px; background-color: #fafafa; color: #09090b; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 24px 0; }
    .footer { padding: 24px; text-align: center; font-size: 14px; color: #a1a1aa; border-top: 1px solid #27272a; }
    h1 { margin-top: 0; font-size: 24px; color: #fafafa; }
    p { margin-bottom: 16px; color: #e4e4e7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${APP_NAME}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      <p>If you didn't request this email, you can safely ignore it.</p>
      <p><a href="${FRONTEND_URL}" style="color: #a1a1aa; text-decoration: underline;">Unsubscribe</a> or manage your email preferences in your settings.</p>
    </div>
  </div>
</body>
</html>
`;

async function sendGenericEmail(to, subject, htmlBody) {
  if (!process.env.SMTP_HOST) {
    console.warn('[EMAIL] SMTP not configured. Skipping email to:', to);
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${APP_NAME}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html: getBaseTemplate(htmlBody),
    });
    console.log('[EMAIL] Sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Error sending email:', error);
    return { success: false, error: error.message };
  }
}

async function sendVerificationEmail(email, token, name) {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
  const content = `
    <h2>Welcome to ${APP_NAME}, ${name}!</h2>
    <p>Please verify your email address by clicking the button below.</p>
    <div style="text-align: center;">
      <a href="${verifyUrl}" class="button">Verify Email Address</a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #3b82f6;">${verifyUrl}</p>
    <p>This link will expire in 24 hours.</p>
  `;
  return sendGenericEmail(email, 'Verify your email address', content);
}

async function sendPasswordResetEmail(email, token, name) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
  const content = `
    <h2>Hello ${name || 'there'},</h2>
    <p>We received a request to reset your password for your ${APP_NAME} account.</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #3b82f6;">${resetUrl}</p>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `;
  return sendGenericEmail(email, 'Reset your password', content);
}

async function sendTeamInviteEmail(email, inviterName, orgName, inviteToken) {
  const inviteUrl = `${FRONTEND_URL}/register?invite=${inviteToken}&email=${encodeURIComponent(email)}`;
  const content = `
    <h2>You've been invited!</h2>
    <p><strong>${inviterName}</strong> has invited you to join their team at <strong>${orgName}</strong> on ${APP_NAME}.</p>
    <div style="text-align: center;">
      <a href="${inviteUrl}" class="button">Accept Invitation</a>
    </div>
    <p>If you already have an account, make sure to register using this exact email address (${email}) to automatically join the team.</p>
  `;
  return sendGenericEmail(email, `Join ${orgName} on ${APP_NAME}`, content);
}

async function sendPaymentFailedEmail(email, name, planName) {
  const updateBillingUrl = `${FRONTEND_URL}/settings/billing`;
  const content = `
    <h2>Payment Failed</h2>
    <p>Hello ${name},</p>
    <p>We were unable to process your recent payment for your <strong>${planName}</strong> plan.</p>
    <p>To avoid any interruption to your service, please update your payment method.</p>
    <div style="text-align: center;">
      <a href="${updateBillingUrl}" class="button">Update Payment Method</a>
    </div>
  `;
  return sendGenericEmail(email, 'Action Required: Payment Failed', content);
}

async function sendSubscriptionConfirmEmail(email, name, planName) {
  const content = `
    <h2>Subscription Confirmed</h2>
    <p>Hello ${name},</p>
    <p>Thank you for subscribing to the <strong>${planName}</strong> plan!</p>
    <p>Your account has been upgraded and you now have access to all the features in your plan.</p>
    <div style="text-align: center;">
      <a href="${FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
    </div>
  `;
  return sendGenericEmail(email, `Welcome to ${APP_NAME} ${planName}`, content);
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTeamInviteEmail,
  sendPaymentFailedEmail,
  sendSubscriptionConfirmEmail,
  sendGenericEmail,
};
