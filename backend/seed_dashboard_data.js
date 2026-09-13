/**
 * Seed realistic mock/demo data for Dialix Dashboard Visual Inspection
 */
const { initDb, run, all, get } = require('./db');

async function seed() {
  await initDb();

  console.log('Seeding dashboard demo data...');

  // 1. Ensure Client 1 (Admin) exists
  const admin = await get('SELECT id FROM clients WHERE id = 1');
  if (!admin) {
    console.error('Client 1 not found! Please run initDb first.');
    return;
  }

  // 2. Gemini Agent: agent_001
  await run(`
    INSERT OR REPLACE INTO gemini_agents (
      agent_id, name, system_prompt, voice, model, temperature, language, max_duration_seconds,
      first_message, thinking_level, media_resolution, max_context_size, target_context_size,
      grounding_google_search, affective_dialog, proactive_audio
    ) VALUES (
      'agent_001',
      'Sophia — Senior Inbound Specialist',
      'You are Sophia, an expert AI customer support representative for Dialix. Assist callers with product information, billing inquiries, and scheduling appointments.',
      'Kore',
      'models/gemini-3.1-flash-live-preview',
      0.7,
      'en',
      600,
      'Hello! Thank you for calling Dialix. How can I assist you with your voice AI deployment today?',
      'none',
      'medium',
      128000,
      64000,
      0,
      0,
      0
    )
  `);

  // 3. Client Agent assignment
  await run(`
    INSERT OR REPLACE INTO client_agents (
      client_id, agent_id, agent_name, can_edit, allowed_features, provider
    ) VALUES (
      1, 'agent_001', 'Sophia — Senior Inbound Specialist', 1, '{"edit_prompt":true,"edit_voice":true,"knowledge_base":true,"tools":true}', 'gemini'
    )
  `);

  // 4. Agent Tools
  await run(`DELETE FROM agent_tools WHERE agent_id = 'agent_001'`);
  await run(`
    INSERT INTO agent_tools (client_id, agent_id, provider, tool_name, tool_type, description, parameters, endpoint_url, is_enabled)
    VALUES
      (1, 'agent_001', 'gemini', 'transfer_to_support', 'transfer_call', 'Transfer caller to live escalation specialist', '{"phone_number":"+18005550199"}', '+18005550199', 1),
      (1, 'agent_001', 'gemini', 'crm_note_sync', 'webhook', 'Dispatch call summary notes to Salesforce CRM', '{"event":"call.ended"}', 'https://api.dialix.ai/v1/integrations/crm-sync', 1)
  `);

  // 5. Agent Knowledge
  await run(`DELETE FROM agent_knowledge WHERE agent_id = 'agent_001'`);
  await run(`
    INSERT INTO agent_knowledge (client_id, agent_id, provider, file_name, file_type, file_size, url, status)
    VALUES
      (1, 'agent_001', 'gemini', 'Dialix_Enterprise_Product_Spec_v2.pdf', 'pdf', 1420500, NULL, 'indexed'),
      (1, 'agent_001', 'gemini', 'Customer_Service_FAQ_and_Escalation.docx', 'docx', 345000, NULL, 'indexed'),
      (1, 'agent_001', 'gemini', 'https://docs.dialix.ai/enterprise-sla', 'url', 0, 'https://docs.dialix.ai/enterprise-sla', 'indexed')
  `);

  // 6. Phone Numbers
  await run(`DELETE FROM phone_numbers WHERE client_id = 1`);
  await run(`
    INSERT INTO phone_numbers (client_id, elevenlabs_phone_number_id, phone_number, label, provider, assigned_agent_id)
    VALUES
      (1, 'pn_us_west_01', '+1 (415) 890-2144', 'San Francisco HQ Toll-Free', 'twilio', 'agent_001'),
      (1, 'pn_us_east_02', '+1 (650) 441-9022', 'Inbound Support Hotline', 'twilio', 'agent_001')
  `);

  // 7. Contacts
  await run(`DELETE FROM contacts WHERE client_id = 1`);
  await run(`
    INSERT INTO contacts (client_id, first_name, last_name, company, phone, phone_e164, email, status, tags, consent_status)
    VALUES
      (1, 'Sarah', 'Connor', 'Cyberdyne Systems', '+1 (415) 555-0142', '+14155550142', 'sarah@cyberdyne.io', 'active', '["vip","enterprise"]', 'granted'),
      (1, 'Alexander', 'Vance', 'Black Mesa Research', '+1 (505) 555-0199', '+15055550199', 'alex@blackmesa.gov', 'active', '["prospect","pilot"]', 'granted'),
      (1, 'Elena', 'Rostova', 'Aether Dynamics', '+1 (212) 555-0187', '+12125550187', 'elena@aether.tech', 'active', '["customer","tier1"]', 'granted'),
      (1, 'Marcus', 'Brody', 'Marshall College', '+1 (312) 555-0123', '+13125550123', 'mbrody@marshall.edu', 'active', '["partner"]', 'granted')
  `);

  // 8. Campaigns
  await run(`DELETE FROM campaigns WHERE client_id = 1`);
  await run(`
    INSERT INTO campaigns (client_id, name, description, agent_id, status, total_contacts, calls_completed, calls_answered, schedule_start, goal)
    VALUES
      (1, 'Enterprise Q3 Inbound Activation', 'Targeted outbound outreach for tier-1 qualified enterprise trial users', 'agent_001', 'running', 250, 142, 118, '2026-09-01 09:00:00', 'Trial Conversion'),
      (1, 'Global AI Product Launch Follow-up', 'Automated feedback collection and scheduling for recent beta testers', 'agent_001', 'scheduled', 500, 0, 0, '2026-09-20 10:00:00', 'Customer Feedback')
  `);

  // 9. Call History & Metrics
  await run(`DELETE FROM call_metrics WHERE conversation_id IN (SELECT conversation_id FROM call_history WHERE client_id = 1)`);
  await run(`DELETE FROM call_history WHERE client_id = 1`);

  const calls = [
    { id: 'conv_001', to: '+1 (415) 555-0142', name: 'Sarah Connor', status: 'completed', duration: 185, quality: 96, sentiment: 'positive' },
    { id: 'conv_002', to: '+1 (505) 555-0199', name: 'Alexander Vance', status: 'completed', duration: 240, quality: 98, sentiment: 'positive' },
    { id: 'conv_003', to: '+1 (212) 555-0187', name: 'Elena Rostova', status: 'completed', duration: 92, quality: 88, sentiment: 'neutral' },
    { id: 'conv_004', to: '+1 (312) 555-0123', name: 'Marcus Brody', status: 'voicemail', duration: 28, quality: 72, sentiment: 'neutral' },
    { id: 'conv_005', to: '+1 (617) 555-0111', name: 'Arthur Pendelton', status: 'completed', duration: 154, quality: 91, sentiment: 'positive' }
  ];

  for (const c of calls) {
    await run(`
      INSERT INTO call_history (client_id, agent_id, conversation_id, to_number, lead_name, status, duration, success, quality_score, started_at)
      VALUES (1, 'agent_001', ?, ?, ?, ?, ?, 1, ?, datetime('now', '-2 hours'))
    `, [c.id, c.to, c.name, c.status, c.duration, c.quality]);

    await run(`
      INSERT INTO call_metrics (conversation_id, status, duration, mq_quality, fq_quality, transcript)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      c.id,
      c.status,
      c.duration,
      c.quality / 100,
      c.quality / 100,
      `Agent: Hello! Thank you for calling Dialix. How may I help you?\nCaller: Hi Sophia, I had a question about our enterprise voice pipeline SLA.\nAgent: I would be glad to help! Our enterprise tier offers a 99.99% uptime guarantee with sub-200ms audio streaming latency.\nCaller: Perfect, that is exactly what we needed to confirm. Thank you!`
    ]);
  }

  // 10. Webhook Subscriptions
  await run(`DELETE FROM webhook_subscriptions WHERE client_id = 1`);
  await run(`
    INSERT INTO webhook_subscriptions (client_id, event, url, secret)
    VALUES
      (1, 'call.completed', 'https://hooks.dialix.ai/events/call-completed', 'whsec_live_9a8b7c6d5e'),
      (1, 'agent.transfer', 'https://hooks.dialix.ai/events/support-transfer', 'whsec_live_1a2b3c4d5e')
  `);

  // 11. API Keys
  await run(`DELETE FROM api_keys WHERE client_id = 1`);
  await run(`
    INSERT INTO api_keys (client_id, name, key_hash, key_prefix, scopes, created_at)
    VALUES
      (1, 'Production Webhook Engine', 'hash_mock_prod_key_123', 'dlx_live_948f', '["calls:read","calls:write","agents:read"]', datetime('now', '-5 days')),
      (1, 'CRM Integration Token', 'hash_mock_crm_key_456', 'dlx_crm_83b2', '["contacts:read","contacts:write"]', datetime('now', '-12 days'))
  `);

  // 12. Team Members
  await run(`DELETE FROM team_members WHERE client_id = 1`);
  await run(`
    INSERT INTO team_members (client_id, email, name, role)
    VALUES
      (1, 'david@dialix.ai', 'David Kross', 'admin'),
      (1, 'rachel@dialix.ai', 'Rachel Torres', 'manager')
  `);

  // 13. Audit Logs
  await run(`DELETE FROM audit_logs WHERE client_id = 1`);
  await run(`
    INSERT INTO audit_logs (client_id, actor_email, action, resource_type, resource_id, details)
    VALUES
      (1, 'admin@dialix.ai', 'agent.update', 'agent', 'agent_001', '{"field":"system_prompt","change":"updated SLA prompt guidelines"}'),
      (1, 'admin@dialix.ai', 'campaign.start', 'campaign', '1', '{"campaign_name":"Enterprise Q3 Inbound Activation"}'),
      (1, 'admin@dialix.ai', 'apikey.create', 'api_key', '1', '{"name":"Production Webhook Engine"}')
  `);

  console.log('✓ Seeding completed successfully!');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
