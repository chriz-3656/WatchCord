/**
 * Utility Functions
 * Common helpers used throughout the application
 */

/**
 * Format time in seconds to MM:SS or HH:MM:SS
 */
export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeId(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;

    // youtu.be/ID
    if (hostname === 'youtu.be' || hostname.includes('youtu.be')) {
      return pathname.slice(1).split('?')[0].split('&')[0];
    }

    // youtube.com/watch?v=ID
    if (hostname.includes('youtube.com')) {
      // /watch?v=ID
      if (pathname.includes('/watch')) {
        const params = new URLSearchParams(urlObj.search);
        return params.get('v');
      }

      // /embed/ID
      if (pathname.includes('/embed/')) {
        return pathname.split('/embed/')[1].split('?')[0].split('&')[0];
      }

      // /shorts/ID
      if (pathname.includes('/shorts/')) {
        return pathname.split('/shorts/')[1].split('?')[0].split('&')[0];
      }

      // /live/ID
      if (pathname.includes('/live/')) {
        return pathname.split('/live/')[1].split('?')[0].split('&')[0];
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect media type from URL
 */
export function getMediaType(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return 'youtube';
    }

    if (hostname.includes('twitch.tv')) {
      return 'twitch';
    }

    if (pathname.endsWith('.mp4')) {
      return 'mp4';
    }

    if (pathname.endsWith('.m3u8')) {
      return 'hls';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Validate media URL
 */
export function validateMediaUrl(url) {
  const allowedHosts = [
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
    'www.youtu.be',
    'twitch.tv',
    'www.twitch.tv'
  ];

  try {
    const urlObj = new URL(url);
    
    // Must be HTTPS
    if (urlObj.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }

    // Check host
    const host = urlObj.hostname.toLowerCase();
    if (!allowedHosts.some(h => host.includes(h))) {
      // Allow direct MP4/M3U8
      if (!urlObj.pathname.endsWith('.mp4') && !urlObj.pathname.endsWith('.m3u8')) {
        return { valid: false, error: 'Host not in allowed list' };
      }
    }

    // Block dangerous protocols
    const lowerUrl = url.trim().toLowerCase();
    if (lowerUrl.startsWith('javascript:') || 
        lowerUrl.startsWith('data:') || 
        lowerUrl.startsWith('file:')) {
      return { valid: false, error: 'Protocol not allowed' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get thumbnail URL for media item
 */
export function getThumbnailUrl(url, type) {
  if (type === 'youtube') {
    const videoId = extractYouTubeId(url);
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
  }
  
  // Default placeholder
  return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="68"><rect fill="%232b2d31" width="120" height="68"/></svg>';
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Generate unique ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse Discord user info
 */
export function parseDiscordUser(user) {
  if (!user) return null;
  
  return {
    id: user.id,
    username: user.username,
    globalName: user.global_name || user.username,
    discriminator: user.discriminator,
    avatar: user.avatar
  };
}

/**
 * Calculate latency from round-trip time
 */
export function calculateLatency(sendTime, receiveTime) {
  return (receiveTime - sendTime) / 2;
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

export default {
  formatTime,
  extractYouTubeId,
  getMediaType,
  validateMediaUrl,
  escapeHtml,
  getThumbnailUrl,
  debounce,
  throttle,
  generateId,
  parseDiscordUser,
  calculateLatency,
  clamp,
  lerp
};
