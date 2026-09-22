const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { all, get, run } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { paypalRequest, verifyWebhookSignature } = require('../lib/paypal');

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

const createSubLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many subscription creation attempts. Please try again later.' }
});

const cancelSubLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many cancellation attempts. Please try again later.' }
});

// 1. Create Subscription
router.post('/create-subscription', authenticate, createSubLimiter, async (req, res) => {
  try {
    const clientId = req.client?.id || req.user?.clientId || req.user?.id;
    let plan_slug = req.body.plan_slug || req.body.planId || req.body.plan_id;
    if (!plan_slug) {
      return res.status(400).json({ error: 'plan_slug is required' });
    }
    if (plan_slug === 'pro') plan_slug = 'professional';

    const plan = await get('SELECT id, name, paypal_plan_id FROM pricing_plans WHERE slug = ?', [plan_slug]);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    if (!plan.paypal_plan_id) {
      return res.status(400).json({ error: 'PayPal credentials not yet configured. Please import your PayPal Client ID and Secret in settings.' });
    }

    const existingSub = await get(
      "SELECT id FROM subscriptions WHERE client_id = ? AND status IN ('active', 'pending')",
      [clientId]
    );

    if (existingSub) {
      return res.status(400).json({ error: 'Client already has an active or pending subscription' });
    }

    const payload = {
      plan_id: plan.paypal_plan_id,
      application_context: {
        brand_name: 'Dialix',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: `${APP_BASE_URL}/subscription/success`,
        cancel_url: `${APP_BASE_URL}/subscription/cancel`
      }
    };

    const result = await paypalRequest('POST', '/v1/billing/subscriptions', payload);
    
    const approvalLink = result.links.find(link => link.rel === 'approve');
    if (!approvalLink) {
      throw new Error('No approval link found in PayPal response');
    }

    res.json({
      approvalUrl: approvalLink.href,
      approval_url: approvalLink.href,
      subscription_id: result.id,
      data: { approval_url: approvalLink.href, approvalUrl: approvalLink.href, subscription_id: result.id }
    });
  } catch (error) {
    console.error('Error creating PayPal subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// 2. Subscription Status
router.get('/subscription-status', authenticate, async (req, res) => {
  try {
    const subscription = await get(
      `SELECT s.*, p.name as plan_name, p.slug as plan_slug 
       FROM subscriptions s 
       LEFT JOIN pricing_plans p ON s.plan_id = p.id 
       WHERE s.client_id = ? 
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.user.clientId]
    );

    if (!subscription) {
      return res.json({ data: { status: 'none' } });
    }

    res.json({ data: subscription });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// 3. Cancel Subscription
router.post('/cancel-subscription', authenticate, cancelSubLimiter, async (req, res) => {
  try {
    const { reason = 'Not specified' } = req.body;

    const subscription = await get(
      "SELECT id, paypal_subscription_id, status FROM subscriptions WHERE client_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [req.user.clientId]
    );

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    if (!subscription.paypal_subscription_id) {
      return res.status(400).json({ error: 'Subscription is missing PayPal ID' });
    }

    await paypalRequest('POST', `/v1/billing/subscriptions/${subscription.paypal_subscription_id}/cancel`, {
      reason
    });

    const now = new Date().toISOString();
    await run(
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?",
      [now, now, subscription.id]
    );

    try {
      await run(
        "INSERT INTO audit_logs (client_id, user_id, action, details) VALUES (?, ?, ?, ?)",
        [req.user.clientId, req.user.id, 'subscription_cancelled', JSON.stringify({ reason, subscription_id: subscription.id })]
      );
    } catch (e) {
      // Ignore if audit_logs doesn't exist
    }

    res.json({ data: { success: true, message: 'Subscription cancelled successfully' } });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// 4. Subscription Success
router.post('/subscription-success', authenticate, async (req, res) => {
  try {
    const { subscription_id } = req.body;
    if (!subscription_id) {
      return res.status(400).json({ error: 'subscription_id is required' });
    }

    const ppSub = await paypalRequest('GET', `/v1/billing/subscriptions/${subscription_id}`);
    
    if (!ppSub || !ppSub.plan_id) {
      return res.status(400).json({ error: 'Invalid subscription from PayPal' });
    }

    const plan = await get('SELECT id FROM pricing_plans WHERE paypal_plan_id = ?', [ppSub.plan_id]);
    if (!plan) {
      return res.status(404).json({ error: 'Corresponding plan not found in local database' });
    }

    let status = 'pending';
    if (ppSub.status === 'ACTIVE') status = 'active';
    else if (ppSub.status === 'SUSPENDED') status = 'suspended';
    else if (ppSub.status === 'CANCELLED') status = 'cancelled';
    else if (ppSub.status === 'EXPIRED') status = 'expired';

    const now = new Date().toISOString();
    const existing = await get('SELECT id FROM subscriptions WHERE paypal_subscription_id = ?', [subscription_id]);
    
    if (existing) {
      await run(
        `UPDATE subscriptions SET status = ?, plan_id = ?, updated_at = ? WHERE id = ?`,
        [status, plan.id, now, existing.id]
      );
    } else {
      await run(
        `INSERT INTO subscriptions (client_id, plan_id, paypal_subscription_id, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.clientId, plan.id, subscription_id, status, now, now]
      );
    }

    if (status === 'active') {
      await run('UPDATE clients SET plan_id = ? WHERE id = ?', [plan.id, req.user.clientId]);
    }

    res.json({ data: { success: true, status } });
  } catch (error) {
    console.error('Error in subscription success:', error);
    res.status(500).json({ error: 'Failed to process subscription' });
  }
});

// 5. PayPal Webhooks
router.post('/webhooks/paypal', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBody = req.body.toString('utf8');
    const isValid = await verifyWebhookSignature(req.headers, rawBody);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(rawBody);
    const eventId = event.id;
    const eventType = event.event_type;
    
    const existingEvent = await get('SELECT id FROM payment_webhook_events WHERE external_event_id = ?', [eventId]);
    if (existingEvent) {
      return res.status(200).send('Already processed');
    }

    const now = new Date().toISOString();
    
    const { lastInsertRowid } = await run(
      `INSERT INTO payment_webhook_events (provider, external_event_id, event_type, status, payload, created_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['paypal', eventId, eventType, 'received', rawBody, now]
    );

    let error = null;
    try {
      const resource = event.resource;
      const subId = resource.id;
      
      switch (eventType) {
        case 'BILLING.SUBSCRIPTION.ACTIVATED':
          await run("UPDATE subscriptions SET status = 'active', updated_at = ? WHERE paypal_subscription_id = ?", [now, subId]);
          const actSub = await get("SELECT client_id, plan_id FROM subscriptions WHERE paypal_subscription_id = ?", [subId]);
          if (actSub) {
            await run("UPDATE clients SET plan_id = ? WHERE id = ?", [actSub.plan_id, actSub.client_id]);
          }
          break;
          
        case 'BILLING.SUBSCRIPTION.SUSPENDED':
          await run("UPDATE subscriptions SET status = 'suspended', updated_at = ? WHERE paypal_subscription_id = ?", [now, subId]);
          break;
          
        case 'BILLING.SUBSCRIPTION.CANCELLED':
          await run("UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE paypal_subscription_id = ?", [now, now, subId]);
          break;
          
        case 'BILLING.SUBSCRIPTION.EXPIRED':
          await run("UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE paypal_subscription_id = ?", [now, subId]);
          break;
          
        case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        case 'PAYMENT.SALE.DENIED':
          {
            const failSubId = resource.billing_agreement_id || resource.id;
            if (failSubId) {
              const failSub = await get(`
                SELECT s.client_id, p.name as plan_name, c.email 
                FROM subscriptions s 
                JOIN pricing_plans p ON s.plan_id = p.id 
                JOIN clients c ON s.client_id = c.id
                WHERE s.paypal_subscription_id = ?
              `, [failSubId]);
              if (failSub && failSub.email) {
                const { sendPaymentFailedEmail } = require('../services/email');
                await sendPaymentFailedEmail(failSub.email, failSub.plan_name, 'Valued Customer');
              }
            }
          }
          break;
          
        case 'PAYMENT.SALE.COMPLETED':
          const billingAgreementId = resource.billing_agreement_id;
          if (billingAgreementId) {
            const sub = await get("SELECT id, client_id FROM subscriptions WHERE paypal_subscription_id = ?", [billingAgreementId]);
            if (sub) {
              await run(
                `INSERT INTO payments (client_id, subscription_id, paypal_payment_id, amount, currency, status, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [sub.client_id, sub.id, resource.id, parseFloat(resource.amount.total), resource.amount.currency, 'completed', now]
              );
            }
          }
          break;
          
        case 'PAYMENT.SALE.REFUNDED':
          if (resource.parent_payment) {
            await run("UPDATE payments SET status = 'refunded' WHERE paypal_payment_id = ?", [resource.parent_payment]);
          }
          break;
          
        case 'PAYMENT.SALE.REVERSED':
          if (resource.parent_payment) {
            await run("UPDATE payments SET status = 'reversed' WHERE paypal_payment_id = ?", [resource.parent_payment]);
          }
          break;
      }
    } catch (procErr) {
      error = procErr.message;
      console.error('Webhook processing error:', procErr);
    }

    await run(
      `UPDATE payment_webhook_events SET status = ?, processed_at = ?, error = ? WHERE id = ?`,
      [error ? 'failed' : 'processed', now, error, lastInsertRowid]
    );

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send('Webhook processing failed');
  }
});

// 6. Billing History
router.get('/billing-history', authenticate, async (req, res) => {
  try {
    const payments = await all(
      'SELECT id, amount, currency, status, payment_method, created_at, paypal_payment_id FROM payments WHERE client_id = ? ORDER BY created_at DESC',
      [req.user.clientId]
    );
    res.json({ data: payments || [] });
  } catch (error) {
    console.error('Error fetching billing history:', error);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

// 7. Admin Sync Plans
router.post('/admin/sync-plans', authenticate, requireAdmin, async (req, res) => {
  try {
    const plans = await all('SELECT id, name, slug, description FROM pricing_plans WHERE price > 0 AND paypal_plan_id IS NULL');
    
    if (!plans || plans.length === 0) {
      return res.json({ data: { message: 'All plans are already synced' } });
    }

    const productPayload = {
      name: 'Dialix Service',
      description: 'Dialix AI Voice Call Center SaaS',
      type: 'SERVICE',
      category: 'SOFTWARE'
    };
    
    const product = await paypalRequest('POST', '/v1/catalogs/products', productPayload);
    const productId = product.id;
    const results = [];

    for (const plan of plans) {
      let amount = 0;
      if (plan.slug === 'starter') amount = 49;
      else if (plan.slug === 'professional') amount = 149;
      else if (plan.slug === 'enterprise') amount = 0; // Custom pricing

      if (amount === 0) continue;

      const planPayload = {
        product_id: productId,
        name: `${plan.name} Plan`,
        description: plan.description || `Dialix ${plan.name} Monthly Subscription`,
        status: 'ACTIVE',
        billing_cycles: [{
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value: amount.toString(), currency_code: 'USD' } }
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: { value: '0', currency_code: 'USD' },
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3
        }
      };

      try {
        const ppPlan = await paypalRequest('POST', '/v1/billing/plans', planPayload);
        await run('UPDATE pricing_plans SET paypal_plan_id = ? WHERE id = ?', [ppPlan.id, plan.id]);
        results.push({ plan: plan.name, paypal_plan_id: ppPlan.id, status: 'success' });
      } catch (err) {
        results.push({ plan: plan.name, error: err.message, status: 'failed' });
      }
    }

    res.json({ data: { results } });
  } catch (error) {
    console.error('Error syncing plans:', error);
    res.status(500).json({ error: 'Failed to sync plans', details: error.message });
  }
});

module.exports = router;
