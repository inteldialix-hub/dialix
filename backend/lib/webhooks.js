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

const MAX_RETRIES = 5;
const RETRY_DELAYS = [60000, 300000, 900000, 3600000, 14400000]; // 1min, 5min, 15min, 60min, 4hr

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
 * Send a webhook event to all matching subscribers with deliveries tracking.
 */
async function sendWebhookEvent(event, payload, sourceClientId) {
  try {
    let subscribers;
    if (sourceClientId) {
      subscribers = await all(
        'SELECT * FROM webhook_subscriptions WHERE event = ? AND client_id = ?',
        [event, sourceClientId]
      );
    } else {
      subscribers = await all('SELECT * FROM webhook_subscriptions WHERE event = ?', [event]);
    }
    if (!subscribers || !subscribers.length) return;

    for (const sub of subscribers) {
      const result = await run(
        `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status, max_attempts) 
         VALUES (?, ?, ?, ?, ?)`,
        [sub.id, event, JSON.stringify(payload), 'pending', MAX_RETRIES]
      );
      const deliveryId = result.lastInsertRowid;
      deliverWithRetry(sub, event, payload, deliveryId, 0);
    }
  } catch (err) {
    console.error('Webhook delivery error:', err.message || err);
  }
}

/**
 * Process pending/failed retries
 */
async function processRetries() {
  try {
    const pendingDeliveries = await all(
      `SELECT d.*, s.url, s.secret, s.client_id
       FROM webhook_deliveries d
       JOIN webhook_subscriptions s ON d.webhook_id = s.id
       WHERE (d.status = 'failed' OR d.status = 'pending')
       AND d.attempts < d.max_attempts
       AND (d.next_retry_at IS NULL OR datetime(d.next_retry_at) <= datetime('now'))`
    );

    for (const delivery of pendingDeliveries) {
      const payload = delivery.payload ? JSON.parse(delivery.payload) : {};
      const sub = {
        id: delivery.webhook_id,
        url: delivery.url,
        secret: delivery.secret,
        client_id: delivery.client_id
      };
      deliverWithRetry(sub, delivery.event_type, payload, delivery.id, delivery.attempts);
    }
  } catch (err) {
    console.error('Failed to process webhook retries:', err);
  }
}

/**
 * Deliver a webhook with tracking
 */
async function deliverWithRetry(subscription, event, payload, deliveryId, attempt) {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Dialix-Webhook/1.0',
    'X-Dialix-Event': event,
    'X-Dialix-Delivery': String(deliveryId),
  };

  if (subscription.secret) {
    headers['X-Dialix-Signature'] = buildSignature(subscription.secret, { event, payload });
  }

  const startTime = Date.now();
  let statusCode = null;
  let success = false;
  let errorMessage = null;
  let responseText = null;

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
    
    try {
      const text = await response.text();
      responseText = text.slice(0, 1000); // Truncate response
    } catch (e) {}

  } catch (err) {
    errorMessage = err.name === 'AbortError' ? 'Request timed out (10s)' : err.message;
    console.error(`Failed webhook POST to ${subscription.url} (attempt ${attempt + 1}):`, errorMessage);
  }

  const durationMs = Date.now() - startTime;
  const currentAttempt = attempt + 1;

  if (success) {
    await run(
      `UPDATE webhook_deliveries 
       SET status = 'success', http_status = ?, response_body = ?, attempts = ?, latency_ms = ?, delivered_at = datetime('now'), next_retry_at = NULL, error_message = NULL
       WHERE id = ?`,
      [statusCode, responseText, currentAttempt, durationMs, deliveryId]
    );
  } else {
    let nextRetryAt = null;
    if (currentAttempt < MAX_RETRIES) {
      const delayMs = RETRY_DELAYS[attempt] || 3600000;
      nextRetryAt = new Date(Date.now() + delayMs).toISOString();
    }
    
    await run(
      `UPDATE webhook_deliveries 
       SET status = 'failed', http_status = ?, response_body = ?, attempts = ?, latency_ms = ?, error_message = ?, next_retry_at = ?
       WHERE id = ?`,
      [statusCode, responseText, currentAttempt, durationMs, errorMessage, nextRetryAt, deliveryId]
    );
  }

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
          attempt: currentAttempt,
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
}

module.exports = {
  SUPPORTED_EVENTS,
  getSubscriptions,
  createSubscription,
  deleteSubscription,
  sendWebhookEvent,
  buildSignature,
  processRetries,
};
