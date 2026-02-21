# Custom Summary Provider

The Custom Summary Provider allows you to use any OpenAI-compatible API endpoint for observation extraction and summary generation in claude-mem.

## Configuration

### Via Settings File

Edit `~/.claude-mem/settings.json`:

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "https://your-api-endpoint.com/v1/chat/completions",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "your-api-key-here",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "model-name",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MAX_CONTEXT_MESSAGES": "20",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MAX_TOKENS": "100000"
}
```

### Via Environment Variables

Create or edit `~/.claude-mem/.env`:

```bash
CUSTOM_SUMMARY_API_URL=https://your-api-endpoint.com/v1/chat/completions
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
| `CLAUDE_MEM_CUSTOM_SUMMARY_API_URL` | Full URL to the OpenAI-compatible API endpoint | (required) |
| `CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY` | API key for authentication | (required) |
| `CLAUDE_MEM_CUSTOM_SUMMARY_MODEL` | Model name to use | `"gpt-4o-mini"` |
| `CLAUDE_MEM_CUSTOM_SUMMARY_MAX_CONTEXT_MESSAGES` | Maximum messages in conversation context | `20` |
| `CLAUDE_MEM_CUSTOM_SUMMARY_MAX_TOKENS` | Maximum estimated tokens (safety limit) | `100000` |

## API Requirements

Your custom API endpoint must support the OpenAI-compatible API format:

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
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

## Example Configurations

### OpenAI (Azure or Direct)

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "https://api.openai.com/v1/chat/completions",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "sk-...",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "gpt-4o-mini"
}
```

### Azure OpenAI

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2024-02-15-preview",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "your-azure-api-key",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "gpt-4o-mini"
}
```

### Anthropic via OpenAI-Compatible Endpoint

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "https://api.anthropic.com/v1/messages",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "sk-ant-...",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "claude-sonnet-4-5-20250514"
}
```

### Self-Hosted vLLM

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "http://localhost:8000/v1/chat/completions",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "your-key-or-empty",
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "meta-llama/Llama-3-8b"
}
```

### Ollama (with OpenAI compatibility)

```json
{
  "CLAUDE_MEM_PROVIDER": "custom",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_URL": "http://localhost:11434/v1/chat/completions",
  "CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY": "ollama",  // Ollama ignores this
  "CLAUDE_MEM_CUSTOM_SUMMARY_MODEL": "llama3.2"
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

The Custom Summary Provider (`CustomSummaryAgent`) follows the same architecture as the existing OpenRouter provider:

1. **Event-driven message processing** - Uses the same SessionManager queue system
2. **Multi-turn conversations** - Maintains conversation history for context
3. **Shared response processing** - Uses the same ResponseProcessor as other agents
4. **Database integration** - Stores observations and summaries identically to other providers
5. **Fallback support** - Can fall back to Claude SDK if API fails (when configured)

## Implementation Details

- **File**: `src/services/worker/CustomSummaryAgent.ts`
- **API Format**: OpenAI-compatible `/v1/chat/completions`
- **Response Format**: XML observation format (same as Claude/Gemini/OpenRouter)
- **Context Management**: Sliding window with configurable message/token limits
- **Token Estimation**: Conservative 4 characters per token estimate

## Comparison with Other Providers

| Provider | Use Case | Cost | Latency |
|----------|----------|------|---------|
| **Claude SDK** | Best quality, Claude Code integration | CLI subscription or API | Low (local) |
| **Gemini** | Free tier, good quality | Free (rate limited) | Medium |
| **OpenRouter** | 100+ models, free options available | Varies by model | Medium |
| **Custom** | Any OpenAI-compatible endpoint | Depends on endpoint | Varies |

## Notes

- The custom provider uses a **synthetic memory session ID** since the API is stateless
- Provider can be switched mid-session (conversation history is preserved)
- Settings are loaded with priority: environment variables > settings file > defaults
- Credentials are stored in `~/.claude-mem/.env` (isolated from project .env files)
