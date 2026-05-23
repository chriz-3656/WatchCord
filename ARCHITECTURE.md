# Architecture Documentation

## System Overview

Watch Together is a real-time synchronized media playback platform built as a Discord Embedded Activity. The system follows a client-server architecture with WebSocket-based synchronization.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      DISCORD PLATFORM                         │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Voice       │    │ Activity     │    │ OAuth2       │    │
│  │ Channel     │───▶│ Launcher     │───▶│ Token        │    │
│  │             │    │              │    │ Exchange     │    │
│  └─────────────┘    └──────────────┘    └──────────────┘    │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    EMBEDDED WEB APP                           │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Discord SDK │    │ Video        │    │ WebSocket    │    │
│  │ Integration │    │ Player       │    │ Client       │    │
│  └─────────────┘    └──────────────┘    └──────────────┘    │
│         │                  │                   │              │
│         │                  │                   │              │
│         ▼                  ▼                   ▼              │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ User Auth   │    │ YouTube      │    │ Sync Events  │    │
│  │ & Context   │    │ Iframe API   │    │ & Commands   │    │
│  └─────────────┘    └──────────────┘    └──────────────┘    │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (Socket.IO)
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                     BACKEND SERVER                            │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Express.js  │    │ Socket.IO    │    │ Room         │    │
│  │ HTTP Server │    │ WebSocket    │    │ Manager      │    │
│  └─────────────┘    └──────────────┘    └──────────────┘    │
│         │                  │                   │              │
│         ▼                  ▼                   ▼              │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ OAuth2      │    │ Sync Engine  │    │ Queue        │    │
│  │ Endpoint    │    │ & Heartbeat  │    │ Manager      │    │
│  └─────────────┘    └──────────────┘    └──────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Modules

#### `discord.js` - Discord SDK Integration
- Initializes Discord Embedded App SDK
- Handles OAuth2 authorization flow
- Exchanges access code for token via backend
- Subscribes to participant updates
- Provides channel context

#### `youtube.js` - YouTube Player Wrapper
- Lazy-loads YouTube iframe API
- Abstracts player operations (play, pause, seek)
- Reports state changes to sync engine
- Handles errors gracefully

#### `websocket.js` - WebSocket Client
- Manages Socket.IO connection
- Sends/receives sync events
- Handles reconnection logic
- Emits local events for other modules

#### `sync.js` - Client-Side Sync Engine
- Monitors host timestamps
- Detects drift (>300ms soft, >1000ms hard)
- Triggers corrections when needed
- Tracks sync status

#### `queue.js` - Queue State Management
- Maintains local queue copy
- Notifies UI of changes
- Handles add/remove/reorder

#### `ui.js` - UI Controller
- Renders all visual elements
- Handles user interactions
- Updates based on state changes
- Prevents XSS via escaping

#### `app.js` - Application Coordinator
- Bootstraps all modules
- Coordinates initialization sequence
- Routes events between components
- Manages lifecycle

### 2. Backend Modules

#### `server.js` - Express Application
- Serves static frontend files
- Handles OAuth2 token exchange
- Provides health check endpoint
- Configures security headers (helmet)

#### `websocket/index.js` - WebSocket Handler
- Sets up Socket.IO server
- Routes incoming events
- Enforces rate limits
- Manages room joins/leaves

#### `rooms/manager.js` - Room Management
- Creates/joins/destroys rooms
- Tracks participants per room
- Handles host migration
- Cleans up idle rooms

#### `rooms/state.js` - Room State Model
- Stores room metadata
- Tracks playback state
- Manages participant list
- Serializes state for clients

#### `sync/engine.js` - Sync Engine
- Broadcasts play/pause/seek
- Sends heartbeats every 2s
- Handles auto-advance on video end
- Pushes full state to late joiners

#### `sync/ratelimit.js` - Rate Limiter
- Limits sync events per second
- Limits queue adds per minute
- Prevents abuse

#### `queue/manager.js` - Queue Manager
- Validates media URLs
- Manages queue per room
- Enforces size limits
- Detects media types

#### `media/resolver.js` - Media Resolver
- Extracts YouTube video IDs
- Validates URL formats
- Blocks dangerous protocols
- Generates thumbnail URLs

#### `discord/oauth.js` - OAuth2 Handler
- Exchanges access codes
- Fetches user info
- Validates tokens

## Data Flow

### Initialization Sequence

```
1. Page loads in Discord iframe
2. discord.js initializes SDK
3. OAuth2 authorization
4. Backend exchanges code for token
5. WebSocket connects
6. Client joins room via channel ID
7. Receives initial state (if exists)
8. UI renders
9. Ready for interaction
```

### Playback Synchronization

```
Host clicks Play
    │
    ├─► Local player.play()
    │
    └─► ws:play event
            │
            ▼
        Server receives
            │
            ├─► Validate sender is host
            ├─► Check rate limit
            └─► Broadcast sync:play
                    │
                    ├─► All clients receive
                    └─► Each client player.play()
```

### Heartbeat Flow

```
Server (every 2s)
    │
    ├─► Calculate current timestamp
    │   (based on last known state + elapsed time)
    │
    └─► Emit heartbeat to all rooms
            │
            ├─► Clients receive
            ├─► Compare with local timestamp
            ├─► Calculate drift
            └─► Correct if needed
```

### Host Migration

```
Host disconnects
    │
    ▼
Server detects disconnect
    │
    ├─► Remove from participants
    │
    └─► Check if was host
            │
            ├─► Find longest-present participant
            ├─► Promote to host
            └─► Broadcast sync:host
                    │
                    └─► All clients update UI
```

## State Management

### Room State Structure

```javascript
{
  roomId: string,          // Channel ID
  channelId: string,
  createdAt: number,
  lastActivityAt: number,
  participants: Map,       // userId -> userInfo
  hostId: string | null,
  isPlaying: boolean,
  currentTimestamp: number,
  queue: Array,            // MediaItem[]
  currentItem: MediaItem | null,
  history: Array           // Previously played items
}
```

### MediaItem Structure

```javascript
{
  id: string,
  url: string,
  type: 'youtube' | 'twitch' | 'mp4' | 'hls',
  addedBy: string,         // User ID
  addedAt: number,
  title?: string,
  thumbnail?: string
}
```

### Sync Event Protocol

**Client → Server:**
```json
{
  "event": "play" | "pause" | "seek" | "queue_add",
  "roomId": "channel-id",
  "userId": "user-id",
  "timestamp": 120.5,
  "serverTime": 1716000000000
}
```

**Server → Client:**
```json
{
  "type": "sync_play" | "sync_pause" | "sync_seek",
  "timestamp": 120.5,
  "hostId": "host-user-id",
  "serverTime": 1716000000001
}
```

## Security Model

### Threat Mitigations

| Threat | Mitigation |
|--------|------------|
| XSS | textContent over innerHTML, CSP headers |
| CSRF | Discord OAuth2 state parameter |
| Rate abuse | Per-client event limiting |
| Injection | URL validation, allowlist |
| Secret exposure | Client secret server-side only |
| MITM | HTTPS required, WSS for WebSocket |

### Content Security Policy

```javascript
{
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "https://discord.com", "https://www.youtube.com"],
  frameSrc: ["'self'", "https://www.youtube.com", "https://discord.com"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: ["'self'", "wss:", "https://discord.com"]
}
```

## Scalability Considerations

### Current Limitations

- Single server = single process
- All room state in memory
- No horizontal scaling without Redis

### Scaling Path

1. **Redis Adapter** - Socket.IO supports Redis pub/sub for multi-server
2. **External State** - Move room state to Redis/database
3. **Load Balancer** - Distribute WebSocket connections
4. **CDN** - Serve static assets from edge

### Resource Usage

- ~1KB per connected client (WebSocket overhead)
- ~10KB per active room (state + queue)
- Heartbeat: small JSON every 2s per room
- CPU: minimal (mostly I/O bound)

## Error Handling

### Client-Side

- Network disconnect → Auto-reconnect with exponential backoff
- YouTube error → Show user-friendly message
- Sync failure → Continue local playback, mark as drifting

### Server-Side

- Invalid event → Log warning, ignore event
- Room not found → Create new room or reject
- Database error → Log error, continue with in-memory
- OAuth failure → Return 401, client shows error

## Testing Strategy

### Unit Tests
- YouTube URL parsing
- Queue operations
- Room state transitions
- Rate limiter behavior

### Integration Tests
- WebSocket event flow
- Host migration sequence
- Drift correction logic

### Manual Testing
- Multi-client sync accuracy
- Network latency simulation
- Discord iframe behavior

## Future Enhancements

### Planned Features
- [ ] Twitch embed support
- [ ] HLS.js integration
- [ ] Shared chat overlay
- [ ] Emoji reactions
- [ ] Session persistence
- [ ] Custom themes

### Technical Improvements
- [ ] Redis adapter for scaling
- [ ] SQLite persistence layer
- [ ] Metrics/monitoring dashboard
- [ ] Admin panel
- [ ] API documentation

---

This architecture prioritizes:
1. **Simplicity** - Vanilla JS, minimal dependencies
2. **Reliability** - Automatic recovery, graceful degradation
3. **Security** - Defense in depth, principle of least privilege
4. **Maintainability** - Clear module boundaries, documented interfaces
