function createLogger(context = {}) {
  const log = (level, message, data = {}) => {
    const output = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
      ...data
    };
    
    // Filter sensitive fields
    const filtered = JSON.parse(JSON.stringify(output, (key, value) => {
      if (['password', 'token', 'secret'].includes(key?.toLowerCase?.() || '')) {
        return '[FILTERED]';
      }
      return value;
    }));
    
    console.log(JSON.stringify(filtered));
  };

  return {
    info: (msg, data) => log('INFO', msg, data),
    warn: (msg, data) => log('WARN', msg, data),
    error: (msg, data) => log('ERROR', msg, data),
    debug: (msg, data) => log('DEBUG', msg, data)
  };
}

module.exports = { createLogger };
