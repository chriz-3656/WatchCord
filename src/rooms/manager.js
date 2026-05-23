import { RoomState } from './state.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Room Manager
 * Handles creation, joining, and lifecycle of watch party rooms
 */
class RoomManager {
  constructor() {
    // Map: channelId -> RoomState
    this.rooms = new Map();
    
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Get or create room for a channel
   */
  getOrCreateRoom(channelId) {
    if (!this.rooms.has(channelId)) {
      const room = new RoomState(channelId, channelId);
      this.rooms.set(channelId, room);
      logger.info('Room created', { channelId });
    }
    return this.rooms.get(channelId);
  }

  /**
   * Get room state
   */
  getRoom(channelId) {
    return this.rooms.get(channelId);
  }

  /**
   * Join a room
   */
  joinRoom(channelId, userId, userInfo) {
    const room = this.getOrCreateRoom(channelId);
    
    // Check room size limit
    if (room.getParticipantCount() >= config.maxRoomSize) {
      throw new Error('Room is full');
    }
    
    // Add participant
    room.addParticipant(userId, userInfo);
    
    logger.info('User joined room', { 
      channelId, 
      userId, 
      participantCount: room.getParticipantCount() 
    });
    
    return room;
  }

  /**
   * Leave a room
   */
  leaveRoom(channelId, userId) {
    const room = this.rooms.get(channelId);
    if (!room) return null;
    
    room.removeParticipant(userId);
    
    logger.info('User left room', { 
      channelId, 
      userId, 
      participantCount: room.getParticipantCount() 
    });
    
    // Check if room is empty
    if (room.isEmpty()) {
      // Don't destroy immediately - preserve for rejoin window
      logger.info('Room is empty, scheduled for cleanup', { channelId });
    }
    
    return room;
  }

  /**
   * Promote new host (host migration)
   */
  promoteHost(channelId) {
    const room = this.rooms.get(channelId);
    if (!room) return null;
    
    const newHostId = room.promoteHost();
    
    if (newHostId && newHostId !== room.hostId) {
      logger.info('Host migrated', { 
        channelId, 
        newHostId,
        oldHostId: room.hostId
      });
    }
    
    return newHostId;
  }

  /**
   * Destroy a room completely
   */
  destroyRoom(channelId) {
    const room = this.rooms.get(channelId);
    if (room) {
      this.rooms.delete(channelId);
      logger.info('Room destroyed', { channelId });
    }
  }

  /**
   * Start periodic cleanup of idle rooms
   */
  startCleanup() {
    setInterval(() => {
      this.cleanupIdleRooms();
    }, 60000); // Check every minute
  }

  /**
   * Cleanup idle rooms
   */
  cleanupIdleRooms() {
    const now = Date.now();
    const toDestroy = [];
    
    for (const [channelId, room] of this.rooms) {
      if (room.isIdle(config.roomIdleTimeoutMs)) {
        toDestroy.push(channelId);
      }
    }
    
    for (const channelId of toDestroy) {
      this.destroyRoom(channelId);
    }
    
    if (toDestroy.length > 0) {
      logger.info('Cleaned up idle rooms', { count: toDestroy.length });
    }
  }

  /**
   * Get all active rooms
   */
  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      totalRooms: this.rooms.size,
      totalParticipants: Array.from(this.rooms.values())
        .reduce((sum, room) => sum + room.getParticipantCount(), 0)
    };
  }
}

// Singleton instance
const roomManager = new RoomManager();

export default roomManager;
export { RoomManager };
