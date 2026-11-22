import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Start a fresh Vietnam e-Visa application from an existing one, at any time,
 * so an applicant can revise details or recover from a stuck attempt.
 *
 * - Answers and document references are copied; the old application keeps all
 *   its data and is archived as superseded by the new one (0211 columns), so
 *   the one-ongoing-application index allows the new draft.
 * - Refuses while a VIZA run is queued or filling the official form, so two
 *   runs never act for the same applicant. An open official handoff (the live
 *   session the applicant has not submitted) is cancelled first.
 * - When the old attempt already reached the official site (a registration
 *   code exists), the applicant must confirm, because submitting again creates
 *   a second official application.
 * - Any other open application for the same applicant and product (for
 *   example an empty draft) is archived too: the one-ongoing-application index
 *   allows only one, and the 0211 insert trigger would archive it anyway.
 * - Every step is undone if a later step fails.
 */

type Admin = ReturnType<typeof createAdminClient>;

export type VietnamSourceApplication = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
  visa_package_id: string | null;
  status: string | null;
  submission_result?: unknown;
};

export type VietnamQueueRow = {
  status?: string | null;
  official_status?: string | null;
};

export type NewVietnamApplicationResult =
  | {
      readonly applicationId: string;
      readonly country: string;
      readonly visaType: string;
      readonly status: 201;
    }
  | {
      readonly error: string;
      readonly code:
        | "submission_in_progress"
        | "official_submission_exists"
        | "no_answers"
        | "source_changed"
        | "cancel_unavailable"
        | "copy_failed";
      readonly status: 409 | 500 | 503;
    };

const ACTIVE_QUEUE_STATUS = /pending|processing|scheduled/i;
const OFFICIAL_QUEUE_STATUS = /^(registration_code_captured|payment_submitted|submitted)/i;
const OFFICIAL_RESULT_STATUSES = new Set(["stopped_at_pay", "submitted_pending_email"]);
// Mirrors applications_one_ongoing_country_visa_idx (0144).
const INDEX_TERMINAL_STATUSES = new Set([
  "submitted", "submitted_mock", "form_ready_for_agency", "completed", "approved",
  "rejected", "cancelled", "canceled", "archived", "failed", "stalled",
]);
const INDEX_TERMINAL_RESULT_STATUSES = new Set(["completed", "complete", "submitted", "success", "done"]);

export type VietnamSiblingApplication = {
  id: string;
  country: string | null;
  visa_type: string | null;
  status: string | null;
  purpose: string | null;
  submission_result_status: string | null;
};

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

/** Same product, still counted by the one-ongoing-application index. */
export function isOpenSiblingApplication(
  source: Pick<VietnamSourceApplication, "id" | "country" | "visa_type">,
  row: VietnamSiblingApplication,
): boolean {
  return (
    row.id !== source.id &&
    norm(row.country) === norm(source.country) &&
    norm(row.visa_type) === norm(source.visa_type) &&
    !INDEX_TERMINAL_STATUSES.has(norm(row.status || "draft")) &&
    !INDEX_TERMINAL_RESULT_STATUSES.has(norm(row.submission_result_status)) &&
    (row.purpose ?? "") !== "VIZA_PLACEHOLDER_DRY_RUN"
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** A VIZA run is queued or filling the official form for this application. */
export function hasActiveVietnamRun(rows: readonly VietnamQueueRow[]): boolean {
  return rows.some((row) => ACTIVE_QUEUE_STATUS.test(row.status ?? ""));
}

/** The application already reached the official site (a declaration exists there). */
export function hasVietnamOfficialSubmission(
  application: Pick<VietnamSourceApplication, "submission_result">,
  rows: readonly VietnamQueueRow[],
): boolean {
  const result = asRecord(application.submission_result);
  if (result) {
    const code = result.registrationCode;
    if (typeof code === "string" && code.trim()) return true;
    if (result.submittedBy === "applicant_on_official_portal") return true;
    if (typeof result.status === "string" && OFFICIAL_RESULT_STATUSES.has(result.status)) return true;
  }
  return rows.some((row) => OFFICIAL_QUEUE_STATUS.test(row.official_status ?? ""));
}

export async function startNewVietnamApplication(
  admin: Admin,
  source: VietnamSourceApplication,
  options: { readonly confirmOfficialDuplicate?: boolean } = {},
): Promise<NewVietnamApplicationResult> {
  const { data: queueData, error: queueError } = await admin
    .from("submission_queue")
    .select("status, official_status")
    .eq("application_id", source.id);
  if (queueError) {
    return { error: "Could not check the current submission", code: "copy_failed", status: 500 };
  }
  const queueRows = (queueData ?? []) as VietnamQueueRow[];
  if (hasActiveVietnamRun(queueRows)) {
    return {
      error: "VIZA is still working on this application. Wait until it finishes, or cancel it first.",
      code: "submission_in_progress",
      status: 409,
    };
  }
  if (hasVietnamOfficialSubmission(source, queueRows) && options.confirmOfficialDuplicate !== true) {
    return {
      error:
        "This application was already sent to the Vietnam e-Visa site. A new application will create a second official application.",
      code: "official_submission_exists",
      status: 409,
    };
  }

  const { data: answers, error: answersError } = await admin
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", source.id);
  if (answersError) {
    return { error: "Could not load the saved answers", code: "copy_failed", status: 500 };
  }
  if (!answers || answers.length === 0) {
    return { error: "This application has no saved answers to copy", code: "no_answers", status: 409 };
  }
  const { data: documents, error: documentsError } = await admin
    .from("application_documents")
    .select("document_type, storage_path, filename, status, rejection_reason, requirement_key, required")
    .eq("application_id", source.id);
  if (documentsError) {
    return { error: "Could not load the uploaded documents", code: "copy_failed", status: 500 };
  }

  const { data: siblingData, error: siblingError } = await admin
    .from("applications")
    .select("id, country, visa_type, status, purpose, submission_result_status")
    .eq("applicant_id", source.applicant_id);
  if (siblingError) {
    return { error: "Could not check your other applications", code: "copy_failed", status: 500 };
  }
  const siblings = ((siblingData ?? []) as VietnamSiblingApplication[]).filter((row) =>
    isOpenSiblingApplication(source, row),
  );
  if (siblings.length > 0) {
    const { data: siblingQueue, error: siblingQueueError } = await admin
      .from("submission_queue")
      .select("status, official_status")
      .in("application_id", siblings.map((row) => row.id));
    if (siblingQueueError) {
      return { error: "Could not check the current submission", code: "copy_failed", status: 500 };
    }
    if (hasActiveVietnamRun((siblingQueue ?? []) as VietnamQueueRow[])) {
      return {
        error: "VIZA is still working on another Vietnam application of yours. Wait until it finishes, or cancel it first.",
        code: "submission_in_progress",
        status: 409,
      };
    }
  }

  // An open handoff (live official session, not submitted) must not outlive
  // the application it belongs to: cancel it through the owner-checked RPC.
  const { data: openHandoffs, error: handoffError } = await admin
    .from("takeover_session")
    .select("id")
    .eq("application_id", source.id)
    .eq("handoff_kind", "official_applicant_final_submit")
    .in("status", ["queued", "claimed"]);
  if (handoffError) {
    return { error: "Could not check the official session", code: "cancel_unavailable", status: 503 };
  }
  if ((openHandoffs ?? []).length > 0) {
    const { data: cancelData, error: cancelError } = await admin.rpc("cancel_official_applicant_submission", {
      p_application_id: source.id,
      p_applicant_id: source.applicant_id,
    });
    const outcome = asRecord(Array.isArray(cancelData) ? cancelData[0] : cancelData)?.outcome;
    if (cancelError) {
      return { error: "The open official session could not be closed", code: "cancel_unavailable", status: 503 };
    }
    if (outcome === "cancel_requested") {
      return {
        error: "VIZA is still working on this application. Wait until it finishes, or cancel it first.",
        code: "submission_in_progress",
        status: 409,
      };
    }
  }

  // Archive the old application first: the one-ongoing-application index
  // would otherwise reject the new draft. The status guard makes a concurrent
  // change fail instead of being overwritten.
  const previousStatus = source.status ?? "draft";
  const archiveQuery = admin
    .from("applications")
    .update({ status: "archived", superseded_previous_status: previousStatus, updated_at: new Date().toISOString() })
    .eq("id", source.id)
    .eq("applicant_id", source.applicant_id);
  const { data: archived, error: archiveError } = await (source.status === null
    ? archiveQuery.is("status", null)
    : archiveQuery.eq("status", source.status)
  ).select("id");
  if (archiveError || !archived || archived.length !== 1) {
    return {
      error: "This application changed while starting a new one. Refresh the page and try again.",
      code: "source_changed",
      status: 409,
    };
  }
  const archivedSiblings: { id: string; status: string }[] = [];
  const restoreSource = async () => {
    for (const row of [{ id: source.id, status: previousStatus }, ...archivedSiblings]) {
      await admin
        .from("applications")
        .update({
          status: row.status,
          superseded_previous_status: null,
          superseded_by_application_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "archived");
    }
  };
  for (const sibling of siblings) {
    const siblingStatus = sibling.status ?? "draft";
    const siblingQuery = admin
      .from("applications")
      .update({ status: "archived", superseded_previous_status: siblingStatus, updated_at: new Date().toISOString() })
      .eq("id", sibling.id)
      .eq("applicant_id", source.applicant_id);
    const { data: siblingArchived, error: siblingArchiveError } = await (sibling.status === null
      ? siblingQuery.is("status", null)
      : siblingQuery.eq("status", sibling.status)
    ).select("id");
    if (siblingArchiveError || !siblingArchived || siblingArchived.length !== 1) {
      await restoreSource();
      return {
        error: "One of your applications changed while starting a new one. Refresh the page and try again.",
        code: "source_changed",
        status: 409,
      };
    }
    archivedSiblings.push({ id: sibling.id, status: siblingStatus });
  }

  const country = source.country || "vietnam";
  const visaType = source.visa_type || "VN_E_VISA";
  const { data: created, error: createError } = await admin
    .from("applications")
    .insert({
      applicant_id: source.applicant_id,
      country,
      visa_type: visaType,
      visa_package_id: source.visa_package_id,
      status: "draft",
    })
    .select("id")
    .single();
  if (createError || !created) {
    // Error code/constraint only: no applicant data in logs.
    console.error("[new-application:vietnam] draft insert failed", createError?.code ?? "no_row");
    await restoreSource();
    return { error: "Could not create a new application", code: "copy_failed", status: 500 };
  }
  const newId = (created as { id: string }).id;
  // Deleting the new draft later (or below, on a failed copy) restores the
  // old application through the 0211 restore trigger.
  await admin
    .from("applications")
    .update({ superseded_by_application_id: newId })
    .in("id", [source.id, ...archivedSiblings.map((row) => row.id)]);

  const discardNewDraft = async () => {
    await admin.from("applications").delete().eq("id", newId);
    await restoreSource();
  };

  const { error: answerCopyError } = await admin.from("visa_application_answers").insert(
    (answers as { field_name: string; value_text: unknown; value_json: unknown }[]).map((answer) => ({
      application_id: newId,
      field_name: answer.field_name,
      value_text: answer.value_text,
      value_json: answer.value_json,
    })),
  );
  if (answerCopyError) {
    await discardNewDraft();
    return { error: "Could not copy the saved answers", code: "copy_failed", status: 500 };
  }

  const documentRows = (documents ?? []) as Record<string, unknown>[];
  if (documentRows.length > 0) {
    const { error: documentCopyError } = await admin.from("application_documents").insert(
      documentRows.map((document) => {
        const copy: Record<string, unknown> = {
          application_id: newId,
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
      await admin.from("visa_application_answers").delete().eq("application_id", newId);
      await discardNewDraft();
      return { error: "Could not copy the uploaded documents", code: "copy_failed", status: 500 };
    }
  }

  return { applicationId: newId, country, visaType, status: 201 };
}
