import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Exchange Discord access_code for access_token
 * This must be done server-side to protect client secret
 */
export async function exchangeToken(accessCode) {
  try {
    const response = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: config.discordAppId,
        client_secret: config.discordClientSecret,
        grant_type: 'client_credentials',
        scope: 'identify guilds rpc.voice.read'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    logger.error('Failed to exchange Discord token', {
      error: error.message,
      response: error.response?.data
    });
    throw new Error('Discord token exchange failed');
  }
}

/**
 * Get current user info using access token
 */
export async function getUserInfo(accessToken) {
  try {
    const response = await axios.get(
      'https://discord.com/api/users/@me',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    
    return {
      id: response.data.id,
      username: response.data.username,
      discriminator: response.data.discriminator,
      avatar: response.data.avatar,
      globalName: response.data.global_name
    };
  } catch (error) {
    logger.error('Failed to get user info', {
      error: error.message,
      response: error.response?.data
    });
    throw new Error('Failed to get user info');
  }
}

/**
 * Validate that a token is still valid
 */
export async function validateToken(accessToken) {
  try {
    await axios.get(
      'https://discord.com/api/oauth2/@me',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    return true;
  } catch (error) {
    return false;
  }
}
