import { sql, type SQL } from 'drizzle-orm';
import { visaChatMessages } from '../db/schema.js';

export type VisibleVisaChatRole = 'user' | 'assistant';

export type VisibleChatMessageQueryExecutor = (
  query: SQL
) => Promise<unknown>;

/**
 * Preserve exact session/role/content idempotency in one database statement.
 * Chat text remains request-scoped and is never placed in process-shared state.
 */
export function buildSaveVisibleVisaChatMessageQuery(
  sessionId: string,
  role: VisibleVisaChatRole,
  content: string
): SQL | null {
  const normalizedContent = content.trim();
  if (!normalizedContent) return null;

  return sql`
    WITH message_input AS (
      SELECT
        ${sessionId}::uuid AS session_id,
        ${role}::text AS role,
        ${normalizedContent}::text AS content
    )
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
  `;
}

export async function persistVisibleVisaChatMessage(
  sessionId: string,
  role: VisibleVisaChatRole,
  content: string,
  execute: VisibleChatMessageQueryExecutor
): Promise<boolean> {
  const query = buildSaveVisibleVisaChatMessageQuery(sessionId, role, content);
  if (!query) return false;
  await execute(query);
  return true;
}
