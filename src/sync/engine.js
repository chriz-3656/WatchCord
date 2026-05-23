import roomManager from '../rooms/manager.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Sync Engine
 * Broadcasts playback synchronization events to all room participants
 */
class SyncEngine {
  constructor(io) {
    this.io = io;
    this.heartbeatInterval = null;
    this.startHeartbeat();
  }

  /**
   * Start global heartbeat interval
   * Sends current timestamp from host to all clients every N seconds
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.broadcastHeartbeat();
    }, config.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat interval
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Broadcast heartbeat to all rooms with active hosts
   */
  broadcastHeartbeat() {
    const rooms = roomManager.getAllRooms();
    
    for (const room of rooms) {
      if (room.hostId && room.isPlaying && room.currentItem) {
        // Calculate current timestamp based on playback time
        const elapsedSeconds = (Date.now() - room.lastActivityAt) / 1000;
        const currentTimestamp = room.currentTimestamp + elapsedSeconds;
        
        this.io.to(room.roomId).emit('sync:heartbeat', {
          type: 'heartbeat',
          timestamp: currentTimestamp,
          hostId: room.hostId,
          serverTime: Date.now()
        });
      }
    }
  }

  /**
   * Broadcast play event to room
   */
  broadcastPlay(roomId, timestamp, userId) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    room.setPlayback(true, timestamp);

    this.io.to(roomId).emit('sync:play', {
      type: 'sync_play',
      timestamp,
      hostId: room.hostId,
      serverTime: Date.now()
    });

    logger.debug('Play event broadcast', { roomId, timestamp, userId });
  }

  /**
   * Broadcast pause event to room
   */
  broadcastPause(roomId, timestamp, userId) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    room.setPlayback(false, timestamp);

    this.io.to(roomId).emit('sync:pause', {
      type: 'sync_pause',
      timestamp,
      hostId: room.hostId,
      serverTime: Date.now()
    });

    logger.debug('Pause event broadcast', { roomId, timestamp, userId });
  }

  /**
   * Broadcast seek event to room
   */
  broadcastSeek(roomId, timestamp, userId) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    room.seek(timestamp);

    this.io.to(roomId).emit('sync:seek', {
      type: 'sync_seek',
      timestamp,
      hostId: room.hostId,
      serverTime: Date.now()
    });

    logger.debug('Seek event broadcast', { roomId, timestamp, userId });
  }

  /**
   * Broadcast queue update to room
   */
  broadcastQueueUpdate(roomId, queue, currentItem) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    this.io.to(roomId).emit('sync:queue', {
      type: 'sync_queue',
      queue,
      currentItem,
      hostId: room.hostId,
      serverTime: Date.now()
    });

    logger.debug('Queue update broadcast', { roomId, queueLength: queue.length });
  }

  /**
   * Broadcast host change to room
   */
  broadcastHostChange(roomId, newHostId) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    this.io.to(roomId).emit('sync:host', {
      type: 'sync_host',
      hostId: newHostId,
      serverTime: Date.now()
    });

    logger.info('Host change broadcast', { roomId, newHostId });
  }

  /**
   * Send full room state to client (for late joiners)
   */
  sendFullState(socket, roomId) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    socket.emit('sync:state', {
      type: 'sync_state',
      state: room.serialize(),
      serverTime: Date.now()
    });

    logger.debug('Full state sent to client', { roomId, clientId: socket.id });
  }

  /**
   * Handle video end event - auto advance queue
   */
  handleVideoEnd(roomId) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const hasMore = room.skipCurrent();
    
    if (hasMore && room.currentItem) {
      // Auto-play next item
      this.broadcastQueueUpdate(roomId, room.queue, room.currentItem);
      
      // Small delay before auto-play
      setTimeout(() => {
        this.broadcastPlay(roomId, 0, 'system');
      }, 1000);
    } else {
      // No more items, stop playback
      this.broadcastPause(roomId, 0, 'system');
      this.broadcastQueueUpdate(roomId, room.queue, null);
    }
  }
}

export default SyncEngine;
