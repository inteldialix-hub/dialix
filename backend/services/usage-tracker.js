const { get, run, all } = require('../db');

/**
 * Gets the current month period string in YYYY-MM format
 */
function getCurrentPeriod() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Records usage for a completed call
 * @param {number} clientId 
 * @param {string} conversationId 
 * @param {number} durationSeconds 
 */
async function recordCallUsage(clientId, conversationId, durationSeconds) {
  if (!clientId || !durationSeconds || durationSeconds <= 0) return;
  
  const period = getCurrentPeriod();
  const connectedMinutes = Math.ceil(durationSeconds / 60);
  
  // Calculate estimated costs (rough estimate)
  // Assuming $0.09/min for AI and $0.01/min for telephony
  const aiCost = connectedMinutes * 0.09;
  const telephonyCost = connectedMinutes * 0.01;

  // Insert or update usage record for the period
  await run(`
    INSERT INTO usage_records (
      client_id, period, call_count, connected_minutes, total_duration_seconds, ai_cost, telephony_cost, created_at, updated_at
    ) VALUES (
      ?, ?, 1, ?, ?, ?, ?, datetime('now'), datetime('now')
    )
    ON CONFLICT(client_id, period) DO UPDATE SET
      call_count = call_count + 1,
      connected_minutes = connected_minutes + EXCLUDED.connected_minutes,
      total_duration_seconds = total_duration_seconds + EXCLUDED.total_duration_seconds,
      ai_cost = ai_cost + EXCLUDED.ai_cost,
      telephony_cost = telephony_cost + EXCLUDED.telephony_cost,
      updated_at = datetime('now')
  `, [clientId, period, connectedMinutes, durationSeconds, aiCost, telephonyCost]);
}

/**
 * Gets current month usage summary for a client
 */
async function getCurrentMonthUsage(clientId) {
  const period = getCurrentPeriod();
  const record = await get(
    'SELECT * FROM usage_records WHERE client_id = ? AND period = ?',
    [clientId, period]
  );
  
  if (!record) {
    return { totalCalls: 0, totalMinutes: 0, totalCost: 0, period };
  }
  
  return {
    totalCalls: record.call_count,
    totalMinutes: record.connected_minutes,
    totalCost: (record.ai_cost || 0) + (record.telephony_cost || 0),
    period
  };
}

/**
 * Gets usage history for the last N months
 */
async function getUsageHistory(clientId, months = 12) {
  const records = await all(
    'SELECT * FROM usage_records WHERE client_id = ? ORDER BY period DESC LIMIT ?',
    [clientId, months]
  );
  
  return records.map(r => ({
    period: r.period,
    totalCalls: r.call_count,
    totalMinutes: r.connected_minutes,
    totalCost: (r.ai_cost || 0) + (r.telephony_cost || 0),
    aiCost: r.ai_cost,
    telephonyCost: r.telephony_cost
  })).reverse(); // Reverse to get chronological order
}

module.exports = {
  recordCallUsage,
  getCurrentMonthUsage,
  getUsageHistory,
  getCurrentPeriod
};
