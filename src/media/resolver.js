/**
 * Media Resolver
 * Validates and extracts metadata from media URLs
 */

const ALLOWED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'twitch.tv',
  'www.twitch.tv',
  'clips.twitch.tv'
];

const ALLOWED_PROTOCOLS = ['https:'];

/**
 * Validate that a URL is safe and allowed
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Invalid URL format' };
  }

  try {
    const urlObj = new URL(url);

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
      return { 
        valid: false, 
        error: 'Only HTTPS URLs are allowed' 
      };
    }

    // Check host
    const host = urlObj.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.includes(host) && !host.endsWith('.mp4') && !host.endsWith('.m3u8')) {
      // Check if path ends with allowed extension
      const pathname = urlObj.pathname.toLowerCase();
      if (!pathname.endsWith('.mp4') && !pathname.endsWith('.m3u8')) {
        return { 
          valid: false, 
          error: 'Host not in allowed list' 
        };
      }
    }

    // Block dangerous protocols
    if (url.trim().toLowerCase().startsWith('javascript:') ||
        url.trim().toLowerCase().startsWith('data:') ||
        url.trim().toLowerCase().startsWith('file:')) {
      return { 
        valid: false, 
        error: 'Protocol not allowed' 
      };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL' };
  }
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
    if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
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
 * Get media type from URL
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
 * Get thumbnail URL for media item
 */
export function getThumbnailUrl(url, mediaType) {
  if (mediaType === 'youtube') {
    const videoId = extractYouTubeId(url);
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
  }

  // Default placeholder
  return null;
}

/**
 * Sanitize URL for display (prevent XSS)
 */
export function sanitizeUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.href;
  } catch {
    return '';
  }
}

export default {
  validateUrl,
  extractYouTubeId,
  getMediaType,
  getThumbnailUrl,
  sanitizeUrl
};
