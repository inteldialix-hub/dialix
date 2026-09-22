const nodemailer = require('nodemailer');
const templates = require('../email-templates/index');

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://www.inteldialix.online';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const defaultSender = process.env.SMTP_FROM || 'noreply@blackglass-studio.com';

const sendEmail = async (to, subject, html) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials missing. Would have sent email to:', to);
    console.warn('Subject:', subject);
    return false;
  }
  
  try {
    const info = await transporter.sendMail({
      from: defaultSender,
      to,
      subject,
      html
    });
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

const sendVerificationEmail = async (to, token, name) => {
  const link = `${APP_BASE_URL}/verify-email?token=${token}`;
  return sendEmail(to, 'Verify your Dialix account', templates.verificationTemplate(name, link));
};

const sendPasswordResetEmail = async (to, token, name) => {
  const link = `${APP_BASE_URL}/reset-password?token=${token}`;
  return sendEmail(to, 'Reset your Dialix password', templates.passwordResetTemplate(name, link));
};

const sendTeamInviteEmail = async (to, inviterName, orgName, inviteLink) => {
  return sendEmail(to, `Invitation to join ${orgName} on Dialix`, templates.teamInviteTemplate(inviterName, orgName, inviteLink));
};

const sendSubscriptionActivatedEmail = async (to, planName, name) => {
  return sendEmail(to, 'Dialix Subscription Activated', templates.subscriptionActivatedTemplate(name, planName));
};

const sendPaymentFailedEmail = async (to, planName, name) => {
  return sendEmail(to, 'Dialix Payment Failed', templates.paymentFailedTemplate(name, planName));
};

const sendCampaignCompletedEmail = async (to, campaignName, stats) => {
  return sendEmail(to, `Campaign ${campaignName} Completed`, templates.campaignCompletedTemplate(campaignName, stats));
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTeamInviteEmail,
  sendSubscriptionActivatedEmail,
  sendPaymentFailedEmail,
  sendCampaignCompletedEmail
};
