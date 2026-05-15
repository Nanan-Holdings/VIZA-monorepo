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
        const knowledgeResult = await retrieveVisaKnowledge({
          query: message,
          country: appContext.application?.country ?? 'indonesia',
          visaType: appContext.application?.visa_type,
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
