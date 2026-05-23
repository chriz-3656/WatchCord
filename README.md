# 🎬 Watch Together

A **private, self-hosted** synchronized watch party platform built for Discord using the official [Discord Embedded App SDK](https://discord.com/developers/docs/activities/overview).

## What This Is

- ✅ A **Discord Activity** that runs inside voice channels
- ✅ **Synchronized playback** - everyone watches the same video at the same time
- ✅ **YouTube support** with queue management
- ✅ **Host authority system** with automatic migration
- ✅ **Zero ban risk** - uses only official Discord APIs
- ✅ **Self-hostable** - run your own private instance

## What This Is NOT

- ❌ **NOT a video rebroadcaster** - no video/audio passes through the server
- ❌ **NOT a selfbot** - uses official Discord developer platform
- ❌ **NOT RTP injection** - no reverse engineering involved
- ❌ **NOT for public distribution** - designed for private communities

## How It Works

```
┌─────────────────┐
│ Discord Voice   │
│ Channel         │
└────────┬────────┘
         │ Users launch Activity
         ▼
┌─────────────────┐
│ Discord         │
│ Embedded App    │
│ (iframe)        │
└────────┬────────┘
         │ Each user loads video independently
         ▼
┌─────────────────┐
│ Your Browser    │◄─── YouTube/HLS/MP4
│ (video player)  │     (direct from source)
└────────┬────────┘
         │
         │ WebSocket sync events only:
         │ - play/pause/seek commands
         │ - current timestamp
         │ - queue state
         ▼
┌─────────────────┐
│ Sync Server     │◄─── Broadcasts to all clients
│ (Node.js +      │     No media relay!
│  Socket.IO)     │
└─────────────────┘
```

**Key insight:** Each participant loads the video in their own browser. The server only synchronizes *when* to play/pause/seek, not the actual video content.

## Prerequisites

1. **Node.js 20+** - [Download](https://nodejs.org/)
2. **Discord Application** - [Create one](https://discord.com/developers/applications)
3. **HTTPS URL** - For local dev, use [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) or ngrok

## Quick Start

### 1. Install Dependencies

```bash
chmod +x install.sh
./install.sh
```

Or manually:
```bash
npm install
cp .env.example .env
```

### 2. Configure Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Copy your **Application ID**
4. Go to **OAuth2** section and copy your **Client Secret**
5. Enable **Activities** in the app settings

### 3. Set Up HTTPS Tunnel (Local Development)

Discord Activities require HTTPS even for local testing.

**Install cloudflared:**
```bash
# macOS
brew install cloudflared

# Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

**Start tunnel:**
```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the generated URL (e.g., `https://your-tunnel.trycloudflare.com`)

### 4. Configure Environment

Edit `.env`:
```env
DISCORD_APP_ID=your_app_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
CLIENT_URL=https://your-tunnel-url.trycloudflare.com
PORT=3000
```

### 5. Configure Discord Activity URL

In Discord Developer Portal:
1. Go to your application → **Activities**
2. Click **Add Activity** (or edit existing)
3. Set **URL Mappings** to your HTTPS tunnel URL
4. Save changes

### 6. Start the Server

```bash
npm start
```

Server will start on `http://localhost:3000`

### 7. Launch in Discord

1. Join a voice channel in a server where you have permissions
2. Click **Activities** (rocket icon) in the voice channel controls
3. Select your activity from the list
4. The watch party will launch!

## Features

### Playback Controls
- ▶️ **Play/Pause** - Synchronized across all participants
- ⏩ **Seek** - Jump to any timestamp (host only)
- ⏭️ **Skip** - Skip to next video in queue (host only)
- 🔊 **Volume** - Local control (not synced)

### Queue System
- 📋 **Add videos** - Paste YouTube URLs
- 🗑️ **Remove videos** - Host can manage queue
- ⏭️ **Auto-advance** - Next video plays automatically
- 👤 **Attribution** - Shows who added each video

### Synchronization
- 💓 **Heartbeat** - Server sends timestamp every 2 seconds
- 🔄 **Drift correction** - Auto-corrects if >300ms off
- 🎯 **Late join sync** - New users catch up immediately
- 👑 **Host migration** - Automatic if host leaves

### Keyboard Shortcuts (Host Only)
- `Space` or `K` - Play/Pause
- `J` - Rewind 10 seconds
- `L` - Forward 10 seconds

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | Vanilla JS | Video player, UI, Discord SDK |
| Backend | Node.js + Express | HTTP server, OAuth2 |
| WebSocket | Socket.IO | Real-time sync |
| Storage | In-memory (optional SQLite) | Room state, queues |

### Directory Structure

```
/
├── public/              # Frontend (served as static)
│   ├── index.html       # Activity entry point
│   ├── css/             # Stylesheets
│   └── js/              # JavaScript modules
├── src/                 # Backend
│   ├── server.js        # Express app
│   ├── websocket/       # Socket.IO handlers
│   ├── rooms/           # Room management
│   ├── sync/            # Sync engine
│   └── queue/           # Queue management
├── tests/               # Test suite
├── .env.example         # Environment template
├── Dockerfile           # Container definition
└── docker-compose.yml   # Multi-service setup
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_APP_ID` | - | Discord Application ID |
| `DISCORD_CLIENT_SECRET` | - | Discord OAuth2 Client Secret |
| `CLIENT_URL` | - | HTTPS URL of your server |
| `PORT` | 3000 | Server port |
| `MAX_ROOM_SIZE` | 50 | Max participants per room |
| `MAX_QUEUE_SIZE` | 100 | Max videos in queue |
| `ROOM_IDLE_TIMEOUT_MS` | 1800000 | Destroy empty rooms after 30 min |
| `HEARTBEAT_INTERVAL_MS` | 2000 | Sync heartbeat interval |
| `DRIFT_SOFT_THRESHOLD_MS` | 300 | Minor drift threshold |
| `DRIFT_HARD_THRESHOLD_MS` | 1000 | Major drift threshold |
| `SYNC_EVENTS_PER_SECOND` | 5 | Rate limit for sync events |
| `QUEUE_ADDS_PER_MINUTE` | 10 | Rate limit for queue adds |

## Deployment

### Docker

```bash
docker-compose up -d
```

### Production Considerations

1. **Use a real domain** with proper SSL certificate
2. **Set up Redis** for horizontal scaling (see docker-compose.yml)
3. **Configure rate limiting** appropriately for your user count
4. **Monitor server resources** - WebSocket connections use memory
5. **Set up logging** - Check `logs/` directory

## Troubleshooting

### "Discord Application ID not found"
- Make sure you've set `DISCORD_APP_ID` in `.env`
- Restart the server after changing environment variables

### "Token exchange failed"
- Verify `DISCORD_CLIENT_SECRET` is correct
- Check that OAuth2 is enabled in Discord Developer Portal

### Activity doesn't load in Discord
- Ensure `CLIENT_URL` is HTTPS
- Verify URL Mappings in Discord Developer Portal matches your URL
- Check browser console for errors (Ctrl+Shift+I in Discord)

### Video won't play
- Some videos are embedding-disabled by the uploader
- Age-restricted videos may not work in embedded player
- Check for error messages in the UI

### Participants out of sync
- Check network latency between participants
- Host should have stable internet connection
- Drift correction will auto-fix minor issues

## Security

This project implements several security measures:

- ✅ **Input validation** - All URLs validated server-side
- ✅ **CSP headers** - Prevents XSS via helmet.js
- ✅ **Rate limiting** - Prevents abuse
- ✅ **No client secrets** - Discord secret stays server-side
- ✅ **XSS prevention** - Uses textContent, not innerHTML

See [RISKS.md](./RISKS.md) for known limitations and mitigations.

## Testing

```bash
npm test
```

Test coverage includes:
- Sync engine behavior
- Drift correction logic
- Queue operations
- Room management
- YouTube URL parsing
- Reconnection handling

## Development

### Running in Development Mode

```bash
npm run dev
```

Enables hot reloading for backend changes.

### Adding New Media Types

To support additional video sources:

1. Add validation in `src/media/resolver.js`
2. Implement player in `public/js/youtube.js` (or create new player module)
3. Update CSP headers in `src/server.js`

## License

MIT License - See LICENSE file for details.

## Disclaimer

This project is for **educational and research purposes only**. 

- Not affiliated with Discord Inc.
- Not affiliated with YouTube/Google
- Use responsibly and respect content copyrights
- Do not use for commercial purposes without proper licensing

## Support

For issues and feature requests, please open an issue on GitHub.

---

Built with 💚 using the official Discord Embedded App SDK
