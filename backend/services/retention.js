const { get, run, all } = require('../db');

const runRetentionCleanup = async () => {
  console.log('Starting data retention cleanup...');
  
  try {
    // Determine retention days (could be fetched from organization settings, but for now default 90 days)
    const retentionDays = 90;
    
    // Find call_history records older than retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = cutoffDate.toISOString();
    
    const oldCalls = await all(`SELECT id, client_id, recording_url FROM call_history WHERE created_at < ?`, [cutoffDateStr]);
    
    if (oldCalls.length === 0) {
      console.log('No old records found for retention cleanup.');
      return;
    }
    
    let deletedCount = 0;
    for (const call of oldCalls) {
      // Mark as deleted or delete records
      // Assuming we're deleting them
      await run(`DELETE FROM call_history WHERE id = ?`, [call.id]);
      
      // Log to audit logs
      await run(
        `INSERT INTO audit_logs (client_id, actor_id, action, resource_type, resource_id, details)
         VALUES (?, ?, 'DELETE', 'call_history', ?, ?)`,
        [call.client_id, call.client_id, call.id.toString(), JSON.stringify({ reason: 'Retention cleanup policy', deleted_at: new Date().toISOString() })]
      );
      deletedCount++;
    }
    
    console.log(`Retention cleanup completed. Deleted ${deletedCount} old call records.`);
  } catch (error) {
    console.error('Error during data retention cleanup:', error);
  }
};

module.exports = {
  runRetentionCleanup
};
