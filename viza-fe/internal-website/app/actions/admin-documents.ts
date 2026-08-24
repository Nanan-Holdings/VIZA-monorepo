"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

type ReviewResult = { success: true } | { success: false; error: string };

const AE_EVIDENCE_REVIEW_COMMAND =
  "application_document.ae_transaction_783_evidence_review.v1";
const AE_EVIDENCE_REVIEW_SCHEMA = "ae_transaction_783_evidence_review/v1";
const AE_EVIDENCE_METADATA_KEY = "ae_transaction_783_evidence_review";

type AeEvidenceReviewInput =
  | {
      documentId: string;
      kind: "six_month_bank_statement";
      reason: string;
      statementMonths: number;
      minimumMonthlyBalanceUsdEquivalent: number;
      official: boolean;
      stamped: boolean;
      signed: boolean;
      colored: boolean;
    }
  | {
      documentId: string;
      kind: "uae_health_coverage_evidence";
      reason: string;
      issuerCountry: string;
      validityDays: number;
    };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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

function aeEvidenceDocumentKind(documentType: string, requirementKey: string | null):
  | "six_month_bank_statement"
  | "uae_health_coverage_evidence"
  | null {
  const keys = new Set([documentType, requirementKey ?? documentType]);
  if ([...keys].some((key) =>
    ["bank_statement", "six_month_bank_statement", "proof_of_funds"].includes(key)
  )) return "six_month_bank_statement";
  if ([...keys].some((key) =>
    [
      "travel_insurance",
      "health_insurance",
      "uae_health_insurance",
      "uae_health_coverage_evidence",
    ].includes(key)
  )) return "uae_health_coverage_evidence";
  return null;
}

export async function reviewAdminDocument(input: {
  documentId: string;
  decision: "validated" | "rejected";
  reason: string;
}): Promise<ReviewResult> {
  try {
    const actor = await requireRole("admin", "staff");
    if (input.decision === "rejected" && !input.reason.trim()) {
      return { success: false, error: "A rejection reason is required" };
    }
    const admin = createAdminClient();
    const { data: before, error: readError } = await admin
      .from("application_documents")
      .select("*")
      .eq("id", input.documentId)
      .maybeSingle();
    if (readError || !before) return { success: false, error: readError?.message || "Document not found" };
    const now = new Date().toISOString();
    const changes = {
      status: input.decision,
      rejection_reason: input.decision === "rejected" ? input.reason.trim() : null,
      review_notes: input.reason.trim() || (input.decision === "validated" ? "Validated by staff" : null),
      reviewed_at: now,
      reviewed_by: actor.id,
      updated_at: now,
    };
    const { error: auditError } = await admin.from("admin_command_events").insert({
      actor_user_id: actor.id,
      command: `application_document.${input.decision}`,
      target_type: "application_documents",
      target_id: input.documentId,
      reason: input.reason.trim() || "Document validated against the configured requirement",
      before_state: {
        application_id: before.application_id,
        document_type: before.document_type,
        requirement_key: before.requirement_key,
        status: before.status,
        reviewed_at: before.reviewed_at,
      },
      after_state: changes,
    });
    if (auditError) return { success: false, error: `Review not saved because audit failed: ${auditError.message}` };
    const { error: updateError } = await admin.from("application_documents").update(changes).eq("id", input.documentId);
    if (updateError) return { success: false, error: updateError.message };
    await admin.from("application_events").insert({
      application_id: before.application_id,
      applicant_id: null,
      event_type: input.decision === "validated" ? "document_validated" : "document_rejected",
      actor_type: "admin",
      actor_id: actor.id,
      message: input.reason.trim() || `Document ${input.decision}`,
      metadata: { document_id: input.documentId, document_type: before.document_type },
    });
    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${before.application_id}`);
    revalidatePath("/client/documents");
    revalidatePath("/client/status");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to review document" };
  }
}

/**
 * Records the content-specific UAE transaction-783 evidence review. The
 * immutable command event is written before the row projection, and the
 * projection update is compare-and-set against the reviewed storage path and
 * timestamp. An orphan event cannot authorize a runner because the runner
 * requires the event, current row, reviewer, locator, and current byte hash to
 * match exactly.
 */
export async function reviewAeTransaction783Evidence(
  input: AeEvidenceReviewInput,
): Promise<ReviewResult> {
  try {
    const actor = await requireRole("admin", "staff");
    if (!input.reason.trim()) {
      return { success: false, error: "A content-review reason is required" };
    }
    const admin = createAdminClient();
    const { data: before, error: readError } = await admin
      .from("application_documents")
      .select(
        "id, application_id, document_type, requirement_key, storage_path, status, reviewed_at, reviewed_by, updated_at, document_hash, metadata",
      )
      .eq("id", input.documentId)
      .maybeSingle();
    if (readError || !before) {
      return { success: false, error: readError?.message || "Document not found" };
    }
    if (!before.storage_path) {
      return { success: false, error: "The current document has no stored file" };
    }

    const { data: application, error: applicationError } = await admin
      .from("applications")
      .select("country, visa_type")
      .eq("id", before.application_id)
      .maybeSingle();
    if (
      applicationError ||
      application?.country !== "united_arab_emirates" ||
      application?.visa_type !== "AE_TOURIST_VISA"
    ) {
      return { success: false, error: "Document is not attached to a UAE transaction-783 application" };
    }
    const documentKind = aeEvidenceDocumentKind(
      String(before.document_type),
      typeof before.requirement_key === "string" ? before.requirement_key : null,
    );
    if (documentKind !== input.kind) {
      return { success: false, error: "Evidence review kind does not match the current document" };
    }

    const evidenceState = input.kind === "six_month_bank_statement"
      ? {
          kind: input.kind,
          statement_months: input.statementMonths,
          minimum_monthly_balance_usd_equivalent: input.minimumMonthlyBalanceUsdEquivalent,
          official: input.official,
          stamped: input.stamped,
          signed: input.signed,
          colored: input.colored,
        }
      : {
          kind: input.kind,
          issuer_country: input.issuerCountry.trim(),
          validity_days: input.validityDays,
        };
    const qualifies = input.kind === "six_month_bank_statement"
      ? Number.isFinite(input.statementMonths) && input.statementMonths >= 6 &&
        Number.isFinite(input.minimumMonthlyBalanceUsdEquivalent) &&
        input.minimumMonthlyBalanceUsdEquivalent >= 4_000 &&
        input.official === true && input.stamped === true &&
        input.signed === true && input.colored === true
      : input.issuerCountry.trim().toLowerCase() === "united arab emirates" &&
        Number.isFinite(input.validityDays) && input.validityDays >= 180;
    if (!qualifies) {
      return { success: false, error: "Evidence does not meet the configured UAE transaction-783 rules" };
    }

    const { data: blob, error: downloadError } = await admin.storage
      .from("application-documents")
      .download(before.storage_path);
    if (downloadError || !blob) {
      return { success: false, error: "The current document could not be fingerprinted" };
    }
    const documentHash = sha256(Buffer.from(await blob.arrayBuffer()));
    const evidenceStateHash = sha256(canonicalJson(evidenceState));
    const storageLocatorHash = sha256(before.storage_path);
    const auditEventId = randomUUID();
    const now = new Date().toISOString();
    const afterState = {
      schema_version: AE_EVIDENCE_REVIEW_SCHEMA,
      audit_event_id: auditEventId,
      application_id: before.application_id,
      document_id: before.id,
      document_type: before.document_type,
      requirement_key: before.requirement_key,
      status: "validated",
      reviewed_at: now,
      reviewed_by: actor.id,
      document_updated_at: now,
      document_hash: documentHash,
      storage_locator_hash: storageLocatorHash,
      evidence_state: evidenceState,
      evidence_state_hash: evidenceStateHash,
    };

    const { error: auditError } = await admin.from("admin_command_events").insert({
      id: auditEventId,
      actor_user_id: actor.id,
      command: AE_EVIDENCE_REVIEW_COMMAND,
      target_type: "application_documents",
      target_id: before.id,
      reason: input.reason.trim(),
      before_state: {
        application_id: before.application_id,
        document_type: before.document_type,
        requirement_key: before.requirement_key,
        status: before.status,
        reviewed_at: before.reviewed_at,
        reviewed_by: before.reviewed_by,
        document_hash: before.document_hash,
      },
      after_state: afterState,
      evidence_redacted: {
        schema_version: AE_EVIDENCE_REVIEW_SCHEMA,
        evidence_state_hash: evidenceStateHash,
        storage_locator_hash: storageLocatorHash,
      },
    });
    if (auditError) {
      return { success: false, error: `Evidence review not saved because audit failed: ${auditError.message}` };
    }

    const currentMetadata = record(before.metadata) ?? {};
    const reviewProjection = {
      schema_version: AE_EVIDENCE_REVIEW_SCHEMA,
      audit_event_id: auditEventId,
      reviewed_at: now,
      reviewed_by: actor.id,
      document_hash: documentHash,
      storage_locator_hash: storageLocatorHash,
      evidence_state: evidenceState,
      evidence_state_hash: evidenceStateHash,
    };
    let updateQuery = admin
      .from("application_documents")
      .update({
        status: "validated",
        rejection_reason: null,
        review_notes: input.reason.trim(),
        reviewed_at: now,
        reviewed_by: actor.id,
        document_hash: documentHash,
        metadata: {
          ...currentMetadata,
          [AE_EVIDENCE_METADATA_KEY]: reviewProjection,
        },
        updated_at: now,
      })
      .eq("id", before.id)
      .eq("storage_path", before.storage_path);
    updateQuery = before.updated_at
      ? updateQuery.eq("updated_at", before.updated_at)
      : updateQuery.is("updated_at", null);
    const { data: updated, error: updateError } = await updateQuery
      .select("id")
      .maybeSingle();
    if (updateError || !updated) {
      return {
        success: false,
        error: updateError?.message || "Document changed during review; review it again",
      };
    }

    await admin.from("application_events").insert({
      application_id: before.application_id,
      applicant_id: null,
      event_type: "document_validated",
      actor_type: "admin",
      actor_id: actor.id,
      message: "UAE transaction-783 evidence review recorded",
      metadata: {
        document_id: before.id,
        document_type: before.document_type,
        evidence_state_hash: evidenceStateHash,
      },
    });
    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${before.application_id}`);
    revalidatePath("/client/documents");
    revalidatePath("/client/status");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to record UAE evidence review",
    };
  }
}
