"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

type ReviewResult = { success: true } | { success: false; error: string };

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
