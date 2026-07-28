"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildStatusSummary, fetchAdminApplicationDetail } from "./data";

type QueueRow = {
  id: string;
  application_id: string;
  status: string | null;
  mode: string | null;
  provider: string | null;
};

type ApplicationRow = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
};

type ManualActionTable = {
  tableName: string;
  queueColumn: "submission_queue_id" | "job_id";
};

type ManualActionRow = {
  id: string;
  submission_queue_id?: string | null;
  job_id?: string | null;
  application_id: string | null;
  action_type: string;
  status: string | null;
};

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function safeReturnTo(value: string, applicationId: string): string {
  if (value.startsWith("/admin/applications/")) return value;
  return `/admin/applications/${applicationId}`;
}

function withResultParam(returnTo: string, key: string): string {
  const separator = returnTo.includes("?") ? "&" : "?";
  return `${returnTo}${separator}${key}=1`;
}

function normalizeCountry(country: string | null | undefined): string {
  return (country ?? "").trim().toLowerCase();
}

function normalizeVisaType(visaType: string | null | undefined): string {
  return (visaType ?? "").trim().toLowerCase();
}

function isDs160Job(queue: QueueRow, application: ApplicationRow): boolean {
  const country = normalizeCountry(application.country);
  const visaType = normalizeVisaType(application.visa_type);
  return (
    queue.provider === "ceac_live" ||
    queue.status?.startsWith("ds160_") === true ||
    visaType === "ds160" ||
    country === "united_states" ||
    country === "united states" ||
    country === "us" ||
    country === "美国"
  );
}

function isFranceJob(queue: QueueRow, application: ApplicationRow): boolean {
  const country = normalizeCountry(application.country);
  return queue.provider === "france_visas_live" || country === "france" || country === "fr" || country === "法国";
}

function isVietnamJob(queue: QueueRow, application: ApplicationRow): boolean {
  const country = normalizeCountry(application.country);
  return (
    queue.provider === "vietnam_evisa_live" ||
    country === "vietnam" ||
    country === "vn" ||
    country === "viet_nam"
  );
}

function manualActionTables(queue: QueueRow, application: ApplicationRow): ManualActionTable[] {
  const tables: ManualActionTable[] = [
    { tableName: "submission_manual_actions", queueColumn: "submission_queue_id" },
  ];
  if (isFranceJob(queue, application)) tables.push({ tableName: "france_live_manual_actions", queueColumn: "job_id" });
  if (isVietnamJob(queue, application)) tables.push({ tableName: "vietnam_live_manual_actions", queueColumn: "job_id" });
  if (isDs160Job(queue, application)) tables.push({ tableName: "ds160_live_manual_actions", queueColumn: "job_id" });
  return tables;
}

function requeuePatch(queue: QueueRow, application: ApplicationRow, now: string): Record<string, unknown> {
  if (isDs160Job(queue, application)) {
    return {
      status: "ds160_live_assisted_pending",
      mode: "live_assisted",
      provider: "ceac_live",
      manual_action_status: "completed",
      live_checkpoint: null,
      last_error: null,
      error_message: null,
      updated_at: now,
    };
  }
  if (isFranceJob(queue, application)) {
    return {
      status: "fv_prefill_pending",
      mode: "live_assisted",
      provider: "france_visas_live",
      manual_action_status: "completed",
      live_checkpoint: null,
      last_error: null,
      error_message: null,
      updated_at: now,
    };
  }
  if (isVietnamJob(queue, application)) {
    return {
      status: "vn_cloud_live_pending",
      mode: "live_assisted",
      provider: "vietnam_evisa_live",
      manual_action_status: "completed",
      last_error: null,
      error_message: null,
      updated_at: now,
    };
  }
  return {
    status: "pending",
    manual_action_status: "completed",
    last_error: null,
    error_message: null,
    updated_at: now,
  };
}

async function findManualAction(
  adminClient: ReturnType<typeof createAdminClient>,
  jobId: string,
  actionId: string,
  tables: ManualActionTable[],
): Promise<{ table: ManualActionTable; action: ManualActionRow } | null> {
  for (const table of tables) {
    const selectColumns =
      table.queueColumn === "submission_queue_id"
        ? "id, submission_queue_id, application_id, action_type, status"
        : "id, job_id, application_id, action_type, status";
    const { data } = await adminClient
      .from(table.tableName)
      .select(selectColumns)
      .eq("id", actionId)
      .eq(table.queueColumn, jobId)
      .maybeSingle();
    if (data) return { table, action: data as ManualActionRow };
  }
  return null;
}

export async function queueStatusNotification(formData: FormData) {
  const applicationId = getFormString(formData, "applicationId");
  const returnTo = safeReturnTo(getFormString(formData, "returnTo"), applicationId);
  let target = withResultParam(returnTo, "actionError");

  if (!applicationId) {
    redirect(target);
  }

  try {
    const actor = await requireRole("admin", "staff", "customer_service");
    const { application, error } = await fetchAdminApplicationDetail(applicationId);

    if (error || !application) {
      target = withResultParam(returnTo, "actionError");
    } else {
      const adminClient = createAdminClient();
      const summary = buildStatusSummary(application);
      const recipient = application.profile?.email ?? null;

      const { error: notificationError } = await adminClient.from("notification_events").insert({
        application_id: application.id,
        applicant_id: application.applicantId,
        channel: "email",
        template_key: "support_status_update",
        recipient,
        status: "queued",
        payload: {
          summary,
          queued_by: actor.id,
          source: "admin_application_monitor",
        },
      });

      if (notificationError) {
        target = withResultParam(returnTo, "actionError");
      } else {
        await adminClient.from("application_events").insert({
          application_id: application.id,
          applicant_id: application.applicantId,
          event_type: "support_notification_queued",
          actor_type: "admin",
          actor_id: actor.id,
          message: "Staff queued a customer-safe status update notification.",
          metadata: {
            template_key: "support_status_update",
            recipient_present: Boolean(recipient),
          },
        });

        revalidatePath("/admin/applications");
        revalidatePath(`/admin/applications/${application.id}`);
        target = withResultParam(returnTo, "queuedNotification");
      }
    }
  } catch {
    target = withResultParam(returnTo, "actionError");
  }

  redirect(target);
}

export async function completeLiveManualAction(formData: FormData) {
  const jobId = getFormString(formData, "jobId");
  const actionId = getFormString(formData, "actionId");
  const applicationId = getFormString(formData, "applicationId");
  const returnTo = safeReturnTo(getFormString(formData, "returnTo"), applicationId);
  let target = withResultParam(returnTo, "actionError");

  if (!jobId || !actionId || !applicationId) {
    redirect(target);
  }

  try {
    const actor = await requireRole("admin", "staff", "customer_service");
    const adminClient = createAdminClient();

    const { data: queueData, error: queueError } = await adminClient
      .from("submission_queue")
      .select("id, application_id, status, mode, provider")
      .eq("id", jobId)
      .maybeSingle();

    if (queueError || !queueData) redirect(target);
    const queue = queueData as QueueRow;
    if (queue.application_id !== applicationId) redirect(target);

    const { data: applicationData, error: applicationError } = await adminClient
      .from("applications")
      .select("id, applicant_id, country, visa_type")
      .eq("id", queue.application_id)
      .maybeSingle();

    if (applicationError || !applicationData) redirect(target);
    const application = applicationData as ApplicationRow;
    const found = await findManualAction(adminClient, jobId, actionId, manualActionTables(queue, application));
    if (!found || found.action.application_id !== application.id) redirect(target);

    const now = new Date().toISOString();
    if (found.action.status !== "completed") {
      const { error: actionError } = await adminClient
        .from(found.table.tableName)
        .update({ status: "completed", completed_at: now })
        .eq("id", actionId)
        .eq(found.table.queueColumn, jobId);
      if (actionError) redirect(target);
    }

    const queuePatch = requeuePatch(queue, application, now);
    const { error: updateQueueError } = await adminClient
      .from("submission_queue")
      .update(queuePatch)
      .eq("id", jobId);
    if (updateQueueError) redirect(target);

    await adminClient.from("applications").update({
      status: "submitted",
      submission_result_status: "waiting",
      submission_result: null,
      submission_result_updated_at: now,
      updated_at: now,
    }).eq("id", application.id);

    await adminClient.from("application_events").insert({
      application_id: application.id,
      applicant_id: application.applicant_id,
      event_type: "live_manual_action_completed_by_staff",
      actor_type: "admin",
      actor_id: actor.id,
      message: "Staff marked an official-site manual action complete and resumed the live-assisted job.",
      metadata: {
        job_id: jobId,
        action_id: actionId,
        action_type: found.action.action_type,
        source_table: found.table.tableName,
      },
    });

    revalidatePath("/admin/applications");
    revalidatePath(returnTo);
    revalidatePath("/client/status");
    target = withResultParam(returnTo, "manualActionCompleted");
  } catch {
    target = withResultParam(returnTo, "actionError");
  }

  redirect(target);
}
