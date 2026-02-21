/**
 * CustomSummaryAgent: Custom API-based observation extraction
 *
 * Alternative to SDKAgent that uses any OpenAI-compatible API
 * for observation extraction and summary generation.
 *
 * Responsibility:
 * - Call custom OpenAI-compatible REST API for observation extraction
 * - Parse XML responses (same format as Claude/Gemini/OpenRouter)
 * - Sync to database and Chroma
 * - Support configurable API endpoint, model, and credentials
 */

import { buildContinuationPrompt, buildInitPrompt, buildObservationPrompt, buildSummaryPrompt } from '../../sdk/prompts.js';
import { getCredential } from '../../shared/EnvManager.js';
import { SettingsDefaultsManager } from '../../shared/SettingsDefaultsManager.js';
import { USER_SETTINGS_PATH } from '../../shared/paths.js';
import { logger } from '../../utils/logger.js';
import { ModeManager } from '../domain/ModeManager.js';
import type { ActiveSession, ConversationMessage } from '../worker-types.js';
import { DatabaseManager } from './DatabaseManager.js';
import { SessionManager } from './SessionManager.js';
import {
  isAbortError,
  processAgentResponse,
  shouldFallbackToClaude,
  type FallbackAgent,
  type WorkerRef
} from './agents/index.js';

// Context window management constants (defaults, overridable via settings)
const DEFAULT_MAX_CONTEXT_MESSAGES = 20;  // Maximum messages to keep in conversation history
const DEFAULT_MAX_ESTIMATED_TOKENS = 100000;  // ~100k tokens max context (safety limit)
const CHARS_PER_TOKEN_ESTIMATE = 4;  // Conservative estimate: 1 token = 4 chars

// OpenAI-compatible message format
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// OpenAI-compatible response format
interface CustomAPIResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
}

// Anthropic API response format
interface AnthropicResponse {
  id?: string;
  type?: string;
  role?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    type?: string;
    message?: string;
  };
}

export class CustomSummaryAgent {
  private dbManager: DatabaseManager;
  private sessionManager: SessionManager;
  private fallbackAgent: FallbackAgent | null = null;

  constructor(dbManager: DatabaseManager, sessionManager: SessionManager) {
    this.dbManager = dbManager;
    this.sessionManager = sessionManager;
  }

  /**
   * Set the fallback agent (Claude SDK) for when custom API fails
   * Must be set after construction to avoid circular dependency
   */
  setFallbackAgent(agent: FallbackAgent): void {
    this.fallbackAgent = agent;
  }

  /**
   * Start custom API agent for a session
   * Uses multi-turn conversation to maintain context across messages
   */
  async startSession(session: ActiveSession, worker?: WorkerRef): Promise<void> {
    try {
      // Get custom API configuration
      const { apiUrl, apiKey, model } = this.getCustomAPIConfig();

      if (!apiUrl) {
        throw new Error('Custom API URL not configured. Set CLAUDE_MEM_CUSTOM_SUMMARY_API_URL in settings or CUSTOM_SUMMARY_API_URL environment variable.');
      }

      if (!apiKey) {
        throw new Error('Custom API key not configured. Set CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY in settings or CUSTOM_SUMMARY_API_KEY environment variable.');
      }

      // Generate synthetic memorySessionId (custom API is stateless, doesn't return session IDs)
      if (!session.memorySessionId) {
        const syntheticMemorySessionId = `custom-${session.contentSessionId}-${Date.now()}`;
        session.memorySessionId = syntheticMemorySessionId;
        this.dbManager.getSessionStore().updateMemorySessionId(session.sessionDbId, syntheticMemorySessionId);
        logger.info('SESSION', `MEMORY_ID_GENERATED | sessionDbId=${session.sessionDbId} | provider=CustomSummary`);
      }

      // Load active mode
      const mode = ModeManager.getInstance().getActiveMode();

      // Build initial prompt
      const initPrompt = session.lastPromptNumber === 1
        ? buildInitPrompt(session.project, session.contentSessionId, session.userPrompt, mode)
        : buildContinuationPrompt(session.userPrompt, session.lastPromptNumber, session.contentSessionId, mode);

      // Add to conversation history and query custom API with full context
      session.conversationHistory.push({ role: 'user', content: initPrompt });
      const initResponse = await this.queryCustomAPIMultiTurn(session.conversationHistory, apiUrl, apiKey, model);

      if (initResponse.content) {
        // Track token usage
        const tokensUsed = initResponse.tokensUsed || 0;
        session.cumulativeInputTokens += Math.floor(tokensUsed * 0.7);  // Rough estimate
        session.cumulativeOutputTokens += Math.floor(tokensUsed * 0.3);

        // Process response using shared ResponseProcessor (no original timestamp for init - not from queue)
        await processAgentResponse(
          initResponse.content,
          session,
          this.dbManager,
          this.sessionManager,
          worker,
          tokensUsed,
          null,
          'CustomSummary',
          undefined  // No lastCwd yet - before message processing
        );
      } else {
        logger.error('SDK', 'Empty custom API init response - session may lack context', {
          sessionId: session.sessionDbId,
          model
        });
      }

      // Track lastCwd from messages for CLAUDE.md generation
      let lastCwd: string | undefined;

      // Process pending messages
      for await (const message of this.sessionManager.getMessageIterator(session.sessionDbId)) {
        // CLAIM-CONFIRM: Track message ID for confirmProcessed() after successful storage
        // The message is now in 'processing' status in DB until ResponseProcessor calls confirmProcessed()
        session.processingMessageIds.push(message._persistentId);

        // Capture cwd from messages for proper worktree support
        if (message.cwd) {
          lastCwd = message.cwd;
        }
        // Capture earliest timestamp BEFORE processing (will be cleared after)
        const originalTimestamp = session.earliestPendingTimestamp;

        if (message.type === 'observation') {
          // Update last prompt number
          if (message.prompt_number !== undefined) {
            session.lastPromptNumber = message.prompt_number;
          }

          // CRITICAL: Check memorySessionId BEFORE making expensive LLM call
          // This prevents wasting tokens when we won't be able to store the result anyway
          if (!session.memorySessionId) {
            throw new Error('Cannot process observations: memorySessionId not yet captured. This session may need to be reinitialized.');
          }

          // Build observation prompt
          const obsPrompt = buildObservationPrompt({
            id: 0,
            tool_name: message.tool_name!,
            tool_input: JSON.stringify(message.tool_input),
            tool_output: JSON.stringify(message.tool_response),
            created_at_epoch: originalTimestamp ?? Date.now(),
            cwd: message.cwd
          });

          // Add to conversation history and query custom API with full context
          session.conversationHistory.push({ role: 'user', content: obsPrompt });
          const obsResponse = await this.queryCustomAPIMultiTurn(session.conversationHistory, apiUrl, apiKey, model);

          let tokensUsed = 0;
          if (obsResponse.content) {
            tokensUsed = obsResponse.tokensUsed || 0;
            session.cumulativeInputTokens += Math.floor(tokensUsed * 0.7);
            session.cumulativeOutputTokens += Math.floor(tokensUsed * 0.3);
          }

          // Process response using shared ResponseProcessor
          await processAgentResponse(
            obsResponse.content || '',
            session,
            this.dbManager,
            this.sessionManager,
            worker,
            tokensUsed,
            originalTimestamp,
            'CustomSummary',
            lastCwd
          );

        } else if (message.type === 'summarize') {
          // CRITICAL: Check memorySessionId BEFORE making expensive LLM call
          if (!session.memorySessionId) {
            throw new Error('Cannot process summary: memorySessionId not yet captured. This session may need to be reinitialized.');
          }

          // Build summary prompt
          const summaryPrompt = buildSummaryPrompt({
            id: session.sessionDbId,
            memory_session_id: session.memorySessionId,
            project: session.project,
            user_prompt: session.userPrompt,
            last_assistant_message: message.last_assistant_message || ''
          }, mode);

          // Add to conversation history and query custom API with full context
          session.conversationHistory.push({ role: 'user', content: summaryPrompt });
          const summaryResponse = await this.queryCustomAPIMultiTurn(session.conversationHistory, apiUrl, apiKey, model);

          let tokensUsed = 0;
          if (summaryResponse.content) {
            tokensUsed = summaryResponse.tokensUsed || 0;
            session.cumulativeInputTokens += Math.floor(tokensUsed * 0.7);
            session.cumulativeOutputTokens += Math.floor(tokensUsed * 0.3);
          }

          // Process response using shared ResponseProcessor
          await processAgentResponse(
            summaryResponse.content || '',
            session,
            this.dbManager,
            this.sessionManager,
            worker,
            tokensUsed,
            originalTimestamp,
            'CustomSummary',
            lastCwd
          );
        }
      }

      // Mark session complete
      const sessionDuration = Date.now() - session.startTime;
      logger.success('SDK', 'Custom Summary agent completed', {
        sessionId: session.sessionDbId,
        duration: `${(sessionDuration / 1000).toFixed(1)}s`,
        historyLength: session.conversationHistory.length,
        model,
        apiUrl: apiUrl.replace(/\/\/[^@]+@/, '//***@')  // Hide credentials in logs
      });

    } catch (error: unknown) {
      if (isAbortError(error)) {
        logger.warn('SDK', 'Custom Summary agent aborted', { sessionId: session.sessionDbId });
        throw error;
      }

      // Check if we should fall back to Claude
      // IMPORTANT: In remote mode, Claude SDK is not available, so don't fall back
      const { SettingsDefaultsManager } = await import('../../shared/SettingsDefaultsManager.js');
      const { USER_SETTINGS_PATH } = await import('../../shared/paths.js');
      const settings = SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH);
      const isRemoteMode = settings.CLAUDE_MEM_REMOTE_MODE === 'true';

      if (shouldFallbackToClaude(error) && this.fallbackAgent && !isRemoteMode) {
        logger.warn('SDK', 'Custom API failed, falling back to Claude SDK', {
          sessionDbId: session.sessionDbId,
          error: error instanceof Error ? error.message : String(error),
          historyLength: session.conversationHistory.length
        });

        // Fall back to Claude - it will use the same session with shared conversationHistory
        // Note: With claim-and-delete queue pattern, messages are already deleted on claim
        return this.fallbackAgent.startSession(session, worker);
      }

      // In remote mode or if no fallback available, fail with clear error
      if (isRemoteMode) {
        logger.error('SDK', 'Custom API failed in remote mode - no fallback available (Claude SDK not accessible)', {
          sessionDbId: session.sessionDbId,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      logger.failure('SDK', 'Custom Summary agent error', { sessionDbId: session.sessionDbId }, error as Error);
      throw error;
    }
  }

  /**
   * Detect if the API URL is for Anthropic
   * Checks for anthropic.com or explicit setting
   */
  private isAnthropicAPI(apiUrl: string): boolean {
    // Check URL for anthropic domain
    if (apiUrl.includes('anthropic.com')) {
      return true;
    }

    // Check settings for explicit API format override
    const settingsPath = USER_SETTINGS_PATH;
    const settings = SettingsDefaultsManager.loadFromFile(settingsPath);
    const apiFormat = settings.CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT || 'auto';

    if (apiFormat === 'anthropic') {
      return true;
    }

    if (apiFormat === 'openai') {
      return false;
    }

    // Auto-detect: check for Anthropic-specific URL patterns
    return apiUrl.includes('/v1/messages') || apiUrl.includes('/messages');
  }

  /**
   * Estimate token count from text (conservative estimate)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
  }

  /**
   * Truncate conversation history to prevent runaway context costs
   * Keeps most recent messages within token budget
   */
  private truncateHistory(history: ConversationMessage[]): ConversationMessage[] {
    const settings = SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH);

    const MAX_CONTEXT_MESSAGES = parseInt(settings.CLAUDE_MEM_CUSTOM_SUMMARY_MAX_CONTEXT_MESSAGES) || DEFAULT_MAX_CONTEXT_MESSAGES;
    const MAX_ESTIMATED_TOKENS = parseInt(settings.CLAUDE_MEM_CUSTOM_SUMMARY_MAX_TOKENS) || DEFAULT_MAX_ESTIMATED_TOKENS;

    if (history.length <= MAX_CONTEXT_MESSAGES) {
      // Check token count even if message count is ok
      const totalTokens = history.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);
      if (totalTokens <= MAX_ESTIMATED_TOKENS) {
        return history;
      }
    }

    // Sliding window: keep most recent messages within limits
    const truncated: ConversationMessage[] = [];
    let tokenCount = 0;

    // Process messages in reverse (most recent first)
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      const msgTokens = this.estimateTokens(msg.content);

      if (truncated.length >= MAX_CONTEXT_MESSAGES || tokenCount + msgTokens > MAX_ESTIMATED_TOKENS) {
        logger.warn('SDK', 'Context window truncated to prevent runaway costs', {
          originalMessages: history.length,
          keptMessages: truncated.length,
          droppedMessages: i + 1,
          estimatedTokens: tokenCount,
          tokenLimit: MAX_ESTIMATED_TOKENS
        });
        break;
      }

      truncated.unshift(msg);  // Add to beginning
      tokenCount += msgTokens;
    }

    return truncated;
  }

  /**
   * Convert shared ConversationMessage array to OpenAI-compatible message format
   */
  private conversationToOpenAIMessages(history: ConversationMessage[]): OpenAIMessage[] {
    return history.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
  }

  /**
   * Query custom API with full conversation history (multi-turn)
   * Sends the entire conversation context for coherent responses
   * Supports both OpenAI-compatible and Anthropic API formats
   */
  private async queryCustomAPIMultiTurn(
    history: ConversationMessage[],
    apiUrl: string,
    apiKey: string,
    model: string
  ): Promise<{ content: string; tokensUsed?: number }> {
    // Truncate history to prevent runaway costs
    const truncatedHistory = this.truncateHistory(history);
    const totalChars = truncatedHistory.reduce((sum, m) => sum + m.content.length, 0);
    const estimatedTokens = this.estimateTokens(truncatedHistory.map(m => m.content).join(''));

    // Detect API format
    const isAnthropic = this.isAnthropicAPI(apiUrl);

    logger.debug('SDK', `Querying custom API multi-turn (${model})`, {
      turns: truncatedHistory.length,
      totalChars,
      estimatedTokens,
      apiUrl: apiUrl.replace(/\/\/[^@]+@/, '//***@'),  // Hide credentials in logs
      apiUrlRaw: apiUrl,  // For debugging - will show full URL including any embedded credentials
      apiFormat: isAnthropic ? 'anthropic' : 'openai'
    });

    logger.debug('SDK', `Fetching from custom API`, {
      url: apiUrl,
      method: 'POST',
      model,
      apiFormat: isAnthropic ? 'anthropic' : 'openai'
    });

    let response: Response;
    let tokensUsed = 0;
    let content = '';

    if (isAnthropic) {
      // Anthropic Messages API format
      const systemMessage = this.extractSystemMessage(truncatedHistory);
      const userMessages = this.extractUserMessages(truncatedHistory);

      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: userMessages,
          system: systemMessage,
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as AnthropicResponse;

      // Check for API error in response body
      if (data.error) {
        throw new Error(`Anthropic API error: ${data.error.type} - ${data.error.message}`);
      }

      // Extract text content from Anthropic response
      if (data.content && data.content.length > 0) {
        const textBlock = data.content.find(block => block.type === 'text');
        content = textBlock?.text || '';
      }

      tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

      // Log actual token usage
      if (data.usage) {
        logger.info('SDK', 'Anthropic API usage', {
          model,
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
          totalTokens: tokensUsed,
          messagesInContext: truncatedHistory.length
        });

        // Warn if costs are getting high
        if (tokensUsed > 50000) {
          logger.warn('SDK', 'High token usage detected - consider reducing context', {
            totalTokens: tokensUsed
          });
        }
      }

    } else {
      // OpenAI-compatible API format
      const messages = this.conversationToOpenAIMessages(truncatedHistory);

      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Custom API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as CustomAPIResponse;

      // Check for API error in response body
      if (data.error) {
        throw new Error(`Custom API error: ${data.error.type || data.error.code} - ${data.error.message}`);
      }

      if (!data.choices?.[0]?.message?.content) {
        logger.error('SDK', 'Empty response from custom API');
        return { content: '' };
      }

      content = data.choices[0].message.content;
      tokensUsed = data.usage?.total_tokens || 0;

      // Log actual token usage for cost tracking
      if (data.usage) {
        const inputTokens = data.usage?.prompt_tokens || 0;
        const outputTokens = data.usage?.completion_tokens || 0;

        logger.info('SDK', 'Custom API usage', {
          model,
          inputTokens,
          outputTokens,
          totalTokens: tokensUsed,
          messagesInContext: truncatedHistory.length
        });

        // Warn if costs are getting high
        if (tokensUsed > 50000) {
          logger.warn('SDK', 'High token usage detected - consider reducing context', {
            totalTokens: tokensUsed
          });
        }
      }
    }

    return { content, tokensUsed };
  }

  /**
   * Extract system message from conversation history (for Anthropic API)
   * Returns the first user message as system context, or empty string
   */
  private extractSystemMessage(history: ConversationMessage[]): string {
    if (history.length === 0) return '';
    // First user message typically contains system instructions
    const firstUserMsg = history.find(m => m.role === 'user');
    return firstUserMsg?.content || '';
  }

  /**
   * Extract user messages for Anthropic API format
   * Anthropic expects alternating user/assistant messages
   */
  private extractUserMessages(history: ConversationMessage[]): Array<{ role: string; content: string }> {
    const result: Array<{ role: string; content: string }> = [];

    for (const msg of history) {
      if (msg.role === 'user') {
        result.push({
          role: 'user',
          content: msg.content
        });
      } else if (msg.role === 'assistant' && result.length > 0) {
        // Only add assistant messages if there's already a user message
        result.push({
          role: 'assistant',
          content: msg.content
        });
      }
    }

    return result;
  }

  /**
   * Get custom API configuration from settings or environment
   * Issue #733: Uses centralized ~/.claude-mem/.env for credentials, not random project .env files
   */
  private getCustomAPIConfig(): { apiUrl: string; apiKey: string; model: string } {
    const settingsPath = USER_SETTINGS_PATH;
    const settings = SettingsDefaultsManager.loadFromFile(settingsPath);

    // API URL: check settings first, then centralized claude-mem .env (NOT process.env)
    // This prevents Issue #733 where random project .env files could interfere
    let apiUrl = settings.CLAUDE_MEM_CUSTOM_SUMMARY_API_URL || getCredential('CUSTOM_SUMMARY_API_URL') || '';

    const apiFormat = settings.CLAUDE_MEM_CUSTOM_SUMMARY_API_FORMAT || 'auto';
    const isAnthropic = apiFormat === 'anthropic' || apiUrl.includes('anthropic.com');

    // Auto-detect and append appropriate endpoint path
    if (apiUrl) {
      const hasEndpoint = apiUrl.endsWith('/chat/completions') ||
                         apiUrl.endsWith('/completions') ||
                         apiUrl.endsWith('/v1/messages') ||
                         apiUrl.endsWith('/messages');

      if (!hasEndpoint) {
        // Remove trailing slash if present
        apiUrl = apiUrl.replace(/\/$/, '');

        // Append appropriate endpoint based on API format
        if (isAnthropic) {
          apiUrl += '/v1/messages';
          logger.debug('SDK', 'Auto-appended /v1/messages to Anthropic API URL', {
            originalUrl: settings.CLAUDE_MEM_CUSTOM_SUMMARY_API_URL || getCredential('CUSTOM_SUMMARY_API_URL') || '',
            finalUrl: apiUrl
          });
        } else {
          apiUrl += '/chat/completions';
          logger.debug('SDK', 'Auto-appended /chat/completions to custom API URL', {
            originalUrl: settings.CLAUDE_MEM_CUSTOM_SUMMARY_API_URL || getCredential('CUSTOM_SUMMARY_API_URL') || '',
            finalUrl: apiUrl
          });
        }
      }
    }

    // API key: check settings first, then centralized claude-mem .env
    const apiKey = settings.CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY || getCredential('CUSTOM_SUMMARY_API_KEY') || '';

    // Model: from settings or default
    const model = settings.CLAUDE_MEM_CUSTOM_SUMMARY_MODEL || 'gpt-4o-mini';

    return { apiUrl, apiKey, model };
  }
}

/**
 * Check if custom API is available (has URL and API key configured)
 * Issue #733: Uses centralized ~/.claude-mem/.env, not random project .env files
 */
export function isCustomSummaryAvailable(): boolean {
  const settingsPath = USER_SETTINGS_PATH;
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);
  const hasUrl = !!(settings.CLAUDE_MEM_CUSTOM_SUMMARY_API_URL || getCredential('CUSTOM_SUMMARY_API_URL'));
  const hasKey = !!(settings.CLAUDE_MEM_CUSTOM_SUMMARY_API_KEY || getCredential('CUSTOM_SUMMARY_API_KEY'));
  return hasUrl && hasKey;
}

/**
 * Check if custom API is the selected provider
 */
export function isCustomSummarySelected(): boolean {
  const settingsPath = USER_SETTINGS_PATH;
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);
  return settings.CLAUDE_MEM_PROVIDER === 'custom';
}
