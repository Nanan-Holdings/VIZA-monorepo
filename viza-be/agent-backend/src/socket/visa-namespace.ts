import { Namespace, Socket } from 'socket.io';
import { Logger } from '../utils/logger.js';

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
 *
 * The real agent loop is not wired yet — this handler acknowledges the
 * message and returns a placeholder response so the frontend can connect
 * and render without CORS / 404 errors.
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
        // TODO: Wire up VisaAgent streaming loop here.
        // For now, echo a placeholder so the UI round-trip works end-to-end.

        // Emit a few tokens to prove streaming works
        const placeholder =
          "I'm the VIZA assistant. The agent backend is connected but the AI agent loop hasn't been wired up yet. Stay tuned!";

        // Stream token-by-token (chunked for realism)
        const chunkSize = 8;
        for (let i = 0; i < placeholder.length; i += chunkSize) {
          const chunk = placeholder.slice(i, i + chunkSize);
          socket.emit('token', {
            type: 'token',
            payload: chunk,
            timestamp: Date.now(),
          });
          // Small delay between chunks to simulate streaming
          await sleep(30);
        }

        // Emit response_complete with the full response
        socket.emit('response_complete', {
          type: 'response_complete',
          sessionId: session_id,
          userId: user_id,
          fullResponse: placeholder,
          toolsUsed: [],
          escalated: false,
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        });
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
      // TODO: Forward to agent loop when implemented
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
