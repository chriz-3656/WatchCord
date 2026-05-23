/**
 * YouTube Iframe API Wrapper
 * Handles video playback and state reporting
 */

class YouTubePlayer {
  constructor(containerId) {
    this.containerId = containerId;
    this.player = null;
    this.currentVideoId = null;
    this.isReady = false;
    this.stateChangeCallback = null;
    this.errorCallback = null;
    
    // Bind methods
    this.onPlayerReady = this.onPlayerReady.bind(this);
    this.onPlayerStateChange = this.onPlayerStateChange.bind(this);
    this.onPlayerError = this.onPlayerError.bind(this);
  }

  /**
   * Wait for YouTube iframe API to be ready
   */
  waitForAPI() {
    return new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }

      // Check every 100ms
      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('YouTube API failed to load'));
      }, 10000);
    });
  }

  /**
   * Initialize player with video
   */
  async loadVideo(videoId, startSeconds = 0) {
    try {
      await this.waitForAPI();

      // Destroy existing player
      if (this.player) {
        this.player.destroy();
        this.player = null;
      }

      this.currentVideoId = videoId;

      // Create new player
      this.player = new window.YT.Player(this.containerId, {
        width: '100%',
        height: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0, // Hide default controls - we use custom ones
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3, // Hide annotations
          playsinline: 1
        },
        events: {
          onReady: this.onPlayerReady,
          onStateChange: this.onPlayerStateChange,
          onError: this.onPlayerError
        }
      });

      return true;
    } catch (error) {
      console.error('[YouTube] Failed to load video:', error);
      throw error;
    }
  }

  /**
   * Player ready callback
   */
  onPlayerReady(event) {
    console.log('[YouTube] Player ready');
    this.isReady = true;
    
    if (this.stateChangeCallback) {
      this.stateChangeCallback('ready');
    }
  }

  /**
   * Player state change callback
   */
  onPlayerStateChange(event) {
    const state = event.data;
    
    console.log('[YouTube] State changed:', state);

    if (this.stateChangeCallback) {
      let stateName;
      
      switch (state) {
        case window.YT.PlayerState.BUFFERING:
          stateName = 'buffering';
          break;
        case window.YT.PlayerState.PLAYING:
          stateName = 'playing';
          break;
        case window.YT.PlayerState.PAUSED:
          stateName = 'paused';
          break;
        case window.YT.PlayerState.ENDED:
          stateName = 'ended';
          break;
        case window.YT.PlayerState.CUED:
          stateName = 'cued';
          break;
        default:
          stateName = 'unknown';
      }
      
      this.stateChangeCallback(stateName, {
        state,
        currentTime: this.getCurrentTime(),
        duration: this.getDuration()
      });
    }
  }

  /**
   * Player error callback
   */
  onPlayerError(event) {
    console.error('[YouTube] Player error:', event.data);
    
    const errorMessages = {
      2: 'Invalid video ID',
      5: 'HTML5 player error',
      100: 'Video not found',
      101: 'Video cannot be played in embedded player',
      150: 'Video cannot be played in embedded player'
    };

    const errorMessage = errorMessages[event.data] || 'Unknown error';
    
    if (this.errorCallback) {
      this.errorCallback({
        code: event.data,
        message: errorMessage
      });
    }
  }

  /**
   * Play video
   */
  play(startSeconds = null) {
    if (!this.player || !this.isReady) return;
    
    if (startSeconds !== null) {
      this.player.seekTo(startSeconds, true);
    }
    
    this.player.playVideo();
  }

  /**
   * Pause video
   */
  pause() {
    if (!this.player || !this.isReady) return;
    this.player.pauseVideo();
  }

  /**
   * Seek to timestamp
   */
  seek(seconds) {
    if (!this.player || !this.isReady) return;
    this.player.seekTo(seconds, true);
  }

  /**
   * Get current time
   */
  getCurrentTime() {
    if (!this.player || !this.isReady) return 0;
    return this.player.getCurrentTime() || 0;
  }

  /**
   * Get video duration
   */
  getDuration() {
    if (!this.player || !this.isReady) return 0;
    return this.player.getDuration() || 0;
  }

  /**
   * Get playback state
   */
  getState() {
    if (!this.player || !this.isReady) return -1;
    return this.player.getPlayerState();
  }

  /**
   * Set volume (0-100)
   */
  setVolume(volume) {
    if (!this.player || !this.isReady) return;
    this.player.setVolume(volume);
  }

  /**
   * Get volume
   */
  getVolume() {
    if (!this.player || !this.isReady) return 100;
    return this.player.getVolume() || 100;
  }

  /**
   * Get video data
   */
  getVideoData() {
    if (!this.player || !this.isReady) return null;
    return this.player.getVideoData();
  }

  /**
   * Set state change callback
   */
  onStateChange(callback) {
    this.stateChangeCallback = callback;
  }

  /**
   * Set error callback
   */
  onError(callback) {
    this.errorCallback = callback;
  }

  /**
   * Check if playing
   */
  isPlaying() {
    return this.getState() === window.YT.PlayerState.PLAYING;
  }

  /**
   * Check if paused
   */
  isPaused() {
    return this.getState() === window.YT.PlayerState.PAUSED;
  }

  /**
   * Check if ended
   */
  isEnded() {
    return this.getState() === window.YT.PlayerState.ENDED;
  }

  /**
   * Destroy player
   */
  destroy() {
    if (this.player) {
      this.player.destroy();
      this.player = null;
      this.isReady = false;
      this.currentVideoId = null;
    }
  }
}

export default YouTubePlayer;
export { YouTubePlayer };
