const express = require('express');
const router = express.Router();
const { analyzeCall, analyzeRecentCalls } = require('../services/post-call-analysis');
const { get } = require('../db');
const { authenticate } = require('../middleware/auth');

// POST /api/calls/:id/analyze
router.post('/:id/analyze', authenticate, async (req, res) => {
  try {
    const callId = req.params.id;
    // Check if user owns the call
    const call = await get('SELECT client_id FROM call_history WHERE id = ?', [callId]);
    
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }
    
    if (call.client_id !== req.client.id && req.client.is_admin !== 1) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const result = await analyzeCall(callId);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// GET /api/calls/:id/analysis
router.get('/:id/analysis', authenticate, async (req, res) => {
  try {
    const callId = req.params.id;
    const call = await get('SELECT * FROM call_history WHERE id = ?', [callId]);
    
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }
    
    if (call.client_id !== req.client.id && req.client.is_admin !== 1) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    res.json({
      summary: call.summary,
      sentiment: call.sentiment,
      outcome: call.outcome,
      qualification_score: call.qualification_score,
      key_topics: call.key_topics ? JSON.parse(call.key_topics) : null,
      analyzed_at: call.analyzed_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// POST /api/calls/analyze-recent
router.post('/analyze-recent', authenticate, async (req, res) => {
  try {
    if (req.client.is_admin !== 1) {
      return res.status(403).json({ error: 'Admin only endpoint' });
    }
    
    const result = await analyzeRecentCalls();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Analysis failed' });
  }
});

module.exports = router;
