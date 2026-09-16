const crypto = require('crypto');
const { all, get, run } = require('../db');

const SUPPORTED_EVENTS = [
  'call.initiated',
  'call.completed',
  'call.failed',
  'call.inbound',
  'agent.created',
  'agent.updated',
  'agent.deleted',
  'campaign.started',
  'campaign.completed',
  'campaign.paused',
  'contact.created',
  'contact.updated',
  'subscription.activated',
  'subscription.cancelled',
];

const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 30000, 120000]; // 5s, 30s, 2min

function buildSignature(secret, payload) {
  if (!secret) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

async function getSubscriptions(clientId, event) {
  if (!event) {
    return await all('SELECT * FROM webhook_subscriptions WHERE client_id = ?', [clientId]);
  }
  return await all('SELECT * FROM webhook_subscriptions WHERE client_id = ? AND event = ?', [clientId, event]);
}

async function createSubscription(clientId, event, url, secret) {
  if (!SUPPORTED_EVENTS.includes(event)) {
    throw new Error(`Unsupported webhook event: ${event}`);
  }
  // Auto-generate a signing secret if none provided
  const signingSecret = secret || crypto.randomBytes(32).toString('hex');
  const result = await run(
    `INSERT INTO webhook_subscriptions (client_id, event, url, secret)
     VALUES (?, ?, ?, ?)`,
    [clientId, event, url, signingSecret]
  );
  return { id: result.lastInsertRowid, client_id: clientId, event, url, secret: signingSecret };
}

async function deleteSubscription(clientId, id) {
  return await run('DELETE FROM webhook_subscriptions WHERE id = ? AND client_id = ?', [id, clientId]);
}

/**
 * Send a webhook event to all matching subscribers with retries and delivery logging.
 * Think of it like a postal service — it tries to deliver the package,
 * and if nobody answers, it comes back later up to 3 times.
 */
async function sendWebhookEvent(event, payload, sourceClientId) {
  try {
    let subscribers;
    if (sourceClientId) {
      // Only notify subscribers belonging to the source client
      subscribers = await all(
        'SELECT * FROM webhook_subscriptions WHERE event = ? AND client_id = ?',
        [event, sourceClientId]
      );
    } else {
      subscribers = await all('SELECT * FROM webhook_subscriptions WHERE event = ?', [event]);
    }
    if (!subscribers || !subscribers.length) return;

    for (const sub of subscribers) {
      deliverWithRetry(sub, event, payload, 0);
    }
  } catch (err) {
    console.error('Webhook delivery error:', err.message || err);
  }
}

/**
 * Deliver a webhook with automatic retries on failure
 */
async function deliverWithRetry(subscription, event, payload, attempt) {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Dialix-Webhook/1.0',
    'X-Dialix-Event': event,
    'X-Dialix-Delivery': crypto.randomUUID(),
  };

  if (subscription.secret) {
    headers['X-Dialix-Signature'] = buildSignature(subscription.secret, { event, payload });
  }

  const startTime = Date.now();
  let statusCode = 0;
  let success = false;
  let errorMessage = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(subscription.url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    statusCode = response.status;
    success = statusCode >= 200 && statusCode < 300;
  } catch (err) {
    errorMessage = err.name === 'AbortError' ? 'Request timed out (10s)' : err.message;
    console.error(`Failed webhook POST to ${subscription.url} (attempt ${attempt + 1}):`, errorMessage);
  }

  const durationMs = Date.now() - startTime;

  // Log delivery attempt (non-blocking)
  try {
    await run(
      `INSERT INTO audit_logs (client_id, actor, action, resource_type, resource_id, details, created_at)
       VALUES (?, 'system', 'webhook.delivered', 'webhook', ?, ?, datetime('now'))`,
      [
        subscription.client_id,
        String(subscription.id),
        JSON.stringify({
          event,
          url: subscription.url,
          attempt: attempt + 1,
          status_code: statusCode,
          success,
          duration_ms: durationMs,
          error: errorMessage,
        }),
      ]
    );
  } catch {
    // Don't let logging failures break webhook delivery
  }

  // Retry on failure
  if (!success && attempt < MAX_RETRIES) {
    const delay = RETRY_DELAYS[attempt] || 60000;
    setTimeout(() => {
      deliverWithRetry(subscription, event, payload, attempt + 1);
    }, delay);
  }
}

module.exports = {
  SUPPORTED_EVENTS,
  getSubscriptions,
  createSubscription,
  deleteSubscription,
  sendWebhookEvent,
  buildSignature,
};
