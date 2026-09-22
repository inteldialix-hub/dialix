const { get } = require('../db');

/**
 * Entitlement plans definition
 */
const PLANS = {
  free: {
    price: 0,
    maxAgents: 1,
    maxCampaigns: 1,
    maxContacts: 100,
    includedMinutes: 50,
    maxConcurrentCalls: 1,
    apiAccess: false,
    webhookAccess: false
  },
  starter: {
    price: 49,
    maxAgents: 5,
    maxCampaigns: 10,
    maxContacts: 5000,
    includedMinutes: 500,
    maxConcurrentCalls: 3,
    apiAccess: true,
    webhookAccess: true
  },
  professional: {
    price: 149,
    maxAgents: 20,
    maxCampaigns: -1, // unlimited
    maxContacts: 50000,
    includedMinutes: 2000,
    maxConcurrentCalls: 10,
    apiAccess: true,
    webhookAccess: true
  },
  enterprise: {
    price: -1,
    maxAgents: -1,
    maxCampaigns: -1,
    maxContacts: -1,
    includedMinutes: -1,
    maxConcurrentCalls: -1,
    apiAccess: true,
    webhookAccess: true
  }
};

/**
 * Get client entitlements based on their plan
 */
async function getEntitlements(clientId) {
  const row = await get(
    'SELECT p.slug FROM clients c LEFT JOIN pricing_plans p ON c.plan_id = p.id WHERE c.id = ?',
    [clientId]
  );
  
  const planSlug = (row && row.slug) ? row.slug : 'free';
  const planLimits = PLANS[planSlug] || PLANS.free;
  
  return {
    plan: planSlug,
    ...planLimits
  };
}

/**
 * Check if a resource operation is allowed
 */
async function checkLimit(clientId, resource) {
  const entitlements = await getEntitlements(clientId);
  
  // resource can be 'agents', 'campaigns', 'contacts', 'concurrent_calls', 'apiAccess', 'webhookAccess'
  if (resource === 'apiAccess') {
    return { allowed: entitlements.apiAccess, current: 0, limit: 1, message: 'API access not included in current plan' };
  }
  if (resource === 'webhookAccess') {
    return { allowed: entitlements.webhookAccess, current: 0, limit: 1, message: 'Webhook access not included in current plan' };
  }
  
  let current = 0;
  let limit = entitlements.maxAgents; // default
  
  if (resource === 'agents') {
    const res = await get('SELECT COUNT(*) as count FROM client_agents WHERE client_id = ?', [clientId]);
    current = res ? parseInt(res.count, 10) : 0;
    limit = entitlements.maxAgents;
  } else if (resource === 'campaigns') {
    const res = await get('SELECT COUNT(*) as count FROM campaigns WHERE client_id = ?', [clientId]);
    current = res ? parseInt(res.count, 10) : 0;
    limit = entitlements.maxCampaigns;
  } else if (resource === 'contacts') {
    const res = await get('SELECT COUNT(*) as count FROM contacts WHERE client_id = ?', [clientId]);
    current = res ? parseInt(res.count, 10) : 0;
    limit = entitlements.maxContacts;
  } else if (resource === 'concurrent_calls') {
    const res = await get("SELECT COUNT(*) as count FROM call_history WHERE client_id = ? AND status IN ('initiated', 'ringing', 'in-progress')", [clientId]);
    current = res ? parseInt(res.count, 10) : 0;
    limit = entitlements.maxConcurrentCalls;
  } else {
    throw new Error('Unknown resource for limit check: ' + resource);
  }
  
  if (limit === -1) {
    return { allowed: true, current, limit, message: 'Unlimited' };
  }
  
  const allowed = current < limit;
  return { 
    allowed, 
    current, 
    limit, 
    message: allowed ? 'Within limits' : `Plan limit exceeded for ${resource}`
  };
}

/**
 * Enforce limit - throws if exceeded
 */
async function enforceLimit(clientId, resource) {
  const result = await checkLimit(clientId, resource);
  if (!result.allowed) {
    const error = new Error('Plan limit exceeded');
    error.status = 403;
    error.details = { resource, current: result.current, limit: result.limit };
    throw error;
  }
}

module.exports = {
  getEntitlements,
  checkLimit,
  enforceLimit
};
