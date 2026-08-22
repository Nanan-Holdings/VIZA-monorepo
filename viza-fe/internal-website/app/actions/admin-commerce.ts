"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundOrderLines, type RefundOutput } from "./refunds";

type CommandResult = { success: true } | { success: false; error: string };

export async function retryPaymentProvisioning(input: {
  jobId: string;
  reason: string;
}): Promise<CommandResult> {
  try {
    const actor = await requireRole("admin", "staff");
    if (!input.reason.trim()) return { success: false, error: "A retry reason is required" };
    const admin = createAdminClient();
    const { data: before, error: readError } = await admin
      .from("payment_provisioning_jobs")
      .select("*")
      .eq("id", input.jobId)
      .maybeSingle();
    if (readError || !before) return { success: false, error: readError?.message || "Provisioning job not found" };
    if (before.status !== "dead_letter" && before.status !== "retry") {
      return { success: false, error: `A ${before.status} job cannot be manually retried` };
    }

    const requestedState = {
      status: "retry",
      attempts: before.status === "dead_letter" ? 0 : before.attempts,
      available_at: new Date().toISOString(),
      lease_expires_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    };
    const { error: auditError } = await admin.from("admin_command_events").insert({
      actor_user_id: actor.id,
      command: "payment_provisioning.retry_requested",
      target_type: "payment_provisioning_jobs",
      target_id: input.jobId,
      reason: input.reason.trim(),
      before_state: {
        status: before.status,
        attempts: before.attempts,
        max_attempts: before.max_attempts,
        user_status: before.user_status,
        profile_status: before.profile_status,
        application_status: before.application_status,
        inbox_status: before.inbox_status,
        allocation_status: before.allocation_status,
        runner_status: before.runner_status,
      },
      after_state: requestedState,
    });
    if (auditError) return { success: false, error: `Retry not queued because audit could not be recorded: ${auditError.message}` };

    const { data: after, error: updateError } = await admin
      .from("payment_provisioning_jobs")
      .update(requestedState)
      .eq("id", input.jobId)
      .in("status", ["dead_letter", "retry"])
      .select("*")
      .maybeSingle();
    if (updateError || !after) return { success: false, error: updateError?.message || "Provisioning job changed before retry" };

    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/work");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to retry provisioning" };
  }
}

export async function decideAdminRefund(input: {
  refundRequestId: string;
  approve: boolean;
  reason: string;
}): Promise<CommandResult> {
  try {
    const actor = await requireRole("admin");
    if (input.reason.trim().length < 5) return { success: false, error: "A decision reason is required" };
    const admin = createAdminClient();
    const { data: before, error: readError } = await admin.from("refund_request").select("*").eq("id", input.refundRequestId).maybeSingle();
    if (readError || !before) return { success: false, error: readError?.message || "Refund request not found" };
    if (before.status !== "requested") return { success: false, error: `Refund request is already ${before.status}` };
    const changes = { status: input.approve ? "approved" : "denied", staff_note: input.reason.trim(), decided_by: actor.id, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const safeBefore = {
      application_id: before.application_id,
      status: before.status,
      amount_cents: before.amount_cents,
      currency: before.currency,
      decided_at: before.decided_at,
    };
    const { error: auditError } = await admin.from("admin_command_events").insert({ actor_user_id: actor.id, command: input.approve ? "refund_request.approve" : "refund_request.deny", target_type: "refund_request", target_id: input.refundRequestId, reason: input.reason.trim(), before_state: safeBefore, after_state: changes });
    if (auditError) return { success: false, error: `Decision not saved because audit failed: ${auditError.message}` };
    const { error: updateError } = await admin.from("refund_request").update(changes).eq("id", input.refundRequestId).eq("status", "requested");
    if (updateError) return { success: false, error: updateError.message };
    revalidatePath("/admin/refunds");
    revalidatePath("/admin/billing");
    revalidatePath("/admin/orders");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to decide refund" };
  }
}

export async function executeApprovedRefund(input: {
  refundRequestId: string;
  orderId: string;
  lineIds: string[];
  reason: string;
}): Promise<(CommandResult & { output?: RefundOutput })> {
  try {
    const actor = await requireRole("admin");
    if (input.reason.trim().length < 5) return { success: false, error: "An execution reason is required" };
    if (input.lineIds.length === 0) return { success: false, error: "Select at least one order line" };
    const admin = createAdminClient();
    const { data: request, error: readError } = await admin.from("refund_request").select("*").eq("id", input.refundRequestId).maybeSingle();
    if (readError || !request) return { success: false, error: readError?.message || "Refund request not found" };
    if (request.status !== "approved") return { success: false, error: "Refund must be approved before execution" };
    const { data: order } = await admin.from("order").select("id, application_id").eq("id", input.orderId).maybeSingle();
    if (!order || order.application_id !== request.application_id) return { success: false, error: "Order does not belong to this refund request" };
    const safeRequest = {
      application_id: request.application_id,
      status: request.status,
      amount_cents: request.amount_cents,
      currency: request.currency,
    };
    const { error: auditError } = await admin.from("admin_command_events").insert({ actor_user_id: actor.id, command: "refund.execute_requested", target_type: "refund_request", target_id: input.refundRequestId, reason: input.reason.trim(), before_state: safeRequest, after_state: { order_id: input.orderId, line_ids: input.lineIds, status: "execution_requested" } });
    if (auditError) return { success: false, error: `Refund not executed because audit failed: ${auditError.message}` };

    const output = await refundOrderLines(input.orderId, input.lineIds);
    if (!output.refundId || output.refundedCents <= 0) {
      return { success: false, error: "Selected lines are not refundable under the current policy", output };
    }
    const { error: statusError } = await admin.from("refund_request").update({ status: "refunded", stripe_refund_id: output.refundId, updated_at: new Date().toISOString() }).eq("id", input.refundRequestId).eq("status", "approved");
    const { error: completionAuditError } = await admin.from("admin_command_events").insert({ actor_user_id: actor.id, command: "refund.execute_completed", target_type: "refund_request", target_id: input.refundRequestId, reason: input.reason.trim(), before_state: safeRequest, after_state: output });
    if (statusError) {
      return { success: false, error: `Stripe refund ${output.refundId} succeeded, but request state sync failed: ${statusError.message}`, output };
    }
    if (completionAuditError) {
      return { success: false, error: `Stripe refund ${output.refundId} succeeded, but completion audit failed: ${completionAuditError.message}`, output };
    }
    revalidatePath("/admin/refunds");
    revalidatePath("/admin/billing");
    revalidatePath("/admin/orders");
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to execute refund" };
  }
}
