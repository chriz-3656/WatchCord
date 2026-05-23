import { describe, it, expect } from 'vitest';
import SyncEngine from '../public/js/sync.js';

describe('Drift Correction', () => {
  let sync;

  beforeEach(() => {
    sync = new SyncEngine({
      softThreshold: 300,
      hardThreshold: 1000
    });
  });

  it('should not correct drift under 300ms', () => {
    let correctionTriggered = false;
    sync.onDriftDetected = () => {
      correctionTriggered = true;
    };

    // Simulate small drift (200ms)
    sync.updateHostTimestamp(120.2, Date.now());
    
    // No correction should be triggered for minor drift
    expect(correctionTriggered).toBe(false);
    expect(sync.syncStatus).toBe('synced');
  });

  it('should trigger soft correction for 300-1000ms drift', () => {
    let driftData = null;
    sync.onDriftDetected = (data) => {
      driftData = data;
    };

    // Set up playing state
    sync.setLocalState(true, 120);
    sync.lastHostTimestamp = 120;
    sync.lastServerTime = Date.now();
    sync.isPlaying = true;

    // Simulate moderate drift (500ms)
    setTimeout(() => {
      sync.updateHostTimestamp(120.5, Date.now());
    }, 500);

    // Drift status should be drifting
    expect(sync.syncStatus).toBe('drifting');
  });

  it('should trigger hard seek for >1000ms drift', () => {
    let driftData = null;
    sync.onDriftDetected = (data) => {
      driftData = data;
    };

    // Set up playing state
    sync.setLocalState(true, 120);
    sync.lastHostTimestamp = 120;
    sync.lastServerTime = Date.now();
    sync.isPlaying = true;

    // Simulate large drift (1500ms)
    setTimeout(() => {
      sync.updateHostTimestamp(121.5, Date.now());
    }, 500);

    // Drift status should be resyncing
    expect(sync.syncStatus).toBe('resyncing');
  });

  it('should update sync status based on drift', () => {
    let statusChanged = false;
    sync.onSyncStatusChange = (status) => {
      statusChanged = true;
    };

    sync.updateHostTimestamp(120, Date.now());
    
    expect(statusChanged).toBe(true);
  });

  it('should respect correction cooldown', () => {
    let callCount = 0;
    sync.onDriftDetected = () => {
      callCount++;
    };

    sync.lastCorrectionTime = Date.now();
    
    // Multiple rapid calls should be limited by cooldown
    sync.handleDrift(120, 500);
    sync.handleDrift(120, 500);
    
    // Should only trigger once due to cooldown
    expect(callCount).toBeLessThanOrEqual(1);
  });

  it('should reset state correctly', () => {
    sync.syncStatus = 'drifting';
    sync.driftAmount = 500;
    sync.isPlaying = true;
    
    sync.reset();
    
    expect(sync.syncStatus).toBe('synced');
    expect(sync.driftAmount).toBe(0);
    expect(sync.isPlaying).toBe(false);
  });

  it('should calculate latency correctly', () => {
    const sendTime = 1000;
    const receiveTime = 1100;
    
    const latency = sync.calculateLatency(sendTime, receiveTime);
    
    expect(latency).toBe(50);
  });
});
