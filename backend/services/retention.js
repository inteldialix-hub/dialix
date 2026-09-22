const { get, run, all } = require('../db');

const runRetentionCleanup = async () => {
  console.log('Starting data retention cleanup...');
  
  try {
    const clients = await all(`SELECT id, recording_retention_days FROM clients`);
    let deletedCount = 0;

    for (const client of clients) {
      const retentionDays = client.recording_retention_days || 90;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffDateStr = cutoffDate.toISOString();
      
      const oldCalls = await all(`SELECT id, client_id, recording_url FROM call_history WHERE client_id = ? AND created_at < ?`, [client.id, cutoffDateStr]);
      
      for (const call of oldCalls) {
        // Mark as deleted or delete records
        await run(`DELETE FROM call_history WHERE id = ?`, [call.id]);
        
        // Log to audit logs
        await run(
          `INSERT INTO audit_logs (client_id, actor_email, action, resource_type, resource_id, details)
           VALUES (?, ?, 'DELETE', 'call_history', ?, ?)`,
          [call.client_id, 'system', call.id.toString(), JSON.stringify({ reason: 'Retention cleanup policy', deleted_at: new Date().toISOString() })]
        );
        deletedCount++;
      }
    }
    
    console.log(`Retention cleanup completed. Deleted ${deletedCount} old call records.`);
  } catch (error) {
    console.error('Error during data retention cleanup:', error);
  }
};

module.exports = {
  runRetentionCleanup
};
