/**
 * Discord Embedded App SDK Integration
 * Handles OAuth2, participant identification, and activity lifecycle
 */

import { DiscordSDK } from 'https://discord.com/embedded-app-sdk';

class DiscordIntegration {
  constructor() {
    this.sdk = null;
    this.currentUser = null;
    this.participants = [];
    this.channelId = null;
    this.guildId = null;
    this.accessToken = null;
    this.isConnected = false;
  }

  /**
   * Initialize Discord SDK
   */
  async initialize() {
    try {
      // Get application ID from environment or default
      const appId = window.DISCORD_APP_ID || this.extractAppIdFromUrl();
      
      if (!appId) {
        throw new Error('Discord Application ID not found');
      }

      console.log('[Discord] Initializing SDK with app ID:', appId);
      
      // Initialize SDK
      this.sdk = new DiscordSDK(appId);
      
      // Ready event
      await this.sdk.ready();
      
      console.log('[Discord] SDK ready');
      
      // Authenticate
      await this.authenticate();
      
      return true;
    } catch (error) {
      console.error('[Discord] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Extract app ID from URL query params (for testing)
   */
  extractAppIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('application_id');
  }

  /**
   * Authenticate with Discord and get user info
   */
  async authenticate() {
    try {
      console.log('[Discord] Starting authentication...');
      
      // Authorize with required scopes
      const auth = await this.sdk.commands.authorize({
        client_id: this.sdk.clientId,
        response_type: 'code',
        state: crypto.randomUUID(),
        prompt: 'none',
        scope: ['identify', 'guilds', 'rpc.voice.read']
      });

      console.log('[Discord] Authorization received');

      // Exchange code for token via our backend
      const response = await fetch('/api/oauth/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accessCode: auth.code
        })
      });

      if (!response.ok) {
        throw new Error('Token exchange failed');
      }

      const data = await response.json();
      
      this.accessToken = data.accessToken;
      this.currentUser = data.user;
      
      console.log('[Discord] Authenticated as:', this.currentUser.username);
      
      // Get channel context
      await this.getChannelContext();
      
      // Subscribe to participant updates
      this.subscribeToParticipants();
      
      this.isConnected = true;
      
      return {
        user: this.currentUser,
        accessToken: this.accessToken
      };
    } catch (error) {
      console.error('[Discord] Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Get channel context from Discord
   */
  async getChannelContext() {
    try {
      const context = await this.sdk.commands.getContext();
      
      this.channelId = context.channel.id;
      this.guildId = context.guild?.id;
      
      console.log('[Discord] Channel context:', {
        channelId: this.channelId,
        guildId: this.guildId
      });
      
      return {
        channelId: this.channelId,
        guildId: this.guildId
      };
    } catch (error) {
      console.error('[Discord] Failed to get channel context:', error);
      // For local testing without Discord context
      this.channelId = 'local_test_channel';
      this.guildId = 'local_test_guild';
      return {
        channelId: this.channelId,
        guildId: this.guildId
      };
    }
  }

  /**
   * Subscribe to participant updates
   */
  subscribeToParticipants() {
    if (!this.sdk) return;

    this.sdk.subscribe(
      'ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE',
      (event) => {
        console.log('[Discord] Participants updated:', event);
        this.participants = event.participants || [];
        
        // Emit custom event for UI to handle
        window.dispatchEvent(new CustomEvent('discord:participants_update', {
          detail: { participants: this.participants }
        }));
      }
    );

    // Initial participant fetch
    this.fetchParticipants();
  }

  /**
   * Fetch current participants
   */
  async fetchParticipants() {
    try {
      const activityInstance = await this.sdk.commands.getActivityInstance();
      this.participants = activityInstance?.participants || [];
      
      window.dispatchEvent(new CustomEvent('discord:participants_update', {
        detail: { participants: this.participants }
      }));
    } catch (error) {
      console.error('[Discord] Failed to fetch participants:', error);
    }
  }

  /**
   * Get current user info
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Get channel ID
   */
  getChannelId() {
    return this.channelId;
  }

  /**
   * Get participants
   */
  getParticipants() {
    return this.participants;
  }

  /**
   * Check if connected to Discord
   */
  isReady() {
    return this.isConnected && this.currentUser !== null;
  }

  /**
   * Get user avatar URL
   */
  getUserAvatar(userId, format = 'png', size = 32) {
    if (!userId) return null;
    
    const user = this.participants.find(p => p.user?.id === userId);
    if (!user) return null;
    
    const avatarHash = user.user?.avatar;
    if (!avatarHash) {
      // Default avatar based on discriminator
      const discrim = parseInt(user.user?.discriminator) % 5;
      return `https://cdn.discordapp.com/embed/avatars/${discrim}.png?size=${size}`;
    }
    
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${format}?size=${size}`;
  }
}

// Singleton instance
const discordIntegration = new DiscordIntegration();

export default discordIntegration;
export { DiscordIntegration };
