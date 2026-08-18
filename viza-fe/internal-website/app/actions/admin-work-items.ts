"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  WORK_ITEM_STATUSES,
  getWorkItemSop,
  type WorkItemPriority,
  type WorkItemStatus,
} from "@/lib/admin/work-item-sops";

export interface AdminWorkItemRow {
  id: string;
  application_id: string | null;
  applicant_id: string | null;
  order_id: string | null;
  source_type: string | null;
  source_id: string | null;
  kind: string;
  title: string;
  description: string | null;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  owning_team: string;
  assigned_to: string | null;
  due_at: string | null;
  checklist: unknown;
  resolution_code: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAdminWorkItemInput {
  applicationId?: string;
  applicantId?: string;
  orderId?: string;
  sourceType?: string;
  sourceId?: string;
  dedupeKey?: string;
  kind: string;
  title: string;
  description?: string;
  priority?: WorkItemPriority;
  owningTeam?: string;
  dueAt?: string;
}

type ActionResult = { success: true; id?: string } | { success: false; error: string };

function auditWorkItemState(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    priority: row.priority,
    owning_team: row.owning_team,
    assigned_to: row.assigned_to,
    due_at: row.due_at,
    resolution_code: row.resolution_code,
  };
}

async function authorize() {
  return requireRole("admin", "staff", "customer_service");
}

function revalidateAdminWork(item?: { application_id?: string | null }) {
  revalidatePath("/admin");
  revalidatePath("/admin/work");
  if (item?.application_id) revalidatePath(`/admin/applications/${item.application_id}`);
}

export async function createAdminWorkItem(
  input: CreateAdminWorkItemInput,
): Promise<ActionResult> {
  try {
    const actor = await authorize();
    const sop = getWorkItemSop(input.kind);
    const dueAt = input.dueAt
      ? new Date(input.dueAt).toISOString()
      : sop
        ? new Date(Date.now() + sop.targetMinutes * 60_000).toISOString()
        : null;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("admin_work_items")
      .insert({
        application_id: input.applicationId || null,
        applicant_id: input.applicantId || null,
        order_id: input.orderId || null,
        source_type: input.sourceType || null,
        source_id: input.sourceId || null,
        dedupe_key: input.dedupeKey || null,
        kind: input.kind,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        priority: input.priority || sop?.defaultPriority || "p2",
        owning_team: input.owningTeam || sop?.owningTeam || "operations",
        due_at: dueAt,
        checklist: (sop?.checklist || []).map((label) => ({ label, completed: false })),
        created_by: actor.id,
      })
      .select("id, application_id")
      .single();
    if (error || !data) return { success: false, error: error?.message || "Unable to create work item" };

    await admin.from("admin_work_item_events").insert({
      work_item_id: data.id,
      actor_user_id: actor.id,
      action: "created",
      after_state: { kind: input.kind, status: "open", priority: input.priority || sop?.defaultPriority || "p2" },
    });
    revalidateAdminWork(data);
    return { success: true, id: data.id as string };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to create work item" };
  }
}

export async function updateAdminWorkItem(input: {
  id: string;
  status?: WorkItemStatus;
  assignedTo?: string | null;
  priority?: WorkItemPriority;
  resolutionCode?: string;
  resolutionNotes?: string;
  reason: string;
}): Promise<ActionResult> {
  try {
    const actor = await authorize();
    if (input.status && !WORK_ITEM_STATUSES.includes(input.status)) {
      return { success: false, error: "Invalid work item status" };
    }
    if (!input.reason.trim()) return { success: false, error: "A reason is required" };
    const admin = createAdminClient();
    const { data: before, error: readError } = await admin
      .from("admin_work_items")
      .select("*")
      .eq("id", input.id)
      .single();
    if (readError || !before) return { success: false, error: readError?.message || "Work item not found" };

    const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.status) changes.status = input.status;
    if (input.assignedTo !== undefined) changes.assigned_to = input.assignedTo;
    if (input.priority) changes.priority = input.priority;
    if (input.resolutionCode !== undefined) changes.resolution_code = input.resolutionCode || null;
    if (input.resolutionNotes !== undefined) changes.resolution_notes = input.resolutionNotes || null;
    if (input.status === "resolved" || input.status === "cancelled") {
      changes.resolved_at = new Date().toISOString();
    } else if (input.status) {
      changes.resolved_at = null;
    }

    const { data: after, error: updateError } = await admin
      .from("admin_work_items")
      .update(changes)
      .eq("id", input.id)
      .select("*")
      .single();
    if (updateError || !after) return { success: false, error: updateError?.message || "Unable to update work item" };

    const { error: eventError } = await admin.from("admin_work_item_events").insert({
      work_item_id: input.id,
      actor_user_id: actor.id,
      action: input.status === "resolved" ? "resolved" : "updated",
      reason: input.reason.trim(),
      before_state: auditWorkItemState(before),
      after_state: auditWorkItemState(after),
    });
    if (eventError) return { success: false, error: eventError.message };
    revalidateAdminWork(after);
    return { success: true, id: input.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to update work item" };
  }
}

export async function claimAdminWorkItem(id: string, reason: string): Promise<ActionResult> {
  const actor = await authorize();
  return updateAdminWorkItem({ id, assignedTo: actor.id, status: "in_progress", reason });
}

interface SignalRow {
  dedupe_key: string;
  application_id?: string | null;
  applicant_id?: string | null;
  order_id?: string | null;
  source_type: string;
  source_id: string;
  kind: string;
  title: string;
  description?: string | null;
  priority: WorkItemPriority;
  owning_team: string;
  due_at: string;
  checklist: Array<{ label: string; completed: boolean }>;
  metadata_redacted?: Record<string, unknown>;
  created_by: string;
}

function signalRow(
  actorId: string,
  input: Omit<SignalRow, "created_by" | "due_at" | "checklist" | "owning_team"> & {
    owningTeam?: string;
  },
): SignalRow {
  const sop = getWorkItemSop(input.kind);
  return {
    ...input,
    owning_team: input.owningTeam || sop?.owningTeam || "operations",
    due_at: new Date(Date.now() + (sop?.targetMinutes || 240) * 60_000).toISOString(),
    checklist: (sop?.checklist || []).map((label) => ({ label, completed: false })),
    created_by: actorId,
  };
}

/**
 * Reconciles durable operational failures into the staff queue. This is safe to
 * run repeatedly because each source signal has a stable dedupe key.
 */
export async function syncAdminOperationalWorkItems(): Promise<
  ActionResult & { created?: number; warnings?: string[] }
> {
  try {
    const actor = await authorize();
    const admin = createAdminClient();
    const rows: SignalRow[] = [];
    const warnings: string[] = [];

    const [provisioning, runners, refunds, takeovers, portals, dlq, appointments, privacy] = await Promise.all([
      admin
        .from("payment_provisioning_jobs")
        .select("id, order_id, status, attempts, max_attempts, last_error")
        .in("status", ["retry", "dead_letter"])
        .limit(100),
      admin
        .from("runner_job")
        .select("id, application_id, country, status, last_error")
        .in("status", ["failed", "dead_letter", "needs_human"])
        .limit(100),
      admin
        .from("refund_request")
        .select("id, application_id, applicant_id, status, reason")
        .in("status", ["requested", "disputed"])
        .limit(100),
      admin
        .from("takeover_session")
        .select("id, application_id, applicant_id, job_id, status, reason")
        .in("status", ["queued", "claimed"])
        .limit(100),
      admin
        .from("portal_health")
        .select("country, status, error, note")
        .in("status", ["degraded", "down"])
        .limit(100),
      admin
        .from("notification_dlq")
        .select("id, application_id, applicant_id, template_key, channel, error")
        .is("replayed_at", null)
        .limit(100),
      admin
        .from("appointment_assistance_jobs")
        .select("id, application_id, user_id, status, current_manual_action, last_error_message")
        .eq("requires_user_action", true)
        .limit(100),
      admin
        .from("data_privacy_requests")
        .select("id, application_id, applicant_id, request_type, status, due_at, notes")
        .in("status", ["requested", "pending", "processing"])
        .limit(100),
    ]);

    const sources = [provisioning, runners, refunds, takeovers, portals, dlq, appointments, privacy];
    for (const source of sources) {
      if (source.error) warnings.push(source.error.message);
    }

    for (const job of provisioning.data ?? []) {
      rows.push(signalRow(actor.id, {
        dedupe_key: `payment_provisioning_jobs:${job.id}`,
        order_id: job.order_id as string,
        source_type: "payment_provisioning_jobs",
        source_id: job.id as string,
        kind: "payment_provisioning_failed",
        title: `Payment provisioning ${job.status}`,
        description: (job.last_error as string | null) || `Attempt ${job.attempts} of ${job.max_attempts}`,
        priority: job.status === "dead_letter" ? "p0" : "p1",
      }));
    }
    for (const job of runners.data ?? []) {
      rows.push(signalRow(actor.id, {
        dedupe_key: `runner_job:${job.id}`,
        application_id: job.application_id as string,
        source_type: "runner_job",
        source_id: job.id as string,
        kind: "submission_action_required",
        title: `${String(job.country).replaceAll("_", " ")} submission ${job.status}`,
        description: (job.last_error as string | null) || "Submission runner requires staff review",
        priority: job.status === "dead_letter" ? "p0" : "p1",
      }));
    }
    for (const request of refunds.data ?? []) {
      rows.push(signalRow(actor.id, {
        dedupe_key: `refund_request:${request.id}`,
        application_id: request.application_id as string,
        applicant_id: request.applicant_id as string,
        source_type: "refund_request",
        source_id: request.id as string,
        kind: "refund_or_dispute",
        title: request.status === "disputed" ? "Payment dispute requires response" : "Refund request requires decision",
        description: request.reason as string,
        priority: request.status === "disputed" ? "p0" : "p1",
      }));
    }
    for (const takeover of takeovers.data ?? []) {
      rows.push(signalRow(actor.id, {
        dedupe_key: `takeover_session:${takeover.id}`,
        application_id: takeover.application_id as string,
        applicant_id: takeover.applicant_id as string,
        source_type: "takeover_session",
        source_id: takeover.id as string,
        kind: "submission_action_required",
        title: "Operator takeover required",
        description: takeover.reason as string,
        priority: "p0",
      }));
    }
    for (const portal of portals.data ?? []) {
      rows.push(signalRow(actor.id, {
        dedupe_key: `portal_health:${portal.country}:${portal.status}`,
        source_type: "portal_health",
        source_id: portal.country as string,
        kind: "portal_incident",
        title: `${String(portal.country).replaceAll("_", " ")} portal ${portal.status}`,
        description: (portal.error as string | null) || (portal.note as string | null),
        priority: portal.status === "down" ? "p0" : "p1",
      }));
    }
    for (const notification of dlq.data ?? []) {
      rows.push(signalRow(actor.id, {
        dedupe_key: `notification_dlq:${notification.id}`,
        application_id: notification.application_id as string | null,
        applicant_id: notification.applicant_id as string | null,
        source_type: "notification_dlq",
        source_id: notification.id as string,
        kind: "notification_delivery_failed",
        title: `${notification.channel} notification failed`,
        description: `${notification.template_key}: ${notification.error}`,
        priority: "p2",
        owningTeam: "customer_support",
      }));
    }
    for (const appointment of appointments.data ?? []) {
      rows.push(signalRow(actor.id, {
        dedupe_key: `appointment_assistance_jobs:${appointment.id}:${appointment.status}`,
        application_id: appointment.application_id as string,
        source_type: "appointment_assistance_jobs",
        source_id: appointment.id as string,
        kind: "appointment_action_required",
        title: "Appointment workflow requires action",
        description: (appointment.current_manual_action as string | null) || (appointment.last_error_message as string | null) || String(appointment.status),
        priority: "p1",
      }));
    }
    for (const request of privacy.data ?? []) {
      const sop = getWorkItemSop("privacy_request");
      rows.push({
        ...signalRow(actor.id, {
          dedupe_key: `data_privacy_requests:${request.id}`,
          application_id: request.application_id as string | null,
          applicant_id: request.applicant_id as string,
          source_type: "data_privacy_requests",
          source_id: request.id as string,
          kind: "privacy_request",
          title: `Privacy request: ${request.request_type}`,
          description: (request.notes as string | null) || String(request.status),
          priority: "p1",
        }),
        due_at: (request.due_at as string | null) || new Date(Date.now() + (sop?.targetMinutes || 1440) * 60_000).toISOString(),
      });
    }

    if (rows.length === 0) {
      revalidateAdminWork();
      return { success: true, created: 0, warnings };
    }
    const { data, error } = await admin
      .from("admin_work_items")
      .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) return { success: false, error: error.message, warnings };
    revalidateAdminWork();
    return { success: true, created: data?.length ?? 0, warnings };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to sync operational work" };
  }
}
