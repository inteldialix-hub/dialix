const { get, all } = require('../db');

/**
 * Plan limit enforcement helper.
 * Checks if a client has exceeded their plan's resource limits.
 * Returns { allowed: true } or { allowed: false, reason: string }
 */

async function getClientPlanLimits(clientId) {
  const row = await get(
    `SELECT p.max_agents, p.max_calls_per_month, p.max_phone_numbers, p.features, p.name AS plan_name
     FROM clients c
     LEFT JOIN pricing_plans p ON c.plan_id = p.id
     WHERE c.id = ?`,
    [clientId]
  );

  if (!row || !row.plan_name) {
    // No plan assigned — use default plan limits
    const defaultPlan = await get(
      'SELECT max_agents, max_calls_per_month, max_phone_numbers, features, name AS plan_name FROM pricing_plans WHERE is_default = 1 AND is_active = 1'
    );
    return defaultPlan || { max_agents: 1, max_calls_per_month: 100, max_phone_numbers: 1, features: '{}', plan_name: 'Free' };
  }

  return row;
}

async function checkAgentLimit(clientId) {
  const limits = await getClientPlanLimits(clientId);
  if (limits.max_agents === -1) return { allowed: true };

  const agentCount = await get('SELECT COUNT(*) as count FROM client_agents WHERE client_id = ?', [clientId]);
  const current = agentCount?.count || 0;

  if (current >= limits.max_agents) {
    return {
      allowed: false,
      reason: `Agent limit reached (${current}/${limits.max_agents}). Upgrade your plan to add more agents.`,
      current,
      limit: limits.max_agents,
      plan: limits.plan_name,
    };
  }

  return { allowed: true, current, limit: limits.max_agents };
}

async function checkPhoneNumberLimit(clientId) {
  const limits = await getClientPlanLimits(clientId);
  if (limits.max_phone_numbers === -1) return { allowed: true };

  const phoneCount = await get('SELECT COUNT(*) as count FROM phone_numbers WHERE client_id = ?', [clientId]);
  const current = phoneCount?.count || 0;

  if (current >= limits.max_phone_numbers) {
    return {
      allowed: false,
      reason: `Phone number limit reached (${current}/${limits.max_phone_numbers}). Upgrade your plan to add more numbers.`,
      current,
      limit: limits.max_phone_numbers,
      plan: limits.plan_name,
    };
  }

  return { allowed: true, current, limit: limits.max_phone_numbers };
}

async function checkCallLimit(clientId) {
  const limits = await getClientPlanLimits(clientId);
  if (limits.max_calls_per_month === -1) return { allowed: true };

  // Count calls in current month
  const callCount = await get(
    "SELECT COUNT(*) as count FROM call_history WHERE client_id = ? AND created_at >= datetime('now', 'start of month')",
    [clientId]
  );
  const current = callCount?.count || 0;

  if (current >= limits.max_calls_per_month) {
    return {
      allowed: false,
      reason: `Monthly call limit reached (${current}/${limits.max_calls_per_month}). Upgrade your plan for more calls.`,
      current,
      limit: limits.max_calls_per_month,
      plan: limits.plan_name,
    };
  }

  return { allowed: true, current, limit: limits.max_calls_per_month };
}

module.exports = {
  getClientPlanLimits,
  checkAgentLimit,
  checkPhoneNumberLimit,
  checkCallLimit,
};
