const styles = `
  body {
    background-color: #0f172a; /* slate-900 */
    color: #f8fafc; /* slate-50 */
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 40px 20px;
  }
  .header {
    text-align: center;
    margin-bottom: 32px;
  }
  .logo {
    font-size: 24px;
    font-weight: bold;
    color: #10b981; /* emerald-500 */
    text-decoration: none;
  }
  .card {
    background-color: #1e293b; /* slate-800 */
    border-radius: 8px;
    padding: 32px;
    border: 1px solid #334155; /* slate-700 */
  }
  .title {
    margin-top: 0;
    font-size: 20px;
    color: #f8fafc;
  }
  .text {
    font-size: 16px;
    line-height: 1.5;
    color: #cbd5e1; /* slate-300 */
    margin-bottom: 24px;
  }
  .btn-container {
    text-align: center;
    margin-bottom: 24px;
  }
  .btn {
    display: inline-block;
    background-color: #10b981; /* emerald-500 */
    color: #ffffff;
    text-decoration: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-weight: 600;
  }
  .footer {
    text-align: center;
    margin-top: 32px;
    font-size: 14px;
    color: #64748b; /* slate-500 */
  }
`;

const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="#" class="logo">Dialix</a>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Dialix. All rights reserved.</p>
      <p>If you didn't request this email, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>
`;

module.exports = {
  verificationTemplate: (name, link) => baseTemplate(`
    <h2 class="title">Verify your email</h2>
    <p class="text">Hi ${name || 'there'},</p>
    <p class="text">Welcome to Dialix! Please verify your email address to get started.</p>
    <div class="btn-container">
      <a href="${link}" class="btn">Verify Email</a>
    </div>
  `),
  passwordResetTemplate: (name, link) => baseTemplate(`
    <h2 class="title">Reset your password</h2>
    <p class="text">Hi ${name || 'there'},</p>
    <p class="text">We received a request to reset your password. Click the button below to choose a new one.</p>
    <div class="btn-container">
      <a href="${link}" class="btn">Reset Password</a>
    </div>
  `),
  teamInviteTemplate: (inviterName, orgName, link) => baseTemplate(`
    <h2 class="title">You've been invited!</h2>
    <p class="text">${inviterName} has invited you to join <strong>${orgName}</strong> on Dialix.</p>
    <div class="btn-container">
      <a href="${link}" class="btn">Accept Invitation</a>
    </div>
  `),
  subscriptionActivatedTemplate: (name, planName) => baseTemplate(`
    <h2 class="title">Subscription Activated</h2>
    <p class="text">Hi ${name || 'there'},</p>
    <p class="text">Your subscription to the <strong>${planName}</strong> plan is now active. Thank you for choosing Dialix!</p>
  `),
  paymentFailedTemplate: (name, planName) => baseTemplate(`
    <h2 class="title">Action Required: Payment Failed</h2>
    <p class="text">Hi ${name || 'there'},</p>
    <p class="text">We couldn't process your payment for the <strong>${planName}</strong> plan. Please update your billing information to avoid service interruption.</p>
  `),
  campaignCompletedTemplate: (campaignName, stats) => baseTemplate(`
    <h2 class="title">Campaign Completed</h2>
    <p class="text">Your campaign <strong>${campaignName}</strong> has finished running.</p>
    <p class="text">
      <strong>Total Calls:</strong> ${stats.total || 0}<br>
      <strong>Answered:</strong> ${stats.answered || 0}<br>
      <strong>Failed:</strong> ${stats.failed || 0}
    </p>
  `)
};
