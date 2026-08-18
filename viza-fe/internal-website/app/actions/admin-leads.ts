"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";
type Result = { success: true } | { success: false; error: string };

export async function updateAdminLead(input: {
  leadId: string;
  status: LeadStatus;
  reason: string;
  assignToMe?: boolean;
}): Promise<Result> {
  try {
    const actor = await requireRole("admin", "staff", "customer_service");
    if (!input.reason.trim()) return { success: false, error: "A reason or contact note is required" };
    const admin = createAdminClient();
    const { data: before, error: readError } = await admin.from("marketing_leads").select("*").eq("id", input.leadId).maybeSingle();
    if (readError || !before) return { success: false, error: readError?.message || "Lead not found" };
    const now = new Date().toISOString();
    const changes: Record<string, unknown> = { status: input.status, updated_at: now };
    if (input.assignToMe || !before.assigned_to) changes.assigned_to = actor.id;
    if (input.status === "contacted" && !before.first_response_at) changes.first_response_at = now;
    if (input.status === "lost") changes.loss_reason = input.reason.trim();
    const { error: auditError } = await admin.from("admin_command_events").insert({
      actor_user_id: actor.id,
      command: `marketing_lead.${input.status}`,
      target_type: "marketing_leads",
      target_id: input.leadId,
      reason: input.reason.trim(),
      before_state: {
        status: before.status,
        assigned_to: before.assigned_to,
        first_response_at: before.first_response_at,
        due_at: before.due_at,
      },
      after_state: changes,
    });
    if (auditError) return { success: false, error: `Lead not updated because audit failed: ${auditError.message}` };
    const { error: updateError } = await admin.from("marketing_leads").update(changes).eq("id", input.leadId);
    if (updateError) return { success: false, error: updateError.message };
    revalidatePath("/admin/leads");
    revalidatePath("/admin/work");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to update lead" };
  }
}
