/**
 * Dialix Campaign Dialing Worker
 * In-process background runner that processes active campaigns,
 * enforces schedule/calling hours/DNC rules, and dials contacts.
 */

const { all, get, run } = require('../db');
const elevenlabs = require('./elevenlabs');
const vapi = require('./vapi');
const { detectDncOptOut } = require('./dnc-keywords');

let intervalId = null;
let isProcessing = false;
let isShuttingDown = false;
let lastTickTime = null;
let processedCount = 0;
let errorCount = 0;

const minuteRateLimits = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Check if the current time matches campaign calling window
 */
function isWithinCallingWindow(campaign) {
  const now = new Date();
  const tz = campaign.calling_timezone || 'UTC';

  // Check Schedule dates
  if (campaign.schedule_start && now < new Date(campaign.schedule_start)) {
    return false;
  }
  if (campaign.schedule_end && now > new Date(campaign.schedule_end)) {
    return 'expired';
  }

  // Check Calling Days
  let allowedDays = ['mon', 'tue', 'wed', 'thu', 'fri'];
  if (campaign.calling_days) {
    try {
      const parsed = typeof campaign.calling_days === 'string'
        ? JSON.parse(campaign.calling_days)
        : campaign.calling_days;
      if (Array.isArray(parsed) && parsed.length > 0) {
        allowedDays = parsed.map(d => String(d).toLowerCase().slice(0, 3));
      }
    } catch {
      // Keep default
    }
  }

  let currentDay;
  let currentHourMinute;
  try {
    const formatterDay = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
    currentDay = formatterDay.format(now).toLowerCase().slice(0, 3);

    const formatterTime = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    currentHourMinute = formatterTime.format(now);
  } catch {
    currentDay = DAYS[now.getUTCDay()];
    currentHourMinute = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
  }

  if (!allowedDays.includes(currentDay)) {
    return false;
  }

  // Check Calling Hours
  const startTime = campaign.calling_start_time || '09:00';
  const endTime = campaign.calling_end_time || '18:00';

  if (currentHourMinute < startTime || currentHourMinute > endTime) {
    return false;
  }

  return true;
}

/**
 * Detect provider for an agent
 */
async function getAgentProvider(clientId, agentId) {
  const agentRow = await get(
    'SELECT provider FROM client_agents WHERE client_id = ? AND agent_id = ?',
    [clientId, agentId]
  );
  if (agentRow?.provider) return agentRow.provider;
  if (agentId.startsWith('gemini_')) return 'gemini';
  return agentId.startsWith('agent_') ? 'elevenlabs' : 'vapi';
}

/**
 * Process a single campaign
 */
async function processCampaign(campaign) {
  const windowStatus = isWithinCallingWindow(campaign);
  if (windowStatus === 'expired') {
    console.log(`[CampaignWorker] Campaign #${campaign.id} "${campaign.name}" schedule expired. Marking completed.`);
    await run(
      "UPDATE campaigns SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      [campaign.id]
    );
    return;
  }

  if (!windowStatus) {
    // Outside calling hours/days — wait
    return;
  }

  if (!campaign.agent_id || !campaign.phone_number_id) {
    return;
  }

  // Spend limit check
  const spendRow = await get(`SELECT SUM(cost) as total_spend FROM call_history WHERE campaign_id = ?`, [campaign.id]);
  const estimatedSpend = spendRow?.total_spend || 0;
  if (campaign.max_spend && estimatedSpend >= campaign.max_spend) {
    console.log(`[CampaignWorker] Campaign #${campaign.id} budget exhausted. Estimated spend: ${estimatedSpend}`);
    await run("UPDATE campaigns SET status = 'budget_exhausted', updated_at = datetime('now') WHERE id = ?", [campaign.id]);
    return;
  }

  // Parse contact IDs
  let contactIds = [];
  if (campaign.contact_list) {
    try {
      contactIds = typeof campaign.contact_list === 'string'
        ? JSON.parse(campaign.contact_list)
        : campaign.contact_list;
    } catch {
      contactIds = [];
    }
  }

  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    await run(
      "UPDATE campaigns SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      [campaign.id]
    );
    return;
  }

  // Check concurrency
  const maxConcurrent = campaign.max_concurrent_calls || campaign.max_concurrent || 1;
  const activeRow = await get(
    `SELECT COUNT(*) as active FROM call_history 
     WHERE client_id = ? AND agent_id = ? AND status IN ('initiated', 'ringing', 'in-progress')`,
    [campaign.client_id, campaign.agent_id]
  );
  const activeCalls = activeRow?.active || 0;
  let availableSlots = maxConcurrent - activeCalls;

  if (availableSlots <= 0) {
    return; // Concurrency limit reached
  }

  // Rate limiting check
  const callsPerMinute = campaign.calls_per_minute || 5;
  const currentMinute = Math.floor(Date.now() / 60000);
  const rateKey = `${campaign.id}_${currentMinute}`;
  const callsThisMinute = minuteRateLimits.get(rateKey) || 0;
  
  if (callsThisMinute >= callsPerMinute) {
    return; // Throttle limit reached for this minute
  }
  
  const throttleAvailable = callsPerMinute - callsThisMinute;
  availableSlots = Math.min(availableSlots, throttleAvailable);

  // Check and update status of initiated calls for this campaign (calls_answered tracking)
  try {
    const pendingCalls = await all(
      "SELECT id, conversation_id, status FROM call_history WHERE campaign_id = ? AND status IN ('initiated', 'ringing')",
      [String(campaign.id)]
    );
    for (const call of (pendingCalls || [])) {
      let isAnswered = false;
      let newStatus = call.status;

      if (campaign.agent_id?.startsWith('agent_') && process.env.ELEVENLABS_API_KEY) {
        try {
          const conv = await elevenlabs.getConversation(call.conversation_id);
          if (conv?.status === 'in-call' || conv?.status === 'done') {
            isAnswered = true;
            newStatus = conv.status === 'done' ? 'completed' : 'in-progress';
          }
        } catch {}
      } else if (process.env.VAPI_API_KEY && !campaign.agent_id?.startsWith('gemini_')) {
        try {
          const vCall = await vapi.getCall(call.conversation_id);
          if (vCall?.status === 'in-progress' || vCall?.status === 'ended') {
            isAnswered = true;
            newStatus = vCall.status === 'ended' ? 'completed' : 'in-progress';
          }
        } catch {}
      }

      if (isAnswered) {
        await run('UPDATE call_history SET status = ? WHERE id = ?', [newStatus, call.id]);
        await run(
          `UPDATE campaigns 
           SET calls_answered = calls_answered + 1, updated_at = datetime('now') 
           WHERE id = ?`,
          [campaign.id]
        );
      }
    }
  } catch (err) {
    // Non-blocking sync notice
  }

  // Find contacts already called by THIS campaign
  const calledRows = await all(
    'SELECT to_number, status, created_at FROM call_history WHERE client_id = ? AND (campaign_id = ? OR (campaign_id IS NULL AND agent_id = ? AND created_at >= ?))',
    [campaign.client_id, String(campaign.id), campaign.agent_id, campaign.started_at || campaign.created_at || '1970-01-01']
  );
  
  // Track numbers that shouldn't be retried anymore
  const calledNumbers = new Set((calledRows || []).filter(r => r.status !== 'failed').map(r => r.to_number));

  // Get DNC list for this client
  const dncRows = await all(
    'SELECT phone_e164 FROM dnc_list WHERE client_id = ? OR client_id IS NULL',
    [campaign.client_id]
  );
  const dncSet = new Set((dncRows || []).map(r => r.phone_e164));

  // Query remaining valid contacts
  const placeholders = contactIds.map(() => '?').join(',');
  const candidateContacts = await all(
    `SELECT id, first_name, last_name, phone, phone_e164, retry_count 
     FROM contacts 
     WHERE id IN (${placeholders}) AND client_id = ? AND do_not_call = 0`,
    [...contactIds, campaign.client_id]
  );

  const maxRetryAttempts = campaign.max_retry_attempts !== undefined ? campaign.max_retry_attempts : 3;
  const retryDelayMs = (campaign.retry_delay_minutes !== undefined ? campaign.retry_delay_minutes : 30) * 60000;

  const pendingContacts = (candidateContacts || []).filter(c => {
    const rawNumber = c.phone_e164 || c.phone;
    if (!rawNumber) return false;
    if (dncSet.has(rawNumber) || dncSet.has(c.phone)) return false;
    if (calledNumbers.has(rawNumber) || calledNumbers.has(c.phone)) return false;
    if ((c.retry_count || 0) >= maxRetryAttempts) return false;
    
    // Enforce retry delay if there are prior failures
    const priorFailures = (calledRows || []).filter(r => r.to_number === rawNumber && r.status === 'failed');
    if (priorFailures.length > 0) {
      // Find latest failure
      let latestTime = 0;
      for (const failure of priorFailures) {
        if (failure.created_at) {
          const t = new Date(failure.created_at + 'Z').getTime();
          if (t > latestTime) latestTime = t;
        }
      }
      if (latestTime > 0 && (Date.now() - latestTime) < retryDelayMs) {
        return false;
      }
    }
    
    return true;
  });

  if (pendingContacts.length === 0) {
    // All contacts called or excluded
    console.log(`[CampaignWorker] Campaign #${campaign.id} "${campaign.name}" finished dialing all contacts.`);
    await run(
      "UPDATE campaigns SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      [campaign.id]
    );
    return;
  }

  // Get phone number details
  const isNumericPhone = /^\d+$/.test(String(campaign.phone_number_id));
  const cleanPhoneId = String(campaign.phone_number_id).replace(/^el_/, '');
  let phoneRow = isNumericPhone
    ? await get(
        'SELECT * FROM phone_numbers WHERE (id = ? OR elevenlabs_phone_number_id = ?) AND client_id = ?',
        [parseInt(campaign.phone_number_id), cleanPhoneId, campaign.client_id]
      )
    : await get(
        'SELECT * FROM phone_numbers WHERE (elevenlabs_phone_number_id = ? OR elevenlabs_phone_number_id = ?) AND client_id = ?',
        [cleanPhoneId, String(campaign.phone_number_id), campaign.client_id]
      );

  if (!phoneRow) {
    try {
      const allEl = await elevenlabs.getPhoneNumbers();
      const elMatch = (Array.isArray(allEl) ? allEl : []).find(
        n => (n.phone_number_id || n.id) === cleanPhoneId
      );
      if (elMatch) {
        phoneRow = {
          elevenlabs_phone_number_id: elMatch.phone_number_id || elMatch.id,
          phone_number: elMatch.phone_number || elMatch.number,
          provider: elMatch.provider || 'twilio',
        };
      }
    } catch {}
  }
  if (!phoneRow) {
    console.error(`[CampaignWorker] Phone number ${campaign.phone_number_id} not found for campaign ${campaign.id}`);
    return;
  }

  const provider = await getAgentProvider(campaign.client_id, campaign.agent_id);

  // Dial up to availableSlots contacts
  const batch = pendingContacts.slice(0, availableSlots);
  for (const contact of batch) {
    const targetNumber = contact.phone_e164 || contact.phone;
    const leadName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Valued Customer';

    const delays = [5000, 15000, 45000];
    let success = false;

    for (let attempt = 0; attempt <= 3; attempt++) {
      if (isShuttingDown) break;
      
      try {
        let conversationId = null;

        if (provider === 'elevenlabs') {
          const callPayload = {
            agent_id: campaign.agent_id,
            agent_phone_number_id: phoneRow.elevenlabs_phone_number_id,
            to_number: targetNumber,
            conversation_initiation_client_data: {
              dynamic_variables: {
                lead_name: contact.first_name || leadName,
                LEAD_NAME: contact.first_name || leadName,
              },
            },
          };
          const elRes = await elevenlabs.makeOutboundCall(phoneRow.provider || 'twilio', callPayload);
          conversationId = elRes?.conversation_id || elRes?.id || `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        } else if (provider === 'vapi') {
          // If phone is an ElevenLabs phone, Vapi cannot dial out with it
          if (phoneRow.elevenlabs_phone_number_id && !phoneRow.provider_id) {
            throw new Error(`Agent is managed by Vapi, but phone line ${phoneRow.phone_number} is hosted on ElevenLabs. Please assign an ElevenLabs agent to this campaign.`);
          }
          const vapiRes = await vapi.createCall({
            assistantId: campaign.agent_id,
            phoneNumberId: phoneRow.provider_id || undefined,
            customerNumber: targetNumber,
            customer: {
              number: targetNumber,
              name: leadName,
            },
          });
          conversationId = vapiRes?.id || `vapi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        } else {
          // Fallback or Gemini
          conversationId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        }

        // Record call history with campaign_id
        await run(
          `INSERT INTO call_history (
            client_id, campaign_id, agent_id, conversation_id, to_number, lead_name, status, started_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'initiated', datetime('now'), datetime('now'))`,
          [campaign.client_id, String(campaign.id), campaign.agent_id, conversationId, targetNumber, leadName]
        );

        // Increment campaign completed calls
        await run(
          `UPDATE campaigns 
           SET calls_completed = calls_completed + 1, updated_at = datetime('now') 
           WHERE id = ?`,
          [campaign.id]
        );

        console.log(`[CampaignWorker] Successfully dialed ${targetNumber} for campaign #${campaign.id} (${leadName})`);
        success = true;
        break; // exit retry loop on success
      } catch (err) {
        console.error(`[CampaignWorker] Call failure for ${targetNumber} in campaign #${campaign.id} (Attempt ${attempt + 1}):`, err.message || err);
        if (err.message && err.message.includes('hosted on ElevenLabs')) {
          break; // Don't retry incompatible provider
        }
        if (attempt < 3) {
          console.log(`[CampaignWorker] Waiting ${delays[attempt]}ms before retrying...`);
          await sleep(delays[attempt]);
        }
      }
    }

    if (!success) {
      console.error(`[CampaignWorker] All retries failed for ${targetNumber} in campaign #${campaign.id}.`);
      await run(
        `UPDATE campaigns 
         SET calls_failed = calls_failed + 1, updated_at = datetime('now') 
         WHERE id = ?`,
        [campaign.id]
      );
      // Mark contact as failed in call_history
      try {
        await run(
          `INSERT INTO call_history (
            client_id, campaign_id, agent_id, conversation_id, to_number, lead_name, status, started_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'failed', datetime('now'), datetime('now'))`,
          [campaign.client_id, String(campaign.id), campaign.agent_id, `fail_${Date.now()}`, targetNumber, leadName]
        );
      } catch(e) {}
    }
  }
}

async function detectStuckCampaigns() {
  try {
    const stuck = await all("SELECT id, name, updated_at FROM campaigns WHERE status = 'running' AND updated_at < datetime('now', '-30 minutes')");
    for (const c of (stuck || [])) {
      console.warn(`[CampaignWorker] Warning: Campaign #${c.id} "${c.name}" appears stuck (no activity since ${c.updated_at}).`);
      const updatedAt = new Date(c.updated_at + 'Z');
      if (Date.now() - updatedAt.getTime() > 2 * 60 * 60 * 1000) {
        console.warn(`[CampaignWorker] Auto-pausing stuck campaign #${c.id}`);
        await run("UPDATE campaigns SET status = 'paused', updated_at = datetime('now') WHERE id = ?", [c.id]);
      }
    }
  } catch (err) {
    console.error('[CampaignWorker] Error detecting stuck campaigns:', err);
  }
}

/**
 * Main worker tick
 */
async function tick() {
  if (isProcessing || isShuttingDown) return;
  lastTickTime = new Date().toISOString();
  isProcessing = true;

  try {
    await detectStuckCampaigns();
    const runningCampaigns = await all("SELECT * FROM campaigns WHERE status = 'running'");
    if (runningCampaigns && runningCampaigns.length > 0) {
      for (const campaign of runningCampaigns) {
        await processCampaign(campaign);
      }
    }
  } catch (err) {
    console.error('[CampaignWorker] Tick error:', err.message || err);
    errorCount++;
  } finally {
    processedCount++;
    isProcessing = false;
  }
}

/**
 * Start the background campaign worker
 */
function start(intervalMs = 10000) {
  if (intervalId) return;
  console.log(`[CampaignWorker] Starting automated campaign dialing worker (interval: ${intervalMs}ms)`);
  // Run first tick after small delay
  setTimeout(tick, 2000);
  intervalId = setInterval(tick, intervalMs);
}

/**
 * Stop the worker
 */
function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[CampaignWorker] Stopped campaign dialing worker');
  }
}

async function gracefulShutdown() {
  console.log('[CampaignWorker] Initiating graceful shutdown...');
  isShuttingDown = true;
  
  // Wait up to 30s for current processing to finish
  const startWait = Date.now();
  while (isProcessing && Date.now() - startWait < 30000) {
    await sleep(1000);
  }
  
  stop();
  console.log('[CampaignWorker] Graceful shutdown complete.');
}

function getStats() {
  return {
    isProcessing,
    lastTickTime,
    processedCount,
    errorCount
  };
}

module.exports = {
  start,
  stop,
  tick,
  gracefulShutdown,
  getStats,
};
