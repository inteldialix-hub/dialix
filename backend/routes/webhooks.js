const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validateSchema } = require('../middleware/validate');
const { getSubscriptions, createSubscription, deleteSubscription, SUPPORTED_EVENTS } = require('../lib/webhooks');
const { get } = require('../db');

const router = express.Router();

/**
 * GET /api/webhooks/events
 * List supported webhook event types
 */
router.get('/events', authenticate, (req, res) => {
  res.json({ events: SUPPORTED_EVENTS });
});

// Webhook subscription schema
const webhookSchema = {
  body: {
    event: { type: 'string', required: true },
    url: { type: 'string', required: true, format: 'url' },
    secret: { type: 'string', required: false }
  }
};

/**
 * GET /api/webhooks
 * Get webhook subscriptions for the client
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const subscriptions = await getSubscriptions(req.client.id);
    const webhooks = (subscriptions || []).map(s => ({
      id: s.id,
      url: s.url,
      events: [s.event],
      description: s.event,
      created_at: s.created_at,
    }));
    res.json({ subscriptions: subscriptions || [], webhooks });
  } catch (err) {
    console.error('GET /api/webhooks error:', err);
    res.status(500).json({ error: 'Failed to fetch webhook subscriptions' });
  }
});

/**
 * POST /api/webhooks
 * Create one or more webhook subscriptions
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { url, secret } = req.body;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({ error: 'A valid HTTP/HTTPS url is required' });
    }

    // Support both single event string and array of events
    let eventList = [];
    if (Array.isArray(req.body.events) && req.body.events.length > 0) {
      eventList = req.body.events;
    } else if (req.body.event) {
      eventList = [req.body.event];
    } else {
      return res.status(400).json({ error: 'At least one webhook event is required' });
    }

    const createdSubscriptions = [];
    for (const ev of eventList) {
      if (!SUPPORTED_EVENTS.includes(ev)) {
        return res.status(400).json({ error: `Unsupported webhook event: ${ev}` });
      }
      const sub = await createSubscription(req.client.id, ev, url, secret);
      createdSubscriptions.push(sub);
    }

    const formattedWebhooks = createdSubscriptions.map(s => ({
      id: s.id,
      url: s.url,
      events: [s.event],
      description: s.event,
      created_at: new Date().toISOString(),
    }));

    res.status(201).json({
      success: true,
      subscription: createdSubscriptions[0],
      subscriptions: createdSubscriptions,
      webhooks: formattedWebhooks,
    });
  } catch (err) {
    console.error('POST /api/webhooks error:', err);
    if (err.message && err.message.includes('Unsupported webhook event')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create webhook subscription' });
  }
});

/**
 * POST /api/webhooks/:id/test
 * Test ping a webhook subscription
 */
router.post('/:id/test', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await get('SELECT * FROM webhook_subscriptions WHERE id = ? AND client_id = ?', [id, req.client.id]);
    if (!sub) {
      return res.status(404).json({ error: 'Webhook subscription not found' });
    }

    const testPayload = {
      event: sub.event || 'test.ping',
      test: true,
      subscription_id: sub.id,
      message: 'Test event from Dialix Webhook Dispatcher',
      timestamp: new Date().toISOString(),
    };

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let statusCode = 0;
    let responseText = '';
    try {
      const resp = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Dialix-Webhook-Tester/1.0',
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      statusCode = resp.status;
      responseText = await resp.text().catch(() => '');
    } catch (fetchErr) {
      clearTimeout(timeout);
      return res.status(502).json({
        success: false,
        status: 502,
        status_code: 502,
        error: `Webhook ping failed: ${fetchErr.message}`,
        duration_ms: Date.now() - startTime,
        latency_ms: Date.now() - startTime,
      });
    }

    const duration = Date.now() - startTime;
    res.json({
      success: statusCode >= 200 && statusCode < 300,
      status: statusCode,
      status_code: statusCode,
      duration_ms: duration,
      latency_ms: duration,
      response_preview: responseText.slice(0, 200),
    });
  } catch (err) {
    console.error('POST /api/webhooks/:id/test error:', err);
    res.status(500).json({ error: 'Failed to send test ping' });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook subscription
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await deleteSubscription(req.client.id, parseInt(id));
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/webhooks/:id error:', err);
    res.status(500).json({ error: 'Failed to delete webhook subscription' });
  }
});

module.exports = router;