import { sql, type SQL } from 'drizzle-orm';
import {
  visaAgentRunDiagnostics,
  visaChatMessages,
} from '../db/schema.js';

export interface ChatTurnCompletionDiagnostic {
  sessionId: string;
  memoryRevision: number;
  destinationCountry: string | null;
  passportCountryIso3: string | null;
  entryRuleOutcome: string;
  visaType: string | null;
  recommendedProducts: Array<{
    productCode?: string;
    provider?: 'official' | 'viza';
    requirement?: 'required' | 'conditional' | 'optional';
  }>;
  intent: string | null;
  sourceKeys: string[];
  fallbackReason: string | null;
  model: string;
  durationMs: number;
}

export type ChatTurnCompletionQueryExecutor = (
  query: SQL,
) => Promise<unknown>;

/**
 * Persist assistant output and its redacted diagnostic in one atomic database
 * statement. The exact-message guard preserves frontend/socket idempotency,
 * while an empty assistant response still records the diagnostic.
 */
export function buildPersistedChatTurnCompletionQuery(
  assistantContent: string,
  diagnostic: ChatTurnCompletionDiagnostic,
): SQL {
  const normalizedContent = assistantContent.trim();

  return sql`
    WITH completion_input AS (
      SELECT
        ${diagnostic.sessionId}::uuid AS session_id,
        'assistant'::text AS role,
        ${normalizedContent}::text AS content,
        ${diagnostic.memoryRevision}::bigint AS memory_revision,
        ${diagnostic.destinationCountry}::text AS destination_country,
        ${diagnostic.passportCountryIso3}::text AS passport_country_iso3,
        ${diagnostic.entryRuleOutcome}::text AS entry_rule_outcome,
        ${diagnostic.visaType}::text AS visa_type,
        ${JSON.stringify(diagnostic.recommendedProducts)}::jsonb AS recommended_products,
        ${diagnostic.intent}::text AS intent,
        ${JSON.stringify(diagnostic.sourceKeys)}::jsonb AS source_keys,
        ${diagnostic.fallbackReason}::text AS fallback_reason,
        ${diagnostic.model}::text AS model,
        ${diagnostic.durationMs}::integer AS duration_ms
    ),
    inserted_message AS (
      INSERT INTO ${visaChatMessages} ("session_id", "role", "content")
      SELECT input.session_id, input.role, input.content
      FROM completion_input AS input
      WHERE input.content <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM ${visaChatMessages} AS existing
          WHERE existing.session_id = input.session_id
            AND existing.role = input.role
            AND existing.content = input.content
        )
      RETURNING "id"
    ),
    inserted_diagnostic AS (
      INSERT INTO ${visaAgentRunDiagnostics} (
        "session_id",
        "memory_revision",
        "destination_country",
        "passport_country_iso3",
        "entry_rule_outcome",
        "visa_type",
        "recommended_products",
        "intent",
        "source_keys",
        "fallback_reason",
        "model",
        "duration_ms"
      )
      SELECT
        input.session_id,
        input.memory_revision,
        input.destination_country,
        input.passport_country_iso3,
        input.entry_rule_outcome,
        input.visa_type,
        input.recommended_products,
        input.intent,
        input.source_keys,
        input.fallback_reason,
        input.model,
        input.duration_ms
      FROM completion_input AS input
      RETURNING "id"
    )
    SELECT
      EXISTS (SELECT 1 FROM inserted_message) AS "messageInserted",
      EXISTS (SELECT 1 FROM inserted_diagnostic) AS "diagnosticInserted"
  `;
}

export async function persistChatTurnCompletion(
  assistantContent: string,
  diagnostic: ChatTurnCompletionDiagnostic,
  execute: ChatTurnCompletionQueryExecutor,
): Promise<void> {
  await execute(
    buildPersistedChatTurnCompletionQuery(assistantContent, diagnostic),
  );
}
