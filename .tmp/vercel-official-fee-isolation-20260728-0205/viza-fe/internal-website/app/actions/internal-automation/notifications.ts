"use server";

import { revalidatePath } from "next/cache";
import {
  APPLICATION_AUTOMATION_SELECT,
  getAdminAutomationContext,
  getCustomerAutomationContext,
  getOwnedApplication,
  insertApplicationEvent,
  type ApplicationAutomationRow,
  type NotificationEventRow,
} from "./db";
import {
  readApplicantNotifications,
  readApplicationAutomationBundles,
  summarizeNotificationEvent,
} from "./read-model";
import {
  actionErrorMessage,
  actionFail,
  actionOk,
  type AutomationActionResult,
  type AutomationJson,
  type NotificationEventSummary,
} from "./types";

function mergeIdempotencyKey(
  payload: AutomationJson | undefined,
  idempotencyKey: string | undefined,
): AutomationJson | null {
  if (!payload && !idempotencyKey) return null;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return idempotencyKey ? { ...payload, idempotencyKey } : payload;
  }
  return {
    value: payload ?? null,
    idempotencyKey,
  };
}

export async function getCustomerNotificationEvents(input: {
  applicationId?: string;
} = {}): Promise<AutomationActionResult<NotificationEventSummary[]>> {
  try {
    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

    if (input.applicationId) {
      const applicationResult = await getOwnedApplication(
        contextResult.data.adminClient,
        contextResult.data.applicantId,
        input.applicationId,
      );
      if (!applicationResult.ok) return applicationResult;

      const bundlesResult = await readApplicationAutomationBundles(
        contextResult.data.adminClient,
        [applicationResult.data],
      );
      if (!bundlesResult.ok) return bundlesResult;

      return actionOk(
        (bundlesResult.data[0]?.notifications ?? []).map(summarizeNotificationEvent),
      );
    }

    const notificationsResult = await readApplicantNotifications(
      contextResult.data.adminClient,
      contextResult.data.applicantId,
    );
    if (!notificationsResult.ok) return notificationsResult;

    return actionOk(notificationsResult.data.map(summarizeNotificationEvent));
  } catch (error) {
    console.error(
      "[getCustomerNotificationEvents]",
      actionErrorMessage(error, "Unexpected notification read error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load notification events.");
  }
}

export async function recordAdminNotificationEvent(input: {
  applicationId?: string;
  applicantId?: string;
  channel?: string;
  templateKey: string;
  recipient?: string;
  status?: string;
  payload?: AutomationJson;
  idempotencyKey?: string;
}): Promise<AutomationActionResult<NotificationEventSummary>> {
  try {
    const templateKey = input.templateKey?.trim();
    const channel = input.channel?.trim() || "email";
    const status = input.status?.trim() || "queued";
    const idempotencyKey = input.idempotencyKey?.trim() || undefined;

    if (!templateKey) {
      return actionFail("VALIDATION_ERROR", "templateKey is required.");
    }

    if (!input.applicationId && !input.applicantId) {
      return actionFail(
        "VALIDATION_ERROR",
        "applicationId or applicantId is required.",
      );
    }

    const contextResult = await getAdminAutomationContext();
    if (!contextResult.ok) return contextResult;

    let application: ApplicationAutomationRow | null = null;
    let applicantId = input.applicantId ?? null;

    if (input.applicationId) {
      const { data, error } = await contextResult.data.adminClient
        .from<ApplicationAutomationRow>("applications")
        .select(APPLICATION_AUTOMATION_SELECT)
        .eq("id", input.applicationId)
        .maybeSingle();

      if (error) {
        return actionFail("DB_ERROR", "Could not load application.");
      }
      if (!data) {
        return actionFail("NOT_FOUND", "Application was not found.");
      }

      application = data;
      applicantId = data.applicant_id;
    }

    if (idempotencyKey && application) {
      const { data: existing, error } = await contextResult.data.adminClient
        .from<NotificationEventRow>("notification_events")
        .select(
          "id, application_id, applicant_id, channel, template_key, recipient, status, payload, sent_at, created_at, updated_at",
        )
        .eq("application_id", application.id)
        .eq("channel", channel)
        .eq("template_key", templateKey)
        .eq("payload->>idempotencyKey", idempotencyKey)
        .limit(1)
        .maybeSingle();

      if (error) {
        return actionFail("DB_ERROR", "Could not verify notification event.");
      }
      if (existing) {
        return actionOk(summarizeNotificationEvent(existing));
      }
    }

    const { data, error } = await contextResult.data.adminClient
      .from<NotificationEventRow>("notification_events")
      .insert({
        application_id: application?.id ?? null,
        applicant_id: applicantId,
        channel,
        template_key: templateKey,
        recipient: input.recipient?.trim() || null,
        status,
        payload: mergeIdempotencyKey(input.payload, idempotencyKey),
      })
      .select(
        "id, application_id, applicant_id, channel, template_key, recipient, status, payload, sent_at, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      return actionFail("DB_ERROR", "Could not record notification event.");
    }

    if (application) {
      await insertApplicationEvent(contextResult.data.adminClient, {
        applicationId: application.id,
        applicantId,
        eventType: "notification_event_recorded",
        actorType: "staff",
        actorId: contextResult.data.adminUser.id,
        message: "Staff recorded a notification event.",
        metadata: {
          notification_event_id: data.id,
          template_key: templateKey,
          channel,
          status,
        },
      });
    }

    revalidatePath("/admin/applications");
    revalidatePath("/admin/billing");

    return actionOk(summarizeNotificationEvent(data));
  } catch (error) {
    console.error(
      "[recordAdminNotificationEvent]",
      actionErrorMessage(error, "Unexpected notification record error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not record notification event.");
  }
}
