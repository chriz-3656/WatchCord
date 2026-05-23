# Risks and Mitigations

This document outlines known technical risks, limitations, and their mitigations for the Watch Together platform.

## 1. YouTube Iframe API Limitations

### Risk
YouTube's iframe API has several restrictions that may affect functionality:

- Some videos are **embedding-disabled** by the uploader
- **Age-restricted** content cannot be played in embedded players
- **Region-locked** videos may not be available in all locations
- YouTube may **block automated playback** if detected

### Impact
Users may encounter errors when trying to play certain videos. The experience will be degraded for affected content.

### Mitigation
- ✅ Detect embedding errors (codes 101, 150) and show user-friendly message
- ✅ Validate video availability before adding to queue (optional enhancement)
- ✅ Provide clear error messages explaining why a video can't be played
- ⚠️ Cannot bypass YouTube restrictions - this is by design

### Status
**Accepted Risk** - This is a limitation of using YouTube's official API.

---

## 2. Discord Activity SDK Breaking Changes

### Risk
The Discord Embedded App SDK is relatively new (1.x). Future versions may introduce breaking changes to the API.

### Impact
The application may stop working after Discord SDK updates.

### Mitigation
- ✅ Pin SDK version in package.json (`^1.5.2`)
- ✅ Monitor Discord developer changelog
- ✅ Keep abstraction layer thin for easier updates
- ⚠️ Test thoroughly after any SDK update

### Status
**Monitored** - Check SDK releases monthly.

---

## 3. WebSocket Scalability

### Risk
The current implementation uses in-memory state and single-process Socket.IO. This limits horizontal scaling.

### Impact
- Maximum ~1000-2000 concurrent connections per server instance
- Room state lost on server restart
- Cannot distribute load across multiple servers

### Mitigation
- ✅ Document Redis adapter upgrade path in ARCHITECTURE.md
- ✅ Design state management for easy externalization
- ✅ Use room-based architecture for natural sharding
- ⚠️ For production with >1000 users, implement Redis adapter

### Status
**Known Limitation** - Acceptable for private communities (<100 users).

---

## 4. Drift Correction Visibility

### Risk
Aggressive timestamp correction can cause visible seeking, which feels jarring to users.

### Impact
Poor user experience if corrections are too frequent or aggressive.

### Mitigation
- ✅ Three-tier approach:
  - 0-300ms: No correction (normal variance)
  - 300-1000ms: Soft correction (could adjust playback rate)
  - >1000ms: Hard seek (necessary for sync)
- ✅ Cooldown period between corrections (500ms)
- ✅ Only correct when playing (not during buffering)
- ✅ Show sync status indicator so users understand what's happening

### Status
**Mitigated** - Thresholds tuned for balance between accuracy and UX.

---

## 5. Host Network Quality

### Risk
Since host controls are authoritative, a host with poor network quality can affect all participants.

### Impact
- Delayed sync events from slow host
- Frequent host migrations if host disconnects
- All participants drift if host's timestamps are inconsistent

### Mitigation
- ✅ Server-side heartbeat provides fallback timestamp authority
- ✅ Automatic host migration on disconnect
- ✅ Rate limiting prevents flood of bad events
- ⚠️ Consider server-authoritative timestamps as future enhancement

### Status
**Partially Mitigated** - Server heartbeat helps but doesn't fully solve.

---

## 6. Room State Loss on Restart

### Risk
All active sessions are lost when the server restarts (in-memory storage).

### Impact
- Active watch parties interrupted
- Queue state lost
- Users must rejoin and restart

### Mitigation
- ✅ Room idle timeout preserves empty rooms briefly (for reconnection)
- ✅ Optional SQLite persistence documented (can be enabled)
- ✅ Graceful shutdown handling
- ⚠️ For production, enable SQLite or Redis persistence

### Status
**Known Limitation** - Acceptable for casual use; add persistence for production.

---

## 7. Browser Autoplay Policies

### Risk
Modern browsers block autoplay without prior user interaction due to media autoplay policies.

### Impact
Videos may not start automatically when:
- User joins an active session
- Next video in queue should auto-play
- Host initiates playback for non-host users

### Mitigation
- ✅ Require initial user interaction (click-to-start UI)
- ✅ Show "Click to join" overlay on late join
- ✅ Educate users via UI prompts
- ⚠️ Cannot fully bypass browser policies

### Status
**Mitigated** - UX designed around autoplay restrictions.

---

## 8. Content Security Policy (CSP) Conflicts

### Risk
Discord runs activities in a sandboxed iframe with strict CSP. YouTube iframe API requires specific CSP rules that may conflict.

### Impact
- YouTube player may fail to load
- Scripts may be blocked
- Activity may not function correctly

### Mitigation
- ✅ Configure URL mappings in Discord Developer Portal
- ✅ Set appropriate CSP headers in Express (helmet.js)
- ✅ Whitelist required domains:
  - `https://www.youtube.com`
  - `https://youtube.com`
  - `https://discord.com`
- ⚠️ May need adjustment based on Discord's iframe configuration

### Status
**Tested** - Current configuration works; monitor for changes.

---

## 9. Rate Limiting False Positives

### Risk
Aggressive rate limiting may block legitimate user actions during rapid interactions.

### Impact
- Users unable to seek frequently (e.g., finding a specific moment)
- Queue additions blocked during active curation
- Frustration from "rate limit exceeded" errors

### Mitigation
- ✅ Reasonable defaults (5 sync events/sec, 10 queue adds/min)
- ✅ Configurable via environment variables
- ✅ Clear error messages when rate limited
- ⚠️ Monitor and adjust based on real usage patterns

### Status
**Configurable** - Defaults reasonable; tune per deployment.

---

## 10. Discord OAuth2 Token Expiry

### Risk
Discord access tokens expire after a set duration. Token refresh logic is not implemented.

### Impact
- Long-running sessions (>24 hours) may lose authentication
- Some features may stop working until re-authentication

### Mitigation
- ✅ Tokens typically last 24+ hours
- ✅ Most watch parties are short-lived (<4 hours)
- ⚠️ Add token refresh for long-session support (future enhancement)

### Status
**Accepted for Now** - Sufficient for typical use cases.

---

## 11. Mobile Compatibility

### Risk
Discord mobile app has limited support for Activities compared to desktop.

### Impact
- Activity may not launch on mobile
- Touch controls may not work optimally
- Performance issues on lower-end devices

### Mitigation
- ✅ Responsive CSS for various screen sizes
- ✅ Touch-friendly control sizes
- ⚠️ Limited testing on mobile Discord app
- ⚠️ Document mobile limitations in README

### Status
**Best Effort** - Desktop-first, mobile responsive.

---

## 12. Legal and Copyright Considerations

### Risk
Synchronized viewing of copyrighted content may have legal implications depending on jurisdiction and use case.

### Impact
- Potential copyright infringement claims
- Terms of Service violations with content providers
- Liability for server operators

### Mitigation
- ✅ **No media relay** - Server never touches video content
- ✅ Each user loads content independently from official sources
- ✅ Clear documentation: "Educational/research purposes only"
- ✅ No commercial use recommended
- ⚠️ Users responsible for their own viewing compliance
- ⚠️ Consult legal counsel for production deployment

### Status
**Critical** - This is a key design principle. The architecture intentionally avoids media relay to minimize legal risk.

---

## Risk Summary Matrix

| Risk | Likelihood | Impact | Status |
|------|------------|--------|--------|
| YouTube restrictions | High | Medium | Accepted |
| SDK breaking changes | Low | High | Monitored |
| WebSocket scalability | Medium | Medium | Known Limit |
| Drift correction UX | Low | Low | Mitigated |
| Host network quality | Medium | Medium | Partial |
| State loss on restart | Medium | Medium | Known Limit |
| Browser autoplay | High | Low | Mitigated |
| CSP conflicts | Low | High | Tested |
| Rate limit false positives | Low | Low | Configurable |
| Token expiry | Low | Medium | Accepted |
| Mobile compatibility | Medium | Low | Best Effort |
| Legal/copyright | Low | High | Critical |

---

## Recommendations for Production Deployment

1. **Enable SQLite persistence** for room state
2. **Set up Redis** if expecting >500 concurrent users
3. **Monitor token expiry** and implement refresh if needed
4. **Review legal considerations** with counsel
5. **Tune rate limits** based on actual usage patterns
6. **Set up monitoring** for drift rates and sync quality
7. **Configure proper SSL** with valid certificate
8. **Implement logging aggregation** for debugging

---

## Conclusion

This platform is designed for **private, educational use** with careful attention to:
- Using only official APIs (Discord, YouTube)
- Avoiding media relay (copyright safety)
- Minimizing ban risk (no selfbot behavior)

Most risks are either mitigated, acceptable for the intended use case, or documented for future improvement. The architecture prioritizes safety and compliance over feature completeness.

**Last Updated:** 2024
**Review Schedule:** Quarterly or after major dependency updates
