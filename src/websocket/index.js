import { Server } from 'socket.io';
import http from 'http';
import roomManager from '../rooms/manager.js';
import queueManager from '../queue/manager.js';
import SyncEngine from '../sync/engine.js';
import { checkSyncLimit, checkQueueLimit } from '../sync/ratelimit.js';
import { validateUrl, extractYouTubeId, getMediaType } from '../media/resolver.js';
import logger from '../utils/logger.js';

/**
 * WebSocket Handler
 * Sets up Socket.IO server and handles all real-time events
 */
export function setupWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: '*', // Discord iframe handles CORS
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Initialize sync engine
  const syncEngine = new SyncEngine(io);

  io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    let currentRoomId = null;
    let currentUserId = null;

    /**
     * Join a room
     */
    socket.on('ws:join_room', async (data) => {
      try {
        const { channelId, userId, userInfo } = data;

        if (!channelId || !userId) {
          socket.emit('error', { message: 'Missing channelId or userId' });
          return;
        }

        // Join room
        const room = roomManager.joinRoom(channelId, userId, userInfo);
        currentRoomId = channelId;
        currentUserId = userId;

        // Join Socket.IO room
        socket.join(channelId);

        // Send full state to late joiner
        syncEngine.sendFullState(socket, channelId);

        // Broadcast user joined to others
        socket.to(channelId).emit('user:joined', {
          userId,
          userInfo,
          isHost: room.hostId === userId
        });

        logger.info('User joined room via WebSocket', { 
          channelId, 
          userId, 
          socketId: socket.id 
        });
      } catch (error) {
        logger.error('Failed to join room', { error: error.message });
        socket.emit('error', { message: error.message });
      }
    });

    /**
     * Leave room
     */
    socket.on('ws:leave_room', () => {
      if (currentRoomId && currentUserId) {
        const room = roomManager.leaveRoom(currentRoomId, currentUserId);
        
        if (room) {
          // Notify others
          socket.to(currentRoomId).emit('user:left', {
            userId: currentUserId
          });

          // Check for host migration
          if (currentUserId === room.hostId) {
            const newHostId = roomManager.promoteHost(currentRoomId);
            if (newHostId) {
              syncEngine.broadcastHostChange(currentRoomId, newHostId);
            }
          }
        }

        socket.leave(currentRoomId);
        
        logger.info('User left room', { 
          roomId: currentRoomId, 
          userId: currentUserId 
        });

        currentRoomId = null;
        currentUserId = null;
      }
    });

    /**
     * Play event (host only)
     */
    socket.on('ws:play', (data) => {
      if (!currentRoomId) return;

      const room = roomManager.getRoom(currentRoomId);
      if (!room || currentUserId !== room.hostId) {
        socket.emit('error', { message: 'Only host can control playback' });
        return;
      }

      // Rate limit
      if (!checkSyncLimit(socket.id)) {
        socket.emit('error', { message: 'Rate limit exceeded' });
        return;
      }

      const { timestamp } = data;
      syncEngine.broadcastPlay(currentRoomId, timestamp || 0, currentUserId);
    });

    /**
     * Pause event (host only)
     */
    socket.on('ws:pause', (data) => {
      if (!currentRoomId) return;

      const room = roomManager.getRoom(currentRoomId);
      if (!room || currentUserId !== room.hostId) {
        socket.emit('error', { message: 'Only host can control playback' });
        return;
      }

      // Rate limit
      if (!checkSyncLimit(socket.id)) {
        socket.emit('error', { message: 'Rate limit exceeded' });
        return;
      }

      const { timestamp } = data;
      syncEngine.broadcastPause(currentRoomId, timestamp || 0, currentUserId);
    });

    /**
     * Seek event (host only)
     */
    socket.on('ws:seek', (data) => {
      if (!currentRoomId) return;

      const room = roomManager.getRoom(currentRoomId);
      if (!room || currentUserId !== room.hostId) {
        socket.emit('error', { message: 'Only host can control playback' });
        return;
      }

      // Rate limit
      if (!checkSyncLimit(socket.id)) {
        socket.emit('error', { message: 'Rate limit exceeded' });
        return;
      }

      const { timestamp } = data;
      if (typeof timestamp !== 'number' || timestamp < 0) {
        socket.emit('error', { message: 'Invalid timestamp' });
        return;
      }

      syncEngine.broadcastSeek(currentRoomId, timestamp, currentUserId);
    });

    /**
     * Add to queue
     */
    socket.on('ws:queue_add', (data) => {
      if (!currentRoomId || !currentUserId) return;

      // Rate limit
      if (!checkQueueLimit(socket.id)) {
        socket.emit('error', { message: 'Queue add rate limit exceeded' });
        return;
      }

      const { url } = data;
      
      // Validate URL
      const validation = validateUrl(url);
      if (!validation.valid) {
        socket.emit('error', { message: validation.error });
        return;
      }

      try {
        const item = queueManager.addItem(currentRoomId, url, currentUserId);
        
        // Get updated queue
        const queue = queueManager.getQueue(currentRoomId);
        const room = roomManager.getRoom(currentRoomId);
        
        // Broadcast queue update
        syncEngine.broadcastQueueUpdate(currentRoomId, queue, room?.currentItem);

        socket.emit('queue:added', { item });
        
        logger.info('Item added to queue', { 
          roomId: currentRoomId, 
          userId: currentUserId,
          itemId: item.id 
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    /**
     * Remove from queue
     */
    socket.on('ws:queue_remove', (data) => {
      if (!currentRoomId) return;

      const room = roomManager.getRoom(currentRoomId);
      if (!room || currentUserId !== room.hostId) {
        socket.emit('error', { message: 'Only host can manage queue' });
        return;
      }

      const { index } = data;

      try {
        queueManager.removeItem(currentRoomId, index);
        
        const queue = queueManager.getQueue(currentRoomId);
        syncEngine.broadcastQueueUpdate(currentRoomId, queue, room.currentItem);
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    /**
     * Skip current item
     */
    socket.on('ws:queue_skip', () => {
      if (!currentRoomId) return;

      const room = roomManager.getRoom(currentRoomId);
      if (!room || currentUserId !== room.hostId) {
        socket.emit('error', { message: 'Only host can skip' });
        return;
      }

      syncEngine.handleVideoEnd(currentRoomId);
    });

    /**
     * Video end notification
     */
    socket.on('ws:video_end', () => {
      if (!currentRoomId) return;

      const room = roomManager.getRoom(currentRoomId);
      if (!room || currentUserId !== room.hostId) {
        return; // Only host can trigger auto-advance
      }

      syncEngine.handleVideoEnd(currentRoomId);
    });

    /**
     * Heartbeat acknowledgment
     */
    socket.on('ws:heartbeat_ack', (data) => {
      // Client acknowledges heartbeat - can be used for latency measurement
      logger.debug('Heartbeat ACK', { socketId: socket.id, ...data });
    });

    /**
     * Disconnect handling
     */
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });

      if (currentRoomId && currentUserId) {
        const room = roomManager.leaveRoom(currentRoomId, currentUserId);
        
        if (room) {
          // Notify others
          io.to(currentRoomId).emit('user:left', {
            userId: currentUserId
          });

          // Check for host migration
          if (currentUserId === room.hostId) {
            const newHostId = roomManager.promoteHost(currentRoomId);
            if (newHostId) {
              syncEngine.broadcastHostChange(currentRoomId, newHostId);
            }
          }
        }
      }
    });

    /**
     * Error handling
     */
    socket.on('error', (error) => {
      logger.error('Socket error', { socketId: socket.id, error });
    });
  });

  logger.info('WebSocket server initialized');
  
  return io;
}

export default setupWebSocket;
