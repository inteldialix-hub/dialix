async function withRetry(fn, { maxRetries = 2, backoffMs = 1000, label = 'operation', shouldRetry = () => true } = {}) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!shouldRetry(err) || attempt > maxRetries) throw err;
      const delay = backoffMs * Math.pow(2, attempt - 1);
      console.warn(`[Retry] ${label} attempt ${attempt} failed, retrying in ${delay}ms:`, err.message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

module.exports = { withRetry };
