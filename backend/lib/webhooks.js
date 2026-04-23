const crypto = require('crypto');
const { all, get, run } = require('../db');

const SUPPORTED_EVENTS = ['call.completed', 'call.failed'];

function buildSignature(secret, payload) {
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
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
  const result = await run(
    `INSERT INTO webhook_subscriptions (client_id, event, url, secret)
     VALUES (?, ?, ?, ?)`,
    [clientId, event, url, secret || null]
  );
  return { id: result.lastInsertRowid || result.lastInsertRowid, client_id: clientId, event, url, secret };
}

async function deleteSubscription(clientId, id) {
  return await run('DELETE FROM webhook_subscriptions WHERE id = ? AND client_id = ?', [id, clientId]);
}

async function sendWebhookEvent(event, payload) {
  try {
    const subscribers = await all('SELECT * FROM webhook_subscriptions WHERE event = ?', [event]);
    if (!subscribers.length) return;

    for (const sub of subscribers) {
      const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
      const headers = {
        'Content-Type': 'application/json',
      };
      if (sub.secret) {
        headers['X-Dialix-Signature'] = buildSignature(sub.secret, { event, payload });
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        await fetch(sub.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
      } catch (err) {
        console.error(`Failed webhook POST to ${sub.url}:`, err.message || err);
      }
    }
  } catch (err) {
    console.error('Webhook delivery error:', err.message || err);
  }
}

module.exports = {
  SUPPORTED_EVENTS,
  getSubscriptions,
  createSubscription,
  deleteSubscription,
  sendWebhookEvent,
};
