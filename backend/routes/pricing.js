const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { all, get, run } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateSchema } = require('../middleware/validate');
const { createPlanSchema, updatePlanSchema, assignPlanSchema } = require('../lib/schemas');

const router = express.Router();

const adminPricingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many pricing admin requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
});

// ═══════════════════════════════════════════════════════════
//  PUBLIC — Get all active pricing plans
// ═══════════════════════════════════════════════════════════

router.get('/plans', async (req, res) => {
  try {
    const plans = await all(
      'SELECT id, name, slug, price, billing_period, max_agents, max_calls_per_month, max_phone_numbers, features, is_default, sort_order FROM pricing_plans WHERE is_active = 1 ORDER BY sort_order ASC'
    );

    // Parse the features JSON string
    const parsed = plans.map(p => ({
      ...p,
      features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features,
    }));

    res.json({ plans: parsed });
  } catch (err) {
    console.error('GET /api/pricing/plans error:', err);
    res.status(500).json({ error: 'Failed to fetch pricing plans' });
  }
});

// ═══════════════════════════════════════════════════════════
//  AUTHENTICATED — Get current client's plan
// ═══════════════════════════════════════════════════════════

router.get('/my-plan', authenticate, async (req, res) => {
  try {
    const row = await get(
      'SELECT c.plan_id, p.name AS plan_name, p.slug, p.price, p.billing_period, p.max_agents, p.max_calls_per_month, p.max_phone_numbers, p.features FROM clients c LEFT JOIN pricing_plans p ON c.plan_id = p.id WHERE c.id = ?',
      [req.client.id]
    );

    if (!row || !row.plan_id) {
      // Return default plan if no plan assigned
      const defaultPlan = await get(
        'SELECT id, name, slug, price, billing_period, max_agents, max_calls_per_month, max_phone_numbers, features FROM pricing_plans WHERE is_default = 1 AND is_active = 1'
      );
      if (defaultPlan) {
        return res.json({
          plan: {
            ...defaultPlan,
            features: typeof defaultPlan.features === 'string' ? JSON.parse(defaultPlan.features) : defaultPlan.features,
          },
          is_default: true,
        });
      }
      return res.json({ plan: null, is_default: true });
    }

    res.json({
      plan: {
        id: row.plan_id,
        name: row.plan_name,
        slug: row.slug,
        price: row.price,
        billing_period: row.billing_period,
        max_agents: row.max_agents,
        max_calls_per_month: row.max_calls_per_month,
        max_phone_numbers: row.max_phone_numbers,
        features: typeof row.features === 'string' ? JSON.parse(row.features) : row.features,
      },
      is_default: false,
    });
  } catch (err) {
    console.error('GET /api/pricing/my-plan error:', err);
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

// ═══════════════════════════════════════════════════════════
//  ADMIN — CRUD for pricing plans
// ═══════════════════════════════════════════════════════════

// Get all plans (including inactive)
router.get('/admin/plans', authenticate, requireAdmin, async (req, res) => {
  try {
    const plans = await all('SELECT * FROM pricing_plans ORDER BY sort_order ASC');
    const parsed = plans.map(p => ({
      ...p,
      features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features,
    }));
    res.json({ plans: parsed });
  } catch (err) {
    console.error('GET /api/pricing/admin/plans error:', err);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Create a new plan
router.post('/admin/plans', authenticate, requireAdmin, adminPricingLimiter, validateSchema(createPlanSchema), async (req, res) => {
  try {
    const { name, slug, price, billing_period, max_agents, max_calls_per_month, max_phone_numbers, features, is_default, sort_order } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug are required' });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: 'slug must be lowercase alphanumeric with hyphens only' });
    }

    // Check if slug exists
    const existing = await get('SELECT id FROM pricing_plans WHERE slug = ?', [slug]);
    if (existing) {
      return res.status(409).json({ error: 'A plan with this slug already exists' });
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await run('UPDATE pricing_plans SET is_default = 0');
    }

    const featuresStr = typeof features === 'object' ? JSON.stringify(features) : (features || '{}');

    const result = await run(
      `INSERT INTO pricing_plans (name, slug, price, billing_period, max_agents, max_calls_per_month, max_phone_numbers, features, is_default, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        slug,
        price || 0,
        billing_period || 'monthly',
        max_agents ?? -1,
        max_calls_per_month ?? -1,
        max_phone_numbers ?? -1,
        featuresStr,
        is_default ? 1 : 0,
        sort_order || 0,
      ]
    );

    const newPlan = await get('SELECT * FROM pricing_plans WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({
      plan: {
        ...newPlan,
        features: typeof newPlan.features === 'string' ? JSON.parse(newPlan.features) : newPlan.features,
      },
    });
  } catch (err) {
    console.error('POST /api/pricing/admin/plans error:', err);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

// Update a plan
router.put('/admin/plans/:id', authenticate, requireAdmin, adminPricingLimiter, validateSchema(updatePlanSchema), async (req, res) => {
  try {
    const planId = req.params.id;
    const existing = await get('SELECT * FROM pricing_plans WHERE id = ?', [planId]);
    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const { name, price, billing_period, max_agents, max_calls_per_month, max_phone_numbers, features, is_default, is_active, sort_order } = req.body;

    // If setting as default, unset other defaults
    if (is_default) {
      await run('UPDATE pricing_plans SET is_default = 0');
    }

    const featuresStr = features !== undefined
      ? (typeof features === 'object' ? JSON.stringify(features) : features)
      : existing.features;

    await run(
      `UPDATE pricing_plans SET
        name = ?, price = ?, billing_period = ?, max_agents = ?, max_calls_per_month = ?,
        max_phone_numbers = ?, features = ?, is_default = ?, is_active = ?, sort_order = ?,
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        name ?? existing.name,
        price ?? existing.price,
        billing_period ?? existing.billing_period,
        max_agents ?? existing.max_agents,
        max_calls_per_month ?? existing.max_calls_per_month,
        max_phone_numbers ?? existing.max_phone_numbers,
        featuresStr,
        is_default !== undefined ? (is_default ? 1 : 0) : existing.is_default,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        sort_order ?? existing.sort_order,
        planId,
      ]
    );

    const updated = await get('SELECT * FROM pricing_plans WHERE id = ?', [planId]);
    res.json({
      plan: {
        ...updated,
        features: typeof updated.features === 'string' ? JSON.parse(updated.features) : updated.features,
      },
    });
  } catch (err) {
    console.error('PUT /api/pricing/admin/plans error:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// Delete a plan
router.delete('/admin/plans/:id', authenticate, requireAdmin, adminPricingLimiter, async (req, res) => {
  try {
    const planId = req.params.id;
    const existing = await get('SELECT * FROM pricing_plans WHERE id = ?', [planId]);
    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Check if any clients are on this plan
    const clientsOnPlan = await all('SELECT id FROM clients WHERE plan_id = ?', [planId]);
    if (clientsOnPlan.length > 0) {
      return res.status(409).json({
        error: `Cannot delete plan: ${clientsOnPlan.length} client(s) are currently on this plan. Reassign them first.`,
      });
    }

    await run('DELETE FROM pricing_plans WHERE id = ?', [planId]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/pricing/admin/plans error:', err);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

// ═══════════════════════════════════════════════════════════
//  ADMIN — Assign plan to client
// ═══════════════════════════════════════════════════════════

router.put('/admin/clients/:clientId/plan', authenticate, requireAdmin, adminPricingLimiter, validateSchema(assignPlanSchema), async (req, res) => {
  try {
    const { clientId } = req.params;
    const { plan_id } = req.body;

    const client = await get('SELECT id FROM clients WHERE id = ?', [clientId]);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (plan_id !== null && plan_id !== undefined) {
      const plan = await get('SELECT id FROM pricing_plans WHERE id = ? AND is_active = 1', [plan_id]);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found or inactive' });
      }
    }

    await run('UPDATE clients SET plan_id = ? WHERE id = ?', [plan_id || null, clientId]);

    res.json({ success: true, plan_id: plan_id || null });
  } catch (err) {
    console.error('PUT /api/pricing/admin/clients/:clientId/plan error:', err);
    res.status(500).json({ error: 'Failed to assign plan' });
  }
});

// Get all clients with their plan info (for admin)
router.get('/admin/clients', authenticate, requireAdmin, async (req, res) => {
  try {
    const clients = await all(
      `SELECT c.id, c.name, c.email, c.is_admin, c.plan_id, c.created_at,
              p.name as plan_name, p.slug as plan_slug, p.price as plan_price
       FROM clients c
       LEFT JOIN pricing_plans p ON c.plan_id = p.id
       ORDER BY c.created_at DESC`
    );
    res.json({ clients });
  } catch (err) {
    console.error('GET /api/pricing/admin/clients error:', err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

module.exports = router;
