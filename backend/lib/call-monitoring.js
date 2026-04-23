/**
 * Call Monitoring System
 * 
 * Manages real-time call state, metrics, and broadcasting to connected clients
 */

const { EventEmitter } = require('events');
const { run, get, all } = require('../db');
const { getCache, setCache, delCache } = require('./cache');
const { sendWebhookEvent } = require('./webhooks');

class CallMonitor extends EventEmitter {
  constructor() {
    super();
    // In-memory store for active calls
    this.activeCalls = new Map();
    
    // Initialize cache connection
    this.initCache();
  }

  async initCache() {
    try {
      const { initCache } = require('./cache');
      await initCache();
    } catch (err) {
      console.log('Cache initialization failed:', err.message);
    }
  }

  /**
   * Create a new call record in the database
   */
  async createCall(clientId, agentId, conversationId, toNumber, leadName) {
    try {
      const result = await run(
        `INSERT INTO call_history 
         (client_id, agent_id, conversation_id, to_number, lead_name, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [clientId, agentId, conversationId, toNumber, leadName || null, 'initiated']
      );

      const callRecord = {
        id: result.lastInsertRowid,
        clientId,
        agentId,
        conversationId,
        toNumber,
        leadName,
        status: 'initiated',
        duration: 0,
        startedAt: new Date(),
        metrics: {},
      };

      this.activeCalls.set(conversationId, callRecord);
      this.emit('call:created', callRecord);

      return callRecord;
    } catch (err) {
      console.error('Error creating call record:', err);
      throw err;
    }
  }

  /**
   * Update call status and metrics
   */
  async updateCallStatus(conversationId, status, metrics = {}) {
    try {
      const call = this.activeCalls.get(conversationId);
      if (!call) {
        console.warn(`Call not found: ${conversationId}`);
        return;
      }

      call.status = status;
      call.metrics = { ...call.metrics, ...metrics };
      call.duration = Math.floor((Date.now() - call.startedAt.getTime()) / 1000);

      // Update database
      if (status === 'connected') {
        await run(
          `UPDATE call_history SET status = ? WHERE conversation_id = ?`,
          [status, conversationId]
        );
      } else if (status === 'completed' || status === 'failed') {
        const success = status === 'completed' ? 1 : 0;
        const qualityScore = metrics.quality_score || null;

        await run(
          `UPDATE call_history 
           SET status = ?, duration = ?, success = ?, ended_at = datetime('now'), quality_score = ?
           WHERE conversation_id = ?`,
          [status, call.duration, success, qualityScore, conversationId]
        );

        // Store detailed metrics
        await run(
          `INSERT OR REPLACE INTO call_metrics 
           (conversation_id, status, duration, mq_quality, fq_quality, transcript)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            conversationId,
            status,
            call.duration,
            metrics.mq_quality || null,
            metrics.fq_quality || null,
            metrics.transcript || null,
          ]
        );

        // Remove from active calls after a brief delay
        setTimeout(() => this.activeCalls.delete(conversationId), 5000);

        // Invalidate caches since call completed
        await delCache(`analytics:client:${call.clientId}`);
        await delCache(`analytics:agent:${call.agentId}`);
        await delCache('analytics:dashboard:stats');

        // Send webhook event
        const event = status === 'completed' ? 'call.completed' : 'call.failed';
        const payload = {
          conversation_id: conversationId,
          agent_id: call.agentId,
          to_number: call.toNumber,
          lead_name: call.leadName,
          duration: call.duration,
          quality_score: qualityScore,
          success: success,
          error_message: metrics.error_message || null,
        };
        sendWebhookEvent(event, payload);
      }

      this.emit('call:updated', { conversationId, status, call, metrics });
      return call;
    } catch (err) {
      console.error('Error updating call status:', err);
      throw err;
    }
  }

  /**
   * Get call record by conversation ID
   */
  async getCall(conversationId) {
    try {
      const call = this.activeCalls.get(conversationId);
      if (call) return call;

      // Fall back to database
      const record = await get(
        'SELECT * FROM call_history WHERE conversation_id = ?',
        [conversationId]
      );
      return record;
    } catch (err) {
      console.error('Error getting call:', err);
      return null;
    }
  }

  /**
   * Get call analytics for a client
   */
  async getClientAnalytics(clientId) {
    const cacheKey = `analytics:client:${clientId}`;
    
    // Try cache first
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const stats = await get(
        `SELECT 
           COUNT(*) as total_calls,
           SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls,
           AVG(duration) as avg_duration,
           AVG(quality_score) as avg_quality,
           MAX(quality_score) as best_quality
         FROM call_history 
         WHERE client_id = ?`,
        [clientId]
      );

      const recentCalls = await all(
        `SELECT * FROM call_history 
         WHERE client_id = ? 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [clientId]
      );

      const result = {
        stats,
        recentCalls,
      };

      // Cache for 30 seconds
      await setCache(cacheKey, result, 30);

      return result;
    } catch (err) {
      console.error('Error getting client analytics:', err);
      return { stats: {}, recentCalls: [] };
    }
  }

  /**
   * Get agent performance metrics
   */
  async getAgentMetrics(agentId) {
    const cacheKey = `analytics:agent:${agentId}`;
    
    // Try cache first
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const metrics = await get(
        `SELECT 
           COUNT(*) as total_calls,
           SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls,
           AVG(duration) as avg_duration,
           AVG(quality_score) as avg_quality,
           MIN(created_at) as first_call
         FROM call_history 
         WHERE agent_id = ?`,
        [agentId]
      );

      const recentCalls = await all(
        `SELECT * FROM call_history 
         WHERE agent_id = ? 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [agentId]
      );

      const result = {
        metrics,
        recentCalls,
      };

      // Cache for 30 seconds
      await setCache(cacheKey, result, 30);

      return result;
    } catch (err) {
      console.error('Error getting agent metrics:', err);
      return { metrics: {}, recentCalls: [] };
    }
  }

  /**
   * Get call history with filters
   */
  async getCallHistory(clientId, { limit = 50, offset = 0, agentId = null, status = null } = {}) {
    try {
      let query = 'SELECT * FROM call_history WHERE client_id = ?';
      const params = [clientId];

      if (agentId) {
        query += ' AND agent_id = ?';
        params.push(agentId);
      }

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const calls = await all(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) as count FROM call_history WHERE client_id = ?';
      const countParams = [clientId];

      if (agentId) {
        countQuery += ' AND agent_id = ?';
        countParams.push(agentId);
      }

      if (status) {
        countQuery += ' AND status = ?';
        countParams.push(status);
      }

      const countResult = await get(countQuery, countParams);
      const total = countResult?.count || 0;

      return {
        calls,
        total,
        limit,
        offset,
      };
    } catch (err) {
      console.error('Error getting call history:', err);
      return { calls: [], total: 0, limit, offset };
    }
  }

  /**
   * Get active calls count
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Get active calls count by agent
   */
  getActiveCallsByAgent(agentId) {
    return Array.from(this.activeCalls.values()).filter(call => call.agentId === agentId);
  }

  /**
   * Get dashboard metrics (real-time)
   */
  async getDashboardMetrics() {
    try {
      const activeCalls = Array.from(this.activeCalls.values());

      const cacheKey = 'analytics:dashboard:stats';
      
      // Try cache for historical stats
      const cachedStats = await getCache(cacheKey);
      let todayStats, overallStats, topAgents;

      if (cachedStats) {
        ({ todayStats, overallStats, topAgents } = cachedStats);
      } else {
        todayStats = await get(
          `SELECT 
             COUNT(*) as calls_today,
             SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_today,
             AVG(duration) as avg_duration_today,
             AVG(quality_score) as avg_quality_today
           FROM call_history 
           WHERE DATE(created_at) = DATE('now')`,
          []
        );

        overallStats = await get(
          `SELECT 
             COUNT(*) as total_calls,
             SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as total_successful,
             AVG(quality_score) as overall_avg_quality
           FROM call_history`,
          []
        );

        // Get top performing agents
        topAgents = await all(
          `SELECT 
             agent_id,
             COUNT(*) as call_count,
             AVG(quality_score) as avg_quality,
             SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls
           FROM call_history 
           GROUP BY agent_id 
           ORDER BY successful_calls DESC 
           LIMIT 5`,
          []
        );

        // Cache historical stats for 15 seconds
        await setCache(cacheKey, { todayStats, overallStats, topAgents }, 15);
      }

      return {
        activeCalls: {
          count: activeCalls.length,
          calls: activeCalls,
        },
        today: todayStats,
        overall: overallStats,
        topAgents,
      };
    } catch (err) {
      console.error('Error getting dashboard metrics:', err);
      return {
        activeCalls: { count: 0, calls: [] },
        today: {},
        overall: {},
        topAgents: [],
      };
    }
  }
}

module.exports = new CallMonitor();
