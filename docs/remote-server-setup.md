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
