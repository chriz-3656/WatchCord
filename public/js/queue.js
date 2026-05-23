/**
 * Queue Manager (Frontend)
 * Handles local queue state and rendering
 */

class QueueManager {
  constructor() {
    this.items = [];
    this.currentItem = null;
    this.listeners = new Map();
  }

  /**
   * Set queue from server
   */
  setQueue(items, currentItem) {
    this.items = items || [];
    this.currentItem = currentItem || null;
    this.notify('update');
  }

  /**
   * Add item to queue
   */
  addItem(item) {
    this.items.push(item);
    this.notify('add', { item });
  }

  /**
   * Remove item at index
   */
  removeItem(index) {
    if (index >= 0 && index < this.items.length) {
      const removed = this.items.splice(index, 1)[0];
      this.notify('remove', { index, item: removed });
    }
  }

  /**
   * Set current playing item
   */
  setCurrentItem(item) {
    this.currentItem = item;
    this.notify('current_change', { item });
  }

  /**
   * Get queue
   */
  getQueue() {
    return [...this.items];
  }

  /**
   * Get current item
   */
  getCurrentItem() {
    return this.currentItem;
  }

  /**
   * Get queue length
   */
  getLength() {
    return this.items.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty() {
    return this.items.length === 0;
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    
    return () => this.unsubscribe(event, callback);
  }

  /**
   * Unsubscribe from queue changes
   */
  unsubscribe(event, callback) {
    if (this.listeners.has(event)) {
      const handlers = this.listeners.get(event);
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Notify listeners
   */
  notify(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[Queue] Listener error:', error);
        }
      });
    }
    
    // Also emit window event for other modules
    window.dispatchEvent(new CustomEvent('queue:' + event, {
      detail: data
    }));
  }

  /**
   * Clear queue
   */
  clear() {
    this.items = [];
    this.currentItem = null;
    this.notify('clear');
  }

  /**
   * Reorder item
   */
  reorder(fromIndex, toIndex) {
    if (fromIndex >= 0 && fromIndex < this.items.length &&
        toIndex >= 0 && toIndex < this.items.length) {
      const [item] = this.items.splice(fromIndex, 1);
      this.items.splice(toIndex, 0, item);
      this.notify('reorder', { fromIndex, toIndex, item });
    }
  }
}

export default QueueManager;
export { QueueManager };
