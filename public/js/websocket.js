/**
 * WebSocket Client
 * Handles Socket.IO connection and event routing
 */

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.eventHandlers = new Map();
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        // Determine WebSocket URL based on current location
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        console.log('[WebSocket] Connecting to:', wsUrl);

        this.socket = io(wsUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          timeout: 20000
        });

        // Connection established
        this.socket.on('connect', () => {
          console.log('[WebSocket] Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          this.emitLocal('connect');
          resolve();
        });

        // Connection lost
        this.socket.on('disconnect', (reason) => {
          console.log('[WebSocket] Disconnected:', reason);
          this.isConnected = false;
          
          this.emitLocal('disconnect', { reason });
        });

        // Reconnection attempt
        this.socket.on('reconnect_attempt', (attemptNumber) => {
          console.log('[WebSocket] Reconnection attempt:', attemptNumber);
          this.reconnectAttempts = attemptNumber;
          
          this.emitLocal('reconnect_attempt', { attemptNumber });
        });

        // Reconnection failed
        this.socket.on('reconnect_failed', () => {
          console.error('[WebSocket] Reconnection failed');
          this.emitLocal('reconnect_failed');
          reject(new Error('Failed to reconnect'));
        });

        // Error
        this.socket.on('error', (error) => {
          console.error('[WebSocket] Error:', error);
          this.emitLocal('error', { error });
        });

        // Server errors
        this.socket.on('error', (data) => {
          console.error('[WebSocket] Server error:', data);
          this.emitLocal('server_error', data);
        });

        // Sync events
        this.setupSyncHandlers();

      } catch (error) {
        console.error('[WebSocket] Connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Setup sync event handlers
   */
  setupSyncHandlers() {
    // Playback sync
    this.on('sync:play', (data) => {
      this.emitLocal('sync_play', data);
    });

    this.on('sync:pause', (data) => {
      this.emitLocal('sync_pause', data);
    });

    this.on('sync:seek', (data) => {
      this.emitLocal('sync_seek', data);
    });

    // Queue sync
    this.on('sync:queue', (data) => {
      this.emitLocal('sync_queue', data);
    });

    // Host change
    this.on('sync:host', (data) => {
      this.emitLocal('sync_host', data);
    });

    // Full state (for late joiners)
    this.on('sync:state', (data) => {
      this.emitLocal('sync_state', data);
    });

    // Heartbeat
    this.on('sync:heartbeat', (data) => {
      this.emitLocal('heartbeat', data);
    });

    // User events
    this.on('user:joined', (data) => {
      this.emitLocal('user_joined', data);
    });

    this.on('user:left', (data) => {
      this.emitLocal('user_left', data);
    });

    // Queue confirmation
    this.on('queue:added', (data) => {
      this.emitLocal('queue_added', data);
    });
  }

  /**
   * Join room
   */
  joinRoom(channelId, userId, userInfo) {
    if (!this.socket || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('ws:join_room', {
      channelId,
      userId,
      userInfo
    });
  }

  /**
   * Leave room
   */
  leaveRoom() {
    if (!this.socket) return;

    this.socket.emit('ws:leave_room');
  }

  /**
   * Send play event
   */
  play(timestamp) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('ws:play', { timestamp });
  }

  /**
   * Send pause event
   */
  pause(timestamp) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('ws:pause', { timestamp });
  }

  /**
   * Send seek event
   */
  seek(timestamp) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('ws:seek', { timestamp });
  }

  /**
   * Add item to queue
   */
  addToQueue(url) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('ws:queue_add', { url });
  }

  /**
   * Remove item from queue
   */
  removeFromQueue(index) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('ws:queue_remove', { index });
  }

  /**
   * Skip current item
   */
  skipCurrent() {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('ws:queue_skip');
  }

  /**
   * Notify video end
   */
  videoEnd() {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('ws:video_end');
  }

  /**
   * Acknowledge heartbeat
   */
  heartbeatAck(latency) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('ws:heartbeat_ack', { latency });
  }

  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.socket) return;

    this.socket.on(event, handler);
  }

  /**
   * Remove event handler
   */
  off(event, handler) {
    if (!this.socket) return;

    this.socket.off(event, handler);
  }

  /**
   * Emit local event (for internal use)
   */
  emitLocal(event, data) {
    window.dispatchEvent(new CustomEvent(`ws:${event}`, {
      detail: data
    }));
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.leaveRoom();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Check connection status
   */
  isReady() {
    return this.isConnected && this.socket !== null;
  }
}

// Singleton instance
const wsClient = new WebSocketClient();

export default wsClient;
export { WebSocketClient };
