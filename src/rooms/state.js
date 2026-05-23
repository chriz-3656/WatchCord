/**
 * Room State Model
 * Represents the current state of a watch party room
 */
export class RoomState {
  constructor(roomId, channelId) {
    this.roomId = roomId;
    this.channelId = channelId;
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
    this.participants = new Map(); // userId -> participant info
    this.hostId = null;
    this.isPlaying = false;
    this.currentTimestamp = 0;
    this.queue = [];
    this.currentItem = null;
    this.history = [];
  }

  /**
   * Update last activity timestamp
   */
  touch() {
    this.lastActivityAt = Date.now();
  }

  /**
   * Check if room is idle (no activity for given duration)
   */
  isIdle(timeoutMs) {
    return Date.now() - this.lastActivityAt > timeoutMs;
  }

  /**
   * Get participant count
   */
  getParticipantCount() {
    return this.participants.size;
  }

  /**
   * Check if room is empty
   */
  isEmpty() {
    return this.participants.size === 0;
  }

  /**
   * Add participant to room
   */
  addParticipant(userId, userInfo) {
    this.participants.set(userId, {
      ...userInfo,
      joinedAt: Date.now()
    });
    this.touch();
    
    // First participant becomes host
    if (!this.hostId) {
      this.hostId = userId;
    }
  }

  /**
   * Remove participant from room
   */
  removeParticipant(userId) {
    const removed = this.participants.delete(userId);
    this.touch();
    return removed;
  }

  /**
   * Check if user is in room
   */
  hasParticipant(userId) {
    return this.participants.has(userId);
  }

  /**
   * Get all participant IDs
   */
  getParticipantIds() {
    return Array.from(this.participants.keys());
  }

  /**
   * Promote new host (for host migration)
   */
  promoteHost() {
    if (this.isEmpty()) {
      this.hostId = null;
      return null;
    }

    // If current host is still here, keep them
    if (this.hostId && this.participants.has(this.hostId)) {
      return this.hostId;
    }

    // Find participant who's been here longest (excluding old host)
    let oldestParticipant = null;
    let oldestJoinTime = Infinity;

    for (const [userId, info] of this.participants) {
      if (info.joinedAt < oldestJoinTime) {
        oldestJoinTime = info.joinedAt;
        oldestParticipant = userId;
      }
    }

    this.hostId = oldestParticipant;
    this.touch();
    return this.hostId;
  }

  /**
   * Set playback state
   */
  setPlayback(isPlaying, timestamp) {
    this.isPlaying = isPlaying;
    this.currentTimestamp = timestamp;
    this.touch();
  }

  /**
   * Seek to timestamp
   */
  seek(timestamp) {
    this.currentTimestamp = timestamp;
    this.touch();
  }

  /**
   * Set current queue item
   */
  setCurrentItem(item) {
    this.currentItem = item;
    if (item) {
      this.currentTimestamp = 0;
    }
    this.touch();
  }

  /**
   * Add item to queue
   */
  addToQueue(item) {
    this.queue.push(item);
    this.touch();
    return this.queue.length - 1;
  }

  /**
   * Remove item from queue at index
   */
  removeFromQueue(index) {
    if (index >= 0 && index < this.queue.length) {
      const removed = this.queue.splice(index, 1)[0];
      this.touch();
      return removed;
    }
    return null;
  }

  /**
   * Skip current item and advance queue
   */
  skipCurrent() {
    if (this.currentItem) {
      this.history.push(this.currentItem);
    }
    
    if (this.queue.length > 0) {
      this.currentItem = this.queue.shift();
      this.currentTimestamp = 0;
      this.touch();
      return true;
    } else {
      this.currentItem = null;
      this.currentTimestamp = 0;
      this.isPlaying = false;
      this.touch();
      return false;
    }
  }

  /**
   * Serialize room state for client sync
   */
  serialize() {
    return {
      roomId: this.roomId,
      channelId: this.channelId,
      hostId: this.hostId,
      isPlaying: this.isPlaying,
      currentTimestamp: this.currentTimestamp,
      currentItem: this.currentItem,
      queue: this.queue,
      participantCount: this.getParticipantCount(),
      participants: this.getParticipantIds()
    };
  }
}

export default RoomState;
