import { createHash } from "node:crypto";
import { reusableDocumentAliases } from "../documents/reusable-document-aliases.js";
import type {
  AeBankStatementEvidenceFacts,
  AeDocumentEvidenceFacts,
  AeHealthCoverageEvidenceFacts,
} from "./field-mappings.js";

export const AE_EVIDENCE_REVIEW_COMMAND =
  "application_document.ae_transaction_783_evidence_review.v1";
export const AE_EVIDENCE_REVIEW_SCHEMA =
  "ae_transaction_783_evidence_review/v1";

type AeEvidenceKey =
  | "six_month_bank_statement"
  | "uae_health_coverage_evidence";

export type AeEvidenceState =
  | {
      kind: "six_month_bank_statement";
      statement_months: number;
      minimum_monthly_balance_usd_equivalent: number;
      official: boolean;
      stamped: boolean;
      signed: boolean;
      colored: boolean;
    }
  | {
      kind: "uae_health_coverage_evidence";
      issuer_country: string;
      validity_days: number;
    };

export interface AeEvidenceDocumentRow {
  id: string;
  application_id: string;
  document_type: string;
  requirement_key: string | null;
  storage_path: string | null;
  status: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  updated_at: string | null;
  document_hash: string | null;
}

export interface AeEvidenceAuditRow {
  id: string;
  actor_user_id: string | null;
  command: string;
  target_type: string;
  target_id: string;
  after_state: unknown;
  created_at: string;
}

export interface AeEvidenceReviewerRow {
  id: string;
  role: string | null;
  deleted_at: string | null;
}

/**
 * All immutable staff document commands are decisive. This deliberately
 * includes generic review/rejection/deletion commands: only a new exact UAE
 * evidence review can re-authorize a document after any later staff action.
 */
export function isAeDecisiveDocumentCommand(command: string): boolean {
  return /^(?:application_document|document)\./i.test(command.trim());
}

export function selectLatestAeDecisiveDocumentAudit(
  documentId: string,
  audits: readonly AeEvidenceAuditRow[],
): AeEvidenceAuditRow | null {
  const decisive = audits.filter((audit) =>
    audit.target_type === "application_documents" &&
    audit.target_id === documentId &&
    isAeDecisiveDocumentCommand(audit.command)
  );
  if (decisive.length === 0) return null;
  const ordered = decisive.map((audit) => ({ audit, time: Date.parse(audit.created_at) }));
  if (ordered.some(({ time }) => !Number.isFinite(time))) return null;
  ordered.sort((left, right) => right.time - left.time || right.audit.id.localeCompare(left.audit.id));
  if (ordered.length > 1 && ordered[0].time === ordered[1].time) return null;
  return ordered[0].audit;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = record(value);
  if (object) {
    return `{${Object.keys(object).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(object[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function hashAeEvidenceState(value: AeEvidenceState): string {
  return sha256(canonicalJson(value));
}

export function hashAeStorageLocator(storagePath: string): string {
  return sha256(storagePath);
}

function evidenceKey(row: AeEvidenceDocumentRow): AeEvidenceKey | null {
  const aliases = new Set([
    row.requirement_key ?? row.document_type,
    row.document_type,
    ...reusableDocumentAliases(row.requirement_key ?? row.document_type),
    ...reusableDocumentAliases(row.document_type),
  ]);
  if (aliases.has("six_month_bank_statement")) return "six_month_bank_statement";
  if (aliases.has("uae_health_coverage_evidence")) return "uae_health_coverage_evidence";
  return null;
}

function parseEvidenceState(value: unknown): AeEvidenceState | null {
  const state = record(value);
  if (!state) return null;
  if (state.kind === "six_month_bank_statement") {
    const statementMonths = numberValue(state.statement_months);
    const minimumBalance = numberValue(state.minimum_monthly_balance_usd_equivalent);
    const official = booleanValue(state.official);
    const stamped = booleanValue(state.stamped);
    const signed = booleanValue(state.signed);
    const colored = booleanValue(state.colored);
    if (
      statementMonths === null || minimumBalance === null || official === null ||
      stamped === null || signed === null || colored === null
    ) return null;
    return {
      kind: "six_month_bank_statement",
      statement_months: statementMonths,
      minimum_monthly_balance_usd_equivalent: minimumBalance,
      official,
      stamped,
      signed,
      colored,
    };
  }
  if (state.kind === "uae_health_coverage_evidence") {
    const issuerCountry = stringValue(state.issuer_country);
    const validityDays = numberValue(state.validity_days);
    if (!issuerCountry || validityDays === null) return null;
    return {
      kind: "uae_health_coverage_evidence",
      issuer_country: issuerCountry,
      validity_days: validityDays,
    };
  }
  return null;
}

function sameTimestamp(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const a = Date.parse(left);
  const b = Date.parse(right);
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

/**
 * Converts one review into evidence facts only when the immutable staff audit,
 * mutable row projection, reviewer, storage locator, and current file bytes all
 * match exactly. Generic document status audits and applicant metadata cannot
 * satisfy this boundary.
 */
export function parseAeAuthoritativeEvidenceReview(input: {
  applicationId: string;
  document: AeEvidenceDocumentRow;
  audit: AeEvidenceAuditRow;
  reviewer: AeEvidenceReviewerRow | undefined;
  actualDocumentHash: string | null;
}): { key: AeEvidenceKey; facts: AeBankStatementEvidenceFacts | AeHealthCoverageEvidenceFacts } | null {
  const { document, audit, reviewer } = input;
  const after = record(audit.after_state);
  const key = evidenceKey(document);
  if (!after || !key) return null;
  if (
    audit.command !== AE_EVIDENCE_REVIEW_COMMAND ||
    audit.target_type !== "application_documents" ||
    audit.target_id !== document.id ||
    after.schema_version !== AE_EVIDENCE_REVIEW_SCHEMA ||
    after.audit_event_id !== audit.id ||
    after.application_id !== input.applicationId ||
    after.document_id !== document.id ||
    after.document_type !== document.document_type ||
    after.requirement_key !== document.requirement_key ||
    after.status !== "validated" ||
    document.application_id !== input.applicationId ||
    document.status !== "validated" ||
    !document.storage_path ||
    after.storage_locator_hash !== hashAeStorageLocator(document.storage_path) ||
    !document.document_hash ||
    document.document_hash !== input.actualDocumentHash ||
    after.document_hash !== document.document_hash ||
    after.reviewed_by !== document.reviewed_by ||
    audit.actor_user_id !== document.reviewed_by ||
    reviewer?.id !== audit.actor_user_id ||
    !["admin", "staff"].includes(reviewer.role ?? "") ||
    reviewer.deleted_at !== null ||
    !sameTimestamp(document.reviewed_at, stringValue(after.reviewed_at)) ||
    !sameTimestamp(document.updated_at, stringValue(after.document_updated_at))
  ) return null;

  const reviewedAt = Date.parse(document.reviewed_at ?? "");
  const auditCreatedAt = Date.parse(audit.created_at);
  if (
    !Number.isFinite(reviewedAt) ||
    !Number.isFinite(auditCreatedAt) ||
    Math.abs(auditCreatedAt - reviewedAt) > 5 * 60_000
  ) return null;

  const state = parseEvidenceState(after.evidence_state);
  const stateHash = stringValue(after.evidence_state_hash);
  if (!state || state.kind !== key || !stateHash || hashAeEvidenceState(state) !== stateHash) {
    return null;
  }

  if (state.kind === "six_month_bank_statement") {
    return {
      key,
      facts: {
        status: document.status,
        reviewedAt: document.reviewed_at,
        documentUpdatedAt: document.updated_at,
        monthsCovered: state.statement_months,
        minimumMonthlyBalanceUsdEquivalent: state.minimum_monthly_balance_usd_equivalent,
        official: state.official,
        stamped: state.stamped,
        signed: state.signed,
        colored: state.colored,
      },
    };
  }
  return {
    key,
    facts: {
      status: document.status,
      reviewedAt: document.reviewed_at,
      documentUpdatedAt: document.updated_at,
      issuerCountry: state.issuer_country,
      validityDays: state.validity_days,
    },
  };
}

async function currentDocumentHash(
  storagePath: string,
): Promise<string | null> {
  const { supabase } = await import("../supabase.js");
  const { data, error } = await supabase.storage
    .from("application-documents")
    .download(storagePath);
  if (error || !data) return null;
  return sha256(Buffer.from(await data.arrayBuffer()));
}

/**
 * Loads UAE evidence from application-scoped documents only. Reusable profile
 * metadata is never authoritative for this time- and trip-sensitive review.
 */
export async function loadAeDocumentEvidenceFacts(
  applicationId: string,
): Promise<AeDocumentEvidenceFacts> {
  const { supabase } = await import("../supabase.js");
  const { data: documentsData, error: documentsError } = await supabase
    .from("application_documents")
    .select(
      "id, application_id, document_type, requirement_key, storage_path, status, reviewed_at, reviewed_by, updated_at, document_hash",
    )
    .eq("application_id", applicationId);
  if (documentsError) {
    throw new Error(`UAE application evidence lookup failed: ${documentsError.message}`);
  }
  const documents = ((documentsData ?? []) as AeEvidenceDocumentRow[])
    .filter((document) => evidenceKey(document) !== null);
  if (documents.length === 0) return {};

  const documentIds = documents.map((document) => document.id);
  const { data: auditsData, error: auditsError } = await supabase
    .from("admin_command_events")
    .select("id, actor_user_id, command, target_type, target_id, after_state, created_at")
    .eq("target_type", "application_documents")
    .in("target_id", documentIds)
    .order("created_at", { ascending: false });
  if (auditsError) {
    throw new Error(`UAE authoritative evidence audit lookup failed: ${auditsError.message}`);
  }
  const audits = (auditsData ?? []) as AeEvidenceAuditRow[];
  const reviewerIds = [...new Set(audits.flatMap((audit) =>
    audit.actor_user_id ? [audit.actor_user_id] : []
  ))];
  const reviewersById = new Map<string, AeEvidenceReviewerRow>();
  if (reviewerIds.length > 0) {
    const { data: reviewersData, error: reviewersError } = await supabase
      .from("users")
      .select("id, role, deleted_at")
      .in("id", reviewerIds);
    if (reviewersError) {
      throw new Error(`UAE evidence reviewer lookup failed: ${reviewersError.message}`);
    }
    for (const reviewer of (reviewersData ?? []) as AeEvidenceReviewerRow[]) {
      reviewersById.set(reviewer.id, reviewer);
    }
  }

  const facts: AeDocumentEvidenceFacts = {};
  for (const document of documents) {
    if (!document.storage_path) continue;
    const latestAudit = selectLatestAeDecisiveDocumentAudit(document.id, audits);
    if (!latestAudit || latestAudit.command !== AE_EVIDENCE_REVIEW_COMMAND) continue;
    const actualDocumentHash = await currentDocumentHash(document.storage_path);
    const parsed = parseAeAuthoritativeEvidenceReview({
      applicationId,
      document,
      audit: latestAudit,
      reviewer: latestAudit.actor_user_id
        ? reviewersById.get(latestAudit.actor_user_id)
        : undefined,
      actualDocumentHash,
    });
    if (!parsed) continue;
    if (parsed.key === "six_month_bank_statement") {
      facts.sixMonthBankStatement = parsed.facts as AeBankStatementEvidenceFacts;
    } else {
      facts.uaeHealthCoverageEvidence = parsed.facts as AeHealthCoverageEvidenceFacts;
    }
  }
  return facts;
}
