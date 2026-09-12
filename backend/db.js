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

function mapQuery(sql, params = []) {
  let index = 0;
  const text = sql.replace(/\?/g, () => `$${++index}`);
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
  
  // For INSERT statements, add RETURNING id to get the inserted row ID
  // (only if not already present to avoid double RETURNING)
  if (text.trim().toUpperCase().startsWith('INSERT') && !/RETURNING\s/i.test(text)) {
    text += ' RETURNING id';
  }
  
  const result = await pool.query(text, values);
  return {
    changes: result.rowCount,
    lastInsertRowid: result.rows[0]?.id || 0,
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
      must_change_password INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
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
    db.run("ALTER TABLE clients ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))");
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

  // Call tracking tables for real-time monitoring and analytics
  db.run(`
    CREATE TABLE IF NOT EXISTS call_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      agent_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL UNIQUE,
      to_number TEXT NOT NULL,
      lead_name TEXT,
      status TEXT DEFAULT 'initiated',
      duration INTEGER DEFAULT 0,
      success INTEGER DEFAULT 0,
      error_message TEXT,
      quality_score REAL,
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

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
      model TEXT DEFAULT 'models/gemini-3.1-flash-live-preview',
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
    db.run('CREATE INDEX IF NOT EXISTS idx_call_history_agent_id ON call_history(agent_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_call_history_conversation_id ON call_history(conversation_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_call_history_created_at ON call_history(created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_client_id ON webhook_subscriptions(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_event ON webhook_subscriptions(event)');
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
  const config = {
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
  };
  if (!config.user || !config.password || !config.database) {
    throw new Error('Postgres configuration requires PG_USER, PG_PASSWORD, and PG_DATABASE');
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
      must_change_password INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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

  // ─── Gemini Agents (local config storage) ────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gemini_agents (
      agent_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_prompt TEXT DEFAULT 'You are a helpful AI assistant.',
      voice TEXT DEFAULT 'Kore',
      model TEXT DEFAULT 'models/gemini-3.1-flash-live-preview',
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

  // ─── Campaigns ──────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
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
    console.log('✓ Database: Performance indexes created');
  } catch (e) {
    console.log('⚠ Database: Indexes may already exist');
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
  getDb: () => (DB_PROVIDER === 'postgres' ? pool : db),
};
