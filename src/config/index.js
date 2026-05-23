import dotenv from 'dotenv';

dotenv.config();

const config = {
  // Discord
  discordAppId: process.env.DISCORD_APP_ID,
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET,
  
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL,
  
  // Room settings
  maxRoomSize: parseInt(process.env.MAX_ROOM_SIZE || '50', 10),
  maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE || '100', 10),
  roomIdleTimeoutMs: parseInt(process.env.ROOM_IDLE_TIMEOUT_MS || '1800000', 10),
  
  // Sync settings
  heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS || '2000', 10),
  driftSoftThresholdMs: parseInt(process.env.DRIFT_SOFT_THRESHOLD_MS || '300', 10),
  driftHardThresholdMs: parseInt(process.env.DRIFT_HARD_THRESHOLD_MS || '1000', 10),
  
  // Rate limiting
  syncEventsPerSecond: parseInt(process.env.SYNC_EVENTS_PER_SECOND || '5', 10),
  queueAddsPerMinute: parseInt(process.env.QUEUE_ADDS_PER_MINUTE || '10', 10),
  
  // Persistence
  dbPath: process.env.DB_PATH || './data/sessions.db',
  
  // Redis (optional)
  redisUrl: process.env.REDIS_URL
};

// Validate required config
const requiredConfig = ['discordAppId', 'discordClientSecret', 'clientUrl'];
const missing = requiredConfig.filter(key => !config[key]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please copy .env.example to .env and fill in the values.');
  process.exit(1);
}

export default config;
