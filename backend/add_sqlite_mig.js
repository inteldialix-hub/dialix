const fs = require('fs');
let db = fs.readFileSync('c:/Users/ITASH/OneDrive/Desktop/dialix 3/backend/db.js', 'utf8');
const sqliteMig = `
    try { db.run("ALTER TABLE campaigns ADD COLUMN max_concurrent_calls INTEGER DEFAULT 1"); persistSync(); } catch(e){}
    try { db.run("ALTER TABLE campaigns ADD COLUMN calls_per_minute INTEGER DEFAULT 5"); persistSync(); } catch(e){}
    try { db.run("ALTER TABLE campaigns ADD COLUMN max_spend REAL"); persistSync(); } catch(e){}
    try { db.run("ALTER TABLE campaigns ADD COLUMN max_retry_attempts INTEGER DEFAULT 3"); persistSync(); } catch(e){}
    try { db.run("ALTER TABLE campaigns ADD COLUMN voicemail_action TEXT DEFAULT 'hang_up'"); persistSync(); } catch(e){}
`;
db = db.replace('try { db.run("ALTER TABLE agent_settings ADD COLUMN tts_model_id TEXT"); persistSync(); } catch (e) {}', 'try { db.run("ALTER TABLE agent_settings ADD COLUMN tts_model_id TEXT"); persistSync(); } catch (e) {}\n' + sqliteMig);
fs.writeFileSync('c:/Users/ITASH/OneDrive/Desktop/dialix 3/backend/db.js', db);
