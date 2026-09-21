const { all, get, run } = require('../db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function analyzeCall(callId) {
  try {
    const calls = await all('SELECT * FROM call_history WHERE id = ?', [callId]);
    if (!calls || calls.length === 0) {
      throw new Error('Call not found');
    }
    const call = calls[0];

    // Check if transcript is available
    if (!call.transcript || call.transcript.trim() === '') {
      throw new Error('No transcript available for analysis');
    }

    let summary, sentiment, outcome, qualification_score, key_topics;
    
    // Check for Gemini API Key
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `
        Analyze the following call transcript and provide a JSON response with these fields:
        - summary: A brief summary of the conversation (max 3 sentences).
        - sentiment: The overall sentiment of the customer ("positive", "neutral", or "negative").
        - outcome: The outcome of the call ("qualified", "not_qualified", "callback", "transfer", "voicemail", or "no_answer").
        - qualification_score: A score from 0 to 100 indicating how qualified the lead is.
        - key_topics: A JSON array of strings representing the main topics discussed.
        
        Transcript:
        ${call.transcript}
      `;

      try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }]}],
            generationConfig: { responseMimeType: "application/json" }
        });
        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);
        
        summary = parsed.summary || 'No summary available';
        sentiment = parsed.sentiment || 'neutral';
        outcome = parsed.outcome || 'not_qualified';
        qualification_score = parsed.qualification_score || 0;
        key_topics = JSON.stringify(parsed.key_topics || []);
      } catch (aiError) {
        console.error(`[Analysis] AI generation failed for call ${callId}:`, aiError);
        // Fallback below
        ({ summary, sentiment, outcome, qualification_score, key_topics } = fallbackAnalysis(call));
      }
    } else {
      // Fallback rule-based analysis
      ({ summary, sentiment, outcome, qualification_score, key_topics } = fallbackAnalysis(call));
    }

    const analyzed_at = new Date().toISOString();
    
    await run(
      `UPDATE call_history 
       SET summary = ?, sentiment = ?, outcome = ?, qualification_score = ?, key_topics = ?, analyzed_at = ? 
       WHERE id = ?`,
      [summary, sentiment, outcome, qualification_score, key_topics, analyzed_at, callId]
    );

    return {
      success: true,
      data: { summary, sentiment, outcome, qualification_score, key_topics, analyzed_at }
    };

  } catch (error) {
    console.error(`[Analysis] Error analyzing call ${callId}:`, error);
    return { success: false, error: error.message };
  }
}

function fallbackAnalysis(call) {
  const t = call.transcript.toLowerCase();
  
  // Sentiment
  let sentiment = 'neutral';
  const posWords = ['great', 'good', 'awesome', 'excellent', 'yes', 'sure', 'interested'];
  const negWords = ['bad', 'terrible', 'no', 'not interested', 'stop', 'remove', 'hang up'];
  
  let posCount = posWords.filter(w => t.includes(w)).length;
  let negCount = negWords.filter(w => t.includes(w)).length;
  
  if (posCount > negCount + 1) sentiment = 'positive';
  else if (negCount > posCount) sentiment = 'negative';

  // Outcome
  let outcome = 'not_qualified';
  if (call.status === 'completed' && call.duration > 120) outcome = 'qualified';
  if (call.status === 'voicemail' || t.includes('leave a message')) outcome = 'voicemail';
  if (call.status === 'no_answer') outcome = 'no_answer';

  // Score
  let score = 0;
  if (call.duration > 30) score += 20;
  if (call.duration > 120) score += 30;
  if (sentiment === 'positive') score += 50;
  else if (sentiment === 'negative') score = Math.max(0, score - 30);
  
  // Summary
  let summary = call.transcript.substring(0, 200);
  if (call.transcript.length > 200) summary += '...';
  
  return {
    summary,
    sentiment,
    outcome,
    qualification_score: score,
    key_topics: JSON.stringify(['general inquiry'])
  };
}

async function analyzeRecentCalls() {
  try {
    const calls = await all(
      `SELECT id FROM call_history 
       WHERE transcript IS NOT NULL AND transcript != '' 
       AND analyzed_at IS NULL 
       AND created_at >= datetime('now', '-24 hours')`
    );
    
    const results = [];
    for (const call of calls) {
      const res = await analyzeCall(call.id);
      results.push({ id: call.id, ...res });
    }
    
    return { success: true, processed: calls.length, results };
  } catch (error) {
    console.error('[Analysis] Error analyzing recent calls:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  analyzeCall,
  analyzeRecentCalls
};
