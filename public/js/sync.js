/**
 * Playback Synchronization Engine
 * Handles drift correction and timestamp synchronization
 */

class SyncEngine {
  constructor(config = {}) {
    // Thresholds in milliseconds
    this.softThreshold = config.softThreshold || 300;
    this.hardThreshold = config.hardThreshold || 1000;
    
    // State
    this.lastHostTimestamp = 0;
    this.lastServerTime = 0;
    this.localTimestamp = 0;
    this.isPlaying = false;
    this.hostId = null;
    this.isHost = false;
    this.driftAmount = 0;
    this.syncStatus = 'synced'; // synced | drifting | resyncing
    
    // Timing
    this.lastCorrectionTime = 0;
    this.correctionCooldown = 500; // ms between corrections
    
    // Callbacks
    this.onDriftDetected = null;
    this.onSyncStatusChange = null;
  }

  /**
   * Update with host timestamp from heartbeat
   */
  updateHostTimestamp(timestamp, serverTime) {
    const now = Date.now();
    
    // Calculate elapsed time since last update
    const elapsedServerTime = serverTime - this.lastServerTime;
    const elapsedRealTime = now - this.lastCorrectionTime;
    
    // Estimate where host should be now
    if (this.isPlaying && this.lastHostTimestamp > 0) {
      const expectedTimestamp = this.lastHostTimestamp + (elapsedRealTime / 1000);
      const drift = Math.abs(expectedTimestamp - timestamp) * 1000; // Convert to ms
      
      this.driftAmount = drift;
      this.updateSyncStatus(drift);
      
      // Check if correction needed
      if (drift > this.softThreshold && !this.isHost) {
        this.handleDrift(timestamp, drift);
      }
    }
    
    this.lastHostTimestamp = timestamp;
    this.lastServerTime = serverTime;
    this.lastCorrectionTime = now;
  }

  /**
   * Update sync status based on drift
   */
  updateSyncStatus(drift) {
    let newStatus;
    
    if (drift < this.softThreshold) {
      newStatus = 'synced';
    } else if (drift < this.hardThreshold) {
      newStatus = 'drifting';
    } else {
      newStatus = 'resyncing';
    }
    
    if (newStatus !== this.syncStatus) {
      this.syncStatus = newStatus;
      
      if (this.onSyncStatusChange) {
        this.onSyncStatusChange(newStatus, drift);
      }
    }
  }

  /**
   * Handle detected drift
   */
  handleDrift(hostTimestamp, driftMs) {
    const now = Date.now();
    
    // Respect cooldown
    if (now - this.lastCorrectionTime < this.correctionCooldown) {
      return;
    }
    
    this.lastCorrectionTime = now;
    
    if (this.onDriftDetected) {
      this.onDriftDetected({
        drift: driftMs,
        hostTimestamp,
        needsHardSeek: driftMs > this.hardThreshold,
        syncStatus: this.syncStatus
      });
    }
  }

  /**
   * Apply soft correction (gradual speed adjustment)
   * Note: YouTube doesn't support playback rate for sync, so we just notify
   */
  applySoftCorrection(hostTimestamp) {
    console.log('[Sync] Soft correction suggested:', hostTimestamp);
    // In a real implementation, we might adjust playbackRate slightly
  }

  /**
   * Apply hard correction (immediate seek)
   */
  applyHardCorrection(hostTimestamp) {
    console.log('[Sync] Hard correction: seeking to', hostTimestamp);
    
    if (this.onDriftDetected) {
      this.onDriftDetected({
        type: 'hard_seek',
        timestamp: hostTimestamp
      });
    }
  }

  /**
   * Set local playback state
   */
  setLocalState(isPlaying, timestamp) {
    this.localTimestamp = timestamp;
    this.isPlaying = isPlaying;
  }

  /**
   * Set host status
   */
  setIsHost(isHost, hostId) {
    this.isHost = isHost;
    this.hostId = hostId;
    
    // Host is always considered synced
    if (isHost) {
      this.syncStatus = 'synced';
      this.driftAmount = 0;
    }
  }

  /**
   * Get current sync status
   */
  getStatus() {
    return {
      syncStatus: this.syncStatus,
      driftAmount: this.driftAmount,
      isHost: this.isHost,
      hostId: this.hostId
    };
  }

  /**
   * Reset sync state
   */
  reset() {
    this.lastHostTimestamp = 0;
    this.lastServerTime = 0;
    this.localTimestamp = 0;
    this.driftAmount = 0;
    this.syncStatus = 'synced';
    this.isPlaying = false;
  }

  /**
   * Calculate latency from heartbeat round-trip
   */
  calculateLatency(sendTime, receiveTime) {
    return (receiveTime - sendTime) / 2;
  }

  /**
   * Adjust timestamp for network latency
   */
  compensateLatency(timestamp, latency) {
    // Add half the RTT to estimate actual host time
    return timestamp + (latency / 1000);
  }
}

export default SyncEngine;
export { SyncEngine };
