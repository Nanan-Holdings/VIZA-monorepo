import "server-only";

// eslint-disable-next-line no-restricted-imports -- Type-only reference in a server-only loader; its caller authenticates and supplies authorized application IDs.
import type { createAdminClient } from "@/lib/supabase/admin";

interface ConsentRow {
  application_id: string;
  accepted: boolean;
  created_at: string | null;
}

interface SignatureRow {
  application_id: string;
  signed_at: string | null;
  created_at: string | null;
}

interface AnswerRow {
  application_id: string;
  field_name: string;
  value_text: string | null;
  value_json: unknown;
}

interface PacketRow {
  application_id: string;
  status: string;
  storage_path: string | null;
  generated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface BaseDocumentRow {
  application_id: string;
}

interface DocumentRow extends BaseDocumentRow {
  application_id: string;
  status: string;
  required: boolean | null;
}

/** Full document projection used only by the Home single-application preload. */
export interface HomeDocumentRow extends DocumentRow {
  id: string;
  document_type: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface SubmissionQueueResult {
  data: unknown;
  error: unknown;
}

export interface RelatedRows<TDocument extends BaseDocumentRow = DocumentRow> {
  consents: ConsentRow[];
  signatures: SignatureRow[];
  answers: AnswerRow[];
  packets: PacketRow[];
  documents: TDocument[];
  partialData: boolean;
  submissionQueueResult?: SubmissionQueueResult;
  /** True only when a requested full Home document relation was validated. */
  documentsPrefetched?: boolean;
  /** True when the requested full Home document relation must use the old GET. */
  documentPrefetchFailed?: boolean;
}

type AdminClient = ReturnType<typeof createAdminClient>;
type QueryResult = SubmissionQueueResult;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_POSTGREST_ROWS = 1_000;
const COLUMNS = {
  consents: "application_id,accepted,created_at",
  signatures: "application_id,signed_at,created_at",
  answers: "application_id,field_name,value_text,value_json",
  packets: "application_id,status,storage_path,generated_at,created_at,updated_at",
  documents: "application_id,status,required",
} as const;
const SUBMISSION_QUEUE_PREFETCH_COLUMNS =
  "id,application_id,status,mode,provider,current_stage,live_checkpoint,manual_action_status,error_code,error_message,official_portal_url,official_status,payment_status,live_submitted_at,updated_at,created_at";
// Explicit existing FK names keep the projection stable if another relationship
// to applications is added later. Left embedding preserves empty child sets.
const EMBEDDED_SELECT = [
  "id",
  `consents:consent_events!consent_events_application_id_fkey(${COLUMNS.consents})`,
  `signatures:application_signatures!application_signatures_application_id_fkey(${COLUMNS.signatures})`,
  `answers:visa_application_answers!visa_application_answers_application_id_fkey(${COLUMNS.answers})`,
  `packets:application_packets!application_packets_application_id_fkey(${COLUMNS.packets})`,
].join(",");

function emptyRows<TDocument extends BaseDocumentRow = DocumentRow>(
  partialData = false,
): RelatedRows<TDocument> {
  return { consents: [], signatures: [], answers: [], packets: [], documents: [], partialData };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validPrefetchedQueueRows(value: unknown, applicationId: string): unknown[] | null {
  if (!Array.isArray(value)) return null;
  const normalizedApplicationId = applicationId.toLowerCase();
  for (const item of value) {
    const row = record(item);
    if (
      !row ||
      typeof row.id !== "string" ||
      row.id.trim().length === 0 ||
      typeof row.application_id !== "string" ||
      row.application_id.toLowerCase() !== normalizedApplicationId
    ) {
      return null;
    }
  }
  return value;
}

function scopedRows<T extends BaseDocumentRow>(
  value: unknown,
  applicationIds: ReadonlySet<string>,
  validateRow?: (row: Record<string, unknown>) => boolean,
): { rows: T[]; failed: boolean } {
  if (!Array.isArray(value)) return { rows: [], failed: true };
  let failed = false;
  const rows: T[] = [];
  for (const item of value) {
    const row = record(item);
    if (
      !row ||
      typeof row.application_id !== "string" ||
      !applicationIds.has(row.application_id) ||
      (validateRow && !validateRow(row))
    ) {
      failed = true;
      continue;
    }
    rows.push(row as T);
  }
  return { rows, failed };
}

async function readScoped<T extends BaseDocumentRow>(
  query: PromiseLike<QueryResult>,
  applicationIds: ReadonlySet<string>,
): Promise<{ rows: T[]; failed: boolean }> {
  try {
    const result = await query;
    if (result.error) return { rows: [], failed: true };
    return scopedRows<T>(result.data, applicationIds);
  } catch {
    return { rows: [], failed: true };
  }
}

async function readSeparately(
  client: AdminClient,
  ids: string[],
  includeDocuments: boolean,
  prefetchDocuments: boolean,
): Promise<RelatedRows> {
  const allowed = new Set(ids);
  const [consents, signatures, answers, packets, documents] = await Promise.all([
    readScoped<ConsentRow>(client.from("consent_events").select(COLUMNS.consents).in("application_id", ids), allowed),
    readScoped<SignatureRow>(client.from("application_signatures").select(COLUMNS.signatures).in("application_id", ids), allowed),
    readScoped<AnswerRow>(client.from("visa_application_answers").select(COLUMNS.answers).in("application_id", ids), allowed),
    readScoped<PacketRow>(client.from("application_packets").select(COLUMNS.packets).in("application_id", ids), allowed),
    includeDocuments && !prefetchDocuments
      ? readScoped<DocumentRow>(client.from("application_documents").select(COLUMNS.documents).in("application_id", ids), allowed)
      : { rows: [], failed: false },
  ]);
  const output: RelatedRows = {
    consents: consents.rows,
    signatures: signatures.rows,
    answers: answers.rows,
    packets: packets.rows,
    documents: documents.rows,
    partialData: [consents, signatures, answers, packets, documents].some((result) => result.failed),
  };
  if (prefetchDocuments) {
    output.documentsPrefetched = false;
    output.documentPrefetchFailed = true;
  }
  return output;
}

function isHomeDocumentRow(row: Record<string, unknown>): boolean {
  return (
    typeof row.id === "string" &&
    row.id.trim().length > 0 &&
    typeof row.document_type === "string" &&
    typeof row.status === "string" &&
    (row.required === null || typeof row.required === "boolean") &&
    (row.created_at === null || typeof row.created_at === "string") &&
    (row.updated_at === null || typeof row.updated_at === "string")
  );
}

/**
 * Read related status rows only AFTER the caller establishes application ownership.
 * This service-role helper is not an authorization boundary. It retains no rows
 * across requests and does not return private file paths to the browser.
 */
export async function loadStatusRelatedRows(
  client: AdminClient,
  authorizedApplicationIds: string[],
  options: {
    includeDocuments?: boolean;
    /** Full Home document columns, enabled only for a validated single-app preload. */
    documentColumns?: string;
    prefetchDocuments?: boolean;
    submissionQueueApplicationId?: string;
    onSubmissionQueueResult?: (result: SubmissionQueueResult | undefined) => void;
    onDocumentsPrefetchResult?: (documents: HomeDocumentRow[] | undefined) => void;
  } = {},
): Promise<RelatedRows> {
  const {
    includeDocuments = false,
    documentColumns,
    prefetchDocuments = false,
    submissionQueueApplicationId,
    onSubmissionQueueResult,
    onDocumentsPrefetchResult,
  } = options;
  let queueResultNotified = false;
  let documentsPrefetchNotified = false;
  const notifyQueueResult = (result?: SubmissionQueueResult): void => {
    if (queueResultNotified) return;
    queueResultNotified = true;
    try {
      onSubmissionQueueResult?.(result);
    } catch {
      // An observer must never change the read result or trigger its fallback.
    }
  };
  const notifyDocumentsPrefetchResult = (documents?: HomeDocumentRow[]): void => {
    if (documentsPrefetchNotified) return;
    documentsPrefetchNotified = true;
    try {
      onDocumentsPrefetchResult?.(documents);
    } catch {
      // An observer must never change the read result or trigger its fallback.
    }
  };

  if (authorizedApplicationIds.length === 0) {
    notifyDocumentsPrefetchResult();
    notifyQueueResult();
    return emptyRows();
  }
  if (authorizedApplicationIds.some((id) => !UUID_PATTERN.test(id))) {
    notifyDocumentsPrefetchResult();
    notifyQueueResult();
    return emptyRows(true);
  }
  const ids = [...new Set(authorizedApplicationIds.map((id) => id.toLowerCase()))];
  const allowed = new Set(ids);
  const queueApplicationId = submissionQueueApplicationId && UUID_PATTERN.test(submissionQueueApplicationId)
    ? submissionQueueApplicationId.toLowerCase()
    : null;
  const queueTargetIsAuthorized = queueApplicationId !== null && allowed.has(queueApplicationId);
  const queueTarget = queueTargetIsAuthorized ? queueApplicationId : null;
  // A full relation is safe only for the single selected application. The
  // caller's Home guard is mirrored here so a future caller cannot turn a
  // multi-application read into an unbounded nested document response.
  const shouldPrefetchDocuments = includeDocuments && prefetchDocuments && ids.length === 1;
  const selectedDocumentColumns = shouldPrefetchDocuments
    ? documentColumns?.trim() || COLUMNS.documents
    : COLUMNS.documents;
  const projection = includeDocuments
    ? `${EMBEDDED_SELECT},documents:application_documents!application_documents_application_id_fkey(${selectedDocumentColumns})${queueTarget ? `,live_queue:submission_queue!submission_queue_application_id_fkey(${SUBMISSION_QUEUE_PREFETCH_COLUMNS})` : ""}`
    : `${EMBEDDED_SELECT}${queueTarget ? `,live_queue:submission_queue!submission_queue_application_id_fkey(${SUBMISSION_QUEUE_PREFETCH_COLUMNS})` : ""}`;
  try {
    let result: SubmissionQueueResult;
    try {
      let query = client.from("applications").select(projection).in("id", ids);
      if (queueTarget) {
        query = query
          .eq("live_queue.application_id", queueTarget)
          .order("created_at", {
            ascending: false,
            nullsFirst: false,
            referencedTable: "live_queue",
          })
          .limit(500, { referencedTable: "live_queue" });
      }
      if (shouldPrefetchDocuments) {
        // Keep the nested relation below the local PostgREST max_rows cap and
        // reject a boundary-sized response below instead of trusting truncation.
        query = query.limit(MAX_POSTGREST_ROWS, { referencedTable: "documents" });
      }
      result = await query;
    } catch {
      // Notify before starting the compatibility reads so queue consumers can
      // issue their own queue request while those reads are still in flight.
      if (shouldPrefetchDocuments) notifyDocumentsPrefetchResult();
      notifyQueueResult();
      return await readSeparately(client, ids, includeDocuments, shouldPrefetchDocuments);
    }
    if (result.error) {
      // One bounded compatibility fallback preserves the previous per-table
      // partial results when PostgREST cannot serve the combined projection.
      if (shouldPrefetchDocuments) notifyDocumentsPrefetchResult();
      notifyQueueResult();
      return await readSeparately(client, ids, includeDocuments, shouldPrefetchDocuments);
    }
    if (!Array.isArray(result.data)) {
      if (shouldPrefetchDocuments) notifyDocumentsPrefetchResult();
      notifyQueueResult();
      return emptyRows(true);
    }
    const output = emptyRows();
    const seen = new Set<string>();
    let queueTargetSeen = false;
    let queuePrefetchValid = queueTarget !== null;
    const prefetchedQueueRows: unknown[] = [];
    let documentPrefetchFailed = false;
    for (const item of result.data) {
      const parent = record(item);
      if (!parent || typeof parent.id !== "string" || !allowed.has(parent.id) || seen.has(parent.id)) {
        output.partialData = true;
        if (queueTarget && parent?.id === queueTarget) queuePrefetchValid = false;
        continue;
      }
      seen.add(parent.id);
      if (queueTarget && parent.id === queueTarget) {
        queueTargetSeen = true;
        const queueRows = validPrefetchedQueueRows(parent.live_queue, queueTarget);
        if (!queueRows) {
          queuePrefetchValid = false;
        } else {
          prefetchedQueueRows.push(...queueRows);
        }
      }
      const parentIds = new Set([parent.id]);
      const consents = scopedRows<ConsentRow>(parent.consents, parentIds);
      const signatures = scopedRows<SignatureRow>(parent.signatures, parentIds);
      const answers = scopedRows<AnswerRow>(parent.answers, parentIds);
      const packets = scopedRows<PacketRow>(parent.packets, parentIds);
      const documents = shouldPrefetchDocuments
        ? Array.isArray(parent.documents) && parent.documents.length < MAX_POSTGREST_ROWS
          ? scopedRows<HomeDocumentRow>(parent.documents, parentIds, isHomeDocumentRow)
          : { rows: [], failed: true }
        : includeDocuments
          ? scopedRows<DocumentRow>(parent.documents, parentIds)
          : { rows: [], failed: false };
      output.consents.push(...consents.rows);
      output.signatures.push(...signatures.rows);
      output.answers.push(...answers.rows);
      output.packets.push(...packets.rows);
      if (shouldPrefetchDocuments) {
        if (documents.failed) {
          documentPrefetchFailed = true;
        } else {
          output.documents.push(...documents.rows);
        }
      } else {
        output.documents.push(...documents.rows);
        output.partialData ||= documents.failed;
      }
      output.partialData ||= [consents, signatures, answers, packets].some((rows) => rows.failed);
    }
    output.partialData ||= seen.size !== ids.length;
    if (shouldPrefetchDocuments) {
      const documentsPrefetched = !documentPrefetchFailed && !output.partialData && seen.size === ids.length;
      output.documentsPrefetched = documentsPrefetched;
      output.documentPrefetchFailed = !documentsPrefetched;
      if (!documentsPrefetched) {
        output.documents = [];
        notifyDocumentsPrefetchResult();
      } else {
        notifyDocumentsPrefetchResult(output.documents as HomeDocumentRow[]);
      }
    }
    if (queueTarget && queuePrefetchValid && queueTargetSeen) {
      output.submissionQueueResult = { data: prefetchedQueueRows, error: null };
      notifyQueueResult(output.submissionQueueResult);
    } else {
      notifyQueueResult();
    }
    return output;
  } finally {
    // Resolve a deferred queue consumer even if an unexpected parser/runtime
    // exception escapes the bounded read above.
    notifyQueueResult();
    notifyDocumentsPrefetchResult();
  }
}
