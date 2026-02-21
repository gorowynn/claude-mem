# Remote Server Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable claude-mem to run on an external server accessible from multiple development machines via VPN or local network.

**Architecture:** Add opt-in `CLAUDE_MEM_REMOTE_MODE` configuration flag that switches worker from localhost-only (default) to network-accessible mode with adaptive CORS and admin endpoint security. All hardcoded `127.0.0.1` references replaced with `getWorkerHost()` calls to respect configured host.

**Tech Stack:** TypeScript, Express.js, SQLite, Node.js/Bun runtime

---

## Task 1: Add Remote Mode Settings

**Files:**
- Modify: `src/shared/SettingsDefaultsManager.ts`

**Step 1: Add settings to interface**

```typescript
export interface SettingsDefaults {
  // ... existing settings ...
  CLAUDE_MEM_REMOTE_MODE: string;           // Add after CLAUDE_MEM_MODE
  CLAUDE_MEM_ALLOWED_ORIGINS: string;       // Add after CLAUDE_MEM_REMOTE_MODE
  CLAUDE_MEM_ALLOW_REMOTE_ADMIN: string;    // Add after CLAUDE_MEM_ALLOWED_ORIGINS
  // ... rest of existing settings ...
}
```

**Step 2: Add default values**

```typescript
private static readonly DEFAULTS: SettingsDefaults = {
  // ... existing defaults ...
  CLAUDE_MEM_MODE: 'code',
  CLAUDE_MEM_REMOTE_MODE: 'false',           // Add here
  CLAUDE_MEM_ALLOWED_ORIGINS: '',            // Add here
  CLAUDE_MEM_ALLOW_REMOTE_ADMIN: 'true',     // Add here
  // ... rest of existing defaults ...
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: BUILD SUCCESS (no type errors)

**Step 4: Test settings load**

Run: `node -e "const {SettingsDefaultsManager} = require('./dist/shared/SettingsDefaultsManager.js'); console.log(SettingsDefaultsManager.get('CLAUDE_MEM_REMOTE_MODE'))"`
Expected: `false`

**Step 5: Commit**

```bash
git add src/shared/SettingsDefaultsManager.ts
git commit -m "feat: add remote mode settings to defaults manager

Add CLAUDE_MEM_REMOTE_MODE, CLAUDE_MEM_ALLOWED_ORIGINS,
and CLAUDE_MEM_ALLOW_REMOTE_ADMIN settings with safe defaults."
```

---

## Task 2: Update Worker Utils Health Checks

**Files:**
- Modify: `src/shared/worker-utils.ts`

**Step 1: Update isWorkerHealthy() to use getWorkerHost()**

Find line ~100:
```typescript
// Before:
const response = await fetchWithTimeout(
  `http://127.0.0.1:${port}/api/health`, {}, HEALTH_CHECK_TIMEOUT_MS
);

// After:
const host = getWorkerHost();
const response = await fetchWithTimeout(
  `http://${host}:${port}/api/health`, {}, HEALTH_CHECK_TIMEOUT_MS
);
```

**Step 2: Update getWorkerVersion() to use getWorkerHost()**

Find line ~130:
```typescript
// Before:
const response = await fetchWithTimeout(
  `http://127.0.0.1:${port}/api/version`, {}, HEALTH_CHECK_TIMEOUT_MS
);

// After:
const host = getWorkerHost();
const response = await fetchWithTimeout(
  `http://${host}:${port}/api/version`, {}, HEALTH_CHECK_TIMEOUT_MS
);
```

**Step 3: Verify build**

Run: `npm run build`
Expected: BUILD SUCCESS

**Step 4: Test with custom host**

Run: `CLAUDE_MEM_WORKER_HOST=192.168.1.50 node dist/shared/worker-utils.js` (if executable) or check manually
Expected: No errors, code compiles

**Step 5: Commit**

```bash
git add src/shared/worker-utils.ts
git commit -m "refactor: use getWorkerHost() in health check URLs

Replace hardcoded 127.0.0.1 with getWorkerHost() calls to respect
configured worker host in health and version checks."
```

---

## Task 3: Update Infrastructure Health Monitor

**Files:**
- Modify: `src/services/infrastructure/HealthMonitor.ts`

**Step 1: Import getWorkerHost**

Add to imports at top:
```typescript
import { getWorkerHost } from '../../shared/worker-utils.js';
```

**Step 2: Update waitForHealth() calls**

Find lines ~23 and ~46:
```typescript
// Before:
const response = await fetch(`http://127.0.0.1:${port}/api/health`);

// After:
const host = getWorkerHost();
const response = await fetch(`http://${host}:${port}/api/health`);
```

**Step 3: Update httpShutdown() call**

Find line ~78:
```typescript
// Before:
const response = await fetch(`http://127.0.0.1:${port}/api/admin/shutdown`, {

// After:
const host = getWorkerHost();
const response = await fetch(`http://${host}:${port}/api/admin/shutdown`, {
```

**Step 4: Update checkVersionMatch() call**

Find line ~114:
```typescript
// Before:
const response = await fetch(`http://127.0.0.1:${port}/api/version`);

// After:
const host = getWorkerHost();
const response = await fetch(`http://${host}:${port}/api/version`);
```

**Step 5: Verify build**

Run: `npm run build`
Expected: BUILD SUCCESS

**Step 6: Commit**

```bash
git add src/services/infrastructure/HealthMonitor.ts
git commit -m "refactor: use getWorkerHost() in infrastructure health checks

Replace hardcoded 127.0.0.1 in all fetch calls to support
configured worker host address."
```

---

## Task 4: Update CLI Handler - Context

**Files:**
- Modify: `src/cli/handlers/context.ts`

**Step 1: Import getWorkerHost**

Add at top:
```typescript
import { getWorkerHost } from '../../shared/worker-utils.js';
```

**Step 2: Update fetch URL**

Find line ~35:
```typescript
// Before:
const url = `http://127.0.0.1:${port}/api/context/inject?projects=${encodeURIComponent(projectsParam)}`;

// After:
const host = getWorkerHost();
const url = `http://${host}:${port}/api/context/inject?projects=${encodeURIComponent(projectsParam)}`;
```

**Step 3: Verify build**

Run: `npm run build`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add src/cli/handlers/context.ts
git commit -m "refactor: use getWorkerHost() in context handler"
```

---

## Task 5: Update CLI Handler - File Edit

**Files:**
- Modify: `src/cli/handlers/file-edit.ts`

**Step 1: Import getWorkerHost**

```typescript
import { getWorkerHost } from '../../shared/worker-utils.js';
```

**Step 2: Update fetch URL**

Find line ~43:
```typescript
// Before:
const response = await fetch(`http://127.0.0.1:${port}/api/sessions/observations`, {

// After:
const host = getWorkerHost();
const response = await fetch(`http://${host}:${port}/api/sessions/observations`, {
```

**Step 3: Verify build**

Run: `npm run build`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add src/cli/handlers/file-edit.ts
git commit -m "refactor: use getWorkerHost() in file-edit handler"
```

---

## Task 6: Update CLI Handler - Observation

**Files:**
- Modify: `src/cli/handlers/observation.ts`

**Step 1: Import and update**

```typescript
import { getWorkerHost } from '../../shared/worker-utils.js';

// Line ~53:
const host = getWorkerHost();
const response = await fetch(`http://${host}:${port}/api/sessions/observations`, {
```

**Step 2: Build and commit**

```bash
npm run build
git add src/cli/handlers/observation.ts
git commit -m "refactor: use getWorkerHost() in observation handler"
```

---

## Task 7: Update CLI Handler - Session Complete

**Files:**
- Modify: `src/cli/handlers/session-complete.ts`

**Step 1: Import and update**

```typescript
import { getWorkerHost } from '../../shared/worker-utils.js';

// Line ~40:
const host = getWorkerHost();
const response = await fetch(`http://${host}:${port}/api/sessions/complete`, {
```

**Step 2: Build and commit**

```bash
npm run build
git add src/cli/handlers/session-complete.ts
git commit -m "refactor: use getWorkerHost() in session-complete handler"
```

---

## Task 8: Update CLI Handler - Session Init

**Files:**
- Modify: `src/cli/handlers/session-init.ts`

**Step 1: Import and update both URLs**

```typescript
import { getWorkerHost } from '../../shared/worker-utils.js';

// Line ~44:
const host = getWorkerHost();
const initResponse = await fetch(`http://${host}:${port}/api/sessions/init`, {

// Line ~93:
const response = await fetch(`http://${host}:${port}/sessions/${sessionDbId}/init`, {
```

**Step 2: Build and commit**

```bash
npm run build
git add src/cli/handlers/session-init.ts
git commit -m "refactor: use getWorkerHost() in session-init handler"
```

---

## Task 9: Update CLI Handler - Summarize

**Files:**
- Modify: `src/cli/handlers/summarize.ts`

**Step 1: Import and update**

```typescript
import { getWorkerHost } from '../../shared/worker-utils.js';

// Line ~49:
const host = getWorkerHost();
const response = await fetch(`http://${host}:${port}/api/sessions/summarize`, {
```

**Step 2: Build and commit**

```bash
npm run build
git add src/cli/handlers/summarize.ts
git commit -m "refactor: use getWorkerHost() in summarize handler"
```

---

## Task 10: Update CLI Handler - User Message

**Files:**
- Modify: `src/cli/handlers/user-message.ts`

**Step 1: Import and update**

```typescript
import { getWorkerHost } from '../../shared/worker-utils.js';

// Line ~29:
const host = getWorkerHost();
const response = await fetch(
  `http://${host}:${port}/api/context/inject?project=${encodeURIComponent(project)}&colors=true`,
```

**Step 2: Build and commit**

```bash
npm run build
git add src/cli/handlers/user-message.ts
git commit -m "refactor: use getWorkerHost() in user-message handler"
```

---

## Task 11: Update Transcript Processor

**Files:**
- Modify: `src/services/transcripts/processor.ts`

**Step 1: Import and update both URLs**

```typescript
import { getWorkerHost } from '../../shared/worker-utils.js';

// Line ~324:
const host = getWorkerHost();
await fetch(`http://${host}:${port}/api/sessions/summarize`, {

// Line ~355:
  `http://${host}:${port}/api/context/inject?projects=${encodeURIComponent(projectsParam)}`
```

**Step 2: Build and commit**

```bash
npm run build
git add src/services/transcripts/processor.ts
git commit -m "refactor: use getWorkerHost() in transcript processor"
```

---

## Task 12: Update Cursor Hooks Installer

**Files:**
- Modify: `src/services/integrations/CursorHooksInstaller.ts`

**Step 1: Import and update**

```typescript
import { getWorkerHost } from '../../shared/worker-utils.js';

// Line ~107:
const host = getWorkerHost();
`http://${host}:${port}/api/context/inject?project=${encodeURIComponent(projectName)}`
```

**Step 2: Build and commit**

```bash
npm run build
git add src/services/integrations/CursorHooksInstaller.ts
git commit -m "refactor: use getWorkerHost() in cursor hooks installer"
```

---

## Task 13: Implement Adaptive CORS Middleware

**Files:**
- Modify: `src/services/worker/http/middleware.ts`

**Step 1: Import SettingsDefaultsManager**

```typescript
import { SettingsDefaultsManager } from '../../../shared/SettingsDefaultsManager.js';
import { getUserSettingsPath } from '../../../shared/paths.js';
```

**Step 2: Replace CORS middleware**

Find lines 28-41, replace with:

```typescript
// CORS - restrict origins based on mode
middlewares.push(cors({
  origin: (origin, callback) => {
    // No Origin header: hooks, curl, CLI tools - always allow
    if (!origin) {
      callback(null, true);
      return;
    }

    const settingsPath = getUserSettingsPath();
    const settings = SettingsDefaultsManager.loadFromFile(settingsPath);

    // Remote mode: check whitelist
    if (settings.CLAUDE_MEM_REMOTE_MODE === 'true') {
      const allowedOrigins = settings.CLAUDE_MEM_ALLOWED_ORIGINS?.split(',') || [];
      const allowed = allowedOrigins.some(allowedOrigin => {
        const allowedBase = allowedOrigin.trim().split(':')[0]; // Strip port
        return origin.startsWith(allowedBase) || origin.startsWith(`http://${allowedBase}`);
      });

      if (allowed) {
        callback(null, true);
      } else {
        logger.warn('CORS', 'Origin not in whitelist', { origin });
        callback(new Error('CORS not allowed'));
      }
      return;
    }

    // Local mode: only localhost and 127.0.0.1
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: false
}));
```

**Step 3: Verify build**

Run: `npm run build`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add src/services/worker/http/middleware.ts
git commit -m "feat: implement adaptive CORS middleware

Local mode: only localhost origins allowed
Remote mode: check CLAUDE_MEM_ALLOWED_ORIGINS whitelist with
flexible port matching for user convenience."
```

---

## Task 14: Implement Adaptive Admin Endpoint Protection

**Files:**
- Modify: `src/services/worker/http/middleware.ts`

**Step 1: Update requireLocalhost function**

Find lines 83-105, replace with:

```typescript
/**
 * Middleware to require localhost-only access (adapts to remote mode)
 * Used for admin endpoints that should not be exposed when binding to 0.0.0.0
 */
export function requireLocalhost(req: Request, res: Response, next: NextFunction): void {
  const settingsPath = getUserSettingsPath();
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);

  // Remote mode: allow if CLAUDE_MEM_ALLOW_REMOTE_ADMIN is true
  if (settings.CLAUDE_MEM_REMOTE_MODE === 'true' && settings.CLAUDE_MEM_ALLOW_REMOTE_ADMIN === 'true') {
    // Optional: Log remote admin access for audit
    const clientIp = req.ip || req.connection.remoteAddress || '';
    logger.info('ADMIN', 'Remote admin access', {
      endpoint: req.path,
      clientIp,
      method: req.method
    });
    next();
    return;
  }

  // Local mode: require localhost only
  const clientIp = req.ip || req.connection.remoteAddress || '';
  const isLocalhost =
    clientIp === '127.0.0.1' ||
    clientIp === '::1' ||
    clientIp === '::ffff:127.0.0.1' ||
    clientIp === 'localhost';

  if (!isLocalhost) {
    logger.warn('SECURITY', 'Admin endpoint access denied - not localhost', {
      endpoint: req.path,
      clientIp,
      method: req.method
    });
    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin endpoints are only accessible from localhost (enable CLAUDE_MEM_ALLOW_REMOTE_ADMIN for remote access)'
    });
    return;
  }

  next();
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add src/services/worker/http/middleware.ts
git commit -m "feat: implement adaptive admin endpoint protection

Local mode: admin endpoints require localhost
Remote mode: admin endpoints accessible if CLAUDE_MEM_ALLOW_REMOTE_ADMIN=true
Logs all remote admin access attempts for audit trail."
```

---

## Task 15: Add Configuration Validation

**Files:**
- Modify: `src/services/worker-service.ts`

**Step 1: Add validation in initializeBackground()**

Find `initializeBackground()` method around line 370, after loading settings, add:

```typescript
// Validate remote mode configuration
if (settings.CLAUDE_MEM_REMOTE_MODE === 'true') {
  if (settings.CLAUDE_MEM_WORKER_HOST === '127.0.0.1' ||
      settings.CLAUDE_MEM_WORKER_HOST === 'localhost') {
    logger.warn('SYSTEM', 'REMOTE_MODE enabled but WORKER_HOST is still localhost. Set WORKER_HOST to 0.0.0.0 for external access');
  }

  if (!settings.CLAUDE_MEM_ALLOWED_ORIGINS) {
    logger.warn('SYSTEM', 'REMOTE_MODE enabled but no ALLOWED_ORIGINS configured. CORS will block browser requests');
  }

  logger.info('SYSTEM', 'Remote server mode enabled', {
    host: settings.CLAUDE_MEM_WORKER_HOST,
    port: settings.CLAUDE_MEM_WORKER_PORT,
    allowedOrigins: settings.CLAUDE_MEM_ALLOWED_ORIGINS || 'none',
    allowRemoteAdmin: settings.CLAUDE_MEM_ALLOW_REMOTE_ADMIN
  });
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add src/services/worker-service.ts
git commit -m "feat: add remote mode configuration validation

Warn if REMOTE_MODE enabled but WORKER_HOST still localhost.
Warn if REMOTE_MODE enabled but no ALLOWED_ORIGINS configured.
Log remote mode configuration on startup."
```

---

## Task 16: Create Remote Mode Documentation

**Files:**
- Create: `docs/remote-server-setup.md`

**Step 1: Write documentation**

```markdown
# Remote Server Deployment

## Overview

Run claude-mem on a central server accessible from multiple development machines via VPN or local network.

## Use Case

Single developer accessing claude-mem from multiple machines (home desktop, work laptop, etc.) with:
- Trusted network (VPN or local network)
- Centralized memory database
- Shared search across all machines

## Prerequisites

- VPN connection (Tailscale, WireGuard, or similar) OR local network access
- Server machine always accessible
- Client machines can reach server via IP address

## Server Setup

### 1. Install claude-mem

```bash
npm install -g claude-mem
```

### 2. Configure Remote Mode

Edit `~/.claude-mem/settings.json`:

```json
{
  "CLAUDE_MEM_REMOTE_MODE": "true",
  "CLAUDE_MEM_WORKER_HOST": "0.0.0.0",
  "CLAUDE_MEM_WORKER_PORT": "37777",
  "CLAUDE_MEM_ALLOWED_ORIGINS": "http://192.168.1.100,http://192.168.1.101,http://192.168.1.102",
  "CLAUDE_MEM_ALLOW_REMOTE_ADMIN": "true"
}
```

**Settings explained:**
- `CLAUDE_MEM_REMOTE_MODE`: Enable remote server deployment
- `CLAUDE_MEM_WORKER_HOST`: Bind to all interfaces (use `0.0.0.0`)
- `CLAUDE_MEM_ALLOWED_ORIGINS`: Comma-separated list of allowed client IPs (flexible port matching)
- `CLAUDE_MEM_ALLOW_REMOTE_ADMIN`: Allow admin endpoints from network

### 3. Start Worker

```bash
npx claude-mem start
```

### 4. Verify Health

```bash
curl http://localhost:37777/api/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "10.x.x",
  "initialized": true
}
```

### 5. Configure Firewall (Optional)

**Linux (ufw):**
```bash
sudo ufw allow 37777/tcp

# Or restrict to specific IPs:
sudo ufw allow from 192.168.1.0/24 to any port 37777
```

**Windows Firewall:**
- Create inbound rule for port 37777
- Scope: Specific local IPs (your client machines)

## Client Setup

### 1. Update Settings

Edit `~/.claude-mem/settings.json` on each client:

```json
{
  "CLAUDE_MEM_WORKER_HOST": "192.168.1.50",
  "CLAUDE_MEM_WORKER_PORT": "37777"
}
```

Replace `192.168.1.50` with your server's actual IP address.

### 2. Test Connection

```bash
curl http://192.168.1.50:37777/api/health
```

Expected: Same health check response as server

### 3. Verify Hook Works

```bash
cd /your/project
claude-mem hook claude-code context
```

Expected: Timeline output showing past observations

## Security Notes

### Best Practices

1. **Use VPN**: Tailscale, WireGuard, or similar for encrypted access
2. **Restrict Firewall**: Only allow necessary IPs on port 37777
3. **Disable Remote Admin**: Set `CLAUDE_MEM_ALLOW_REMOTE_ADMIN=false` when possible
4. **Limit CORS**: Only add client IPs you actually use
5. **Monitor Logs**: Check for unexpected access attempts

### What's Protected

- **Opt-in Only**: Remote mode is disabled by default
- **CORS Whitelist**: Browser requests restricted to allowed origins
- **Admin Endpoints**: Optional remote access (default: protected)
- **Logging**: All remote admin access logged

### What's NOT Protected

This is **not** designed for:
- Public internet exposure
- Multi-user team collaboration
- Untrusted networks
- Production environments without VPN

For those scenarios, you need additional security (API keys, HTTPS, authentication).

## Troubleshooting

### Client Can't Connect

**Symptom**: `Connection refused` or timeout

**Check:**
```bash
# From server: Is worker running?
curl http://localhost:37777/api/health

# From server: Is port listening?
netstat -tuln | grep 37777  # Linux
netstat -an | findstr 37777  # Windows

# From client: Can reach server IP?
ping 192.168.1.50
```

**Fix:**
- Ensure worker started on server
- Check firewall allows port 37777
- Verify client and server on same network/VPN

### CORS Errors in Browser

**Symptom**: Browser console shows CORS errors

**Check:**
- Client IP in `CLAUDE_MEM_ALLOWED_ORIGINS`
- Flexible port matching (no port in allowed origins)

**Fix:**
```json
{
  "CLAUDE_MEM_ALLOWED_ORIGINS": "http://192.168.1.100"  // No port needed
}
```

### Admin Endpoints Blocked

**Symptom**: 403 Forbidden on `/api/admin/restart` or `/api/admin/shutdown`

**Check:**
- `CLAUDE_MEM_ALLOW_REMOTE_ADMIN` set to `true`
- Request coming from allowed IP

**Fix:**
```json
{
  "CLAUDE_MEM_ALLOW_REMOTE_ADMIN": "true"
}
```

Then restart worker.

### Observations Not Saving

**Symptom**: Hooks run but observations not stored

**Check:**
- Worker health endpoint responds
- Check worker logs: `~/.claude-mem/worker.log`

**Fix:**
- Restart worker: `npx claude-mem restart`
- Check database permissions: `~/.claude-mem/claude-mem.db`

## Example Network Layout

```
┌─────────────────┐
│  Server         │  192.168.1.50
│  claude-mem     │  Port: 37777
│  SQLite DB      │  Mode: REMOTE
│  Chroma DB      │  Origins: .100,.101,.102
└────────┬────────┘
         │
    ┌────┴─────┐
    │  VPN /   │
    │  Local   │
    │ Network  │
    └────┬─────┘
         │
    ┌────┴────────────────────┐
    │                         │
┌───▼────┐              ┌────▼────┐
│Client 1│              │Client 2 │
│.100    │              │.101     │
└────────┘              └─────────┘
```

## Support

- GitHub Issues: https://github.com/thedotmack/claude-mem/issues
- Documentation: https://docs.claude-mem.ai
```

**Step 2: Stage and commit**

```bash
git add docs/remote-server-setup.md
git commit -m "docs: add remote server setup guide

Comprehensive guide for deploying claude-mem on external server
with VPN/local network access. Covers server setup, client
configuration, security best practices, and troubleshooting."
```

---

## Task 17: Update README with Remote Mode Section

**Files:**
- Modify: `README.md`

**Step 1: Add section after "Architecture"**

```markdown
## Remote Server Mode

claude-mem can run on a central server accessible from multiple machines via VPN or local network. See [Remote Server Deployment](docs/remote-server-setup.md) for detailed instructions.

**Quick Start:**

Server (`~/.claude-mem/settings.json`):
```json
{
  "CLAUDE_MEM_REMOTE_MODE": "true",
  "CLAUDE_MEM_WORKER_HOST": "0.0.0.0",
  "CLAUDE_MEM_ALLOWED_ORIGINS": "http://192.168.1.100,http://192.168.1.101"
}
```

Client (`~/.claude-mem/settings.json`):
```json
{
  "CLAUDE_MEM_WORKER_HOST": "192.168.1.50"
}
```

**Security:** Remote mode is opt-in only. Use VPN/tunnel for secure access. See [Remote Server Deployment](docs/remote-server-setup.md) for security details.
```

**Step 2: Build and commit**

```bash
npm run build
git add README.md
git commit -m "docs: add remote server mode section to README"
```

---

## Task 18: Create Sync Scripts for Fork Maintenance

**Files:**
- Create: `scripts/sync-upstream.sh`
- Create: `scripts/sync-upstream.ps1`

**Step 1: Create bash script**

Write `scripts/sync-upstream.sh`:

```bash
#!/bin/bash
# Sync upstream changes into your fork

set -e  # Exit on error

echo "🔄 Syncing claude-mem upstream..."

# Fetch latest from upstream
echo "📥 Fetching upstream..."
git fetch upstream

# Update main branch
echo "🌿 Updating main branch..."
git checkout main
git merge upstream/main --ff-only  # Fast-forward only, no merge commit
git push origin main

# Update feature branch
echo "🔧 Updating remote-server branch..."
git checkout remote-server
git merge main -m "chore: sync with upstream/main"

# Check for conflicts
if [ -f .git/MERGE_HEAD ]; then
    echo "⚠️  Merge conflicts detected!"
    echo "📝 Resolve conflicts, then:"
    echo "   git add <resolved-files>"
    echo "   git commit"
    echo "   git push origin remote-server"
    exit 1
fi

echo "✅ Sync complete! Testing build..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful! Pushing changes..."
    git push origin remote-server
    echo "🎉 All done! Your remote-server branch is up to date."
else
    echo "❌ Build failed! Fix issues before pushing."
    git merge --abort
    exit 1
fi
```

**Step 2: Create PowerShell script**

Write `scripts/sync-upstream.ps1`:

```powershell
# Sync upstream changes into your fork (Windows PowerShell)

Write-Host "🔄 Syncing claude-mem upstream..." -ForegroundColor Cyan

# Fetch latest from upstream
Write-Host "📥 Fetching upstream..." -ForegroundColor Yellow
git fetch upstream

# Update main branch
Write-Host "🌿 Updating main branch..." -ForegroundColor Yellow
git checkout main
git merge upstream/main --ff-only
git push origin main

# Update feature branch
Write-Host "🔧 Updating remote-server branch..." -ForegroundColor Yellow
git checkout remote-server
git merge main -m "chore: sync with upstream/main"

# Check for conflicts
$mergeStatus = git status | Select-String "both modified"
if ($mergeStatus) {
    Write-Host "⚠️  Merge conflicts detected!" -ForegroundColor Red
    Write-Host "📝 Resolve conflicts, then:" -ForegroundColor Yellow
    Write-Host "   git add <resolved-files>" -ForegroundColor White
    Write-Host "   git commit" -ForegroundColor White
    Write-Host "   git push origin remote-server" -ForegroundColor White
    exit 1
}

Write-Host "✅ Sync complete! Testing build..." -ForegroundColor Green
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful! Pushing changes..." -ForegroundColor Green
    git push origin remote-server
    Write-Host "🎉 All done! Your remote-server branch is up to date." -ForegroundColor Green
} else {
    Write-Host "❌ Build failed! Fix issues before pushing." -ForegroundColor Red
    git merge --abort
    exit 1
}
```

**Step 3: Make bash executable and commit**

```bash
chmod +x scripts/sync-upstream.sh
git add scripts/sync-upstream.sh scripts/sync-upstream.ps1
git commit -m "feat: add upstream sync scripts for fork maintenance

Add bash and PowerShell scripts to automate syncing upstream
changes into the remote-server feature branch. Includes
conflict detection and build verification."
```

---

## Task 19: Manual Integration Testing

**Files:**
- No file changes (testing only)

**Step 1: Test local mode (regression)**

```bash
# Ensure default settings (no remote mode)
rm ~/.claude-mem/settings.json  # Will recreate with defaults

# Start worker
npx claude-mem start

# Verify localhost binding
curl http://127.0.0.1:37777/api/health

# Test hook
cd /tmp/test-project
claude-mem hook claude-code context

# Expected: Works normally, worker binds to 127.0.0.1 only
```

**Step 2: Test remote mode on server**

```bash
# On server machine
cat > ~/.claude-mem/settings.json << EOF
{
  "CLAUDE_MEM_REMOTE_MODE": "true",
  "CLAUDE_MEM_WORKER_HOST": "0.0.0.0",
  "CLAUDE_MEM_WORKER_PORT": "37777",
  "CLAUDE_MEM_ALLOWED_ORIGINS": "http://192.168.1.100",
  "CLAUDE_MEM_ALLOW_REMOTE_ADMIN": "true"
}
EOF

# Restart worker
npx claude-mem restart

# Verify health from server
curl http://localhost:37777/api/health

# Verify binds to 0.0.0.0
netstat -tuln | grep 37777  # Linux
# Should show: 0.0.0.0:37777
```

**Step 3: Test client connection**

```bash
# On client machine
cat > ~/.claude-mem/settings.json << EOF
{
  "CLAUDE_MEM_WORKER_HOST": "192.168.1.50",
  "CLAUDE_MEM_WORKER_PORT": "37777"
}
EOF

# Test health
curl http://192.168.1.50:37777/api/health

# Test hook
cd /your/project
claude-mem hook claude-code context

# Expected: Returns timeline from server
```

**Step 4: Test all hook types remotely**

```bash
# From client machine
claude-mem hook claude-code session-init
claude-mem hook claude-code observation
claude-mem hook claude-code summarize
claude-mem hook claude-code session-complete

# Check server logs for activity
tail -f ~/.claude-mem/worker.log
```

**Step 5: Test CORS with browser**

```bash
# Open browser on client: http://192.168.1.50:37777/
# Should load viewer UI
# Check browser console for CORS errors (should be none)
```

**Step 6: Test admin endpoints**

```bash
# From client (should work with ALLOW_REMOTE_ADMIN=true)
curl -X POST http://192.168.1.50:37777/api/admin/restart

# Check worker restarted successfully
curl http://192.168.1.50:37777/api/health
```

**Document results:**
```bash
echo "Remote mode integration test results:
- Local mode: PASS/FAIL
- Remote server start: PASS/FAIL
- Client connection: PASS/FAIL
- Hook types: PASS/FAIL
- CORS: PASS/FAIL
- Admin endpoints: PASS/FAIL
" > test-results.txt
```

---

## Task 20: Create Documentation File for Changes

**Files:**
- Create: `REMOTE_MODE_CHANGES.md`

**Step 1: Write change summary**

```markdown
# Remote Server Mode Changes

## Overview

This fork adds remote server deployment capability to claude-mem, enabling the worker to run on an external server accessible from multiple development machines via VPN or local network.

## Modified Files

### Configuration Layer
- `src/shared/SettingsDefaultsManager.ts` - Added remote mode settings

### Network Layer
- `src/shared/worker-utils.ts` - Use getWorkerHost() instead of hardcoded 127.0.0.1
- `src/services/infrastructure/HealthMonitor.ts` - Use getWorkerHost() in all fetch calls
- `src/cli/handlers/context.ts` - Remote worker URL support
- `src/cli/handlers/file-edit.ts` - Remote worker URL support
- `src/cli/handlers/observation.ts` - Remote worker URL support
- `src/cli/handlers/session-complete.ts` - Remote worker URL support
- `src/cli/handlers/session-init.ts` - Remote worker URL support
- `src/cli/handlers/summarize.ts` - Remote worker URL support
- `src/cli/handlers/user-message.ts` - Remote worker URL support
- `src/services/transcripts/processor.ts` - Remote worker URL support
- `src/services/integrations/CursorHooksInstaller.ts` - Remote worker URL support

### Security Layer
- `src/services/worker/http/middleware.ts` - Adaptive CORS and admin endpoint protection

### Validation
- `src/services/worker-service.ts` - Remote mode configuration validation

## New Settings

- `CLAUDE_MEM_REMOTE_MODE` - Enable remote server deployment (default: false)
- `CLAUDE_MEM_ALLOWED_ORIGINS` - CORS whitelist for remote mode (comma-separated IPs)
- `CLAUDE_MEM_ALLOW_REMOTE_ADMIN` - Allow admin endpoints from network (default: true)

## Breaking Changes

None. All changes are opt-in via `CLAUDE_MEM_REMOTE_MODE` setting.

## Sync Strategy

Feature branch: `remote-server`
Upstream: https://github.com/thedotmack/claude-mem

Sync scripts:
- `scripts/sync-upstream.sh` (Linux/Mac)
- `scripts/sync-upstream.ps1` (Windows)

## Testing

See implementation plan Task 19 for integration testing checklist.

## Documentation

- `docs/remote-server-setup.md` - User guide for remote deployment
- `docs/plans/2025-02-21-remote-server-mode-implementation.md` - Implementation plan
- `docs/plans/2025-02-20-remote-server-mode-design.md` - Design document
```

**Step 2: Commit**

```bash
git add REMOTE_MODE_CHANGES.md
git commit -m "docs: add remote mode changes summary

Document all modified files, new settings, and sync strategy
for the remote server mode feature."
```

---

## Task 21: Final Build and Test

**Files:**
- All modified files

**Step 1: Clean build**

```bash
rm -rf dist
npm run build
```

Expected: BUILD SUCCESS with no errors or warnings

**Step 2: Run all hooks locally**

```bash
# Reset to local mode
cat > ~/.claude-mem/settings.json << EOF
{
  "CLAUDE_MEM_MODE": "code"
}
EOF

npx claude-mem restart

# Test each hook type
claude-mem hook claude-code context
claude-mem hook claude-code session-init
claude-mem hook claude-code observation
claude-mem hook claude-code summarize
claude-mem hook claude-code session-complete
```

Expected: All hooks work normally (regression test)

**Step 3: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: No type errors

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final adjustments from testing"
```

---

## Summary

**Total Tasks:** 21
**Estimated Time:** 2-3 hours
**Risk Level:** Low (opt-in feature, backward compatible)

**Success Criteria:**
✅ All hardcoded `127.0.0.1` references replaced with `getWorkerHost()`
✅ CORS adapts based on `CLAUDE_MEM_REMOTE_MODE` setting
✅ Admin endpoints adaptively protected
✅ Configuration validation warns of misconfigurations
✅ Comprehensive documentation and sync scripts
✅ Local mode unchanged (backward compatible)
✅ Remote mode fully functional on external server

**Next Steps After Implementation:**
1. Test with actual VPN/local network setup
2. Deploy to server and verify client connectivity
3. Run full integration test suite
4. Monitor logs for any issues
5. Consider contributing upstream if valuable
