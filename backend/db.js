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
  if (text.trim().toUpperCase().startsWith('INSERT')) {
    text += ' RETURNING id';
  }
  
  const result = await pool.query(text, values);
  return {
    changes: result.rowCount,
    lastInsertRowid: result.rows[0]?.id || 0,
  };
}

function persist() {
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
    persist();
    console.log('✓ Migrated: added can_edit column to client_agents');
  } catch (e) {}

  try {
    db.run('ALTER TABLE client_agents ADD COLUMN allowed_features TEXT DEFAULT NULL');
    persist();
    console.log('✓ Migrated: added allowed_features column to client_agents');
  } catch (e) {}

  // Vapi provider support: track which provider each agent uses
  try {
    db.run("ALTER TABLE client_agents ADD COLUMN provider TEXT DEFAULT 'elevenlabs'");
    persist();
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
    persist();
    console.log('✓ Migrated: added must_change_password column to clients');
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
    persist();
    console.log('✓ Database: Performance indexes created');
  } catch (e) {
    console.log('⚠ Database: Indexes may already exist');
  }
  // ─── Seed default admin account if none exists ─────────────────
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@dialix.ai';
  const adminPassword = process.env.ADMIN_PASSWORD || 'dialix2024';
  const existingAdmin = db.exec(`SELECT id FROM clients WHERE email = '${adminEmail}'`);
  if (!existingAdmin.length || !existingAdmin[0].values.length) {
    const hash = bcrypt.hashSync(adminPassword, 12);
    db.run(
      `INSERT INTO clients (name, email, password_hash, is_admin) VALUES ('Admin', '${adminEmail}', '${hash}', 1)`
    );
    console.log(`✓ Seeded admin account: ${adminEmail}`);
  }

  persist();
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
