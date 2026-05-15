import { Namespace, Socket } from 'socket.io';
import { eq, asc } from 'drizzle-orm';
import { Logger } from '../utils/logger.js';
import { db } from '../db/index.js';
import { visaChatMessages } from '../db/schema.js';
import {
  streamChat,
  buildApplicationContext,
  buildSystemPrompt,
  type ApplicationBlockPayload,
} from '../agent/index.js';
import {
  retrieveVisaKnowledge,
  formatKnowledgeContext,
} from '../services/visa-knowledge.service.js';

const logger = new Logger({ serviceName: 'VisaNamespace' });

function resolveKnowledgeCountry(message: string, applicationCountry?: string | null): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('美国') ||
    normalized.includes('美签') ||
    normalized.includes('united states') ||
    normalized.includes('u.s.') ||
    normalized.includes('usa') ||
    normalized.includes('us visa')
  ) {
    return 'us';
  }

  if (
    normalized.includes('印尼') ||
    normalized.includes('印度尼西亚') ||
    normalized.includes('indonesia') ||
    normalized.includes('bali')
  ) {
    return 'indonesia';
  }

  return applicationCountry ?? 'indonesia';
}

function resolveKnowledgeVisaType(
  country: string,
  message: string,
  applicationVisaType?: string | null
): string | null {
  const normalized = message.toLowerCase();

  if (country === 'us') {
    if (
      normalized.includes('b1') ||
      normalized.includes('b-1') ||
      normalized.includes('b2') ||
      normalized.includes('b-2') ||
      normalized.includes('b1/b2') ||
      normalized.includes('b-1/b-2') ||
      normalized.includes('旅游') ||
      normalized.includes('商务') ||
      normalized.includes('visitor') ||
      normalized.includes('tourist') ||
      normalized.includes('business') ||
      normalized.includes('ds-160') ||
      normalized.includes('ds160')
    ) {
      return 'b1_b2';
    }
  }

  return applicationVisaType ?? null;
}

/**
 * Payload the client sends on the "visa_chat_message" event.
 */
interface VisaChatRequest {
  user_id: string;
  session_id: string;
  message: string;
  service_id?: string;
}

/**
 * Register all event handlers for the /visa Socket.IO namespace.
 */
export function registerVisaNamespace(nsp: Namespace): void {
  nsp.on('connection', (socket: Socket) => {
    logger.info('Client connected to /visa', {
      socketId: socket.id,
      transport: socket.conn.transport.name,
    });

    // ---- join_room (for proactive messages) --------------------------------
    socket.on('join_room', (room: string) => {
      socket.join(room);
      logger.debug(`Socket ${socket.id} joined room ${room}`);
    });

    // ---- visa_chat_message --------------------------------------------------
    socket.on('visa_chat_message', async (request: VisaChatRequest) => {
      const { user_id, session_id, message } = request;

      logger.info('Received visa_chat_message', {
        userId: user_id,
        sessionId: session_id,
        messageLength: message.length,
      });

      const startTime = Date.now();

      try {
        // 1. Save user message to DB (non-fatal)
        try {
          await db.insert(visaChatMessages).values({
            sessionId: session_id,
            role: 'user',
            content: message,
          });
        } catch (dbErr) {
          logger.warn('Failed to save user message (DB may be unavailable)', dbErr as Error, {
            sessionId: session_id,
          });
        }

        // 2. Load conversation history (fallback to current message only)
        let chatHistory: { role: 'user' | 'assistant'; content: string }[] = [
          { role: 'user', content: message },
        ];

        try {
          const history = await db
            .select({ role: visaChatMessages.role, content: visaChatMessages.content })
            .from(visaChatMessages)
            .where(eq(visaChatMessages.sessionId, session_id))
            .orderBy(asc(visaChatMessages.createdAt))
            .limit(50);

          if (history.length > 0) {
            // Only include user/assistant messages (skip 'block' role for Anthropic API)
            chatHistory = history
              .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
              .map((msg) => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
              }));
          }
        } catch (dbErr) {
          logger.warn('Failed to load chat history (using current message only)', dbErr as Error, {
            sessionId: session_id,
          });
        }

        // 3. Build dynamic system prompt with user application context (US-036)
        //    and retrieved visa knowledge from visa_chunks.
        const appContext = await buildApplicationContext(user_id);
        const knowledgeCountry = resolveKnowledgeCountry(
          message,
          appContext.application?.country
        );
        const knowledgeVisaType = resolveKnowledgeVisaType(
          knowledgeCountry,
          message,
          appContext.application?.visa_type
        );
        const knowledgeResult = await retrieveVisaKnowledge({
          query: message,
          country: knowledgeCountry,
          visaType: knowledgeVisaType,
          matchCount: 5,
        });
        const knowledgeContext = formatKnowledgeContext(knowledgeResult.chunks);
        const dynamicSystemPrompt = buildSystemPrompt(
          appContext,
          knowledgeContext
        );

        socket.emit('app_log', {
          type: 'rag_retrieval',
          category: 'rag',
          name: 'visa_knowledge',
          result: {
            chunkCount: knowledgeResult.chunks.length,
            country: knowledgeCountry,
            visaType: knowledgeVisaType,
            usedEmbedding: knowledgeResult.usedEmbedding,
            fallbackReason: knowledgeResult.fallbackReason,
            topSources: knowledgeResult.chunks.slice(0, 3).map((chunk) => ({
              title: chunk.title,
              country: chunk.country,
              visaType: chunk.visaType,
              documentType: chunk.documentType,
              similarity: chunk.similarity,
            })),
          },
          timestamp: Date.now(),
        });

        // 4. Stream response from Claude with dynamic prompt + tool support
        let fullResponse = '';

        await streamChat(
          chatHistory,
          {
            onToken: (text) => {
              socket.emit('token', {
                type: 'token',
                payload: text,
                timestamp: Date.now(),
              });
            },
            onComplete: async (response, toolsUsed) => {
              fullResponse = response;

              // 5. Save assistant text message to DB (only if there's text)
              if (fullResponse.trim()) {
                try {
                  await db.insert(visaChatMessages).values({
                    sessionId: session_id,
                    role: 'assistant',
                    content: fullResponse,
                  });
                } catch (dbErr) {
                  logger.error('Failed to save assistant message', dbErr as Error, {
                    sessionId: session_id,
                  });
                }
              }

              // 6. Emit response_complete
              socket.emit('response_complete', {
                type: 'response_complete',
                sessionId: session_id,
                userId: user_id,
                fullResponse,
                toolsUsed,
                escalated: false,
                duration: Date.now() - startTime,
                timestamp: Date.now(),
              });
            },
            onError: (err) => {
              socket.emit('error', {
                type: 'error',
                message: err.message || 'AI agent error',
                code: 'AGENT_ERROR',
                timestamp: Date.now(),
              });
            },
            // US-037: handle tool use
            onToolUse: async (toolName, toolInput: ApplicationBlockPayload) => {
              logger.info('Tool use: send_application_block', {
                toolName,
                blockType: toolInput.blockType,
                sessionId: session_id,
              });

              // Emit application_block event to the client
              socket.emit('application_block', {
                type: 'application_block',
                payload: toolInput,
                timestamp: Date.now(),
              });

              // Save block record to visa_chat_messages with role='block'
              try {
                await db.insert(visaChatMessages).values({
                  sessionId: session_id,
                  role: 'block',
                  content: toolInput.title,
                  blockData: toolInput as unknown as Record<string, unknown>,
                });
              } catch (dbErr) {
                logger.error('Failed to save block message', dbErr as Error, {
                  sessionId: session_id,
                });
              }
            },
          },
          dynamicSystemPrompt
        );
      } catch (err) {
        logger.error('Error handling visa_chat_message', err as Error, {
          userId: user_id,
          sessionId: session_id,
        });

        socket.emit('error', {
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
          code: 'AGENT_ERROR',
          timestamp: Date.now(),
        });
      }
    });

    // ---- component_complete (UI component callback) -------------------------
    socket.on('component_complete', (event: { componentId: string; result: unknown }) => {
      logger.debug('Component completed', { componentId: event.componentId });
    });

    // ---- disconnect ---------------------------------------------------------
    socket.on('disconnect', (reason: string) => {
      logger.info('Client disconnected from /visa', {
        socketId: socket.id,
        reason,
      });
    });
  });
}
