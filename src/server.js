import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import config from './config/index.js';
import setupWebSocket from './websocket/index.js';
import logger from './utils/logger.js';
import roomManager from './rooms/manager.js';
import queueManager from './queue/manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://discord.com",
        "https://www.youtube.com",
        "https://youtube.com",
        "https://cdn.socket.io"
      ],
      frameSrc: [
        "'self'",
        "https://www.youtube.com",
        "https://youtube.com",
        "https://www.twitch.tv",
        "https://twitch.tv",
        "https://discord.com"
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:", "https://discord.com"],
      workerSrc: ["'self'", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false, // Required for Discord iframe
  crossOriginOpenerPolicy: false
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = roomManager.getStats();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    rooms: stats.totalRooms,
    participants: stats.totalParticipants
  });
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  const roomStats = roomManager.getStats();
  const queueStats = queueManager.getStats();
  
  res.json({
    rooms: roomStats,
    queues: queueStats,
    uptime: process.uptime()
  });
});

// OAuth2 token exchange endpoint
app.post('/api/oauth/exchange', async (req, res) => {
  try {
    const { accessCode } = req.body;
    
    if (!accessCode) {
      return res.status(400).json({ error: 'Missing accessCode' });
    }

    // Import dynamically to avoid circular dependency
    const { exchangeToken, getUserInfo } = await import('./discord/oauth.js');
    
    // Exchange code for token
    const tokenData = await exchangeToken(accessCode);
    
    // Get user info
    const userInfo = await getUserInfo(tokenData.accessToken);
    
    res.json({
      accessToken: tokenData.accessToken,
      expiresIn: tokenData.expiresIn,
      user: userInfo
    });
  } catch (error) {
    logger.error('OAuth exchange failed', { error: error.message });
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Express error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Setup WebSocket
const io = setupWebSocket(server);

// Start server
server.listen(config.port, () => {
  logger.info(`Server started on port ${config.port}`, {
    environment: config.nodeEnv,
    clientUrl: config.clientUrl
  });
  console.log(`\n🎬 Watch Together Server running on port ${config.port}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🔗 Client URL: ${config.clientUrl}`);
  console.log(`💚 Health check: http://localhost:${config.port}/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
export { server, io };
