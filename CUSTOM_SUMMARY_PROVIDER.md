# Custom Summary Provider

The Custom Summary Provider allows you to use any **OpenAI-compatible** or **Anthropic** API endpoint for observation extraction and summary generation in claude-mem.

## Configuration

### Via Settings File

Edit `~/.claude-mem/settings.json`:

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "https://your-api-endpoint.com",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "your-api-key-here",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "model-name",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT": "auto",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MAX_CONTEXT_MESSAGES": "20",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MAX_TOKENS": "100000"
}
```

### Via Environment Variables

Create or edit `~/.claude-mem/.env`:

```bash
CUSTOM_SUMMARY_API_URL=https://your-api-endpoint.com
CUSTOM_SUMMARY_API_KEY=your-api-key-here
```

Then set the provider in settings:

```bash
# In ~/.claude-mem/settings.json
CLAUDE_MEM_PROVIDER=custom
```

Or via environment variable:

```bash
export CLAUDE_MEM_PROVIDER=custom
```

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `CLAUDE_MEM_PROVIDER` | Must be set to `"custom"` to use this provider | `"claude"` |
| `CLAUDE_MEM_CUSTOM_SUMMARY_API_URL` | Base URL or full endpoint URL | (required) |
| `CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY` | API key for authentication | (required) |
| `CLAUDE_MEM_CUSTOM_SUMMARY_MODEL` | Model name to use | `"gpt-4o-mini"` |
| `CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT` | API format: `"auto"`, `"openai"`, or `"anthropic"` | `"auto"` |
| `CLAUDE_MEM_CUSTOM_SUMMARY_MAX_CONTEXT_MESSAGES` | Maximum messages in conversation context | `20` |
| `CLAUDE_MEM_CUSTOM_SUMMARY_MAX_TOKENS` | Maximum estimated tokens (safety limit) | `100000` |

## API Format Support

The custom provider supports **two API formats**:

### 1. OpenAI-Compatible Format

Most providers support this format (OpenAI, Azure, vLLM, Ollama, etc.).

**Request Format:**
```json
POST /v1/chat/completions
{
  "model": "model-name",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "temperature": 0.3,
  "max_tokens": 4096
}
```

**Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Response Format:**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "..."
      }
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

### 2. Anthropic Messages API Format

Native Anthropic API format.

**Request Format:**
```json
POST /v1/messages
{
  "model": "claude-sonnet-4-5-20250514",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "temperature": 0.3,
  "max_tokens": 4096
}
```

**Headers:**
```
x-api-key: YOUR_API_KEY
anthropic-version: 2023-06-01
Content-Type: application/json
```

**Response Format:**
```json
{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "..."
    }
  ],
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 100,
    "output_tokens": 50
  }
}
```

## Auto-Detection

When `CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT` is set to `"auto"` (default), the provider will:

1. **Detect by URL**:
   - URLs containing `anthropic.com` → Anthropic format
   - URLs ending in `/v1/messages` or `/messages` → Anthropic format
   - All other URLs → OpenAI format

2. **Auto-append endpoint paths**:
   - For Anthropic: appends `/v1/messages` if not present
   - For OpenAI: appends `/chat/completions` if not present

## Example Configurations

### OpenAI (Direct)

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "https://api.openai.com",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "sk-...",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "gpt-4o-mini",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT": "openai"
}
```

### Azure OpenAI

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "https://your-resource.openai.azure.com/openai/deployments/your-deployment",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "your-azure-api-key",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "gpt-4o-mini",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT": "openai"
}
```

### Anthropic (Native API)

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "https://api.anthropic.com",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "sk-ant-...",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "claude-sonnet-4-5-20250514",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT": "anthropic"
}
```

### Self-Hosted vLLM

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "http://localhost:8000",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "your-key",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "meta-llama/Llama-3-8b",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT": "openai"
}
```

### Ollama (with OpenAI compatibility)

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "http://localhost:11434",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "ollama",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "llama3.2",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT": "openai"
}
```

### Custom OpenAI-Compatible API (Your Use Case)

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "https://api.z.ai/api/coding/paas/v4",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "your-api-key",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "your-model-name",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT": "openai"
}
```

### Custom Anthropic-Compatible API

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "https://your-custom-endpoint.com",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "your-api-key",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "claude-sonnet-4-5-20250514",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT": "anthropic"
}
```

## Troubleshooting

### Error: "Custom API URL not configured"

Make sure you've set `CLAUDE_MEM_CUSTOM_SUMMARY_API_URL` in either:
- `~/.claude-mem/settings.json`
- `~/.claude-mem/.env` (as `CUSTOM_SUMMARY_API_URL`)
- Environment variable `CUSTOM_SUMMARY_API_URL`

### Error: "Custom API key not configured"

Make sure you've set `CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY` in either:
- `~/.claude-mem/settings.json`
- `~/.claude-mem/.env` (as `CUSTOM_SUMMARY_API_KEY`)
- Environment variable `CUSTOM_SUMMARY_API_KEY`

### Wrong API Format Detected

If the auto-detection picks the wrong format:

1. **Explicitly set the format**:
   ```json
   "CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT": "openai"  // or "anthropic"
   ```

2. **Use the full endpoint URL**:
   - OpenAI: End URL with `/chat/completions`
   - Anthropic: End URL with `/v1/messages`

### Empty Responses

If you receive empty responses from the API, check:
1. The API URL is correct and accessible
2. The API key is valid
3. The model name is supported by your endpoint
4. Check the worker logs: `~/.claude-mem/worker.log`

### High Token Usage

If token usage is high, reduce:
- `CLAUDE_MEM_CUSTOM_SUMMARY_MAX_CONTEXT_MESSAGES` (default: 20)
- `CLAUDE_MEM_CUSTOM_SUMMARY_MAX_TOKENS` (default: 100000)

## Architecture

The Custom Summary Provider (`CustomSummaryAgent`) follows the same architecture as the existing providers:

1. **Event-driven message processing** - Uses the same SessionManager queue system
2. **Multi-turn conversations** - Maintains conversation history for context
3. **Shared response processing** - Uses the same ResponseProcessor as other agents
4. **Database integration** - Stores observations and summaries identically to other providers
5. **Fallback support** - Can fall back to Claude SDK if API fails (when configured)
6. **Dual API format support** - Automatically handles both OpenAI and Anthropic formats

## Implementation Details

- **File**: `src/services/worker/CustomSummaryAgent.ts`
- **API Formats**: OpenAI-compatible `/v1/chat/completions` and Anthropic `/v1/messages`
- **Response Format**: XML observation format (same as Claude/Gemini/OpenRouter)
- **Context Management**: Sliding window with configurable message/token limits
- **Token Estimation**: Conservative 4 characters per token estimate
- **Auto-Detection**: URL-based and setting-based API format detection

## Comparison with Other Providers

| Provider | Use Case | Cost | Latency |
|----------|----------|------|---------|
| **Claude SDK** | Best quality, Claude Code integration | CLI subscription or API | Low (local) |
| **Gemini** | Free tier, good quality | Free (rate limited) | Medium |
| **OpenRouter** | 100+ models, free options available | Varies by model | Medium |
| **Custom** | Any OpenAI/Anthropic-compatible endpoint | Depends on endpoint | Varies |

## Notes

- The custom provider uses a **synthetic memory session ID** since the API is stateless
- Provider can be switched mid-session (conversation history is preserved)
- Settings are loaded with priority: environment variables > settings file > defaults
- Credentials are stored in `~/.claude-mem/.env` (isolated from project .env files)
- **Auto-detection is enabled by default** but can be overridden with explicit format setting
