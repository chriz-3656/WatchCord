import config from '../config/index.js';

/**
 * Per-client rate limiter for WebSocket events
 */
class RateLimiter {
  constructor() {
    // Map: clientId -> { count, resetTime }
    this.limits = new Map();
  }

  /**
   * Check if client is within rate limit
   * @param {string} clientId - Unique client identifier
   * @param {number} maxEvents - Maximum events allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {boolean} - True if within limit, false if exceeded
   */
  checkLimit(clientId, maxEvents, windowMs) {
    const now = Date.now();
    let clientData = this.limits.get(clientId);

    // Initialize or reset if window expired
    if (!clientData || now > clientData.resetTime) {
      clientData = {
        count: 0,
        resetTime: now + windowMs
      };
      this.limits.set(clientId, clientData);
    }

    // Increment counter
    clientData.count++;

    // Check if exceeded
    if (clientData.count > maxEvents) {
      return false;
    }

    return true;
  }

  /**
   * Get remaining events for client
   */
  getRemaining(clientId, maxEvents, windowMs) {
    const clientData = this.limits.get(clientId);
    if (!clientData) return maxEvents;
    
    const now = Date.now();
    if (now > clientData.resetTime) return maxEvents;
    
    return Math.max(0, maxEvents - clientData.count);
  }

  /**
   * Clean up old entries periodically
   */
  cleanup() {
    const now = Date.now();
    for (const [clientId, data] of this.limits) {
      if (now > data.resetTime) {
        this.limits.delete(clientId);
      }
    }
  }
}

// Create rate limiters for different event types
const syncRateLimiter = new RateLimiter();
const queueRateLimiter = new RateLimiter();

// Cleanup interval
setInterval(() => {
  syncRateLimiter.cleanup();
  queueRateLimiter.cleanup();
}, 60000);

/**
 * Check sync event rate limit (play/pause/seek)
 */
export function checkSyncLimit(clientId) {
  return syncRateLimiter.checkLimit(
    clientId,
    config.syncEventsPerSecond,
    1000
  );
}

/**
 * Check queue add rate limit
 */
export function checkQueueLimit(clientId) {
  return queueRateLimiter.checkLimit(
    clientId,
    config.queueAddsPerMinute,
    60000
  );
}

/**
 * Get remaining sync events
 */
export function getSyncLimitRemaining(clientId) {
  return syncRateLimiter.getRemaining(
    clientId,
    config.syncEventsPerSecond,
    1000
  );
}

/**
 * Get remaining queue adds
 */
export function getQueueLimitRemaining(clientId) {
  return queueRateLimiter.getRemaining(
    clientId,
    config.queueAddsPerMinute,
    60000
  );
}

export { RateLimiter };
export default { syncRateLimiter, queueRateLimiter };
