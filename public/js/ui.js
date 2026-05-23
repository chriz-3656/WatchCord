/**
 * UI Controller
 * Handles DOM rendering and user interactions
 */

class UIController {
  constructor() {
    // Element cache
    this.elements = {};
    
    // State
    this.isPlaying = false;
    this.isHost = false;
    this.currentVideoId = null;
    this.participants = [];
    
    // Bind methods
    this.showError = this.showError.bind(this);
  }

  /**
   * Initialize UI - cache DOM elements
   */
  initialize() {
    // Screens
    this.elements.loadingScreen = document.getElementById('loading-screen');
    this.elements.activityScreen = document.getElementById('activity-screen');
    this.elements.loadingText = document.getElementById('loading-text');

    // Header
    this.elements.syncStatus = document.getElementById('sync-status');
    this.elements.statusText = document.querySelector('.status-text');
    this.elements.statusDot = document.querySelector('.status-dot');
    this.elements.participantCount = document.getElementById('participant-count');

    // Player
    this.elements.playerContainer = document.getElementById('player-container');
    this.elements.youtubePlayer = document.getElementById('youtube-player');
    this.elements.btnPlayPause = document.getElementById('btn-play-pause');
    this.elements.iconPlay = this.elements.btnPlayPause?.querySelector('.icon-play');
    this.elements.iconPause = this.elements.btnPlayPause?.querySelector('.icon-pause');
    this.elements.btnSkip = document.getElementById('btn-skip');
    this.elements.progressBar = document.getElementById('progress-bar');
    this.elements.progressFill = document.getElementById('progress-fill');
    this.elements.currentTime = document.getElementById('current-time');
    this.elements.duration = document.getElementById('duration');
    this.elements.volumeSlider = document.getElementById('volume-slider');

    // Now Playing
    this.elements.nowPlaying = document.getElementById('now-playing');
    this.elements.npThumbnail = document.getElementById('np-thumbnail');
    this.elements.npTitle = document.getElementById('np-title');
    this.elements.npAddedBy = document.getElementById('np-added-by');

    // Queue
    this.elements.queueList = document.getElementById('queue-list');
    this.elements.queueCount = document.getElementById('queue-count');
    this.elements.queueForm = document.getElementById('add-to-queue-form');
    this.elements.queueInput = document.getElementById('queue-url-input');

    // Participants
    this.elements.participantsList = document.getElementById('participants-list');

    // Toast
    this.elements.errorToast = document.getElementById('error-toast');
    this.elements.errorMessage = document.getElementById('error-message');

    return true;
  }

  /**
   * Show activity screen (hide loading)
   */
  showActivityScreen() {
    this.elements.loadingScreen?.classList.remove('active');
    this.elements.activityScreen?.classList.add('active');
  }

  /**
   * Update loading text
   */
  setLoadingText(text) {
    if (this.elements.loadingText) {
      this.elements.loadingText.textContent = text;
    }
  }

  /**
   * Update sync status indicator
   */
  setSyncStatus(status, drift = 0) {
    if (!this.elements.syncStatus) return;

    this.elements.syncStatus.className = `sync-status ${status}`;
    
    const statusLabels = {
      synced: 'Synced',
      drifting: `Drifting (${Math.round(drift)}ms)`,
      resyncing: 'Resyncing...'
    };

    if (this.elements.statusText) {
      this.elements.statusText.textContent = statusLabels[status] || status;
    }
  }

  /**
   * Update participant count
   */
  setParticipantCount(count) {
    if (this.elements.participantCount) {
      this.elements.participantCount.innerHTML = `<span class="count">${count}</span> participants`;
    }
  }

  /**
   * Update play/pause button state
   */
  setPlaybackState(playing) {
    this.isPlaying = playing;

    if (this.elements.iconPlay && this.elements.iconPause) {
      if (playing) {
        this.elements.iconPlay.classList.add('hidden');
        this.elements.iconPause.classList.remove('hidden');
      } else {
        this.elements.iconPlay.classList.remove('hidden');
        this.elements.iconPause.classList.add('hidden');
      }
    }
  }

  /**
   * Update progress bar
   */
  setProgress(currentTime, duration) {
    if (!this.elements.progressFill || !this.elements.currentTime || !this.elements.duration) return;

    const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
    this.elements.progressFill.style.width = `${percent}%`;

    this.elements.currentTime.textContent = this.formatTime(currentTime);
    this.elements.duration.textContent = this.formatTime(duration);
  }

  /**
   * Update Now Playing display
   */
  setNowPlaying(item) {
    if (!item) {
      this.elements.nowPlaying?.classList.add('hidden');
      return;
    }

    this.elements.nowPlaying?.classList.remove('hidden');

    // Set thumbnail
    if (item.type === 'youtube' && item.url) {
      const videoId = this.extractYouTubeId(item.url);
      if (videoId) {
        this.elements.npThumbnail.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
    }

    // Set title (use video ID as fallback)
    const title = item.title || (item.type === 'youtube' ? this.extractYouTubeId(item.url) : 'Unknown');
    this.elements.npTitle.textContent = title;

    // Set added by
    if (item.addedBy) {
      this.elements.npAddedBy.textContent = `Added by ${item.addedBy}`;
    } else {
      this.elements.npAddedBy.textContent = '';
    }
  }

  /**
   * Render queue list
   */
  renderQueue(items) {
    if (!this.elements.queueList) return;

    if (!items || items.length === 0) {
      this.elements.queueList.innerHTML = `
        <div class="queue-empty">
          <p>No videos in queue</p>
          <p class="queue-hint">Paste a YouTube URL above to add</p>
        </div>
      `;
      
      if (this.elements.queueCount) {
        this.elements.queueCount.textContent = '0 items';
      }
      return;
    }

    this.elements.queueList.innerHTML = items.map((item, index) => `
      <div class="queue-item" data-index="${index}">
        <div class="queue-drag-handle">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </div>
        <img class="queue-item-thumbnail" src="${this.getThumbnailUrl(item.url)}" alt="">
        <div class="queue-item-info">
          <div class="queue-item-title">${this.escapeHtml(item.title || 'Unknown')}</div>
          <div class="queue-item-meta">
            <span class="queue-item-added-by">
              <span class="queue-item-avatar"></span>
              ${this.escapeHtml(item.addedBy || 'Unknown')}
            </span>
          </div>
        </div>
        <div class="queue-item-actions">
          <button class="queue-item-btn btn-remove" data-index="${index}" title="Remove">
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
        <span class="queue-item-number">${index + 1}</span>
      </div>
    `).join('');

    if (this.elements.queueCount) {
      this.elements.queueCount.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Render participants list
   */
  renderParticipants(participants, hostId) {
    if (!this.elements.participantsList) return;

    this.participants = participants || [];

    if (participants.length === 0) {
      this.elements.participantsList.innerHTML = '<p style="padding: 16px; color: var(--text-muted);">No participants</p>';
      return;
    }

    this.elements.participantsList.innerHTML = participants.map(p => {
      const isHostUser = p.user?.id === hostId;
      const avatarUrl = this.getUserAvatar(p.user);
      
      return `
        <div class="participant-item" style="display: flex; align-items: center; gap: 8px; padding: 8px;">
          <img src="${avatarUrl}" alt="" style="width: 32px; height: 32px; border-radius: 50%;">
          <span style="flex: 1; font-size: 14px;">${this.escapeHtml(p.user?.global_name || p.user?.username || 'Unknown')}</span>
          ${isHostUser ? '<span title="Host">👑</span>' : ''}
        </div>
      `;
    }).join('');

    this.setParticipantCount(participants.length);
  }

  /**
   * Set host status
   */
  setIsHost(isHost) {
    this.isHost = isHost;
    
    // Visual feedback for non-host users
    if (this.elements.btnPlayPause) {
      this.elements.btnPlayPause.disabled = !isHost;
      this.elements.btnPlayPause.title = isHost ? 'Play/Pause' : 'Only host can control playback';
    }
    
    if (this.elements.btnSkip) {
      this.elements.btnSkip.disabled = !isHost;
      this.elements.btnSkip.title = isHost ? 'Skip' : 'Only host can skip';
    }
  }

  /**
   * Show error toast
   */
  showError(message, duration = 3000) {
    if (!this.elements.errorToast || !this.elements.errorMessage) return;

    this.elements.errorMessage.textContent = message;
    this.elements.errorToast.classList.remove('hidden');

    setTimeout(() => {
      this.elements.errorToast.classList.add('hidden');
    }, duration);
  }

  /**
   * Format time in seconds to MM:SS
   */
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Extract YouTube ID from URL
   */
  extractYouTubeId(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname;

      if (hostname.includes('youtu.be')) {
        return pathname.slice(1).split('?')[0];
      }

      if (hostname.includes('youtube.com')) {
        if (pathname.includes('/watch')) {
          const params = new URLSearchParams(urlObj.search);
          return params.get('v');
        }
        if (pathname.includes('/shorts/')) {
          return pathname.split('/shorts/')[1].split('?')[0];
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get thumbnail URL
   */
  getThumbnailUrl(url) {
    const videoId = this.extractYouTubeId(url);
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="68"><rect fill="%232b2d31" width="120" height="68"/></svg>';
  }

  /**
   * Get user avatar URL
   */
  getUserAvatar(user) {
    if (!user) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle fill="%235865f2" cx="16" cy="16" r="16"/></svg>';
    
    if (user.avatar) {
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`;
    }
    
    const discrim = parseInt(user.discriminator) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${discrim}.png?size=32`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Clear queue input
   */
  clearQueueInput() {
    if (this.elements.queueInput) {
      this.elements.queueInput.value = '';
    }
  }
}

// Singleton instance
const uiController = new UIController();

export default uiController;
export { UIController };
