const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'dialix.db');

let db = null;

/**
 * Save DB to disk. Called after every write operation.
 */
function persist() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

/**
 * Initialize the database.
 * Must be called (and awaited) before using the db.
 */
async function initDb() {
  const SQL = await initSqlJs();

  // Load existing DB file if it exists
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
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

  // Migration: add can_edit column if it doesn't exist yet
  try {
    db.run('ALTER TABLE client_agents ADD COLUMN can_edit INTEGER DEFAULT 1');
    persist();
    console.log('✓ Migrated: added can_edit column to client_agents');
  } catch (e) {
    // Column already exists — ignore
  }

  // Migration: add allowed_features column if it doesn't exist yet
  try {
    db.run('ALTER TABLE client_agents ADD COLUMN allowed_features TEXT DEFAULT NULL');
    persist();
    console.log('✓ Migrated: added allowed_features column to client_agents');
  } catch (e) {
    // Column already exists — ignore
  }

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

  persist();

  // Seed default admin if no clients exist
  const result = db.exec('SELECT COUNT(*) as count FROM clients');
  const count = result[0]?.values[0]?.[0] || 0;

  if (count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run(
      'INSERT INTO clients (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)',
      ['Admin', 'admin@dialix.ai', hash]
    );
    persist();
    console.log('✓ Default admin created: admin@dialix.ai / admin123');
  }

  return db;
}

// ─── Helper wrappers to match better-sqlite3 API style ──────────

/**
 * Prepare-like helper: executes a SELECT and returns all rows as objects.
 */
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Prepare-like helper: executes a SELECT and returns the first row as object, or undefined.
 */
function get(sql, params = []) {
  const rows = all(sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

/**
 * Execute an INSERT/UPDATE/DELETE and return { changes, lastInsertRowid }.
 */
function run(sql, params = []) {
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
  getDb: () => db,
};
