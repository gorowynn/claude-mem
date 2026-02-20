# Remote Server Mode Design for claude-mem

**Date:** 2025-02-20
**Author:** Claude (with user collaboration)
**Status:** Design Approved - Ready for Implementation

## Overview

Enable claude-mem to run on an external server accessible from multiple development machines via VPN or local network. Single-user deployment with trusted network security model.

## Use Case

**Primary:** Single developer accessing claude-mem from multiple machines (home desktop, work laptop, etc.) via local network IP (e.g., `192.168.1.x`).

**Security Model:** Trusted network with VPN/tunnel access (Tailscale, WireGuard, or local network).

## Architecture

### Core Principle

Add an opt-in `CLAUDE_MEM_REMOTE_MODE` flag that, when enabled, allows claude-mem to run on an external server while maintaining localhost as the secure default.

### Network Architecture

```
Client Machine 1 (192.168.1.100) ──┐
Client Machine 2 (192.168.1.101) ──┼──> VPN/Local Network ──> Server (192.168.1.50:37777)
Client Machine 3 (192.168.1.102) ──┘                                                    ↓
                                                                            SQLite Database
                                                                            Vector DB (Chroma)
```

### Data Flow

1. **Client** initiates hook → configured to use `192.168.1.50:37777`
2. **Server** receives HTTP request on `0.0.0.0:37777`
3. **Worker** processes request (observation, search, context injection)
4. **Database** stores/retrieves data from SQLite + Chroma
5. **Response** returned to client

## Configuration

### New Settings

```typescript
// src/shared/SettingsDefaultsManager.ts

CLAUDE_MEM_REMOTE_MODE: 'false',           // Enable remote server deployment
CLAUDE_MEM_ALLOWED_ORIGINS: '',            // Comma-separated whitelist
CLAUDE_MEM_ALLOW_REMOTE_ADMIN: 'true',     // Allow admin endpoints from network
```

### Server Configuration (`~/.claude-mem/settings.json`)

```json
{
  "CLAUDE_MEM_REMOTE_MODE": "true",
  "CLAUDE_MEM_WORKER_HOST": "0.0.0.0",
  "CLAUDE_MEM_WORKER_PORT": "37777",
  "CLAUDE_MEM_ALLOWED_ORIGINS": "http://192.168.1.100,http://192.168.1.101,http://192.168.1.102",
  "CLAUDE_MEM_ALLOW_REMOTE_ADMIN": "true"
}
```

### Client Configuration (`~/.claude-mem/settings.json`)

```json
{
  "CLAUDE_MEM_WORKER_HOST": "192.168.1.50",
  "CLAUDE_MEM_WORKER_PORT": "37777"
}
```

## Implementation Changes

### Files to Modify

1. **`src/shared/SettingsDefaultsManager.ts`**
   - Add new settings to interface and defaults
   - Add `REMOTE_MODE_CHANGES.md` documentation

2. **`src/shared/worker-utils.ts`**
   - Replace hardcoded `127.0.0.1` with `getWorkerHost()` in:
     - Line ~100: `isWorkerHealthy()`
     - Line ~130: `getWorkerVersion()`

3. **`src/services/worker/http/middleware.ts`**
   - Update CORS middleware (lines 28-41):
     - Local mode: only localhost origins
     - Remote mode: check `CLAUDE_MEM_ALLOWED_ORIGINS` whitelist (flexible port matching)
   - Update `requireLocalhost()` middleware (lines 83-105):
     - Local mode: require localhost
     - Remote mode: allow if `CLAUDE_MEM_ALLOW_REMOTE_ADMIN=true`

4. **`src/services/infrastructure/HealthMonitor.ts`**
   - Replace hardcoded `127.0.0.1` with `getWorkerHost()` in:
     - Lines 23, 46: `waitForHealth()`
     - Line 78: `httpShutdown()`
     - Line 114: `checkVersionMatch()`

5. **CLI Handlers** (`src/cli/handlers/`)
   - Replace hardcoded `127.0.0.1` with `getWorkerHost()` in:
     - `context.ts:35`
     - `file-edit.ts:43`
     - `observation.ts:53`
     - `session-complete.ts:40`
     - `session-init.ts:44, 93`
     - `summarize.ts:49`
     - `user-message.ts:29`

6. **`src/services/transcripts/processor.ts`**
   - Lines 324, 355

7. **`src/services/integrations/CursorHooksInstaller.ts`**
   - Line 107

### Code Patterns

**CORS Middleware (Flexible Port Matching):**
```typescript
const allowedOrigins = settings.CLAUDE_MEM_ALLOWED_ORIGINS?.split(',') || [];
const allowed = allowedOrigins.some(allowedOrigin => {
  const allowedBase = allowedOrigin.trim().split(':')[0]; // Strip port
  return origin.startsWith(allowedBase) || origin.startsWith(`http://${allowedBase}`);
});
```

**Host Resolution:**
```typescript
// Before:
const response = await fetch(`http://127.0.0.1:${port}/api/health`);

// After:
import { getWorkerHost } from '../../shared/worker-utils.js';
const host = getWorkerHost();
const response = await fetch(`http://${host}:${port}/api/health`);
```

## Security Considerations

### Assumptions

- Trusted network (VPN or local network)
- Single-user deployment
- No public internet exposure
- VPN/tunnel provides encryption and authentication

### Protections

1. **Opt-in Only:** `CLAUDE_MEM_REMOTE_MODE` defaults to `false`
2. **CORS Whitelist:** Only specified origins can connect via browser
3. **Admin Endpoints:** Optional remote access via `CLAUDE_MEM_ALLOW_REMOTE_ADMIN`
4. **Logging:** All remote access attempts logged
5. **No Authentication Needed:** Trusted network security model

### Recommendations for Production

- Use firewall rules to restrict port 37777 to specific IPs
- Keep `CLAUDE_MEM_ALLOW_REMOTE_ADMIN=false` when possible
- Monitor logs for unexpected access attempts
- Consider rate limiting for future enhancements

## Error Handling

### Configuration Validation

```typescript
// In worker-service.ts constructor
if (settings.CLAUDE_MEM_REMOTE_MODE === 'true') {
  if (settings.CLAUDE_MEM_WORKER_HOST === '127.0.0.1') {
    logger.warn('SYSTEM', 'REMOTE_MODE enabled but WORKER_HOST is localhost');
  }
  if (!settings.CLAUDE_MEM_ALLOWED_ORIGINS) {
    logger.warn('SYSTEM', 'REMOTE_MODE enabled but no ALLOWED_ORIGINS configured');
  }
}
```

### Network Error Handling

- All fetch calls have timeout via `fetchWithTimeout()`
- Health check failures logged with host:port details
- Graceful degradation if worker unreachable

### Backward Compatibility

- Default `CLAUDE_MEM_REMOTE_MODE: 'false'` ensures unchanged behavior
- Fallback to `127.0.0.1` if `getWorkerHost()` fails
- No settings migration needed (new settings have safe defaults)

## Testing Strategy

### Unit Tests

- [ ] `getWorkerHost()` returns correct value with/without env override
- [ ] CORS middleware allows/denies based on mode and origin
- [ ] `requireLocalhost()` adapts to remote mode setting

### Integration Tests

**Test 1: Local Mode (Default - Regression)**
```bash
CLAUDE_MEM_REMOTE_MODE: 'false'
Expected: Worker binds to 127.0.0.1, localhost-only CORS, admin endpoints localhost-only
```

**Test 2: Remote Mode**
```bash
CLAUDE_MEM_REMOTE_MODE: 'true'
CLAUDE_MEM_WORKER_HOST: '0.0.0.0'
Expected: Worker accessible from network, CORS whitelist enforced, admin endpoints accessible
```

**Test 3: CORS Validation**
```bash
# curl (no Origin - should work)
curl http://192.168.1.50:37777/api/health

# Browser from non-whitelisted IP (should fail CORS)
```

**Test 4: All Hook Types**
- [ ] Context injection
- [ ] Session init/complete
- [ ] Observation storage
- [ ] Summarization
- [ ] MCP server queries

### Manual Testing Checklist

- [ ] Worker starts in remote mode
- [ ] Health check accessible from client
- [ ] Hook creates session remotely
- [ ] Observation stored and retrieved
- [ ] Search returns results
- [ ] Web UI accessible from client browser
- [ ] Admin endpoints work from client (if enabled)
- [ ] Local mode still works (regression)

## Fork Maintenance Strategy

### Repository Structure

```
main              # Tracks upstream main closely
remote-server     # Feature branch with remote mode changes

Remotes:
origin            # Your fork
upstream          # Original repo (github.com/thedotmack/claude-mem)
```

### Sync Workflow

```bash
# 1. Update main from upstream
git checkout main
git fetch upstream
git merge upstream/main
git push origin main

# 2. Update feature branch
git checkout remote-server
git merge main
# Resolve conflicts if any
git push origin remote-server
```

### Automation Scripts

- **Linux/Mac:** `scripts/sync-upstream.sh`
- **Windows:** `scripts/sync-upstream.ps1`

Scripts automate:
- Fetch upstream
- Update main branch
- Merge main into remote-server
- Run build tests
- Push if successful, abort if failed

### Conflict Resolution Priority

Watch for upstream changes in:
1. `SettingsDefaultsManager.ts` - new settings
2. `middleware.ts` - CORS/security logic
3. `worker-service.ts` - startup sequence
4. Hook handlers - communication protocol

## Documentation

### User Documentation

Create `docs/remote-server-setup.md` with:
- Overview and use cases
- Prerequisites (VPN/local network)
- Server setup steps
- Client configuration steps
- Security best practices
- Troubleshooting guide

### Changelog Entry

```markdown
## [Unreleased]

### Added
- CLAUDE_MEM_REMOTE_MODE setting for external server deployment
- CLAUDE_MEM_ALLOWED_ORIGINS for CORS whitelist in remote mode
- CLAUDE_MEM_ALLOW_REMOTE_ADMIN for remote admin endpoint access

### Changed
- Worker now respects CLAUDE_MEM_WORKER_HOST for all connections
- CORS middleware adapts based on remote mode setting
- Admin endpoints can be accessible from network in remote mode
```

## Implementation Checklist

### Phase 1: Configuration Layer
- [ ] Add settings to `SettingsDefaultsManager.ts`
- [ ] Update `REMOTE_MODE_CHANGES.md`
- [ ] Test settings loading with env var override

### Phase 2: Network Layer
- [ ] Update `worker-utils.ts` health/version checks
- [ ] Update `HealthMonitor.ts` all fetch calls
- [ ] Update all CLI handlers (7 files)
- [ ] Update `processor.ts` and `CursorHooksInstaller.ts`

### Phase 3: Security Layer
- [ ] Implement adaptive CORS middleware
- [ ] Implement adaptive `requireLocalhost` middleware
- [ ] Add configuration validation
- [ ] Add logging for remote access

### Phase 4: Testing
- [ ] Manual testing: local mode (regression)
- [ ] Manual testing: remote mode with client
- [ ] Test all hook types remotely
- [ ] Test CORS with browser
- [ ] Test admin endpoints

### Phase 5: Documentation
- [ ] Write `docs/remote-server-setup.md`
- [ ] Update README with remote mode section
- [ ] Add changelog entry
- [ ] Create sync scripts for fork maintenance

## Success Criteria

✅ **Functional:**
- Worker starts successfully in remote mode
- Client machines can connect and use all features
- All hook types work remotely
- Web UI accessible from client browsers

✅ **Security:**
- Local mode unchanged (backward compatible)
- Remote mode opt-in only
- CORS whitelist enforced
- Admin endpoints protected by setting

✅ **Maintainable:**
- Clean merge path from upstream updates
- Well-documented changes
- Automated sync workflow

## Future Enhancements (Out of Scope)

- API key authentication for multi-user scenarios
- HTTPS/TLS support for public deployment
- Rate limiting
- Audit logging
- Team collaboration features
- Cloud deployment options

## References

- Original claude-mem repository: https://github.com/thedotmack/claude-mem
- Tailscale documentation: https://tailscale.com/kb/
- CORS specification: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
