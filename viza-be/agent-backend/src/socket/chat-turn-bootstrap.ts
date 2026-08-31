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
 * Persist the visible user message and materialize the request-scoped history
 * plus memory snapshot in one database round trip. PostgreSQL data-modifying
 * CTEs share a snapshot, so the inserted row is carried into the history
 * window through RETURNING rather than re-reading the target table.
 */
export function buildPersistedUserChatTurnBootstrapQuery(
  sessionId: string,
  content: string,
  historyLimit: number,
): SQL | null {
  if (!Number.isInteger(historyLimit) || historyLimit < 1) {
    throw new Error('Chat history limit must be a positive integer');
  }

  const normalizedContent = content.trim();
  if (!normalizedContent) return null;

  return sql`
    WITH message_input AS (
      SELECT
        ${sessionId}::uuid AS session_id,
        'user'::text AS role,
        ${normalizedContent}::text AS content
    ),
    inserted_message AS (
      INSERT INTO ${visaChatMessages} ("session_id", "role", "content")
      SELECT input.session_id, input.role, input.content
      FROM message_input AS input
      WHERE NOT EXISTS (
        SELECT 1
        FROM ${visaChatMessages} AS existing
        WHERE existing.session_id = input.session_id
          AND existing.role = input.role
          AND existing.content = input.content
      )
      RETURNING "id", "session_id", "role", "content", "created_at"
    )
    SELECT
      session_row.id AS "sessionId",
      message_row.role,
      message_row.content,
      session_row.memory_json AS "memoryJson",
      session_row.memory_revision AS "memoryRevision"
    FROM ${visaChatSessions} AS session_row
    JOIN message_input AS input ON input.session_id = session_row.id
    LEFT JOIN LATERAL (
      SELECT
        candidate.id,
        candidate.role,
        candidate.content,
        candidate.created_at
      FROM (
        SELECT
          existing.id,
          existing.role,
          existing.content,
          existing.created_at
        FROM ${visaChatMessages} AS existing
        WHERE existing.session_id = input.session_id

        UNION ALL

        SELECT
          inserted.id,
          inserted.role,
          inserted.content,
          inserted.created_at
        FROM inserted_message AS inserted
      ) AS candidate
      ORDER BY candidate.created_at DESC, candidate.id DESC
      LIMIT ${historyLimit}
    ) AS message_row ON TRUE
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

export type PersistedUserChatTurnBootstrapExecutor = (
  query: SQL,
) => Promise<ChatTurnBootstrapRow[]>;

export async function persistUserMessageAndLoadChatTurnBootstrap(
  sessionId: string,
  content: string,
  historyLimit: number,
  execute: PersistedUserChatTurnBootstrapExecutor,
): Promise<ChatTurnBootstrap | null> {
  const query = buildPersistedUserChatTurnBootstrapQuery(
    sessionId,
    content,
    historyLimit,
  );
  if (!query) return null;

  return loadChatTurnBootstrap(historyLimit, () => execute(query));
}
