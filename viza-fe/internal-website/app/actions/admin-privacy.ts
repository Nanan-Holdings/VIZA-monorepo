"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PrivacyOperation = "assign" | "verify_identity" | "fulfill" | "reject" | "place_legal_hold" | "release_legal_hold";

type ActionResult = { success: true } | { success: false; error: string };

const EXPORT_TYPES = new Set(["export", "data_export", "personal_data_export", "access"]);
const ERASURE_TYPES = new Set(["deletion", "delete", "data_deletion", "erasure"]);
const PRIVACY_EXPORT_BUCKET = "privacy-exports";

async function requireAal2(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || data.currentLevel !== "aal2") throw new Error("A current 2FA-verified session is required for erasure or export access.");
  return user.id;
}

async function queryRows(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  column: string,
  values: string[],
  select = "*",
): Promise<{ rows: unknown[]; error?: string }> {
  if (!values.length) return { rows: [] };
  const result = await admin.from(table).select(select).in(column, values);
  return result.error ? { rows: [], error: result.error.message } : { rows: result.data ?? [] };
}

export async function generatePrivacyExport(input: { requestId: string; reason: string }): Promise<ActionResult & { storagePath?: string }> {
  try {
    const actor = await requireRole("admin");
    if (input.reason.trim().length < 5) return { success: false, error: "An export reason is required" };
    const admin = createAdminClient();
    const { data: request } = await admin.from("data_privacy_requests").select("*").eq("id", input.requestId).maybeSingle();
    if (!request) return { success: false, error: "Privacy request not found" };
    if (!EXPORT_TYPES.has(String(request.request_type))) return { success: false, error: "This is not a data-export request" };
    if (!request.identity_verified_at) return { success: false, error: "Identity must be verified before export" };
    if (request.legal_hold) return { success: false, error: "Resolve the legal hold before releasing an export" };

    const { error: auditError } = await admin.from("admin_command_events").insert({
      actor_user_id: actor.id,
      command: "privacy_request.export_started",
      target_type: "data_privacy_requests",
      target_id: input.requestId,
      reason: input.reason.trim(),
      before_state: { status: request.status, export_storage_path: request.export_storage_path },
      after_state: { status: "processing" },
    });
    if (auditError) return { success: false, error: `Export stopped because audit failed: ${auditError.message}` };

    await admin.from("data_privacy_requests").update({ status: "processing", assigned_to: request.assigned_to || actor.id, updated_at: new Date().toISOString() }).eq("id", input.requestId);
    const { data: apps, error: appError } = await admin.from("applications").select("*").eq("applicant_id", request.applicant_id);
    if (appError) return { success: false, error: appError.message };
    const applicationIds = (apps ?? []).map((row) => String(row.id));
    const [profile, answers, profileAnswers, documents, profileDocuments, consents, events, payments, refunds, tickets, privacyRequests] = await Promise.all([
      admin.from("applicant_profiles").select("*").eq("id", request.applicant_id).maybeSingle(),
      queryRows(admin, "visa_application_answers", "application_id", applicationIds),
      queryRows(admin, "universal_profile_answers", "applicant_id", [request.applicant_id]),
      queryRows(admin, "application_documents", "application_id", applicationIds, "id, application_id, document_type, requirement_key, filename, status, rejection_reason, required, reviewed_at, expires_at, created_at, updated_at"),
      queryRows(admin, "universal_profile_documents", "applicant_id", [request.applicant_id], "id, document_type, filename, status, source_application_id, created_at, updated_at"),
      queryRows(admin, "consent_events", "applicant_id", [request.applicant_id]),
      queryRows(admin, "application_events", "applicant_id", [request.applicant_id]),
      queryRows(admin, "payment_records", "applicant_id", [request.applicant_id], "id, application_id, provider, status, amount_cents, currency, provider_payment_id, receipt_url, paid_at, refunded_at, created_at, updated_at"),
      queryRows(admin, "refund_request", "applicant_id", [request.applicant_id]),
      queryRows(admin, "support_ticket", "applicant_id", [request.applicant_id]),
      queryRows(admin, "data_privacy_requests", "applicant_id", [request.applicant_id]),
    ]);
    const sourceErrors = [profile.error?.message, answers.error, profileAnswers.error, documents.error, profileDocuments.error, consents.error, events.error, payments.error, refunds.error, tickets.error, privacyRequests.error].filter((value): value is string => Boolean(value));
    if (sourceErrors.length) return { success: false, error: `Export inventory failed: ${sourceErrors.join("; ")}` };

    const ticketIds = tickets.rows.map((row) => String((row as { id: unknown }).id));
    const messages = await queryRows(admin, "support_message", "ticket_id", ticketIds);
    if (messages.error) return { success: false, error: `Export inventory failed: ${messages.error}` };
    const generatedAt = new Date().toISOString();
    const payload = {
      schemaVersion: 1,
      generatedAt,
      requestReference: request.request_reference || request.id,
      profile: profile.data,
      applications: apps ?? [],
      applicationAnswers: answers.rows,
      reusableProfileAnswers: profileAnswers.rows,
      documentMetadata: documents.rows,
      reusableDocumentMetadata: profileDocuments.rows,
      consentEvents: consents.rows,
      applicationEvents: events.rows,
      paymentRecords: payments.rows,
      refundRequests: refunds.rows,
      supportTickets: tickets.rows,
      supportMessages: messages.rows,
      privacyRequests: privacyRequests.rows,
    };
    const path = `${input.requestId}/personal-data-${Date.now()}.json`;
    const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
    const { error: uploadError } = await admin.storage.from(PRIVACY_EXPORT_BUCKET).upload(path, bytes, { contentType: "application/json", upsert: false });
    if (uploadError) return { success: false, error: `Secure export upload failed: ${uploadError.message}` };

    const now = new Date().toISOString();
    const { error: requestError } = await admin.from("data_privacy_requests").update({ status: "fulfilled", decision: "approved", decision_notes: input.reason.trim(), export_storage_path: path, fulfilled_at: now, updated_at: now }).eq("id", input.requestId);
    if (requestError) {
      await admin.storage.from(PRIVACY_EXPORT_BUCKET).remove([path]);
      return { success: false, error: requestError.message };
    }
    await admin.from("privacy_execution_jobs").upsert({ privacy_request_id: input.requestId, operation: "export", status: "completed", inventory: { applications: applicationIds.length, answers: answers.rows.length, documents: documents.rows.length }, result_redacted: { storage_path: path, bytes: bytes.byteLength, generated_at: generatedAt }, requested_by: actor.id, executed_by: actor.id, started_at: generatedAt, completed_at: now, updated_at: now }, { onConflict: "privacy_request_id,operation" });
    revalidatePath("/admin/privacy");
    revalidatePath("/client/settings");
    return { success: true, storagePath: path };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to generate privacy export" };
  }
}

export async function getPrivacyExportUrl(requestId: string): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    await requireRole("admin");
    await requireAal2();
    const admin = createAdminClient();
    const { data: request } = await admin.from("data_privacy_requests").select("export_storage_path").eq("id", requestId).maybeSingle();
    if (!request?.export_storage_path) return { success: false, error: "No export is available" };
    const { data, error } = await admin.storage.from(PRIVACY_EXPORT_BUCKET).createSignedUrl(request.export_storage_path, 300, { download: true });
    if (error || !data) return { success: false, error: error?.message || "Unable to create secure download" };
    return { success: true, url: data.signedUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to reveal privacy export" };
  }
}

export async function preparePrivacyErasure(input: { requestId: string; reason: string }): Promise<ActionResult> {
  try {
    const actor = await requireRole("admin");
    if (input.reason.trim().length < 5) return { success: false, error: "An erasure preparation reason is required" };
    const admin = createAdminClient();
    const { data: request } = await admin.from("data_privacy_requests").select("*").eq("id", input.requestId).maybeSingle();
    if (!request) return { success: false, error: "Privacy request not found" };
    if (!ERASURE_TYPES.has(String(request.request_type))) return { success: false, error: "This is not an erasure request" };
    if (!request.identity_verified_at) return { success: false, error: "Identity must be verified before preparing erasure" };
    const [{ data: apps }, { count: paymentCount }, { count: orderCount }] = await Promise.all([
      admin.from("applications").select("id, status").eq("applicant_id", request.applicant_id),
      admin.from("payment_records").select("id", { count: "exact", head: true }).eq("applicant_id", request.applicant_id),
      admin.from("order").select("id", { count: "exact", head: true }).eq("applicant_id", request.applicant_id),
    ]);
    const activeApplications = (apps ?? []).filter((row) => !["completed", "rejected", "cancelled", "withdrawn", "expired"].includes(String(row.status)));
    const blockers = [
      ...(request.legal_hold ? ["legal_hold"] : []),
      ...(activeApplications.length ? [`${activeApplications.length}_active_applications`] : []),
    ];
    const now = new Date().toISOString();
    const status = blockers.length ? "blocked" : "awaiting_approval";
    const inventory = { applications: apps?.length ?? 0, activeApplications: activeApplications.length, paymentRecords: paymentCount ?? 0, orders: orderCount ?? 0, blockers, checkedAt: now };
    const retained = ["commercial order and payment ledger", "tax/invoice records", "consent and admin audit records", "privacy request decision record"];
    const { error: auditError } = await admin.from("admin_command_events").insert({ actor_user_id: actor.id, command: "privacy_request.erasure_prepared", target_type: "data_privacy_requests", target_id: input.requestId, reason: input.reason.trim(), before_state: { status: request.status, legal_hold: request.legal_hold }, after_state: { execution_status: status, inventory, retained_scope: retained } });
    if (auditError) return { success: false, error: `Preparation stopped because audit failed: ${auditError.message}` };
    const { error } = await admin.from("privacy_execution_jobs").upsert({ privacy_request_id: input.requestId, operation: "erasure", status, inventory, retained_scope: retained, requested_by: actor.id, approved_by: null, approved_at: null, last_error: blockers.length ? blockers.join(", ") : null, updated_at: now }, { onConflict: "privacy_request_id,operation" });
    if (error) return { success: false, error: error.message };
    await admin.from("data_privacy_requests").update({ status: blockers.length ? "processing" : "processing", assigned_to: request.assigned_to || actor.id, updated_at: now }).eq("id", input.requestId);
    revalidatePath("/admin/privacy");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to prepare erasure" };
  }
}

export async function approvePrivacyErasure(input: { requestId: string; reason: string }): Promise<ActionResult> {
  try {
    const actor = await requireRole("admin");
    if (input.reason.trim().length < 5) return { success: false, error: "An approval reason is required" };
    const admin = createAdminClient();
    const { data: job } = await admin.from("privacy_execution_jobs").select("*").eq("privacy_request_id", input.requestId).eq("operation", "erasure").maybeSingle();
    if (!job || job.status !== "awaiting_approval") return { success: false, error: "Erasure is not awaiting approval" };
    if (job.requested_by === actor.id) return { success: false, error: "A second admin must approve this erasure" };
    const now = new Date().toISOString();
    const { error: auditError } = await admin.from("admin_command_events").insert({ actor_user_id: actor.id, command: "privacy_request.erasure_approved", target_type: "data_privacy_requests", target_id: input.requestId, reason: input.reason.trim(), before_state: { execution_status: job.status, requested_by: job.requested_by }, after_state: { execution_status: "approved", approved_by: actor.id } });
    if (auditError) return { success: false, error: `Approval stopped because audit failed: ${auditError.message}` };
    const { error } = await admin.from("privacy_execution_jobs").update({ status: "approved", approved_by: actor.id, approved_at: now, updated_at: now }).eq("id", job.id).eq("status", "awaiting_approval");
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/privacy");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to approve erasure" };
  }
}

async function deleteRows(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  column: string,
  values: string[],
): Promise<string | null> {
  if (!values.length) return null;
  const { error } = await admin.from(table).delete().in(column, values);
  return error ? `${table}: ${error.message}` : null;
}

export async function executePrivacyErasure(input: {
  requestId: string;
  reason: string;
  confirmation: string;
}): Promise<ActionResult> {
  try {
    const actor = await requireRole("admin");
    const aal2UserId = await requireAal2();
    if (aal2UserId !== actor.id) return { success: false, error: "2FA session identity mismatch" };
    if (input.reason.trim().length < 5) return { success: false, error: "An execution reason is required" };
    if (input.confirmation.trim() !== `ERASE ${input.requestId}`) return { success: false, error: `Type ERASE ${input.requestId} exactly` };
    const admin = createAdminClient();
    const [{ data: job }, { data: request }] = await Promise.all([
      admin.from("privacy_execution_jobs").select("*").eq("privacy_request_id", input.requestId).eq("operation", "erasure").maybeSingle(),
      admin.from("data_privacy_requests").select("*").eq("id", input.requestId).maybeSingle(),
    ]);
    if (!job || job.status !== "approved") return { success: false, error: "Erasure is not approved" };
    if (job.approved_by !== actor.id) return { success: false, error: "The approving admin must execute this erasure" };
    if (!request) return { success: false, error: "Privacy request not found" };
    if (request.legal_hold) return { success: false, error: "Erasure is blocked by a legal hold" };

    const { error: auditError } = await admin.from("admin_command_events").insert({
      actor_user_id: actor.id,
      command: "privacy_request.erasure_execute",
      target_type: "data_privacy_requests",
      target_id: input.requestId,
      reason: input.reason.trim(),
      before_state: { status: request.status, execution_status: job.status, approved_by: job.approved_by },
      after_state: { execution_status: "running", retained_scope: job.retained_scope },
    });
    if (auditError) return { success: false, error: `Erasure stopped because audit failed: ${auditError.message}` };
    const startedAt = new Date().toISOString();
    await admin.from("privacy_execution_jobs").update({ status: "running", executed_by: actor.id, started_at: startedAt, last_error: null, updated_at: startedAt }).eq("id", job.id).eq("status", "approved");

    const { data: applications, error: appError } = await admin.from("applications").select("id, status").eq("applicant_id", request.applicant_id);
    if (appError) return { success: false, error: appError.message };
    const active = (applications ?? []).filter((row) => !["completed", "rejected", "cancelled", "withdrawn", "expired"].includes(String(row.status)));
    if (active.length) {
      await admin.from("privacy_execution_jobs").update({ status: "blocked", last_error: "Active applications appeared after approval", updated_at: new Date().toISOString() }).eq("id", job.id);
      return { success: false, error: "Erasure stopped because an application is active" };
    }
    const applicationIds = (applications ?? []).map((row) => String(row.id));
    const [{ data: appDocuments }, { data: profileDocuments }, { data: tickets }, { data: appointmentJobs }] = await Promise.all([
      applicationIds.length ? admin.from("application_documents").select("storage_path").in("application_id", applicationIds) : Promise.resolve({ data: [] }),
      admin.from("universal_profile_documents").select("storage_path").eq("applicant_id", request.applicant_id),
      admin.from("support_ticket").select("id").eq("applicant_id", request.applicant_id),
      applicationIds.length ? admin.from("appointment_assistance_jobs").select("id").in("application_id", applicationIds) : Promise.resolve({ data: [] }),
    ]);
    const storagePaths = [...(appDocuments ?? []), ...(profileDocuments ?? [])]
      .map((row) => String(row.storage_path || ""))
      .filter(Boolean);
    for (let offset = 0; offset < storagePaths.length; offset += 100) {
      const { error } = await admin.storage.from("application-documents").remove(storagePaths.slice(offset, offset + 100));
      if (error) {
        await admin.from("privacy_execution_jobs").update({ status: "failed", last_error: `Storage purge: ${error.message}`, updated_at: new Date().toISOString() }).eq("id", job.id);
        return { success: false, error: `Storage purge failed: ${error.message}` };
      }
    }

    const ticketIds = (tickets ?? []).map((row) => String(row.id));
    const appointmentJobIds = (appointmentJobs ?? []).map((row) => String(row.id));
    const deletionSpecs: Array<[string, string, string[]]> = [
      ["support_message", "ticket_id", ticketIds],
      ["support_internal_note", "ticket_id", ticketIds],
      ["support_ticket", "applicant_id", [request.applicant_id]],
      ["appointment_assistance_jobs", "id", appointmentJobIds],
      ["visa_application_answers", "application_id", applicationIds],
      ["application_profile_snapshots", "application_id", applicationIds],
      ["ocr_extractions", "application_id", applicationIds],
      ["application_signatures", "application_id", applicationIds],
      ["application_packets", "application_id", applicationIds],
      ["form_assistant_messages", "application_id", applicationIds],
      ["form_assistant_sessions", "application_id", applicationIds],
      ["official_application_tracking", "application_id", applicationIds],
      ["stripe_identity_session", "application_id", applicationIds],
      ["application_documents", "application_id", applicationIds],
      ["universal_profile_answers", "applicant_id", [request.applicant_id]],
      ["universal_profile_documents", "applicant_id", [request.applicant_id]],
      ["shared_profile_fields", "applicant_id", [request.applicant_id]],
      ["notification_preferences", "applicant_id", [request.applicant_id]],
      ["notification_events", "applicant_id", [request.applicant_id]],
      ["visa_chat_sessions", "applicant_id", [request.applicant_id]],
      ["face_match_audit", "applicant_id", [request.applicant_id]],
      ["uk_accounts", "applicant_id", [request.applicant_id]],
      ["au_accounts", "applicant_id", [request.applicant_id]],
      ["ph_etravel_accounts", "applicant_id", [request.applicant_id]],
      ["ds160_other_names", "applicant_id", [request.applicant_id]],
      ["ds160_other_nationalities", "applicant_id", [request.applicant_id]],
      ["ds160_social_media", "applicant_id", [request.applicant_id]],
      ["ds160_lost_passports", "applicant_id", [request.applicant_id]],
      ["ds160_us_relatives", "applicant_id", [request.applicant_id]],
      ["ds160_previous_employers", "applicant_id", [request.applicant_id]],
      ["ds160_security_answers", "applicant_id", [request.applicant_id]],
      ["ds160_travel_companions", "applicant_id", [request.applicant_id]],
      ["ds160_interview_records", "applicant_id", [request.applicant_id]],
    ];
    const deletionErrors: string[] = [];
    for (const [table, column, values] of deletionSpecs) {
      const error = await deleteRows(admin, table, column, values);
      if (error) deletionErrors.push(error);
    }
    if (deletionErrors.length) {
      const message = deletionErrors.join("; ");
      await admin.from("privacy_execution_jobs").update({ status: "failed", last_error: message, updated_at: new Date().toISOString() }).eq("id", job.id);
      return { success: false, error: `Erasure is resumable after these failures: ${message}` };
    }

    const applicationRedaction = {
      arrival_date: null, departure_date: null, port_of_entry: null, purpose: null,
      accommodation_name: null, accommodation_address: null, confirmation_number: null,
      receipt_url: null, ds160_application_id: null, ds160_retrieval_url: null,
      ds160_dat_storage_path: null, packet_manifest: null, packet_storage_path: null,
      external_reference: null, result_storage_path: null, result_notes: null,
      submission_result: null, updated_at: new Date().toISOString(),
    };
    if (applicationIds.length) {
      const { error } = await admin.from("applications").update(applicationRedaction).in("id", applicationIds);
      if (error) return { success: false, error: `Application redaction failed: ${error.message}` };
    }
    const profileRedaction = {
      auth_user_id: null,
      full_name: "Erased applicant", full_name_zh: null, full_name_en: null,
      surname: null, surname_zh: null, surname_en: null, given_names: null, given_names_zh: null, given_names_en: null,
      date_of_birth: null, place_of_birth: null, place_of_birth_zh: null, place_of_birth_en: null,
      birth_country: null, birth_province_or_state: null, birth_province_or_state_zh: null, birth_province_or_state_en: null,
      birth_city: null, birth_city_zh: null, birth_city_en: null, gender: null, nationality: null,
      occupation: null, occupation_zh: null, occupation_en: null, address: null, address_zh: null, address_en: null,
      passport_number: null, passport_issue_date: null, passport_expiry_date: null, passport_issuing_country: null, passport_issuing_authority: null,
      email: `erased-${request.applicant_id}@redacted.invalid`, phone: null, wechat: null, updated_at: new Date().toISOString(),
    };
    const { error: profileError } = await admin.from("applicant_profiles").update(profileRedaction).eq("id", request.applicant_id);
    if (profileError) return { success: false, error: `Profile redaction failed: ${profileError.message}` };

    if (request.auth_user_id) {
      await Promise.all([
        admin.from("payment_records").update({ auth_user_id: null }).eq("auth_user_id", request.auth_user_id),
        admin.from("invoice_requests").update({ auth_user_id: null }).eq("auth_user_id", request.auth_user_id),
        admin.from("refund_records").update({ auth_user_id: null }).eq("auth_user_id", request.auth_user_id),
        admin.from("consent_events").update({ auth_user_id: null }).eq("auth_user_id", request.auth_user_id),
        admin.from("application_events").update({ auth_user_id: null }).eq("auth_user_id", request.auth_user_id),
        admin.from("data_privacy_requests").update({ auth_user_id: null }).eq("auth_user_id", request.auth_user_id),
        admin.from("user_packages").delete().eq("auth_user_id", request.auth_user_id),
        admin.from("user_chat_sessions").delete().eq("auth_user_id", request.auth_user_id),
      ]);
      const { error: authError } = await admin.auth.admin.deleteUser(request.auth_user_id);
      if (authError) return { success: false, error: `Auth account erasure failed: ${authError.message}` };
    }

    const completedAt = new Date().toISOString();
    await admin.from("data_privacy_requests").update({ status: "fulfilled", decision: "approved", decision_notes: input.reason.trim(), retention_notes: "Financial, tax, consent, privacy-decision, and admin-audit records retained under policy; direct identifiers redacted.", fulfilled_at: completedAt, updated_at: completedAt }).eq("id", input.requestId);
    await admin.from("privacy_execution_jobs").update({ status: "completed", completed_at: completedAt, result_redacted: { storage_objects_removed: storagePaths.length, applications_redacted: applicationIds.length, auth_account_deleted: Boolean(request.auth_user_id) }, updated_at: completedAt }).eq("id", job.id);
    revalidatePath("/admin/privacy");
    revalidatePath("/admin/work");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to execute privacy erasure" };
  }
}

export async function updateAdminPrivacyRequest(input: {
  requestId: string;
  operation: PrivacyOperation;
  reason: string;
  evidenceReference?: string;
}): Promise<ActionResult> {
  try {
    const actor = await requireRole("admin", "staff");
    if (!input.reason.trim()) return { success: false, error: "A reason is required" };
    const admin = createAdminClient();
    const { data: before, error: readError } = await admin
      .from("data_privacy_requests")
      .select("*")
      .eq("id", input.requestId)
      .maybeSingle();
    if (readError || !before) return { success: false, error: readError?.message || "Privacy request not found" };
    if (["fulfilled", "rejected", "cancelled"].includes(before.status) && !input.operation.includes("legal_hold")) {
      return { success: false, error: "This privacy request is already closed" };
    }

    const now = new Date().toISOString();
    const changes: Record<string, unknown> = { updated_at: now };
    if (input.operation === "assign") {
      changes.assigned_to = actor.id;
      changes.status = "processing";
    } else if (input.operation === "verify_identity") {
      changes.identity_verified_at = now;
      changes.status = "processing";
      changes.assigned_to = before.assigned_to || actor.id;
    } else if (input.operation === "fulfill") {
      if (!before.identity_verified_at) return { success: false, error: "Identity must be verified before fulfillment" };
      if (!input.evidenceReference?.trim()) return { success: false, error: "A fulfillment evidence reference is required" };
      changes.status = "fulfilled";
      changes.decision = "approved";
      changes.decision_notes = input.reason.trim();
      changes.fulfilled_at = now;
      changes.assigned_to = before.assigned_to || actor.id;
      if (["access", "export", "data_export"].includes(String(before.request_type))) {
        changes.export_storage_path = input.evidenceReference.trim();
      }
    } else if (input.operation === "reject") {
      changes.status = "rejected";
      changes.decision = "denied";
      changes.rejection_reason = input.reason.trim();
      changes.fulfilled_at = now;
      changes.assigned_to = before.assigned_to || actor.id;
    } else if (input.operation === "place_legal_hold") {
      changes.legal_hold = true;
      changes.retention_notes = input.reason.trim();
      changes.status = "processing";
      changes.assigned_to = before.assigned_to || actor.id;
    } else if (input.operation === "release_legal_hold") {
      changes.legal_hold = false;
      changes.retention_notes = input.reason.trim();
    }

    const { error: auditError } = await admin.from("admin_command_events").insert({
      actor_user_id: actor.id,
      command: `privacy_request.${input.operation}`,
      target_type: "data_privacy_requests",
      target_id: input.requestId,
      reason: input.reason.trim(),
      before_state: {
        request_type: before.request_type,
        status: before.status,
        assigned_to: before.assigned_to,
        identity_verified_at: before.identity_verified_at,
        legal_hold: before.legal_hold,
        due_at: before.due_at,
      },
      after_state: changes,
      evidence_redacted: input.evidenceReference ? { reference: input.evidenceReference.trim() } : {},
    });
    if (auditError) return { success: false, error: `Command not executed because audit failed: ${auditError.message}` };
    const { error: updateError } = await admin.from("data_privacy_requests").update(changes).eq("id", input.requestId);
    if (updateError) return { success: false, error: updateError.message };
    revalidatePath("/admin/privacy");
    revalidatePath("/admin/work");
    revalidatePath("/admin/applications");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to update privacy request" };
  }
}
