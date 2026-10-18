"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransitionNotification } from "@/lib/notify/dispatch";
import {
  getDestinationDisplayName,
  getDestinationDisplayNameZh,
  getFormVisaType,
  getVisaTypeDisplayName,
  getVisaTypeDisplayNameZh,
} from "@/lib/visa-destinations";
import {
  RESULT_BUCKET,
  buildResultObjectPath,
  isOutcomeKind,
  planOutcomeTransition,
  validateOutcomeInput,
  type OutcomeApplicationState,
  type OutcomeInput,
} from "@/app/admin/(dashboard)/applications/outcome-transitions";

/**
 * Staff case operations: record an application outcome and email the
 * applicant. Every call writes `applications`, `application_status_history`,
 * `application_events` and (through the dispatcher) `notification_event_log`
 * plus `notification_events`.
 */

const UPLOAD_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

interface OutcomeApplicationRow extends OutcomeApplicationState {
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
}

export type RecordOutcomeResult =
  | { ok: true; toStatus: string; emailed: boolean; emailError: string | null; recipient: string | null }
  | { ok: false; error: string };

export type UploadTargetResult =
  | { ok: true; bucket: string; objectPath: string; storagePath: string; token: string }
  | { ok: false; error: string };

async function authorize() {
  return requireRole("admin", "staff");
}

function countryLabels(country: string | null, visaType: string | null) {
  const countryKey = country ?? "";
  const visaKey = getFormVisaType(visaType ?? "");
  return {
    countryLabel: countryKey ? getDestinationDisplayName(countryKey) : "your destination",
    countryLabelZh: countryKey ? getDestinationDisplayNameZh(countryKey) : "目的地",
    visaTypeLabel: visaKey ? getVisaTypeDisplayName(visaKey) : "visa",
    visaTypeLabelZh: visaKey ? getVisaTypeDisplayNameZh(visaKey) : "签证",
  };
}

/** Signed upload slot for a visa/eTA/arrival-card file, uploaded straight from the browser. */
export async function createOutcomeUploadTarget(input: {
  applicationId: string;
  filename: string;
  contentType: string;
}): Promise<UploadTargetResult> {
  try {
    await authorize();
    if (!UPLOAD_TYPES.has(input.contentType)) {
      return { ok: false, error: "Upload a PDF, JPG, PNG or WebP file." };
    }
    const admin = createAdminClient();
    const { data: application } = await admin
      .from("applications")
      .select("id")
      .eq("id", input.applicationId)
      .maybeSingle();
    if (!application) return { ok: false, error: "Application not found." };

    const objectPath = buildResultObjectPath(input.applicationId, input.filename);
    const { data, error } = await admin.storage.from(RESULT_BUCKET).createSignedUploadUrl(objectPath);
    if (error || !data) return { ok: false, error: error?.message ?? "Could not prepare the upload." };
    return {
      ok: true,
      bucket: RESULT_BUCKET,
      objectPath,
      storagePath: `${RESULT_BUCKET}/${objectPath}`,
      token: data.token,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not prepare the upload." };
  }
}

export async function recordApplicationOutcome(
  applicationId: string,
  rawInput: OutcomeInput,
): Promise<RecordOutcomeResult> {
  try {
    const actor = await authorize();
    if (!applicationId || !isOutcomeKind(rawInput?.kind)) return { ok: false, error: "Choose an outcome." };

    const validated = validateOutcomeInput(applicationId, rawInput);
    if (!validated.ok) return validated;

    const admin = createAdminClient();
    const { data, error: loadError } = await admin
      .from("applications")
      .select("id, applicant_id, status, country, visa_type, external_status, external_reference, result_status, submitted_at, submission_result")
      .eq("id", applicationId)
      .maybeSingle();
    if (loadError) return { ok: false, error: loadError.message };
    if (!data) return { ok: false, error: "Application not found." };
    const application = data as OutcomeApplicationRow;

    if (validated.value.resultStoragePath) {
      const objectPath = validated.value.resultStoragePath.slice(`${RESULT_BUCKET}/`.length);
      const folder = objectPath.slice(0, objectPath.lastIndexOf("/"));
      const name = objectPath.slice(objectPath.lastIndexOf("/") + 1);
      const { data: listed } = await admin.storage.from(RESULT_BUCKET).list(folder, { search: name, limit: 5 });
      if (!listed?.some((item) => item.name === name)) {
        return { ok: false, error: "The uploaded file was not found. Upload it again." };
      }
    }

    const plan = planOutcomeTransition(application, validated.value, actor.id);

    // Optimistic concurrency: only apply if nobody changed the status meanwhile.
    let update = admin.from("applications").update(plan.patch).eq("id", application.id);
    update = plan.fromStatus === null ? update.is("status", null) : update.eq("status", plan.fromStatus);
    const { data: updated, error: updateError } = await update.select("id");
    if (updateError) {
      const conflict = /applications_one_ongoing_country_visa_idx/.test(updateError.message);
      return {
        ok: false,
        error: conflict
          ? "This applicant already has another open application for the same destination and visa. Close that one first."
          : updateError.message,
      };
    }
    if (!updated || updated.length === 0) {
      return { ok: false, error: "The application changed while you were editing. Reload and try again." };
    }

    await admin.from("application_status_history").insert({
      application_id: application.id,
      actor_id: actor.id,
      ...plan.history,
    });
    await admin.from("application_events").insert({
      application_id: application.id,
      applicant_id: application.applicant_id,
      event_type: plan.event.event_type,
      actor_type: "admin",
      actor_id: actor.id,
      message: plan.event.message,
      metadata: {
        ...plan.event.metadata,
        outcome: validated.value.kind,
        source: "admin_outcome",
        previous_submission_result_status:
          "submission_result" in plan.patch
            ? ((application.submission_result as { status?: string } | null)?.status ?? null)
            : undefined,
      },
    });

    if (validated.value.kind !== "needs_info") {
      await resolveOpenSubmissionWork(admin, application.id, actor.id, validated.value.kind);
    }

    const notification = await sendTransitionNotification(
      application.applicant_id,
      plan.notification.event,
      {
        applicantName: "",
        applicationId: application.id,
        ...countryLabels(application.country, application.visa_type),
        detailByLocale: plan.notification.detailByLocale,
      },
      { actorId: actor.id, source: "admin_outcome" },
    );
    const emailed = notification.delivered.includes("email");
    if (emailed) {
      await admin.from("application_events").insert({
        application_id: application.id,
        applicant_id: application.applicant_id,
        event_type: "notification_sent",
        actor_type: "system",
        message: `Applicant emailed (${plan.notification.event}).`,
        metadata: { template_key: plan.notification.event, provider_message_id: notification.messageId },
      });
    }

    revalidatePath("/admin/staff-queue");
    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${application.id}`);
    revalidatePath(`/admin/applications/${application.applicant_id}`);
    revalidatePath("/client/status");

    return {
      ok: true,
      toStatus: plan.toStatus,
      emailed,
      emailError: emailed ? null : notification.suppressed ? "suppressed_by_preference" : notification.error,
      recipient: notification.recipient,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not record the outcome." };
  }
}

async function resolveOpenSubmissionWork(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  actorId: string,
  outcome: string,
) {
  const { data: open } = await admin
    .from("admin_work_items")
    .select("id, status")
    .eq("application_id", applicationId)
    .in("kind", ["submission_action_required", "manual_submission"])
    .in("status", ["open", "in_progress", "waiting_customer", "blocked"]);
  const now = new Date().toISOString();
  for (const item of open ?? []) {
    const { error } = await admin
      .from("admin_work_items")
      .update({ status: "resolved", resolution_code: `outcome_${outcome}`, resolved_at: now, updated_at: now })
      .eq("id", item.id);
    if (!error) {
      await admin.from("admin_work_item_events").insert({
        work_item_id: item.id,
        actor_user_id: actorId,
        action: "resolved",
        reason: `Outcome recorded: ${outcome}`,
        before_state: { status: item.status },
        after_state: { status: "resolved", resolution_code: `outcome_${outcome}` },
      });
    }
  }
}
