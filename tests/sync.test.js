import { describe, it, expect, beforeEach } from 'vitest';
import { SyncEngine } from '../src/sync/engine.js';

describe('Sync Engine', () => {
  let mockIo;
  let syncEngine;

  beforeEach(() => {
    // Mock Socket.IO
    mockIo = {
      to: () => ({
        emit: () => {}
      })
    };
    syncEngine = new SyncEngine(mockIo);
  });

  it('should broadcast play event', () => {
    let emitted = false;
    mockIo.to = (roomId) => ({
      emit: (event, data) => {
        emitted = true;
        expect(event).toBe('sync:play');
        expect(data.type).toBe('sync_play');
        expect(data.timestamp).toBe(120.5);
      }
    });

    syncEngine.broadcastPlay('room1', 120.5, 'user1');
    expect(emitted).toBe(true);
  });

  it('should broadcast pause event', () => {
    let emitted = false;
    mockIo.to = (roomId) => ({
      emit: (event, data) => {
        emitted = true;
        expect(event).toBe('sync:pause');
        expect(data.type).toBe('sync_pause');
      }
    });

    syncEngine.broadcastPause('room1', 120.5, 'user1');
    expect(emitted).toBe(true);
  });

  it('should broadcast seek event', () => {
    let emitted = false;
    mockIo.to = (roomId) => ({
      emit: (event, data) => {
        emitted = true;
        expect(event).toBe('sync:seek');
        expect(data.type).toBe('sync_seek');
        expect(data.timestamp).toBe(300);
      }
    });

    syncEngine.broadcastSeek('room1', 300, 'user1');
    expect(emitted).toBe(true);
  });

  it('should handle heartbeat broadcasting', () => {
    // Heartbeat is started automatically in constructor
    expect(syncEngine.heartbeatInterval).toBeDefined();
  });

  it('should stop heartbeat on cleanup', () => {
    syncEngine.stopHeartbeat();
    expect(syncEngine.heartbeatInterval).toBeNull();
  });
});
