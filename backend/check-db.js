// Quick script to check DB state
const path = require('path');
const dbPath = process.env.FLY_APP_NAME ? '/data/dialix.db' : path.join(__dirname, 'dialix.db');
const db = require('better-sqlite3')(dbPath);
const clients = db.prepare('SELECT id, name, email, is_admin FROM clients').all();
console.log('=== CLIENTS ===');
console.log(JSON.stringify(clients, null, 2));
const agents = db.prepare('SELECT id, client_id, agent_id, provider FROM client_agents LIMIT 20').all();
console.log('=== AGENT ASSIGNMENTS ===');
console.log(JSON.stringify(agents, null, 2));
db.close();
