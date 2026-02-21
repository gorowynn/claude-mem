# Remote Server Mode Changes

## Overview

This fork adds remote server deployment capability to claude-mem, enabling the worker to run on an external server accessible from multiple development machines via VPN or local network.

**Status:** ✅ Implementation Complete (Tasks 1-18)
**Date:** 2025-02-21
**Branch:** remote-server

## Modified Files

### Configuration Layer (1 file)
- `src/shared/SettingsDefaultsManager.ts` - Added remote mode settings with safe defaults

### Network Layer (10 files)
- `src/shared/worker-utils.ts` - Use getWorkerHost() instead of hardcoded 127.0.0.1
- `src/services/infrastructure/HealthMonitor.ts` - Use getWorkerHost() in all fetch calls
- `src/cli/handlers/context.ts` - Remote worker URL support
- `src/cli/handlers/file-edit.ts` - Remote worker URL support
- `src/cli/handlers/observation.ts` - Remote worker URL support
- `src/cli/handlers/session-complete.ts` - Remote worker URL support
- `src/cli/handlers/session-init.ts` - Remote worker URL support (2 URLs)
- `src/cli/handlers/summarize.ts` - Remote worker URL support
- `src/cli/handlers/user-message.ts` - Remote worker URL support
- `src/services/transcripts/processor.ts` - Remote worker URL support (2 URLs)
- `src/services/integrations/CursorHooksInstaller.ts` - Remote worker URL support

### Security Layer (2 files)
- `src/services/worker/http/middleware.ts` - Adaptive CORS and admin endpoint protection
- `src/services/worker-service.ts` - Remote mode configuration validation

## New Settings

All settings default to safe values (remote mode disabled):

| Setting | Default | Purpose |
|---------|---------|---------|
| `CLAUDE_MEM_REMOTE_MODE` | `false` | Enable remote server deployment |
| `CLAUDE_MEM_ALLOWED_ORIGINS` | `''` | CORS whitelist for remote mode (comma-separated IPs) |
| `CLAUDE_MEM_ALLOW_REMOTE_ADMIN` | `true` | Allow admin endpoints from network in remote mode |

## Server Configuration Example

`~/.claude-mem/settings.json` on the server:
```json
{
  "CLAUDE_MEM_REMOTE_MODE": "true",
  "CLAUDE_MEM_WORKER_HOST": "0.0.0.0",
  "CLAUDE_MEM_WORKER_PORT": "37777",
  "CLAUDE_MEM_ALLOWED_ORIGINS": "http://192.168.1.100,http://192.168.1.101,http://192.168.1.102",
  "CLAUDE_MEM_ALLOW_REMOTE_ADMIN": "true"
}
```

## Client Configuration Example

`~/.claude-mem/settings.json` on each client:
```json
{
  "CLAUDE_MEM_WORKER_HOST": "192.168.1.50",
  "CLAUDE_MEM_WORKER_PORT": "37777"
}
```

## Breaking Changes

**None.** All changes are opt-in via `CLAUDE_MEM_REMOTE_MODE` setting.

- Default behavior unchanged (localhost-only)
- Existing installations continue working without changes
- No database migrations required
- No API changes

## Implementation Details

### Adaptive CORS Middleware

**Local Mode:**
- Only allows `localhost` and `127.0.0.1` origins
- Admin endpoints require localhost access

**Remote Mode:**
- Checks `CLAUDE_MEM_ALLOWED_ORIGINS` whitelist
- Flexible port matching (strips port from allowed origins)
- Admin endpoints accessible if `CLAUDE_MEM_ALLOW_REMOTE_ADMIN=true`
- Logs all remote access attempts

### Network Layer Changes

All hardcoded `127.0.0.1` references replaced with `getWorkerHost()` calls:
- Health checks (`/api/health`)
- Version checks (`/api/version`)
- All CLI handler endpoints
- Shutdown/restart endpoints

### Configuration Validation

Worker logs warnings on startup if:
- `REMOTE_MODE=true` but `WORKER_HOST` still `127.0.0.1` (should be `0.0.0.0`)
- `REMOTE_MODE=true` but no `ALLOWED_ORIGINS` configured (CORS will block browsers)

## Fork Maintenance

### Repository Structure

```
main              # Tracks upstream main closely
remote-server     # Feature branch with remote mode changes

Remotes:
origin            # Your fork
upstream          # Original repo (github.com/thedotmack/claude-mem)
```

### Sync Scripts

Two automation scripts provided:
- `scripts/sync-upstream.sh` - Bash script for Linux/Mac
- `scripts/sync-upstream.ps1` - PowerShell script for Windows

**What they do:**
1. Fetch latest from upstream
2. Update main branch (fast-forward only)
3. Merge main into remote-server branch
4. Detect merge conflicts
5. Run build verification
6. Push only if build succeeds

**Usage:**
```bash
# Linux/Mac
chmod +x scripts/sync-upstream.sh
./scripts/sync-upstream.sh

# Windows
powershell ./scripts/sync-upstream.ps1
```

### Manual Sync Process

```bash
# 1. Update main from upstream
git checkout main
git fetch upstream
git merge upstream/main --ff-only
git push origin main

# 2. Update feature branch
git checkout remote-server
git merge main

# 3. Resolve conflicts if any
# Edit conflicted files, then:
git add <resolved-files>
git commit

# 4. Push changes
git push origin remote-server
```

## Testing

### Automated Testing
- All builds completed successfully
- No TypeScript errors
- All individual commits tested

### Manual Testing Checklist (To Be Done)

**Local Mode (Regression Test):**
- [ ] Worker starts with default settings
- [ ] Binds to `127.0.0.1:37777` only
- [ ] All hooks work normally
- [ ] Admin endpoints require localhost

**Remote Mode:**
- [ ] Worker starts with `WORKER_HOST=0.0.0.0`
- [ ] Health check accessible from client machine
- [ ] All hook types work remotely (context, init, observation, summarize, complete)
- [ ] CORS allows whitelisted origins (browser test)
- [ ] CORS blocks non-whitelisted origins
- [ ] Admin endpoints accessible from network (if `ALLOW_REMOTE_ADMIN=true`)
- [ ] Admin endpoints blocked if `ALLOW_REMOTE_ADMIN=false`
- [ ] Configuration validation logs warnings appropriately

## Documentation

Created comprehensive documentation:
- `docs/remote-server-setup.md` - User guide for deployment
- `docs/plans/2025-02-20-remote-server-mode-design.md` - Design document
- `docs/plans/2025-02-21-remote-server-mode-implementation.md` - Implementation plan
- `README.md` - Added remote server mode section

## Commits

16 commits created during implementation:

```
ba54aeb refactor: use getWorkerHost() in cursor hooks installer
c45df4f refactor: use getWorkerHost() in transcript processor
5c90bdf refactor: use getWorkerHost() in user-message handler
a2b4313 refactor: use getWorkerHost() in summarize handler
05b6f05 refactor: use getWorkerHost() in session-init handler
519dce3 refactor: use getWorkerHost() in infrastructure health checks
fc06985 feat: add upstream sync scripts for fork maintenance
e129c3d refactor: use getWorkerHost() in session-complete handler
decf23e docs: add remote server setup guide and update README
61ab844 feat: add remote mode configuration validation
d42b6ee refactor: use getWorkerHost() in observation handler
eede050 feat: implement adaptive admin endpoint protection
9617e22 refactor: use getWorkerHost() in health check URLs
3fcd8dd refactor: use getWorkerHost() in file-edit handler
c28d788 refactor: use getWorkerHost() in context handler
767be2b feat: add remote mode settings to defaults manager
35d2e37 docs: add remote server mode design and implementation plan
```

## Security Considerations

### What's Protected
- ✅ Opt-in only (disabled by default)
- ✅ CORS whitelist enforcement
- ✅ Admin endpoint protection (adapts to mode)
- ✅ Logging of remote access attempts
- ✅ Configuration validation with warnings

### What's NOT Protected
This implementation is **not** designed for:
- ❌ Public internet exposure
- ❌ Multi-user team collaboration
- ❌ Untrusted networks
- ❌ Production environments without VPN

For those scenarios, additional security needed:
- API key authentication
- HTTPS/TLS encryption
- Rate limiting
- User management

## Support

- **Original Repository:** https://github.com/thedotmack/claude-mem
- **Documentation:** https://docs.claude-mem.ai
- **Issues:** Report issues in this fork's repository

## Future Enhancements (Out of Scope)

- API key authentication for multi-user scenarios
- HTTPS/TLS support for public deployment
- Rate limiting and request throttling
- Audit logging for compliance
- Team collaboration features
- Cloud deployment options (AWS, GCP, Azure)
