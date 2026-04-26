/**
 * cache.js
 *
 * Simple in-memory TTL cache.
 *
 * Why not Redis for MVP?
 * - Adds infra complexity
 * - Single-server deployment doesn't need distributed cache
 * - Process restarts clear cache anyway
 *
 * Upgrade to Redis when you have >1 server or need persistence.
 */

const store = new Map();

/**
 * Get a cached value.
 * Returns null if not found or expired.
 */
function get(key) {
  const item = store.get(key);
  if (!item) return null;

  if (Date.now() > item.expiresAt) {
    store.delete(key);
    return null;
  }

  return item.value;
}

/**
 * Set a value with TTL.
 * @param {string} key
 * @param {*} value
 * @param {number} ttlSeconds - default 5 minutes
 */
function set(key, value, ttlSeconds = 300) {
  store.set(key, {
    value,
    expiresAt: Date.now() + (ttlSeconds * 1000),
  });
}

/**
 * Delete a cached entry.
 */
function del(key) {
  store.delete(key);
}

/**
 * Cleanup expired entries (run periodically to prevent memory leaks).
 */
function cleanup() {
  const now = Date.now();
  for (const [key, item] of store.entries()) {
    if (now > item.expiresAt) {
      store.delete(key);
    }
  }
}

// Auto-cleanup every 10 minutes
setInterval(cleanup, 10 * 60 * 1000);

module.exports = { get, set, del };
