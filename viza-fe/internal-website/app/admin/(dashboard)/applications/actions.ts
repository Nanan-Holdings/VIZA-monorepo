"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildStatusSummary, fetchAdminApplicationDetail } from "./data";

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function safeReturnTo(value: string, applicationId: string): string {
  if (value.startsWith(`/admin/applications/${applicationId}`)) return value;
  return `/admin/applications/${applicationId}`;
}

function withResultParam(returnTo: string, key: string): string {
  const separator = returnTo.includes("?") ? "&" : "?";
  return `${returnTo}${separator}${key}=1`;
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
