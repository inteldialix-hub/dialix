const crypto = require('crypto');

const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox';
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

let cachedAccessToken = null;
let tokenExpiry = null;

function getBaseUrl() {
  return PAYPAL_ENV === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken() {
  if (cachedAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

  const baseUrl = getBaseUrl();
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    body: 'grant_type=client_credentials',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to get PayPal access token: ${errorData}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  // Expire 5 minutes before actual expiry (expires_in is in seconds)
  tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
  
  return cachedAccessToken;
}

async function paypalRequest(method, path, body = null, accessToken = null) {
  if (!accessToken) {
    accessToken = await getAccessToken();
  }

  const baseUrl = getBaseUrl();
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const options = {
    method,
    headers
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch (e) {
      errorJson = { message: errorText };
    }
    const error = new Error(`PayPal API Error: ${response.statusText}`);
    error.status = response.status;
    error.details = errorJson;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function verifyWebhookSignature(headers, rawBody, webhookId = WEBHOOK_ID) {
  const accessToken = await getAccessToken();
  const baseUrl = getBaseUrl();

  const authAlgo = headers['paypal-auth-algo'];
  const certUrl = headers['paypal-cert-url'];
  const transmissionId = headers['paypal-transmission-id'];
  const transmissionSig = headers['paypal-transmission-sig'];
  const transmissionTime = headers['paypal-transmission-time'];

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    throw new Error('Missing required PayPal webhook headers');
  }

  const verificationBody = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody)
  };

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(verificationBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to verify webhook signature: ${errorText}`);
  }

  const data = await response.json();
  return data.verification_status === 'SUCCESS';
}

module.exports = {
  getBaseUrl,
  getAccessToken,
  paypalRequest,
  verifyWebhookSignature
};
