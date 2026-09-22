const { initDb, run } = require('./backend/db');

async function migratePlans() {
  try {
    const db = await initDb();
    
    // Update existing plans
    await run(`UPDATE pricing_plans SET name='Free', price=0 WHERE slug='starter' AND price=0`); // If it was called starter but free
    await run(`UPDATE pricing_plans SET price=0 WHERE slug='free'`);
    
    // Fix existing starter if it was not free
    await run(`UPDATE pricing_plans SET name='Starter', slug='starter', price=49 WHERE slug='professional' AND price=49`);
    
    // Fix existing professional
    await run(`UPDATE pricing_plans SET name='Professional', slug='professional', price=149 WHERE slug='business' OR (slug='professional' AND price=149)`);
    
    // Fix enterprise
    await run(`UPDATE pricing_plans SET price=0 WHERE slug='enterprise'`);
    
    // Also delete any duplicates or unused
    console.log('Plans migrated successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migratePlans();
