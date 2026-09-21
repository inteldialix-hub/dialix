/**
 * Stats API — Real-time dashboard analytics
 * Aggregates data from ElevenLabs conversations + local DB
 */
const express = require('express');
const { all, get } = require('../db');
const { authenticate } = require('../middleware/auth');
const elevenlabs = require('../services/elevenlabs');

const router = express.Router();

/**
 * GET /api/stats
 * Returns aggregated dashboard stats:
 * - totalAgents, totalCalls, avgDuration, successRate
 * - callsByAgent (for pie/donut chart)
 * - recentActivity (last 10 call events)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const clientId = req.client.id;
    const isAdmin = req.client.is_admin;

    // Get agents for this client (or all for admin)
    const agents = isAdmin
      ? await all('SELECT DISTINCT agent_id, agent_name FROM client_agents')
      : await all('SELECT agent_id, agent_name FROM client_agents WHERE client_id = ?', [clientId]);

    // Get phone numbers count
    const phoneNumbers = isAdmin
      ? await all('SELECT COUNT(*) as count FROM phone_numbers')
      : await all('SELECT COUNT(*) as count FROM phone_numbers WHERE client_id = ?', [clientId]);
    const totalPhoneNumbers = phoneNumbers[0]?.count || 0;

    // Get client count (admin only)
    let totalClients = 0;
    if (isAdmin) {
      const clientCount = await get('SELECT COUNT(*) as count FROM clients WHERE is_admin = 0');
      totalClients = clientCount?.count || 0;
    }

    // Fetch conversations from ElevenLabs for each agent
    let allConversations = [];
    const callsByAgent = [];

    // Fetch all agents in parallel instead of sequentially
    const agentResults = await Promise.allSettled(
      agents.map(async (agent) => {
        try {
          const data = await elevenlabs.getConversations(agent.agent_id, 50);
          return { agent, convs: data.conversations || [] };
        } catch (err) {
          return { agent, convs: [] };
        }
      })
    );

    for (const result of agentResults) {
      const { agent, convs } = result.status === 'fulfilled' ? result.value : { agent: result.value?.agent, convs: [] };
      if (!agent) continue;
      allConversations = allConversations.concat(
        convs.map(c => ({ ...c, agent_name: agent.agent_name, agent_id: agent.agent_id }))
      );
      callsByAgent.push({
        agent_id: agent.agent_id,
        name: agent.agent_name,
        count: convs.length,
      });
    }

    // Calculate stats
    const totalCalls = allConversations.length;

    // Success = status is 'done' or has a transcript
    const successfulCalls = allConversations.filter(
      c => c.status === 'done' || c.status === 'completed'
    ).length;
    const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

    // Average duration (in seconds)
    const durationsSeconds = allConversations
      .filter(c => c.call_duration_secs || c.metadata?.call_duration_secs)
      .map(c => c.call_duration_secs || c.metadata?.call_duration_secs || 0);
    const avgDuration = durationsSeconds.length > 0
      ? Math.round(durationsSeconds.reduce((a, b) => a + b, 0) / durationsSeconds.length)
      : 0;

    // Recent activity (last 10, sorted by time)
    const recentActivity = allConversations
      .sort((a, b) => {
        const ta = a.start_time_unix_secs || a.metadata?.start_time_unix_secs || 0;
        const tb = b.start_time_unix_secs || b.metadata?.start_time_unix_secs || 0;
        return tb - ta;
      })
      .slice(0, 10)
      .map(c => ({
        id: c.conversation_id || c.id,
        agent_name: c.agent_name,
        agent_id: c.agent_id,
        status: c.status || 'unknown',
        duration: c.call_duration_secs || c.metadata?.call_duration_secs || 0,
        time: c.start_time_unix_secs || c.metadata?.start_time_unix_secs || 0,
        to_number: c.to_number || c.metadata?.to_number || '',
      }));

    // Failed calls = not 'done' or 'completed'
    const failedCalls = allConversations.filter(
      c => c.status && c.status !== 'done' && c.status !== 'completed' && c.status !== 'processing'
    ).length;

    // Total minutes
    const totalMinutes = durationsSeconds.length > 0
      ? Math.round(durationsSeconds.reduce((a, b) => a + b, 0) / 60)
      : 0;

    // Active campaigns count
    let activeCampaigns = 0;
    try {
      const campaignRow = isAdmin
        ? await get("SELECT COUNT(*) as count FROM campaigns WHERE status IN ('running', 'scheduled')")
        : await get("SELECT COUNT(*) as count FROM campaigns WHERE client_id = ? AND status IN ('running', 'scheduled')", [clientId]);
      activeCampaigns = campaignRow?.count || 0;
    } catch (e) { /* campaigns table may not exist yet */ }

    const stats = {
      totalAgents: agents.length,
      totalCalls,
      totalPhoneNumbers,
      successRate,
      avgDuration,
      failedCalls,
      totalMinutes,
      activeCampaigns,
      answeredCalls: successfulCalls,
      callsByAgent,
      recentActivity,
    };

    // Only include client count for admins (non-admins shouldn't see it)
    if (isAdmin) {
      stats.totalClients = totalClients;
    }

    res.json(stats);
  } catch (err) {
    console.error('GET /api/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/stats/daily
 * Returns calls grouped by day
 */
router.get('/daily', authenticate, async (req, res) => {
  try {
    const clientId = req.client.id;
    const isAdmin = req.client.is_admin;
    const days = parseInt(req.query.days) || 30;

    // Get agents
    const agents = isAdmin
      ? await all('SELECT DISTINCT agent_id FROM client_agents')
      : await all('SELECT agent_id FROM client_agents WHERE client_id = ?', [clientId]);

    let allConversations = [];

    const agentResults = await Promise.allSettled(
      agents.map(async (agent) => {
        try {
          const data = await elevenlabs.getConversations(agent.agent_id, 100);
          return data.conversations || [];
        } catch (err) {
          return [];
        }
      })
    );

    for (const result of agentResults) {
      if (result.status === 'fulfilled') {
        allConversations = allConversations.concat(result.value);
      }
    }

    // Filter to last N days
    const now = Date.now() / 1000;
    const cutoff = now - (days * 24 * 60 * 60);
    
    const recentConversations = allConversations.filter(c => {
      const time = c.start_time_unix_secs || c.metadata?.start_time_unix_secs || 0;
      return time >= cutoff;
    });

    // Group by date (YYYY-MM-DD)
    const grouped = {};
    
    // Initialize dates
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      grouped[dateStr] = { date: dateStr, count: 0, successCount: 0, failedCount: 0 };
    }

    recentConversations.forEach(c => {
      const time = c.start_time_unix_secs || c.metadata?.start_time_unix_secs || 0;
      if (time === 0) return;
      
      const dateStr = new Date(time * 1000).toISOString().split('T')[0];
      if (grouped[dateStr]) {
        grouped[dateStr].count++;
        if (c.status === 'done' || c.status === 'completed') {
          grouped[dateStr].successCount++;
        } else if (c.status && c.status !== 'processing') {
          grouped[dateStr].failedCount++;
        }
      }
    });

    const dailyStats = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    res.json(dailyStats);
  }
});

/**
 * GET /api/stats/usage
 * Returns current month usage summary and plan limits for billing page
 */
router.get('/usage', authenticate, async (req, res) => {
  try {
    const { getCurrentMonthUsage } = require('../services/usage-tracker');
    const { getClientPlanLimits } = require('../lib/plan-limits');
    
    const usage = await getCurrentMonthUsage(req.client.id);
    const plan = await getClientPlanLimits(req.client.id);
    
    res.json({ usage, plan });
  } catch (err) {
    console.error('GET /api/stats/usage error:', err);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

/**
 * GET /api/stats/usage/history
 * Returns historical usage for the past year
 */
router.get('/usage/history', authenticate, async (req, res) => {
  try {
    const { getUsageHistory } = require('../services/usage-tracker');
    const history = await getUsageHistory(req.client.id, 12);
    res.json(history);
  } catch (err) {
    console.error('GET /api/stats/usage/history error:', err);
    res.status(500).json({ error: 'Failed to fetch usage history' });
  }
});

module.exports = router;
