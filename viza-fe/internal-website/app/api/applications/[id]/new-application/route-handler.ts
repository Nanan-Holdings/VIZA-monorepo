import { NextResponse } from "next/server";
import { isUsDs160 } from "@/lib/application-tab-completion";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DS160_LEGACY_ANSWER_ALIASES: Record<string, string> = {
  who_is_paying: "trip_payer_type",
  has_other_names: "other_names_used",
  has_specific_travel_plans: "has_specific_plans",
  has_other_phone: "has_other_phones",
  has_other_email: "has_other_emails",
  passport_lost_or_stolen: "lost_passport",
  has_other_education: "has_attended_education",
  has_countries_visited: "has_traveled_last_five_years",
  has_organization: "has_belonged_to_organization",
  has_served_insurgent: "has_served_paramilitary",
};

type SavedAnswer = {
  field_name: string;
  value_text: string | null;
  value_json: unknown;
};

type SavedApplicationDocument = {
  document_type: string;
  storage_path: string | null;
  filename: string | null;
  status: string;
  rejection_reason: string | null;
  requirement_key?: string | null;
  required?: boolean | null;
};

export type NewUsApplicationIntent = "restart_unsigned";

type NewUsApplicationOptions = {
  readonly intent?: NewUsApplicationIntent;
};

type SourceApplication = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
  visa_package_id: string | null;
  status: string | null;
  confirmation_number?: string | null;
  ds160_application_id?: string | null;
  ds160_dat_storage_path?: string | null;
  submission_result_status?: string | null;
  submission_result?: unknown;
};

type RestartQueueRow = {
  id?: unknown;
  status?: unknown;
  locked_by?: unknown;
  locked_at?: unknown;
  locked_until?: unknown;
  official_confirmation_number_encrypted?: unknown;
  official_confirmation_page_url?: unknown;
  live_submitted_at?: unknown;
  ceac_result_payload?: unknown;
};

type RestartSubmissionJobRow = {
  id?: unknown;
  status?: unknown;
  official_submitted_at?: unknown;
  official_confirmation_page_url?: unknown;
  official_confirmation_number_encrypted?: unknown;
};

const DS160_RESTART_ACTIVE_QUEUE_STATUSES = new Set([
  "pending",
  "queued",
  "scheduled",
  "processing",
  "running",
  "ds160_prefill_pending",
  "ds160_prefill_processing",
  "ds160_live_assisted_pending",
  "ds160_live_assisted_processing",
  "ds160_proof_pending",
  "ds160_proof_processing",
]);

const DS160_RESTART_TERMINAL_QUEUE_STATUSES = new Set([
  "done",
  "failed",
  "cancelled",
  "canceled",
  "stopped",
  "stopped_at_sign",
  "action_required",
  "needs_user_action",
  "ds160_blocked",
  "ds160_prefill_failed",
  "ds160_live_assisted_failed",
  "ds160_proof_failed",
  "superseded",
  "retry_superseded",
  "superseded_by_application_queue_isolation",
  "superseded_by_new_application_retry",
]);

const DS160_RESTART_ACTIVE_SUBMISSION_JOB_STATUSES = new Set([
  "pending",
  "queued",
  "scheduled",
  "processing",
  "running",
  "live_pending",
  "live_processing",
]);

const DS160_RESTART_TERMINAL_SUBMISSION_JOB_STATUSES = new Set([
  "failed", "cancelled", "canceled", "blocked", "stopped",
  "stopped_at_sign", "action_required", "needs_user_action", "retry_superseded",
]);

const DS160_RESTART_TERMINAL_SOURCE_STATUSES = new Set([
  "failed",
  "blocked",
  "blockedunsigned",
  "blocked_unsigned",
  "stopped_at_sign",
]);

const DS160_RESTART_TERMINAL_RESULT_STATUSES = new Set([
  "failed",
  "action_required",
  "needs_user_action",
  "stopped_at_sign",
]);

// These fields are official CEAC identity/recovery material, rather than
// applicant answers. A fresh VIZA draft must never inherit them from a prior
// attempt. Application columns and queue rows are also deliberately excluded
// from the new-row insert below.
const DS160_RESTART_EXCLUDED_ANSWER_FIELDS = new Set([
  "ds160_application_id",
  "ds160_dat_storage_path",
  "ds160_retrieval_url",
  "official_application_id",
  "official_application_id_encrypted",
  "official_security_question",
  "official_security_question_encrypted",
  "official_security_answer",
  "official_security_answer_encrypted",
  "confirmation_number",
  "submission_result",
  "submission_result_status",
  "submission_recovery",
  "recovery",
]);

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === "23505" || /duplicate key|unique constraint/i.test(error?.message ?? "");
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalized(value: unknown): string {
  return (text(value) ?? "").toLowerCase().replace(/[\s-]+/g, "_");
}

function hasOfficialSuccess(application: SourceApplication): boolean {
  const result = record(application.submission_result);
  return (
    normalized(application.submission_result_status) === "submitted" ||
    normalized(result?.country) === "us" && normalized(result?.status) === "submitted" ||
    text(application.confirmation_number) !== null
  );
}

function hasQueueOfficialSuccess(row: RestartQueueRow): boolean {
  const result = record(row.ceac_result_payload);
  return (
    text(row.official_confirmation_number_encrypted) !== null ||
    text(row.official_confirmation_page_url) !== null ||
    text(row.live_submitted_at) !== null ||
    normalized(result?.status) === "submitted" ||
    normalized(result?.submissionStatus) === "submitted"
  );
}

function isActiveQueueRow(row: RestartQueueRow): boolean {
  const status = normalized(row.status);
  if (DS160_RESTART_ACTIVE_QUEUE_STATUSES.has(status)) return true;
  if (DS160_RESTART_TERMINAL_QUEUE_STATUSES.has(status)) {
    const lockedUntil = text(row.locked_until);
    if (lockedUntil) {
      const leaseExpiry = Date.parse(lockedUntil);
      // A terminal row can retain the old worker lease columns after the
      // worker stopped. Only a live or malformed lease keeps it blocked.
      if (!Number.isFinite(leaseExpiry)) return true;
      return leaseExpiry > Date.now();
    }
    return text(row.locked_by) !== null || text(row.locked_at) !== null;
  }
  if (
    text(row.locked_by) !== null ||
    text(row.locked_at) !== null ||
    text(row.locked_until) !== null
  ) return true;
  // Unknown non-empty queue states fail closed. A new runner status must be
  // classified before this endpoint can create another DS-160 draft.
  return status.length > 0;
}

function isActiveSubmissionJob(row: RestartSubmissionJobRow): boolean {
  const status = normalized(row.status);
  return (
    DS160_RESTART_ACTIVE_SUBMISSION_JOB_STATUSES.has(status) ||
    text(row.official_submitted_at) !== null ||
    text(row.official_confirmation_page_url) !== null ||
    text(row.official_confirmation_number_encrypted) !== null ||
    !DS160_RESTART_TERMINAL_SUBMISSION_JOB_STATUSES.has(status)
  );
}

function isTerminalRestartSource(
  source: SourceApplication,
  queueRows: RestartQueueRow[],
): boolean {
  const sourceStatus = normalized(source.status);
  const resultStatus = normalized(source.submission_result_status);
  if (
    DS160_RESTART_TERMINAL_SOURCE_STATUSES.has(sourceStatus) ||
    DS160_RESTART_TERMINAL_RESULT_STATUSES.has(resultStatus)
  ) return true;

  // A legacy DS-160 row can retain `applications.status = submitted` while
  // the canonical result is action_required. A terminal DS-160 queue status
  // is the authoritative evidence that this is an unsigned failed/blocked
  // run, provided the success/fence checks below remain clear.
  return queueRows.some((row) => {
    const status = normalized(row.status);
    return status === "ds160_blocked" || status.endsWith("_failed") || status === "failed";
  });
}

async function verifyUnsignedRestartSafety(
  admin: ReturnType<typeof createAdminClient>,
  source: SourceApplication,
): Promise<{ readonly error: string; readonly status: 409 | 503 } | null> {
  const [queueResult, finalFenceResult, submissionJobResult] = await Promise.all([
    admin
      .from("submission_queue")
      .select("id,status,locked_by,locked_at,locked_until,official_confirmation_number_encrypted,official_confirmation_page_url,live_submitted_at,ceac_result_payload")
      .eq("application_id", source.id),
    admin
      .from("ds160_final_submission_attempts")
      .select("id,state")
      .eq("application_id", source.id),
    admin
      .from("ds160_submission_jobs")
      .select("id,status,official_submitted_at,official_confirmation_page_url,official_confirmation_number_encrypted")
      .eq("application_id", source.id),
  ]);

  if (queueResult.error || finalFenceResult.error || submissionJobResult.error) {
    return {
      error: "Could not verify DS-160 restart safety; no new application was created",
      status: 503,
    };
  }

  const queueRows = (queueResult.data ?? []) as RestartQueueRow[];
  const finalFenceRows = (finalFenceResult.data ?? []) as Array<{ id?: unknown; state?: unknown }>;
  const submissionJobRows = (submissionJobResult.data ?? []) as RestartSubmissionJobRow[];

  if (finalFenceRows.length > 0) {
    return {
      error: "This DS-160 already has a final-submission attempt and cannot be restarted",
      status: 409,
    };
  }
  if (hasOfficialSuccess(source) || queueRows.some(hasQueueOfficialSuccess)) {
    return {
      error: "This DS-160 has an official submission result and cannot be restarted",
      status: 409,
    };
  }
  if (queueRows.some(isActiveQueueRow) || submissionJobRows.some(isActiveSubmissionJob)) {
    return {
      error: "This DS-160 still has active submission work; wait for it to finish before restarting",
      status: 409,
    };
  }
  if (!isTerminalRestartSource(source, queueRows)) {
    return {
      error: "Only an unsigned terminal DS-160 application can be restarted",
      status: 409,
    };
  }
  return null;
}

function answersForNewApplication(
  sourceAnswers: SavedAnswer[],
  intent: NewUsApplicationIntent | undefined,
): SavedAnswer[] {
  const normalizedAnswers = normalizeCopiedDs160Answers(sourceAnswers);
  if (intent !== "restart_unsigned") return normalizedAnswers;
  return normalizedAnswers.filter((answer) => !DS160_RESTART_EXCLUDED_ANSWER_FIELDS.has(answer.field_name));
}

async function loadExistingDraft(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  source: { id: string; country: string | null; visa_type: string | null },
  includeAllAnswers = false,
): Promise<{
  readonly draft: { readonly id: string; readonly visa_package_id: string | null } | null;
  readonly answers: SavedAnswer[];
  readonly error: { readonly code?: string; readonly message?: string } | null;
}> {
  const { data: draft, error: draftError } = await admin
    .from("applications")
    .select("id, visa_package_id")
    .eq("applicant_id", profileId)
    .eq("country", source.country)
    .eq("visa_type", source.visa_type)
    .eq("status", "draft")
    .or("purpose.is.null,purpose.neq.VIZA_PLACEHOLDER_DRY_RUN")
    .neq("id", source.id)
    .limit(1)
    .maybeSingle();
  if (draftError || !draft) {
    return { draft: draft ?? null, answers: [], error: draftError };
  }

  const answersRequest = admin
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", draft.id);
  const { data: answers, error: answerError } = await (includeAllAnswers
    ? answersRequest
    : answersRequest.limit(1));
  return {
    draft,
    answers: (answers ?? []) as SavedAnswer[],
    error: answerError,
  };
}

async function loadApplicationDocuments(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
): Promise<{
  readonly documents: SavedApplicationDocument[];
  readonly error: { readonly code?: string; readonly message?: string } | null;
}> {
  const { data, error } = await admin
    .from("application_documents")
    .select("document_type, storage_path, filename, status, rejection_reason, requirement_key, required")
    .eq("application_id", applicationId);
  return {
    documents: (data ?? []) as SavedApplicationDocument[],
    error,
  };
}

function hasCopiedDocumentReferences(
  targetDocuments: SavedApplicationDocument[],
  sourceDocuments: SavedApplicationDocument[],
): boolean {
  if (targetDocuments.length !== sourceDocuments.length) return false;
  return sourceDocuments.every((sourceDocument) => targetDocuments.some((targetDocument) => (
    targetDocument.document_type === sourceDocument.document_type &&
    targetDocument.storage_path === sourceDocument.storage_path &&
    targetDocument.filename === sourceDocument.filename &&
    targetDocument.status === sourceDocument.status &&
    targetDocument.rejection_reason === sourceDocument.rejection_reason &&
    (sourceDocument.requirement_key === undefined ||
      targetDocument.requirement_key === sourceDocument.requirement_key) &&
    (sourceDocument.required === undefined || targetDocument.required === sourceDocument.required)
  )));
}

function jsonValuesEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function hasCopiedAnswers(
  targetAnswers: SavedAnswer[],
  sourceAnswers: SavedAnswer[],
  intent: NewUsApplicationIntent | undefined,
): boolean {
  const expectedAnswers = answersForNewApplication(sourceAnswers, intent);
  if (targetAnswers.length !== expectedAnswers.length) return false;
  return expectedAnswers.every((expected) => targetAnswers.some((actual) => (
    actual.field_name === expected.field_name &&
    actual.value_text === expected.value_text &&
    jsonValuesEqual(actual.value_json, expected.value_json)
  )));
}

async function ensureDraftVisaPackage(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  draft: { readonly id: string; readonly visa_package_id: string | null },
  sourcePackageId: string | null | undefined,
): Promise<string | null> {
  if (draft.visa_package_id || !sourcePackageId) return null;

  const { error } = await admin
    .from("applications")
    .update({
      visa_package_id: sourcePackageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.id)
    .eq("applicant_id", profileId)
    .is("visa_package_id", null);
  return error?.message ?? null;
}

export function normalizeCopiedDs160Answers(sourceAnswers: SavedAnswer[]): SavedAnswer[] {
  const copied = new Map(sourceAnswers.map((answer) => [answer.field_name, answer]));
  for (const [legacyName, canonicalName] of Object.entries(DS160_LEGACY_ANSWER_ALIASES)) {
    if (copied.has(canonicalName)) continue;
    const legacyAnswer = copied.get(legacyName);
    if (!legacyAnswer) continue;
    copied.set(canonicalName, {
      ...legacyAnswer,
      field_name: canonicalName,
    });
  }
  return [...copied.values()];
}

export async function createNewUsApplication(
  userId: string,
  sourceApplicationId: string,
  options: NewUsApplicationOptions = {},
) {
  const intent = options.intent;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (!profile) return { error: "Applicant profile not found", status: 404 } as const;

  const { data: source } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, visa_package_id, status, confirmation_number, ds160_application_id, ds160_dat_storage_path, submission_result_status, submission_result")
    .eq("id", sourceApplicationId)
    .maybeSingle();
  if (!source) return { error: "Application not found", status: 404 } as const;
  if (source.applicant_id !== profile.id) return { error: "Forbidden", status: 403 } as const;
  if (!isUsDs160(source.country, source.visa_type)) {
    return { error: "This action is only available for U.S. DS-160 applications", status: 400 } as const;
  }
  const sourceApplication = source as SourceApplication;

  if (intent === "restart_unsigned") {
    const safetyError = await verifyUnsignedRestartSafety(admin, sourceApplication);
    if (safetyError) return safetyError;
  }

  const result: unknown = source.submission_result;
  const confirmedResult = typeof result === "object" && result !== null && !Array.isArray(result)
    ? result as Record<string, unknown>
    : null;
  // Older worker results can be authoritative while the generic application
  // status still says processing. Match the same official submitted result
  // shown by the result card; never treat a draft/handoff reference as success.
  const hasSubmittedResult = source.submission_result_status === "submitted"
    && confirmedResult?.country === "US"
    && confirmedResult.status === "submitted"
    && typeof confirmedResult.applicationId === "string"
    && /^AA[A-Z0-9]{8}$/.test(confirmedResult.applicationId);
  if (intent !== "restart_unsigned" && source.status !== "submitted" && !hasSubmittedResult) {
    return { error: "Only a submitted application can be used to start a new application", status: 409 } as const;
  }

  const { data: sourceAnswers, error: sourceAnswersError } = await admin
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", source.id);
  if (sourceAnswersError) {
    return { error: sourceAnswersError.message, status: 500 } as const;
  }
  if (!sourceAnswers || sourceAnswers.length === 0) {
    return {
      error: intent === "restart_unsigned"
        ? "The DS-160 application has no saved answers to restart"
        : "The submitted application has no saved answers to reuse",
      status: 409,
    } as const;
  }

  let sourceDocuments: SavedApplicationDocument[] = [];
  if (intent === "restart_unsigned") {
    const loadedDocuments = await loadApplicationDocuments(admin, source.id);
    if (loadedDocuments.error) {
      return { error: "Could not load the source application documents", status: 500 } as const;
    }
    sourceDocuments = loadedDocuments.documents;
  }

  const existing = await loadExistingDraft(admin, profile.id, source, intent === "restart_unsigned");
  if (existing.error) return { error: "Could not load the existing application", status: 500 } as const;
  if (existing.draft) {
    const packageError = await ensureDraftVisaPackage(
      admin,
      profile.id,
      existing.draft,
      source.visa_package_id,
    );
    if (packageError) return { error: packageError, status: 500 } as const;
  }
  if (intent === "restart_unsigned" && existing.draft) {
    if (existing.answers.length > 0 && !hasCopiedAnswers(existing.answers, sourceAnswers as SavedAnswer[], intent)) {
      return {
        error: "An existing DS-160 draft has different answers; refusing to overwrite it",
        status: 409,
      } as const;
    }
    const existingDocuments = await loadApplicationDocuments(admin, existing.draft.id);
    if (existingDocuments.error) {
      return { error: "Could not verify the existing DS-160 draft documents", status: 500 } as const;
    }
    const documentsMatch = hasCopiedDocumentReferences(existingDocuments.documents, sourceDocuments);
    if (
      !documentsMatch &&
      (existing.answers.length > 0 || existingDocuments.documents.length > 0)
    ) {
      return {
        error: "An existing DS-160 draft is incomplete or has different documents; refusing to overwrite it",
        status: 409,
      } as const;
    }
  }
  if (existing.draft && existing.answers.length > 0) {
    // Reopen an existing draft without overwriting any saved answer.
    return {
      applicationId: existing.draft.id,
      country: source.country || "united_states",
      visaType: source.visa_type || "B1_B2",
      status: 200,
    } as const;
  }

  let created: { readonly id: string } | null = existing.draft;
  let createdNew = false;
  if (!created) {
    const { data: inserted, error: createError } = await admin
    .from("applications")
    .insert({
      applicant_id: profile.id,
      country: source.country || "united_states",
      visa_type: source.visa_type || "B1_B2",
      visa_package_id: source.visa_package_id,
      status: "draft",
    })
    .select("id")
    .single();
    if (isUniqueViolation(createError)) {
      // The unique ongoing-application index closes the race between the
      // lookup above and this insert. Re-read the owner-scoped row so a
      // concurrent request reuses it instead of surfacing a false 500.
      const concurrent = await loadExistingDraft(admin, profile.id, source, intent === "restart_unsigned");
      if (concurrent.error || !concurrent.draft) {
        return { error: "Could not create a new application", status: 500 } as const;
      }
      const packageError = await ensureDraftVisaPackage(
        admin,
        profile.id,
        concurrent.draft,
        source.visa_package_id,
      );
      if (packageError) return { error: packageError, status: 500 } as const;
      if (intent === "restart_unsigned") {
        if (concurrent.answers.length > 0 && !hasCopiedAnswers(concurrent.answers, sourceAnswers as SavedAnswer[], intent)) {
          return {
            error: "A concurrent DS-160 draft has different answers; refusing to overwrite it",
            status: 409,
          } as const;
        }
        const concurrentDocuments = await loadApplicationDocuments(admin, concurrent.draft.id);
        if (concurrentDocuments.error) {
          return { error: "Could not verify the concurrent DS-160 draft documents", status: 500 } as const;
        }
        const documentsMatch = hasCopiedDocumentReferences(concurrentDocuments.documents, sourceDocuments);
        if (
          !documentsMatch &&
          (concurrent.answers.length > 0 || concurrentDocuments.documents.length > 0)
        ) {
          return {
            error: "A concurrent DS-160 draft is incomplete or has different documents; refusing to overwrite it",
            status: 409,
          } as const;
        }
      }
      if (concurrent.answers.length > 0) {
        return {
          applicationId: concurrent.draft.id,
          country: source.country || "united_states",
          visaType: source.visa_type || "B1_B2",
          status: 200,
        } as const;
      }
      created = concurrent.draft;
    } else if (createError || !inserted) {
      return { error: createError?.message || "Could not create a new application", status: 500 } as const;
    } else {
      created = inserted;
      createdNew = true;
    }
  }

  if (!created) return { error: "Could not create a new application", status: 500 } as const;

  const { error: copyError } = await admin.from("visa_application_answers").insert(
    answersForNewApplication(sourceAnswers as SavedAnswer[], intent).map((answer) => ({
      application_id: created.id,
      field_name: answer.field_name,
      value_text: answer.value_text,
      value_json: answer.value_json,
    })),
  );
  if (copyError) {
    if (isUniqueViolation(copyError)) {
      // Another request may have copied the same source into this reused
      // draft between the empty check and the insert. Treat that as a
      // successful reuse only after confirming the target now has answers.
      const afterCopy = await loadExistingDraft(admin, profile.id, source, intent === "restart_unsigned");
      const packageError = afterCopy.draft
        ? await ensureDraftVisaPackage(admin, profile.id, afterCopy.draft, source.visa_package_id)
        : null;
      const afterCopyDocuments = intent === "restart_unsigned" && afterCopy.draft
        ? await loadApplicationDocuments(admin, afterCopy.draft.id)
        : null;
      if (!afterCopy.error && !packageError && afterCopy.draft?.id === created.id && afterCopy.answers.length > 0) {
        if (intent === "restart_unsigned" && !hasCopiedAnswers(afterCopy.answers, sourceAnswers as SavedAnswer[], intent)) {
          return {
            error: "The concurrent DS-160 draft has different answers; refusing to overwrite it",
            status: 409,
          } as const;
        }
        if (
          afterCopyDocuments?.error ||
          !hasCopiedDocumentReferences(afterCopyDocuments?.documents ?? [], sourceDocuments)
        ) {
          return {
            error: "The concurrent DS-160 draft is incomplete or has different documents; refusing to overwrite it",
            status: 409,
          } as const;
        }
        return {
          applicationId: created.id,
          country: source.country || "united_states",
          visaType: source.visa_type || "B1_B2",
          status: 200,
        } as const;
      }
    }
    if (createdNew) await admin.from("applications").delete().eq("id", created.id);
    return { error: copyError.message, status: 500 } as const;
  }

  if (intent === "restart_unsigned" && sourceDocuments.length > 0) {
    const { error: documentCopyError } = await admin.from("application_documents").insert(
      sourceDocuments.map((document) => {
        const copy: Record<string, unknown> = {
          application_id: created.id,
          document_type: document.document_type,
          storage_path: document.storage_path,
          filename: document.filename,
          status: document.status,
          rejection_reason: document.rejection_reason,
        };
        if (document.requirement_key !== undefined) copy.requirement_key = document.requirement_key;
        if (document.required !== undefined) copy.required = document.required;
        return copy;
      }),
    );
    if (documentCopyError) {
      // A reused empty draft may already contain one of the same document
      // references from an earlier interrupted copy. Preserve that draft and
      // its documents, but never leave a newly-created child half-copied.
      if (isUniqueViolation(documentCopyError) && !createdNew) {
        const existingDocuments = await loadApplicationDocuments(admin, created.id);
        if (existingDocuments.error) {
          return { error: "Could not verify the copied DS-160 documents", status: 500 } as const;
        }
        if (!hasCopiedDocumentReferences(existingDocuments.documents, sourceDocuments)) {
          return {
            error: "The existing DS-160 draft has different documents; refusing to overwrite it",
            status: 409,
          } as const;
        }
        return {
          applicationId: created.id,
          country: source.country || "united_states",
          visaType: source.visa_type || "B1_B2",
          status: 201,
        } as const;
      }
      if (createdNew) await admin.from("applications").delete().eq("id", created.id);
      return { error: documentCopyError.message, status: 500 } as const;
    }
  }

  return {
    applicationId: created.id,
    country: source.country || "united_states",
    visaType: source.visa_type || "B1_B2",
    // Keep the existing client contract: a successful source-copy response
    // is treated as creation of the next application flow, even when an
    // owner-scoped empty draft was reused. A draft that already had answers
    // returned above with 200 and is never overwritten.
    status: 201,
  } as const;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let intent: NewUsApplicationIntent | undefined;
  let invalidIntent = false;
  try {
    const body = record(await request.json());
    if (body && "intent" in body) {
      if (body.intent === "restart_unsigned") intent = "restart_unsigned";
      else invalidIntent = true;
    }
  } catch {
    // The original endpoint accepted an empty POST. Keep that contract for
    // existing callers while recognizing the explicit restart intent above.
  }

  if (invalidIntent) {
    return NextResponse.json({ error: "Unsupported new-application intent" }, { status: 400 });
  }

  const result = await createNewUsApplication(auth.user.id, id, { intent });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const params = new URLSearchParams({
    applicationId: result.applicationId,
    country: result.country,
    visaType: result.visaType,
  });
  return NextResponse.json(
    {
      applicationId: result.applicationId,
      href: `/client/application/long-form?${params.toString()}`,
    },
    { status: result.status },
  );
}
