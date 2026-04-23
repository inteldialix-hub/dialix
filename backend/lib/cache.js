const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI;
let client;

async function initCache() {
  if (!REDIS_URL) {
    console.log('Redis cache disabled: REDIS_URL not set');
    return;
  }

  if (client?.isOpen) {
    return;
  }

  client = createClient({ url: REDIS_URL });
  client.on('error', (err) => {
    console.error('Redis cache error:', err.message);
  });

  try {
    await client.connect();
    console.log('Redis cache connected');
  } catch (err) {
    console.error('Failed to connect to Redis cache:', err.message);
    client = null;
  }
}

function cacheEnabled() {
  return !!client?.isOpen;
}

async function getCache(key) {
  if (!cacheEnabled()) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error('Redis get error:', err.message);
    return null;
  }
}

async function setCache(key, value, ttlSeconds = 30) {
  if (!cacheEnabled()) return;
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    console.error('Redis set error:', err.message);
  }
}

async function delCache(key) {
  if (!cacheEnabled()) return;
  try {
    await client.del(key);
  } catch (err) {
    console.error('Redis del error:', err.message);
  }
}

module.exports = {
  initCache,
  cacheEnabled,
  getCache,
  setCache,
  delCache,
};
