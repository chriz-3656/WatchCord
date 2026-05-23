/**
 * Main Application Entry Point
 * Bootstraps all modules and coordinates the watch party experience
 */

import discordIntegration from './discord.js';
import wsClient from './websocket.js';
import YouTubePlayer from './youtube.js';
import SyncEngine from './sync.js';
import QueueManager from './queue.js';
import uiController from './ui.js';
import { extractYouTubeId, validateMediaUrl } from './utils.js';

class WatchTogetherApp {
  constructor() {
    // Components
    this.discord = discordIntegration;
    this.ws = wsClient;
    this.player = null;
    this.sync = null;
    this.queue = new QueueManager();
    this.ui = uiController;

    // State
    this.currentVideoId = null;
    this.isPlaying = false;
    this.isHost = false;
    this.hostId = null;
    this.channelId = null;
    this.userId = null;
    this.userInfo = null;

    // Timing
    this.progressInterval = null;
    this.lastHeartbeatTime = 0;

    // Bind methods
    this.handlePlayerStateChange = this.handlePlayerStateChange.bind(this);
    this.handlePlayerError = this.handlePlayerError.bind(this);
    this.handleWebSocketSync = this.handleWebSocketSync.bind(this);
    this.handleHeartbeat = this.handleHeartbeat.bind(this);
  }

  /**
   * Initialize application
   */
  async initialize() {
    try {
      console.log('[App] Initializing...');

      // Initialize UI
      this.ui.initialize();
      this.ui.setLoadingText('Connecting to Discord...');

      // Initialize Discord SDK
      await this.discord.initialize();
      this.ui.setLoadingText('Authenticating...');

      // Get user info
      const user = this.discord.getCurrentUser();
      this.userId = user.id;
      this.userInfo = user;

      // Get channel ID
      this.channelId = this.discord.getChannelId();

      console.log('[App] Authenticated as:', user.username);
      console.log('[App] Channel:', this.channelId);

      // Connect WebSocket
      this.ui.setLoadingText('Connecting to server...');
      await this.ws.connect();

      // Join room
      this.ws.joinRoom(this.channelId, this.userId, this.userInfo);

      // Initialize player
      this.player = new YouTubePlayer('youtube-player');
      this.player.onStateChange(this.handlePlayerStateChange);
      this.player.onError(this.handlePlayerError);

      // Initialize sync engine
      this.sync = new SyncEngine({
        softThreshold: 300,
        hardThreshold: 1000
      });

      this.sync.onDriftDetected = this.handleDrift.bind(this);
      this.sync.onSyncStatusChange = this.handleSyncStatusChange.bind(this);

      // Setup event listeners
      this.setupEventListeners();
      this.setupWebSocketListeners();

      // Show activity screen
      this.ui.showActivityScreen();
      this.ui.setLoadingText('Ready!');

      console.log('[App] Initialization complete');

      return true;
    } catch (error) {
      console.error('[App] Initialization failed:', error);
      this.ui.setLoadingText(`Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup DOM event listeners
   */
  setupEventListeners() {
    // Play/Pause button
    document.getElementById('btn-play-pause')?.addEventListener('click', () => {
      if (!this.isHost) return;

      if (this.isPlaying) {
        this.player.pause();
      } else {
        this.player.play();
      }
    });

    // Skip button
    document.getElementById('btn-skip')?.addEventListener('click', () => {
      if (!this.isHost) return;
      this.ws.skipCurrent();
    });

    // Progress bar click
    document.getElementById('progress-bar')?.addEventListener('click', (e) => {
      if (!this.isHost) return;

      const rect = e.target.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const duration = this.player.getDuration();
      const timestamp = percent * duration;

      this.player.seek(timestamp);
      this.ws.seek(timestamp);
    });

    // Volume slider
    document.getElementById('volume-slider')?.addEventListener('input', (e) => {
      const volume = parseInt(e.target.value, 10);
      this.player.setVolume(volume);
    });

    // Queue form submit
    document.getElementById('add-to-queue-form')?.addEventListener('submit', (e) => {
      e.preventDefault();

      const input = document.getElementById('queue-url-input');
      const url = input.value.trim();

      if (!url) return;

      // Validate URL
      const validation = validateMediaUrl(url);
      if (!validation.valid) {
        this.ui.showError(validation.error);
        return;
      }

      // Check if YouTube URL
      const videoId = extractYouTubeId(url);
      if (!videoId && validation.valid) {
        // Allow other valid URLs
      }

      // Add to queue
      this.ws.addToQueue(url);
      this.ui.clearQueueInput();
    });

    // Queue item removal (delegated)
    document.getElementById('queue-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-remove');
      if (!btn) return;

      const index = parseInt(btn.dataset.index, 10);
      if (!this.isHost) {
        this.ui.showError('Only host can manage queue');
        return;
      }

      this.ws.removeFromQueue(index);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Only if not typing in input
      if (e.target.tagName === 'INPUT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (this.isHost) {
            document.getElementById('btn-play-pause')?.click();
          }
          break;
        case 'KeyK':
          if (this.isHost) {
            document.getElementById('btn-play-pause')?.click();
          }
          break;
        case 'KeyJ':
          if (this.isHost) {
            const currentTime = this.player.getCurrentTime();
            this.player.seek(Math.max(0, currentTime - 10));
            this.ws.seek(Math.max(0, currentTime - 10));
          }
          break;
        case 'KeyL':
          if (this.isHost) {
            const currentTime = this.player.getCurrentTime();
            const duration = this.player.getDuration();
            this.player.seek(Math.min(duration, currentTime + 10));
            this.ws.seek(Math.min(duration, currentTime + 10));
          }
          break;
      }
    });
  }

  /**
   * Setup WebSocket event listeners
   */
  setupWebSocketListeners() {
    // Playback sync events
    window.addEventListener('ws:sync_play', (e) => {
      const { timestamp } = e.detail;
      console.log('[App] Sync play:', timestamp);
      this.player.play(timestamp);
    });

    window.addEventListener('ws:sync_pause', (e) => {
      const { timestamp } = e.detail;
      console.log('[App] Sync pause:', timestamp);
      this.player.pause();
    });

    window.addEventListener('ws:sync_seek', (e) => {
      const { timestamp } = e.detail;
      console.log('[App] Sync seek:', timestamp);
      this.player.seek(timestamp);
    });

    // Queue sync
    window.addEventListener('ws:sync_queue', (e) => {
      const { queue, currentItem } = e.detail;
      console.log('[App] Queue update:', queue.length, 'items');
      this.queue.setQueue(queue, currentItem);
      this.ui.renderQueue(queue);
      
      if (currentItem) {
        this.loadVideo(currentItem);
      }
    });

    // Host change
    window.addEventListener('ws:sync_host', (e) => {
      const { hostId } = e.detail;
      console.log('[App] Host changed:', hostId);
      this.hostId = hostId;
      this.isHost = this.userId === hostId;
      this.ui.setIsHost(this.isHost);
      
      if (this.isHost) {
        this.ui.showError('You are now the host');
      }
    });

    // Full state (late joiner)
    window.addEventListener('ws:sync_state', (e) => {
      const { state } = e.detail;
      console.log('[App] Received full state:', state);
      
      this.hostId = state.hostId;
      this.isHost = this.userId === state.hostId;
      this.ui.setIsHost(this.isHost);

      if (state.currentItem) {
        this.queue.setCurrentItem(state.currentItem);
        this.loadVideo(state.currentItem, state.currentTimestamp);
      }

      if (state.queue) {
        this.queue.setQueue(state.queue, state.currentItem);
        this.ui.renderQueue(state.queue);
      }

      // Set initial playback state
      this.sync.setLocalState(state.isPlaying, state.currentTimestamp);
      this.sync.setIsHost(this.isHost, this.hostId);
    });

    // Heartbeat
    window.addEventListener('ws:heartbeat', this.handleHeartbeat);

    // User events
    window.addEventListener('ws:user_joined', (e) => {
      const { userInfo } = e.detail;
      console.log('[App] User joined:', userInfo?.username);
      this.updateParticipants();
    });

    window.addEventListener('ws:user_left', (e) => {
      const { userId } = e.detail;
      console.log('[App] User left:', userId);
      this.updateParticipants();
    });

    // Server errors
    window.addEventListener('ws:server_error', (e) => {
      const { message } = e.detail;
      this.ui.showError(message);
    });
  }

  /**
   * Handle player state changes
   */
  handlePlayerStateChange(stateName, data) {
    console.log('[App] Player state:', stateName);

    switch (stateName) {
      case 'playing':
        this.isPlaying = true;
        this.ui.setPlaybackState(true);
        this.sync.setLocalState(true, data.currentTime);
        
        if (this.isHost) {
          this.ws.play(data.currentTime);
        }
        
        this.startProgressUpdates();
        break;

      case 'paused':
        this.isPlaying = false;
        this.ui.setPlaybackState(false);
        this.sync.setLocalState(false, data.currentTime);
        
        if (this.isHost) {
          this.ws.pause(data.currentTime);
        }
        
        this.stopProgressUpdates();
        break;

      case 'ended':
        console.log('[App] Video ended');
        this.isPlaying = false;
        this.stopProgressUpdates();
        
        if (this.isHost) {
          this.ws.videoEnd();
        }
        break;

      case 'buffering':
        console.log('[App] Buffering...');
        break;

      case 'ready':
        console.log('[App] Player ready');
        break;
    }
  }

  /**
   * Handle player errors
   */
  handlePlayerError(error) {
    console.error('[App] Player error:', error);
    this.ui.showError(`Video error: ${error.message}`);
  }

  /**
   * Handle heartbeat from server
   */
  handleHeartbeat(e) {
    const { timestamp, serverTime } = e.detail;
    
    this.sync.updateHostTimestamp(timestamp, serverTime);
    this.lastHeartbeatTime = Date.now();
  }

  /**
   * Handle drift detection
   */
  handleDrift(driftData) {
    console.log('[App] Drift detected:', driftData);

    if (driftData.type === 'hard_seek') {
      // Immediate correction
      this.player.seek(driftData.timestamp);
    } else if (driftData.needsHardSeek) {
      // Hard seek needed
      this.player.seek(driftData.hostTimestamp);
    } else {
      // Soft correction (just notify for now)
      console.log('[App] Minor drift, no correction needed');
    }
  }

  /**
   * Handle sync status change
   */
  handleSyncStatusChange(status, drift) {
    this.ui.setSyncStatus(status, drift);
  }

  /**
   * Load video from queue item
   */
  async loadVideo(item, startSeconds = 0) {
    try {
      if (!item || !item.url) return;

      const videoId = extractYouTubeId(item.url);
      if (!videoId) {
        this.ui.showError('Invalid YouTube URL');
        return;
      }

      this.currentVideoId = videoId;
      this.ui.setNowPlaying(item);

      await this.player.loadVideo(videoId, startSeconds);
    } catch (error) {
      console.error('[App] Failed to load video:', error);
      this.ui.showError('Failed to load video');
    }
  }

  /**
   * Update participants list
   */
  async updateParticipants() {
    const participants = this.discord.getParticipants();
    this.ui.renderParticipants(participants, this.hostId);
  }

  /**
   * Start progress bar updates
   */
  startProgressUpdates() {
    this.stopProgressUpdates();
    
    this.progressInterval = setInterval(() => {
      const currentTime = this.player.getCurrentTime();
      const duration = this.player.getDuration();
      
      this.ui.setProgress(currentTime, duration);
      this.sync.setLocalState(this.isPlaying, currentTime);
    }, 250);
  }

  /**
   * Stop progress bar updates
   */
  stopProgressUpdates() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Cleanup on unload
   */
  cleanup() {
    console.log('[App] Cleaning up...');
    
    this.stopProgressUpdates();
    this.ws.leaveRoom();
    this.ws.disconnect();
    
    if (this.player) {
      this.player.destroy();
    }
  }
}

// Create and initialize app
const app = new WatchTogetherApp();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.initialize());
} else {
  app.initialize();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => app.cleanup());

// Export for debugging
window.watchTogetherApp = app;

export default app;
export { WatchTogetherApp };
