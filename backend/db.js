const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// On Fly.io, store the DB on the persistent volume at /data/
// Locally, keep it in the project directory
const DB_PATH = process.env.FLY_APP_NAME
  ? '/data/dialix.db'
  : path.join(__dirname, 'dialix.db');
const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';

let db = null;
let pool = null;

const CONFLICT_KEYS = {
  call_metrics: ['conversation_id'],
  client_agents: ['client_id', 'agent_id'],
  agent_settings: ['agent_id'],
  gemini_agents: ['agent_id'],
  usage_records: ['client_id', 'period'],
  team_members: ['client_id', 'email'],
  dnc_list: ['client_id', 'phone_e164'],
  pricing_plans: ['slug'],
  clients: ['email'],
  phone_numbers: ['elevenlabs_phone_number_id'],
  subscriptions: ['paypal_subscription_id'],
  payments: ['paypal_payment_id'],
  payment_webhook_events: ['external_event_id'],
  team_invitations: ['token'],
};

function mapQuery(sql, params = []) {
  let index = 0;
  let text = sql.replace(/\?/g, () => `$${++index}`);

  // PostgreSQL compatibility: convert SQLite datetime expressions to PostgreSQL syntax
  text = text.replace(/datetime\(\s*['"]now['"]\s*,\s*['"]start of month['"]\s*\)/gi, "date_trunc('month', NOW())");
  text = text.replace(/datetime\(\s*['"]now['"]\s*,\s*['"]-([0-9]+)\s*hours?['"]\s*\)/gi, "NOW() - INTERVAL '$1 hours'");
  text = text.replace(/datetime\(\s*['"]now['"]\s*,\s*['"]\+?([0-9]+)\s*hours?['"]\s*\)/gi, "NOW() + INTERVAL '$1 hours'");
  text = text.replace(/datetime\(\s*['"]now['"]\s*,\s*['"]-([0-9]+)\s*days?['"]\s*\)/gi, "NOW() - INTERVAL '$1 days'");
  text = text.replace(/datetime\(\s*['"]now['"]\s*,\s*['"]\+?([0-9]+)\s*days?['"]\s*\)/gi, "NOW() + INTERVAL '$1 days'");
  text = text.replace(/datetime\(\s*['"]now['"]\s*,\s*['"]-([0-9]+)\s*minutes?['"]\s*\)/gi, "NOW() - INTERVAL '$1 minutes'");
  text = text.replace(/datetime\(\s*['"]now['"]\s*,\s*['"]\+?([0-9]+)\s*minutes?['"]\s*\)/gi, "NOW() + INTERVAL '$1 minutes'");
  text = text.replace(/datetime\(\s*['"]now['"]\s*\)/gi, 'NOW()');

  // Handle SQLite INSERT OR IGNORE -> PostgreSQL ON CONFLICT DO NOTHING
  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(text)) {
    text = text.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(text)) {
      if (/RETURNING\s/i.test(text)) {
        text = text.replace(/(\s+RETURNING\s+.*)$/i, ' ON CONFLICT DO NOTHING$1');
      } else {
        text = text.trim() + ' ON CONFLICT DO NOTHING';
      }
    }
  }

  // Handle SQLite INSERT OR REPLACE -> PostgreSQL ON CONFLICT ... DO UPDATE
  if (/INSERT\s+OR\s+REPLACE\s+INTO/i.test(text)) {
    const replaceRegex = /INSERT\s+OR\s+REPLACE\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*VALUES/i;
    const match = text.match(replaceRegex);
    text = text.replace(/INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO');

    if (match && !/ON\s+CONFLICT/i.test(text)) {
      const tableName = match[1].toLowerCase();
      const rawCols = match[2].split(',').map(c => c.trim().replace(/["`]/g, ''));
      const conflictTarget = CONFLICT_KEYS[tableName] || (rawCols[0] && rawCols[0].endsWith('_id') ? [rawCols[0]] : null);

      if (conflictTarget && conflictTarget.length > 0) {
        const updateCols = rawCols.filter(c => !conflictTarget.includes(c));
        if (updateCols.length > 0) {
          let updateSet = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');
          if (['call_metrics', 'agent_settings', 'gemini_agents', 'pricing_plans', 'campaigns', 'usage_records'].includes(tableName) && !rawCols.includes('updated_at')) {
            updateSet += ', updated_at = NOW()';
          }
          const conflictClause = ` ON CONFLICT (${conflictTarget.join(', ')}) DO UPDATE SET ${updateSet}`;
          if (/RETURNING\s/i.test(text)) {
            text = text.replace(/(\s+RETURNING\s+.*)$/i, `${conflictClause}$1`);
          } else {
            text = text.trim() + conflictClause;
          }
        } else {
          const conflictClause = ` ON CONFLICT (${conflictTarget.join(', ')}) DO NOTHING`;
          if (/RETURNING\s/i.test(text)) {
            text = text.replace(/(\s+RETURNING\s+.*)$/i, `${conflictClause}$1`);
          } else {
            text = text.trim() + conflictClause;
          }
        }
      } else {
        if (/RETURNING\s/i.test(text)) {
          text = text.replace(/(\s+RETURNING\s+.*)$/i, ' ON CONFLICT DO NOTHING$1');
        } else {
          text = text.trim() + ' ON CONFLICT DO NOTHING';
        }
      }
    } else if (!/ON\s+CONFLICT/i.test(text)) {
      if (/RETURNING\s/i.test(text)) {
        text = text.replace(/(\s+RETURNING\s+.*)$/i, ' ON CONFLICT DO NOTHING$1');
      } else {
        text = text.trim() + ' ON CONFLICT DO NOTHING';
      }
    }
  }

  return { text, values: params };
}


async function pgAll(sql, params = []) {
  const { text, values } = mapQuery(sql, params);
  const result = await pool.query(text, values);
  return result.rows;
}

async function pgGet(sql, params = []) {
  const rows = await pgAll(sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

async function pgRun(sql, params = []) {
  let { text, values } = mapQuery(sql, params);
  
  // For INSERT statements, add RETURNING clause to get the inserted row identifier
  // (only if not already present to avoid double RETURNING)
  if (text.trim().toUpperCase().startsWith('INSERT') && !/RETURNING\s/i.test(text)) {
    const tableMatch = text.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+([a-zA-Z0-9_]+)/i);
    const table = tableMatch ? tableMatch[1].toLowerCase() : '';
    if (['gemini_agents', 'agent_settings'].includes(table)) {
      text += ' RETURNING agent_id';
    } else {
      text += ' RETURNING id';
    }
  }
  
  const result = await pool.query(text, values);
  return {
    changes: result.rowCount,
    lastInsertRowid: result.rows[0]?.id || result.rows[0]?.agent_id || 0,
  };
}

let persistTimer = null;

function persist() {
  // Debounce: coalesce rapid writes into a single async flush (100ms)
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (db) {
      try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
      } catch (err) {
        console.error('[DB] persist() failed:', err.message);
      }
    }
  }, 100);
}

// Synchronous persist for init/seed — only used during startup
function persistSync() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function initSqliteDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      must_change_password INTEGER DEFAULT 0,
      email_verified BOOLEAN DEFAULT FALSE,
      verification_token TEXT,
      verification_token_expires TIMESTAMP,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS client_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      can_edit INTEGER DEFAULT 1,
      allowed_features TEXT DEFAULT NULL,
      UNIQUE(client_id, agent_id)
    )
  `);

  try {
    db.run('ALTER TABLE client_agents ADD COLUMN can_edit INTEGER DEFAULT 1');
    persistSync();
    console.log('✓ Migrated: added can_edit column to client_agents');
  } catch (e) {}

  try {
    db.run('ALTER TABLE client_agents ADD COLUMN allowed_features TEXT DEFAULT NULL');
    persistSync();
    console.log('✓ Migrated: added allowed_features column to client_agents');
  } catch (e) {}

  // Vapi provider support: track which provider each agent uses
  try {
    db.run("ALTER TABLE client_agents ADD COLUMN provider TEXT DEFAULT 'elevenlabs'");
    persistSync();
    console.log('✓ Migrated: added provider column to client_agents');
  } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS phone_numbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      elevenlabs_phone_number_id TEXT UNIQUE NOT NULL,
      phone_number TEXT NOT NULL,
      label TEXT NOT NULL,
      provider TEXT NOT NULL,
      assigned_agent_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  try {
    db.run('ALTER TABLE clients ADD COLUMN must_change_password INTEGER DEFAULT 0');
    persistSync();
    console.log('✓ Migrated: added must_change_password column to clients');
  } catch (e) {}

  try {
    db.run('ALTER TABLE clients ADD COLUMN is_active BOOLEAN DEFAULT TRUE');
    persistSync();
    console.log('✓ Migrated: added is_active column to clients');
  } catch (e) {}

  try {
    db.run('ALTER TABLE clients ADD COLUMN updated_at TEXT');
    db.run("UPDATE clients SET updated_at = datetime('now') WHERE updated_at IS NULL");
    persistSync();
    console.log('✓ Migrated: added updated_at column to clients');
  } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS agent_settings (
      agent_id TEXT PRIMARY KEY,
      expressive_mode INTEGER DEFAULT 1,
      suggested_audio_tags TEXT DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── agent_settings migrations ──
  try { db.run("ALTER TABLE agent_settings ADD COLUMN status TEXT DEFAULT 'active'"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE agent_settings ADD COLUMN tts_model_id TEXT"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE agent_settings ADD COLUMN stability REAL DEFAULT 0.5"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE agent_settings ADD COLUMN similarity_boost REAL DEFAULT 0.75"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE agent_settings ADD COLUMN speed REAL DEFAULT 1.0"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE agent_settings ADD COLUMN streaming_latency INTEGER DEFAULT 3"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE agent_settings ADD COLUMN max_call_duration_seconds INTEGER DEFAULT 1800"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE agent_settings ADD COLUMN silence_timeout_seconds INTEGER DEFAULT 30"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE agent_settings ADD COLUMN interruption_handling TEXT DEFAULT 'allow'"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE agent_settings ADD COLUMN compliance_disclosure TEXT"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE agent_settings ADD COLUMN voicemail_behavior TEXT DEFAULT 'hangup'"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE agent_settings ADD COLUMN fallback_message TEXT"); persistSync(); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      event TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT,
      status TEXT DEFAULT 'pending',
      http_status INTEGER,
      response_body TEXT,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      next_retry_at TEXT,
      error_message TEXT,
      latency_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      delivered_at TEXT,
      FOREIGN KEY (webhook_id) REFERENCES webhook_subscriptions(id)
    )
  `);

  // Call tracking tables for real-time monitoring and analytics
  db.run(`
    CREATE TABLE IF NOT EXISTS call_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      campaign_id TEXT,
      agent_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL UNIQUE,
      to_number TEXT NOT NULL,
      lead_name TEXT,
      status TEXT DEFAULT 'initiated',
      duration INTEGER DEFAULT 0,
      success INTEGER DEFAULT 0,
      error_message TEXT,
      quality_score REAL,
      summary TEXT,
      sentiment TEXT,
      outcome TEXT,
      qualification_score INTEGER,
      key_topics TEXT,
      analyzed_at TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  try {
    db.run('ALTER TABLE call_history ADD COLUMN campaign_id TEXT');
    persistSync();
    console.log('✓ Migrated: added campaign_id column to call_history');
  } catch (e) {}

  // ── call_history migrations for inbound + detail tracking + analysis ──
  try { db.run("ALTER TABLE call_history ADD COLUMN direction TEXT DEFAULT 'outbound'"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE call_history ADD COLUMN from_number TEXT"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE call_history ADD COLUMN end_reason TEXT"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE call_history ADD COLUMN recording_url TEXT"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE call_history ADD COLUMN cost REAL"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE call_history ADD COLUMN transcript TEXT"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE call_history ADD COLUMN updated_at TEXT"); persistSync(); } catch (e) {}
  
  try { db.run("ALTER TABLE call_history ADD COLUMN summary TEXT"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE call_history ADD COLUMN sentiment TEXT"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE call_history ADD COLUMN outcome TEXT"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE call_history ADD COLUMN qualification_score INTEGER"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE call_history ADD COLUMN key_topics TEXT"); persistSync(); } catch (e) {}
  try { db.run("ALTER TABLE call_history ADD COLUMN analyzed_at TEXT"); persistSync(); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS call_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL UNIQUE REFERENCES call_history(conversation_id),
      status TEXT,
      duration INTEGER DEFAULT 0,
      mq_quality REAL,
      fq_quality REAL,
      transcript TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Pricing Plans ──────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS pricing_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      billing_period TEXT NOT NULL DEFAULT 'monthly',
      max_agents INTEGER DEFAULT -1,
      max_calls_per_month INTEGER DEFAULT -1,
      max_phone_numbers INTEGER DEFAULT -1,
      features TEXT DEFAULT '{}',
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add plan_id column to clients
  try {
    db.run('ALTER TABLE clients ADD COLUMN plan_id INTEGER DEFAULT NULL REFERENCES pricing_plans(id)');
    persistSync();
    console.log('✓ Migrated: added plan_id column to clients');
  } catch (e) {}

  // Seed default pricing plans if none exist
  const existingPlans = db.exec('SELECT COUNT(*) FROM pricing_plans');
  const planCount = existingPlans[0]?.values[0]?.[0] || 0;
  if (planCount === 0) {
    db.run(`INSERT INTO pricing_plans (name, slug, price, billing_period, max_agents, max_calls_per_month, max_phone_numbers, features, is_default, sort_order)
      VALUES ('Starter', 'starter', 0, 'monthly', 1, 100, 1, '{"dashboard":true,"basic_analytics":true}', 1, 0)`);
    db.run(`INSERT INTO pricing_plans (name, slug, price, billing_period, max_agents, max_calls_per_month, max_phone_numbers, features, sort_order)
      VALUES ('Professional', 'professional', 49, 'monthly', 5, 1000, 5, '{"dashboard":true,"basic_analytics":true,"advanced_analytics":true,"webhooks":true,"call_recording":true}', 1)`);
    db.run(`INSERT INTO pricing_plans (name, slug, price, billing_period, max_agents, max_calls_per_month, max_phone_numbers, features, sort_order)
      VALUES ('Business', 'business', 149, 'monthly', 20, 5000, 20, '{"dashboard":true,"basic_analytics":true,"advanced_analytics":true,"webhooks":true,"call_recording":true,"priority_support":true,"api_access":true}', 2)`);
    db.run(`INSERT INTO pricing_plans (name, slug, price, billing_period, max_agents, max_calls_per_month, max_phone_numbers, features, sort_order)
      VALUES ('Enterprise', 'enterprise', 499, 'monthly', -1, -1, -1, '{"dashboard":true,"basic_analytics":true,"advanced_analytics":true,"webhooks":true,"call_recording":true,"priority_support":true,"api_access":true,"custom_integrations":true,"sla":true}', 3)`);
    persistSync();
    console.log('✓ Seeded default pricing plans');
  }

  // ─── Gemini Agents (local config storage) ────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS gemini_agents (
      agent_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_prompt TEXT DEFAULT 'You are a helpful AI assistant.',
      voice TEXT DEFAULT 'Kore',
      model TEXT DEFAULT 'models/gemini-2.5-flash-native-audio-latest',
      temperature REAL DEFAULT 1.0,
      language TEXT DEFAULT 'en',
      max_duration_seconds INTEGER DEFAULT 600,
      first_message TEXT DEFAULT '',
      thinking_level TEXT DEFAULT 'none',
      media_resolution TEXT DEFAULT 'medium',
      max_context_size INTEGER DEFAULT 128000,
      target_context_size INTEGER DEFAULT 64000,
      grounding_google_search INTEGER DEFAULT 0,
      affective_dialog INTEGER DEFAULT 0,
      proactive_audio INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  // Migrate existing gemini_agents tables missing new columns
  const geminiNewCols = [
    ["client_id", "INTEGER"],
    ["thinking_level", "TEXT DEFAULT 'none'"],
    ["media_resolution", "TEXT DEFAULT 'medium'"],
    ["max_context_size", "INTEGER DEFAULT 128000"],
    ["target_context_size", "INTEGER DEFAULT 64000"],
    ["grounding_google_search", "INTEGER DEFAULT 0"],
    ["affective_dialog", "INTEGER DEFAULT 0"],
    ["proactive_audio", "INTEGER DEFAULT 0"],
  ];
  for (const [col, def] of geminiNewCols) {
    try { db.run(`ALTER TABLE gemini_agents ADD COLUMN ${col} ${def}`); } catch {}
  }

  // ─── Contacts ──────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      first_name TEXT NOT NULL,
      last_name TEXT,
      company TEXT,
      phone TEXT NOT NULL,
      phone_e164 TEXT,
      email TEXT,
      language TEXT DEFAULT 'en',
      country TEXT,
      timezone TEXT,
      tags TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      consent_status TEXT DEFAULT 'unknown',
      consent_source TEXT,
      consent_at TEXT,
      do_not_call INTEGER DEFAULT 0,
      dnc_reason TEXT,
      dnc_at TEXT,
      custom_fields TEXT DEFAULT '{}',
      last_called_at TEXT,
      next_callback_at TEXT,
      source TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── DNC (Do Not Call) Suppression List ──────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS dnc_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      phone_e164 TEXT NOT NULL,
      scope TEXT DEFAULT 'organization',
      reason TEXT,
      source TEXT DEFAULT 'manual',
      actor TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(client_id, phone_e164)
    )
  `);

  // ─── Campaigns ──────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL,
      description TEXT,
      agent_id TEXT,
      phone_number_id INTEGER REFERENCES phone_numbers(id),
      status TEXT DEFAULT 'draft',
      contact_list TEXT DEFAULT '[]',
      total_contacts INTEGER DEFAULT 0,
      valid_contacts INTEGER DEFAULT 0,
      dnc_excluded INTEGER DEFAULT 0,
      calls_completed INTEGER DEFAULT 0,
      calls_answered INTEGER DEFAULT 0,
      calls_failed INTEGER DEFAULT 0,
      schedule_start TEXT,
      schedule_end TEXT,
      calling_days TEXT DEFAULT '["mon","tue","wed","thu","fri"]',
      calling_start_time TEXT DEFAULT '09:00',
      calling_end_time TEXT DEFAULT '18:00',
      calling_timezone TEXT DEFAULT 'UTC',
      max_concurrent INTEGER DEFAULT 1,
      max_calls_per_hour INTEGER DEFAULT 60,
      max_retries INTEGER DEFAULT 2,
      retry_delay_minutes INTEGER DEFAULT 60,
      goal TEXT,
      estimated_cost REAL,
      actual_cost REAL DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      cancelled_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Subscriptions ──────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      plan_id INTEGER REFERENCES pricing_plans(id),
      paypal_subscription_id TEXT UNIQUE,
      status TEXT DEFAULT 'pending',
      started_at TEXT,
      current_period_end TEXT,
      cancelled_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Payments ────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      subscription_id INTEGER REFERENCES subscriptions(id),
      paypal_payment_id TEXT UNIQUE,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'paypal',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Payment Webhook Events (idempotency) ────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS payment_webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT DEFAULT 'paypal',
      external_event_id TEXT UNIQUE,
      event_type TEXT NOT NULL,
      status TEXT DEFAULT 'received',
      payload TEXT,
      processed_at TEXT,
      error TEXT,
      attempt_count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Audit Logs ──────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id),
      actor_email TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      details TEXT DEFAULT '{}',
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── API Keys ────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      scopes TEXT DEFAULT '[]',
      last_used_at TEXT,
      expires_at TEXT,
      revoked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Usage Tracking ──────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS usage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      period TEXT NOT NULL,
      call_count INTEGER DEFAULT 0,
      connected_minutes REAL DEFAULT 0,
      total_duration_seconds INTEGER DEFAULT 0,
      ai_cost REAL DEFAULT 0,
      telephony_cost REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(client_id, period)
    )
  `);

  // ─── System Error Logs (Real-time error telemetry & bug tracking) ─
  db.run(`
    CREATE TABLE IF NOT EXISTS system_error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id),
      error_message TEXT NOT NULL,
      stack_trace TEXT,
      component_name TEXT,
      url TEXT,
      user_agent TEXT,
      status TEXT DEFAULT 'unresolved',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Team Invitations & Members ─────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS team_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      token TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      email TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(client_id, email)
    )
  `);

  // ─── Agent Knowledge Base & Tools ───────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      agent_id TEXT NOT NULL,
      provider TEXT DEFAULT 'elevenlabs',
      external_file_id TEXT,
      file_name TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER DEFAULT 0,
      url TEXT,
      status TEXT DEFAULT 'ready',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS agent_tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      agent_id TEXT NOT NULL,
      provider TEXT DEFAULT 'elevenlabs',
      external_tool_id TEXT,
      tool_name TEXT NOT NULL,
      tool_type TEXT NOT NULL,
      description TEXT,
      parameters TEXT DEFAULT '{}',
      endpoint_url TEXT,
      is_enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Add new columns to existing tables ──────────────────────
  // Add paypal_plan_id to pricing_plans
  try {
    db.run('ALTER TABLE pricing_plans ADD COLUMN paypal_plan_id TEXT DEFAULT NULL');
    persistSync();
    console.log('✓ Migrated: added paypal_plan_id to pricing_plans');
  } catch (e) {}

  // Add email verification columns to clients
  try {
    db.run('ALTER TABLE clients ADD COLUMN email_verified INTEGER DEFAULT 0');
    persistSync();
    console.log('✓ Migrated: added email_verified to clients');
  } catch (e) {}

  try {
    db.run('ALTER TABLE clients ADD COLUMN verification_token TEXT DEFAULT NULL');
    persistSync();
    console.log('✓ Migrated: added verification_token to clients');
  } catch (e) {}

  try {
    db.run('ALTER TABLE clients ADD COLUMN reset_token TEXT DEFAULT NULL');
    persistSync();
    console.log('✓ Migrated: added reset_token to clients');
  } catch (e) {}

  try {
    db.run('ALTER TABLE clients ADD COLUMN reset_token_expires TEXT DEFAULT NULL');
    persistSync();
    console.log('✓ Migrated: added reset_token_expires to clients');
  } catch (e) {}

  // Performance indexes
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)');
    db.run('CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_client_agents_client_id ON client_agents(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_phone_numbers_client_id ON phone_numbers(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_phone_numbers_agent_id ON phone_numbers(assigned_agent_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_call_history_client_id ON call_history(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_call_history_campaign_id ON call_history(campaign_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_call_history_agent_id ON call_history(agent_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_call_history_conversation_id ON call_history(conversation_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_call_history_created_at ON call_history(created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_client_id ON webhook_subscriptions(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_event ON webhook_subscriptions(event)');
    db.run('CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_call_metrics_conversation_id ON call_metrics(conversation_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_gemini_agents_agent_id ON gemini_agents(agent_id)');
    // New table indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_contacts_client_id ON contacts(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_contacts_phone_e164 ON contacts(phone_e164)');
    db.run('CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_dnc_list_phone ON dnc_list(phone_e164)');
    db.run('CREATE INDEX IF NOT EXISTS idx_dnc_list_client ON dnc_list(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal ON subscriptions(paypal_subscription_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payments_paypal ON payments(paypal_payment_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_webhook_events_external ON payment_webhook_events(external_event_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_client_id ON audit_logs(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)');
    db.run('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_api_keys_client_id ON api_keys(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)');
    db.run('CREATE INDEX IF NOT EXISTS idx_usage_records_client ON usage_records(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_usage_records_period ON usage_records(period)');
    db.run('CREATE INDEX IF NOT EXISTS idx_error_logs_client ON system_error_logs(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_error_logs_status ON system_error_logs(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_team_invitations_client ON team_invitations(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token)');
    db.run('CREATE INDEX IF NOT EXISTS idx_team_members_client ON team_members(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email)');
    db.run('CREATE INDEX IF NOT EXISTS idx_agent_knowledge_agent ON agent_knowledge(agent_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_agent_knowledge_client ON agent_knowledge(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_agent_tools_agent ON agent_tools(agent_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_agent_tools_client ON agent_tools(client_id)');
    persistSync();
    console.log('✓ Database: Performance indexes created');
  } catch (e) {
    console.log('⚠ Database: Indexes may already exist');
  }
  // ─── Normalize existing emails to lowercase ─────────────────
  try {
    const rows = db.exec('SELECT id, email FROM clients');
    if (rows.length && rows[0].values.length) {
      let fixed = 0;
      for (const [id, email] of rows[0].values) {
        const lower = String(email).toLowerCase().trim();
        if (lower !== email) {
          db.run('UPDATE clients SET email = ? WHERE id = ?', [lower, id]);
          fixed++;
        }
      }
      if (fixed > 0) {
        persistSync();
        console.log(`✓ Migrated: normalized ${fixed} email(s) to lowercase`);
      }
    }
  } catch (e) {
    console.log('⚠ Email normalization migration skipped:', e.message);
  }

  // ─── Seed default admin account if none exists ─────────────────
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@dialix.ai';
  const adminPassword = process.env.ADMIN_PASSWORD || ('Dialix@2024!' + crypto.randomBytes(4).toString('hex'));
  const stmt = db.prepare('SELECT id FROM clients WHERE email = ?');
  stmt.bind([adminEmail]);
  const adminExists = stmt.step();
  stmt.free();
  if (!adminExists) {
    const hash = bcrypt.hashSync(adminPassword, 12);
    db.run(
      'INSERT INTO clients (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)',
      ['Admin', adminEmail, hash]
    );
    console.log(`✓ Seeded admin account: ${adminEmail}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`  ⚠ Generated password: ${adminPassword} — set ADMIN_PASSWORD env var to use your own`);
    }
  }

  persistSync();
}

async function initPostgresDb() {
  let config;

  // Supabase and most cloud providers give a single DATABASE_URL
  if (process.env.DATABASE_URL) {
    config = {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
  } else {
    // Fallback to individual PG_* env vars
    config = {
      host: process.env.PG_HOST || 'localhost',
      port: Number(process.env.PG_PORT || 5432),
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };
    if (!config.user || !config.password || !config.database) {
      throw new Error('Postgres configuration requires DATABASE_URL or PG_USER, PG_PASSWORD, and PG_DATABASE');
    }
  }

  pool = new Pool(config);
  await pool.query('SELECT 1');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      must_change_password INTEGER DEFAULT 0,
      email_verified BOOLEAN DEFAULT FALSE,
      verification_token TEXT,
      verification_token_expires TIMESTAMP,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_agents (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      can_edit INTEGER DEFAULT 1,
      allowed_features TEXT DEFAULT NULL,
      UNIQUE(client_id, agent_id)
    )
  `);

  await pool.query(`
    ALTER TABLE client_agents ADD COLUMN IF NOT EXISTS can_edit INTEGER DEFAULT 1
  `);
  await pool.query(`
    ALTER TABLE client_agents ADD COLUMN IF NOT EXISTS allowed_features TEXT DEFAULT NULL
  `);

  // Vapi provider support
  await pool.query(`
    ALTER TABLE client_agents ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'elevenlabs'
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS phone_numbers (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      elevenlabs_phone_number_id TEXT UNIQUE NOT NULL,
      phone_number TEXT NOT NULL,
      label TEXT NOT NULL,
      provider TEXT NOT NULL,
      assigned_agent_id TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS elevenlabs_phone_number_id TEXT
  `);
  await pool.query(`
    ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS assigned_agent_id TEXT
  `);

  await pool.query(`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
  `);
  await pool.query(`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  `);
  await pool.query(`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS must_change_password INTEGER DEFAULT 0
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_settings (
      agent_id TEXT PRIMARY KEY,
      expressive_mode INTEGER DEFAULT 1,
      suggested_audio_tags TEXT DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── agent_settings PG migrations ──
  await pool.query(`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`);
  await pool.query(`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS tts_model_id TEXT`);
  await pool.query(`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS stability REAL DEFAULT 0.5`);
  await pool.query(`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS similarity_boost REAL DEFAULT 0.75`);
  await pool.query(`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS speed REAL DEFAULT 1.0`);
  await pool.query(`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS streaming_latency INTEGER DEFAULT 3`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      event TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Call tracking tables for real-time monitoring and analytics
  await pool.query(`
    CREATE TABLE IF NOT EXISTS call_history (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      campaign_id TEXT,
      agent_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL UNIQUE,
      to_number TEXT NOT NULL,
      lead_name TEXT,
      status TEXT DEFAULT 'initiated',
      duration INTEGER DEFAULT 0,
      success INTEGER DEFAULT 0,
      error_message TEXT,
      quality_score REAL,
      started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE call_history ADD COLUMN IF NOT EXISTS campaign_id TEXT
  `);

  // ── call_history PG migrations for inbound + detail tracking ──
  await pool.query(`ALTER TABLE call_history ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound'`);
  await pool.query(`ALTER TABLE call_history ADD COLUMN IF NOT EXISTS from_number TEXT`);
  await pool.query(`ALTER TABLE call_history ADD COLUMN IF NOT EXISTS end_reason TEXT`);
  await pool.query(`ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_url TEXT`);
  await pool.query(`ALTER TABLE call_history ADD COLUMN IF NOT EXISTS cost REAL`);
  await pool.query(`ALTER TABLE call_history ADD COLUMN IF NOT EXISTS transcript TEXT`);
  await pool.query(`ALTER TABLE call_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS call_metrics (
      id SERIAL PRIMARY KEY,
      conversation_id TEXT NOT NULL UNIQUE REFERENCES call_history(conversation_id),
      status TEXT,
      duration INTEGER DEFAULT 0,
      mq_quality REAL,
      fq_quality REAL,
      transcript TEXT,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Pricing Plans ──────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pricing_plans (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      billing_period TEXT NOT NULL DEFAULT 'monthly',
      max_agents INTEGER DEFAULT -1,
      max_calls_per_month INTEGER DEFAULT -1,
      max_phone_numbers INTEGER DEFAULT -1,
      features TEXT DEFAULT '{}',
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_id INTEGER DEFAULT NULL REFERENCES pricing_plans(id)
  `);

  // ─── Seed default pricing plans if none exist (Postgres) ────────
  try {
    const existingPlans = await pool.query('SELECT COUNT(*) FROM pricing_plans');
    const planCount = parseInt(existingPlans.rows[0]?.count || '0', 10);
    if (planCount === 0) {
      await pool.query(`
        INSERT INTO pricing_plans (id, name, slug, price, billing_period, max_agents, max_calls_per_month, max_phone_numbers, features, is_default, is_active, sort_order)
        VALUES 
          (1, 'Free', 'free', 0, 'monthly', 1, 100, 1, '{"dashboard":true,"basic_analytics":true}', 1, 1, 0),
          (2, 'Starter', 'starter', 29, 'monthly', 3, 500, 2, '{"dashboard":true,"basic_analytics":true,"webhooks":true}', 0, 1, 1),
          (3, 'Growth', 'growth', 99, 'monthly', 10, 2500, 5, '{"dashboard":true,"basic_analytics":true,"advanced_analytics":true,"webhooks":true,"call_recording":true}', 0, 1, 2),
          (4, 'Enterprise', 'enterprise', 299, 'monthly', -1, -1, -1, '{"dashboard":true,"basic_analytics":true,"advanced_analytics":true,"webhooks":true,"call_recording":true,"priority_support":true,"api_access":true,"custom_integrations":true,"sla":true}', 0, 1, 3)
        ON CONFLICT (id) DO NOTHING
      `);
      await pool.query(`SELECT setval(pg_get_serial_sequence('pricing_plans', 'id'), (SELECT COALESCE(MAX(id), 1) FROM pricing_plans))`);
      console.log('✓ Seeded default pricing plans in Postgres');
    }
  } catch (err) {
    console.error('⚠ Failed to seed pricing plans in Postgres:', err.message);
  }

  // ─── Gemini Agents (local config storage) ────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gemini_agents (
      agent_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_prompt TEXT DEFAULT 'You are a helpful AI assistant.',
      voice TEXT DEFAULT 'Kore',
      model TEXT DEFAULT 'models/gemini-2.5-flash-native-audio-latest',
      temperature REAL DEFAULT 1.0,
      language TEXT DEFAULT 'en',
      max_duration_seconds INTEGER DEFAULT 600,
      first_message TEXT DEFAULT '',
      thinking_level TEXT DEFAULT 'none',
      media_resolution TEXT DEFAULT 'medium',
      max_context_size INTEGER DEFAULT 128000,
      target_context_size INTEGER DEFAULT 64000,
      grounding_google_search INTEGER DEFAULT 0,
      affective_dialog INTEGER DEFAULT 0,
      proactive_audio INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Migrate existing gemini_agents tables
  const pgGeminiCols = [
    ['client_id', 'INTEGER'],
    ['thinking_level', "TEXT DEFAULT 'none'"],
    ['media_resolution', "TEXT DEFAULT 'medium'"],
    ['max_context_size', 'INTEGER DEFAULT 128000'],
    ['target_context_size', 'INTEGER DEFAULT 64000'],
    ['grounding_google_search', 'INTEGER DEFAULT 0'],
    ['affective_dialog', 'INTEGER DEFAULT 0'],
    ['proactive_audio', 'INTEGER DEFAULT 0'],
  ];
  for (const [col, def] of pgGeminiCols) {
    try { await pool.query(`ALTER TABLE gemini_agents ADD COLUMN IF NOT EXISTS ${col} ${def}`); } catch {}
  }

  // ─── Contacts ──────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      first_name TEXT NOT NULL,
      last_name TEXT,
      company TEXT,
      phone TEXT NOT NULL,
      phone_e164 TEXT,
      email TEXT,
      language TEXT DEFAULT 'en',
      country TEXT,
      timezone TEXT,
      tags TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      consent_status TEXT DEFAULT 'unknown',
      consent_source TEXT,
      consent_at TIMESTAMPTZ,
      do_not_call INTEGER DEFAULT 0,
      dnc_reason TEXT,
      dnc_at TIMESTAMPTZ,
      custom_fields TEXT DEFAULT '{}',
      last_called_at TIMESTAMPTZ,
      next_callback_at TIMESTAMPTZ,
      source TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Contacts migrations
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en'`);
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS country TEXT`);
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS timezone TEXT`);
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS consent_status TEXT DEFAULT 'unknown'`);
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS consent_source TEXT`);
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dnc_reason TEXT`);
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dnc_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_callback_at TIMESTAMPTZ`);

  // ─── DNC (Do Not Call) Suppression List ──────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dnc_list (
      id SERIAL PRIMARY KEY,
      client_id INTEGER,
      phone_e164 TEXT NOT NULL,
      scope TEXT DEFAULT 'organization',
      reason TEXT,
      source TEXT DEFAULT 'manual',
      actor TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(client_id, phone_e164)
    )
  `);

  // DNC migrations
  await pool.query(`ALTER TABLE dnc_list ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'organization'`);
  await pool.query(`ALTER TABLE dnc_list ADD COLUMN IF NOT EXISTS actor TEXT`);

  // ─── Campaigns ──────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL,
      description TEXT,
      agent_id TEXT,
      phone_number_id TEXT,
      status TEXT DEFAULT 'draft',
      contact_list TEXT DEFAULT '[]',
      total_contacts INTEGER DEFAULT 0,
      valid_contacts INTEGER DEFAULT 0,
      dnc_excluded INTEGER DEFAULT 0,
      calls_completed INTEGER DEFAULT 0,
      calls_answered INTEGER DEFAULT 0,
      calls_failed INTEGER DEFAULT 0,
      schedule_start TIMESTAMPTZ,
      schedule_end TIMESTAMPTZ,
      calling_days TEXT DEFAULT '["mon","tue","wed","thu","fri"]',
      calling_start_time TEXT DEFAULT '09:00',
      calling_end_time TEXT DEFAULT '18:00',
      calling_timezone TEXT DEFAULT 'UTC',
      max_concurrent INTEGER DEFAULT 1,
      max_calls_per_hour INTEGER DEFAULT 60,
      max_retries INTEGER DEFAULT 2,
      retry_delay_minutes INTEGER DEFAULT 60,
      goal TEXT,
      estimated_cost REAL,
      actual_cost REAL DEFAULT 0,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Campaigns migrations
  await pool.query(`ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_agent_id_fkey`);
  await pool.query(`ALTER TABLE campaigns ALTER COLUMN agent_id TYPE TEXT USING agent_id::TEXT`);
  await pool.query(`ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_phone_number_id_fkey`);
  await pool.query(`ALTER TABLE campaigns ALTER COLUMN phone_number_id TYPE TEXT USING phone_number_id::TEXT`);

  // ─── Subscriptions ──────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      plan_id INTEGER REFERENCES pricing_plans(id),
      paypal_subscription_id TEXT UNIQUE,
      status TEXT DEFAULT 'pending',
      started_at TIMESTAMPTZ,
      current_period_end TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Payments ────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      subscription_id INTEGER REFERENCES subscriptions(id),
      paypal_payment_id TEXT UNIQUE,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'paypal',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Payment Webhook Events (idempotency) ────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_webhook_events (
      id SERIAL PRIMARY KEY,
      provider TEXT DEFAULT 'paypal',
      external_event_id TEXT UNIQUE,
      event_type TEXT NOT NULL,
      status TEXT DEFAULT 'received',
      payload TEXT,
      processed_at TIMESTAMPTZ,
      error TEXT,
      attempt_count INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Audit Logs ──────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id),
      actor_email TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      details TEXT DEFAULT '{}',
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── API Keys ────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      scopes TEXT DEFAULT '[]',
      last_used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      revoked INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Usage Tracking ──────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usage_records (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      period TEXT NOT NULL,
      call_count INTEGER DEFAULT 0,
      connected_minutes REAL DEFAULT 0,
      total_duration_seconds INTEGER DEFAULT 0,
      ai_cost REAL DEFAULT 0,
      telephony_cost REAL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(client_id, period)
    )
  `);

  // ─── System Error Logs (Real-time error telemetry & bug tracking) ─
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_error_logs (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id),
      error_message TEXT NOT NULL,
      stack_trace TEXT,
      component_name TEXT,
      url TEXT,
      user_agent TEXT,
      status TEXT DEFAULT 'unresolved',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Team Invitations & Members ─────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_invitations (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      token TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_members (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      email TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(client_id, email)
    )
  `);

  // ─── Agent Knowledge Base & Tools ───────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_knowledge (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      agent_id TEXT NOT NULL,
      provider TEXT DEFAULT 'elevenlabs',
      external_file_id TEXT,
      file_name TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER DEFAULT 0,
      url TEXT,
      status TEXT DEFAULT 'ready',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_tools (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      agent_id TEXT NOT NULL,
      provider TEXT DEFAULT 'elevenlabs',
      external_tool_id TEXT,
      tool_name TEXT NOT NULL,
      tool_type TEXT NOT NULL,
      description TEXT,
      parameters TEXT DEFAULT '{}',
      endpoint_url TEXT,
      is_enabled INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Add new columns to existing tables ──────────────────────
  await pool.query('ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT DEFAULT NULL');
  await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_verified INTEGER DEFAULT 0');
  await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS verification_token TEXT DEFAULT NULL');
  await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS reset_token TEXT DEFAULT NULL');
  await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ DEFAULT NULL');

  // Performance indexes
  try {
    await pool.query('CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_client_agents_client_id ON client_agents(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_phone_numbers_client_id ON phone_numbers(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_phone_numbers_agent_id ON phone_numbers(assigned_agent_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_call_history_client_id ON call_history(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_call_history_campaign_id ON call_history(campaign_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_call_history_agent_id ON call_history(agent_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_call_history_conversation_id ON call_history(conversation_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_call_history_created_at ON call_history(created_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_client_id ON webhook_subscriptions(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_event ON webhook_subscriptions(event)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_call_metrics_conversation_id ON call_metrics(conversation_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_gemini_agents_agent_id ON gemini_agents(agent_id)');
    // New table indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_contacts_client_id ON contacts(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_contacts_phone_e164 ON contacts(phone_e164)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_dnc_list_phone ON dnc_list(phone_e164)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_dnc_list_client ON dnc_list(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal ON subscriptions(paypal_subscription_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_payments_paypal ON payments(paypal_payment_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_external ON payment_webhook_events(external_event_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_client_id ON audit_logs(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_api_keys_client_id ON api_keys(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_usage_records_client ON usage_records(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_usage_records_period ON usage_records(period)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_error_logs_client ON system_error_logs(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_error_logs_status ON system_error_logs(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_team_invitations_client ON team_invitations(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_team_members_client ON team_members(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_agent_knowledge_agent ON agent_knowledge(agent_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_agent_knowledge_client ON agent_knowledge(client_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_agent_tools_agent ON agent_tools(agent_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_agent_tools_client ON agent_tools(client_id)');
    console.log('✓ Database: Performance indexes created');
  } catch (e) {
    console.log('⚠ Database: Indexes may already exist');
  }

  // ─── Seed default admin account if none exists (Postgres) ─────
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@dialix.ai').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'MyAdmin2026!Secure';
    const existingAdmin = await pool.query('SELECT id FROM clients WHERE email = $1', [adminEmail]);
    if (existingAdmin.rows.length === 0) {
      const hash = bcrypt.hashSync(adminPassword, 12);
      await pool.query(
        'INSERT INTO clients (name, email, password_hash, is_admin, is_active, plan_id) VALUES ($1, $2, $3, 1, TRUE, 4)',
        ['Dialix Admin', adminEmail, hash]
      );
      console.log(`✓ Seeded admin account in Postgres: ${adminEmail}`);
    }
  } catch (err) {
    console.error('⚠ Failed to seed admin in Postgres:', err.message);
  }
}

async function initDb() {
  if (DB_PROVIDER === 'postgres') {
    await initPostgresDb();
    return pool;
  }

  await initSqliteDb();
  return db;
}

async function all(sql, params = []) {
  if (DB_PROVIDER === 'postgres') {
    return pgAll(sql, params);
  }

  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

async function get(sql, params = []) {
  if (DB_PROVIDER === 'postgres') {
    return pgGet(sql, params);
  }
  const rows = await all(sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

async function run(sql, params = []) {
  if (DB_PROVIDER === 'postgres') {
    return pgRun(sql, params);
  }
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastResult = db.exec('SELECT last_insert_rowid()');
  const lastInsertRowid = lastResult[0]?.values[0]?.[0] || 0;
  persist();
  return { changes, lastInsertRowid };
}

module.exports = {
  initDb,
  all,
  get,
  run,
  mapQuery,
  getDb: () => (DB_PROVIDER === 'postgres' ? pool : db),
};
