import { sql, type SQL } from 'drizzle-orm';
import { visaChatMessages, visaChatSessions } from '../db/schema.js';
import type { VisaConversationStateSnapshot } from '../services/visa-conversation-state.service.js';

export interface ChatTurnBootstrapRow {
  sessionId: string;
  role: string | null;
  content: string | null;
  memoryJson: unknown;
  memoryRevision: number | string | bigint | null;
}

export interface ChatTurnMessageRow {
  role: string;
  content: string;
}

export interface ChatTurnBootstrap {
  messageRows: ChatTurnMessageRow[];
  conversationStateSnapshot: VisaConversationStateSnapshot | null;
}

export function buildChatTurnBootstrapQuery(
  sessionId: string,
  historyLimit: number,
): SQL {
  if (!Number.isInteger(historyLimit) || historyLimit < 1) {
    throw new Error('Chat history limit must be a positive integer');
  }

  return sql`
    SELECT
      session_row.id AS "sessionId",
      message_row.role,
      message_row.content,
      session_row.memory_json AS "memoryJson",
      session_row.memory_revision AS "memoryRevision"
    FROM ${visaChatSessions} AS session_row
    LEFT JOIN LATERAL (
      SELECT
        message.id,
        message.role,
        message.content,
        message.created_at
      FROM ${visaChatMessages} AS message
      WHERE message.session_id = session_row.id
      ORDER BY message.created_at DESC, message.id DESC
      LIMIT ${historyLimit}
    ) AS message_row ON TRUE
    WHERE session_row.id = ${sessionId}::uuid
    ORDER BY
      message_row.created_at DESC NULLS LAST,
      message_row.id DESC NULLS LAST
  `;
}

/**
 * Materialize one request-scoped chat snapshot from a single database read.
 * The snapshot is never stored in a process-shared cache.
 */
export async function loadChatTurnBootstrap(
  historyLimit: number,
  loadRows: () => Promise<ChatTurnBootstrapRow[]>,
): Promise<ChatTurnBootstrap> {
  if (!Number.isInteger(historyLimit) || historyLimit < 1) {
    throw new Error('Chat history limit must be a positive integer');
  }

  const rows = await loadRows();
  const messageRows = rows
    .filter(
      (row): row is ChatTurnBootstrapRow & ChatTurnMessageRow =>
        typeof row.role === 'string' && typeof row.content === 'string',
    )
    .map(({ role, content }) => ({ role, content }));
  const session = rows[0];

  return {
    messageRows,
    conversationStateSnapshot: session
      ? {
          memoryJson: session.memoryJson,
          memoryRevision: session.memoryRevision,
          legacyMessageContents: messageRows.map((row) => row.content),
          legacyHistoryComplete: messageRows.length < historyLimit,
        }
      : null,
  };
}
