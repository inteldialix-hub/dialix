const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validateSchema } = require('../middleware/validate');
const { getSubscriptions, createSubscription, deleteSubscription } = require('../lib/webhooks');

const router = express.Router();

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
    res.json({ subscriptions });
  } catch (err) {
    console.error('GET /api/webhooks error:', err);
    res.status(500).json({ error: 'Failed to fetch webhook subscriptions' });
  }
});

/**
 * POST /api/webhooks
 * Create a new webhook subscription
 */
router.post('/', authenticate, validateSchema(webhookSchema), async (req, res) => {
  try {
    const { event, url, secret } = req.body;

    const subscription = await createSubscription(req.client.id, event, url, secret);
    res.status(201).json({ subscription });
  } catch (err) {
    console.error('POST /api/webhooks error:', err);
    if (err.message.includes('Unsupported webhook event')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create webhook subscription' });
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