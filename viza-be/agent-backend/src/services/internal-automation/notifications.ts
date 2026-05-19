import type { ApplicantProfile, Application } from "../../db/schema.js";
import type { JsonValue } from "./packet-handoff.js";
import {
  normalizeLifecycleStatus,
  type InternalLifecycleStatus,
} from "./status.js";

export const NOTIFICATION_EVENTS = [
  "payment_received",
  "consent_required",
  "documents_required",
  "documents_rejected",
  "packet_ready",
  "external_submission_started",
  "application_submitted",
  "application_approved",
  "application_rejected",
  "refund_requested",
  "refund_approved",
  "refund_rejected",
  "refund_completed",
] as const;

export type NotificationLifecycleEvent = (typeof NOTIFICATION_EVENTS)[number];
export type NotificationChannel = "email" | "sms" | "wechat";

export type NotificationApplicationLike = Pick<
  Application,
  | "id"
  | "applicantId"
  | "country"
  | "visaType"
  | "status"
  | "confirmationNumber"
  | "externalReference"
  | "resultStatus"
  | "resultStoragePath"
  | "receiptUrl"
>;

export type NotificationApplicantLike = Pick<
  ApplicantProfile,
  "id" | "fullName" | "email" | "phone" | "wechat" | "languagePref"
>;

export interface BuildNotificationPayloadInput {
  event: NotificationLifecycleEvent;
  application: NotificationApplicationLike;
  applicant?: NotificationApplicantLike | null;
  lifecycleStatus?: InternalLifecycleStatus | null;
  channel?: NotificationChannel;
  recipient?: string | null;
  metadata?: Record<string, JsonValue>;
}

export interface BuiltNotificationPayload {
  applicationId: string;
  applicantId: string | null;
  channel: NotificationChannel;
  templateKey: string;
  recipient: string | null;
  status: "queued";
  payload: {
    schemaVersion: "viza.notification.v1";
    event: NotificationLifecycleEvent;
    lifecycleStatus: InternalLifecycleStatus;
    application: {
      id: string;
      country: string;
      visaType: string;
      confirmationNumber: string | null;
      externalReference: string | null;
      resultStatus: string | null;
      hasResultFile: boolean;
      hasReceipt: boolean;
    };
    customer: {
      displayName: string | null;
      languagePref: string;
    };
    metadata: Record<string, JsonValue>;
  };
}

const TEMPLATE_KEYS: Record<NotificationLifecycleEvent, string> = {
  payment_received: "internal_automation.payment_received",
  consent_required: "internal_automation.consent_required",
  documents_required: "internal_automation.documents_required",
  documents_rejected: "internal_automation.documents_rejected",
  packet_ready: "internal_automation.packet_ready",
  external_submission_started:
    "internal_automation.external_submission_started",
  application_submitted: "internal_automation.application_submitted",
  application_approved: "internal_automation.application_approved",
  application_rejected: "internal_automation.application_rejected",
  refund_requested: "internal_automation.refund_requested",
  refund_approved: "internal_automation.refund_approved",
  refund_rejected: "internal_automation.refund_rejected",
  refund_completed: "internal_automation.refund_completed",
};

export function buildNotificationPayload(
  input: BuildNotificationPayloadInput
): BuiltNotificationPayload {
  const channel = input.channel ?? "email";
  const lifecycleStatus =
    input.lifecycleStatus ??
    normalizeLifecycleStatus(input.application.status) ??
    lifecycleStatusForNotification(input.event);

  return {
    applicationId: input.application.id,
    applicantId: input.application.applicantId ?? input.applicant?.id ?? null,
    channel,
    templateKey: TEMPLATE_KEYS[input.event],
    recipient: input.recipient ?? selectRecipient(channel, input.applicant),
    status: "queued",
    payload: {
      schemaVersion: "viza.notification.v1",
      event: input.event,
      lifecycleStatus,
      application: {
        id: input.application.id,
        country: input.application.country,
        visaType: input.application.visaType,
        confirmationNumber: input.application.confirmationNumber,
        externalReference: input.application.externalReference,
        resultStatus: input.application.resultStatus,
        hasResultFile: Boolean(input.application.resultStoragePath),
        hasReceipt: Boolean(input.application.receiptUrl),
      },
      customer: {
        displayName: input.applicant?.fullName ?? null,
        languagePref: input.applicant?.languagePref ?? "en",
      },
      metadata: input.metadata ?? {},
    },
  };
}

export function templateKeyForNotificationEvent(
  event: NotificationLifecycleEvent
): string {
  return TEMPLATE_KEYS[event];
}

function selectRecipient(
  channel: NotificationChannel,
  applicant: NotificationApplicantLike | null | undefined
): string | null {
  if (!applicant) return null;
  if (channel === "sms") return applicant.phone;
  if (channel === "wechat") return applicant.wechat;
  return applicant.email;
}

function lifecycleStatusForNotification(
  event: NotificationLifecycleEvent
): InternalLifecycleStatus {
  if (event === "payment_received") return "awaiting_consent";
  if (event === "consent_required") return "awaiting_consent";
  if (event === "documents_required" || event === "documents_rejected") {
    return "awaiting_documents";
  }
  if (event === "packet_ready") return "packet_ready";
  if (event === "external_submission_started") {
    return "external_submission_in_progress";
  }
  if (event === "application_submitted") return "submitted";
  if (event === "application_approved") return "approved";
  if (event === "application_rejected") return "rejected";
  return "draft";
}

