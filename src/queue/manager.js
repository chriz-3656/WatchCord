import roomManager from '../rooms/manager.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Queue Manager
 * Handles queue operations for watch party rooms
 */
class QueueManager {
  constructor() {
    // Map: roomId -> queue state
    this.queues = new Map();
  }

  /**
   * Get or create queue for room
   */
  getOrCreateQueue(roomId) {
    if (!this.queues.has(roomId)) {
      this.queues.set(roomId, {
        items: [],
        history: []
      });
    }
    return this.queues.get(roomId);
  }

  /**
   * Add item to queue
   */
  addItem(roomId, url, addedBy) {
    const queue = this.getOrCreateQueue(roomId);
    
    // Check queue size limit
    if (queue.items.length >= config.maxQueueSize) {
      throw new Error('Queue is full');
    }

    const item = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url,
      addedBy,
      addedAt: Date.now(),
      type: this.detectMediaType(url)
    };

    queue.items.push(item);
    
    logger.info('Item added to queue', { 
      roomId, 
      url, 
      addedBy,
      queueLength: queue.items.length 
    });

    return item;
  }

  /**
   * Remove item from queue at index
   */
  removeItem(roomId, index) {
    const queue = this.getOrCreateQueue(roomId);
    
    if (index < 0 || index >= queue.items.length) {
      throw new Error('Invalid queue index');
    }

    const removed = queue.items.splice(index, 1)[0];
    
    logger.info('Item removed from queue', { 
      roomId, 
      index,
      itemId: removed?.id
    });

    return removed;
  }

  /**
   * Get current queue
   */
  getQueue(roomId) {
    const queue = this.queues.get(roomId);
    return queue ? queue.items : [];
  }

  /**
   * Get queue length
   */
  getQueueLength(roomId) {
    const queue = this.queues.get(roomId);
    return queue ? queue.items.length : 0;
  }

  /**
   * Clear entire queue
   */
  clearQueue(roomId) {
    const queue = this.getOrCreateQueue(roomId);
    const cleared = [...queue.items];
    queue.items = [];
    return cleared;
  }

  /**
   * Reorder queue item
   */
  reorderItem(roomId, fromIndex, toIndex) {
    const queue = this.getOrCreateQueue(roomId);
    
    if (fromIndex < 0 || fromIndex >= queue.items.length ||
        toIndex < 0 || toIndex >= queue.items.length) {
      throw new Error('Invalid queue indices');
    }

    const [item] = queue.items.splice(fromIndex, 1);
    queue.items.splice(toIndex, 0, item);
    
    return item;
  }

  /**
   * Detect media type from URL
   */
  detectMediaType(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();

      // YouTube
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        return 'youtube';
      }

      // Twitch
      if (hostname.includes('twitch.tv')) {
        return 'twitch';
      }

      // Direct MP4
      if (pathname.endsWith('.mp4')) {
        return 'mp4';
      }

      // HLS stream
      if (pathname.endsWith('.m3u8')) {
        return 'hls';
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Validate media URL
   */
  isValidMediaUrl(url) {
    const type = this.detectMediaType(url);
    return type !== 'unknown' && type !== 'invalid';
  }

  /**
   * Get queue stats
   */
  getStats() {
    let totalItems = 0;
    let byType = {};

    for (const queue of this.queues.values()) {
      totalItems += queue.items.length;
      
      for (const item of queue.items) {
        byType[item.type] = (byType[item.type] || 0) + 1;
      }
    }

    return {
      totalQueues: this.queues.size,
      totalItems,
      byType
    };
  }
}

// Singleton instance
const queueManager = new QueueManager();

export default queueManager;
export { QueueManager };
