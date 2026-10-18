/**
 * Pure planning for staff-recorded application outcomes.
 *
 * Staff take a case from "needs a human" to a result with four actions:
 * submitted to the government, approved (visa file attached), refused,
 * or more information needed from the applicant. Each plan is the exact
 * `applications` patch, the `application_status_history` row, the
 * customer-visible `application_events` row and the email to send.
 *
 * The patches only write fields `/client/status` already reads
 * (`status`, `external_status`, `external_reference`, `submitted_at`,
 * `result_status`, `result_storage_path`, `result_notes`), with values
 * from its approved/refused/attention allowlists, so the applicant sees
 * the change without any client change.
 */

import type { TransitionEvent } from "@/lib/notify/templates";

export const OUTCOME_KINDS = ["submitted", "approved", "refused", "needs_info"] as const;
export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

/** Bucket and folder staff result uploads land in. */
export const RESULT_BUCKET = "application-documents";
export const RESULT_FOLDER = "results";

/** Raw status while VIZA waits on the applicant. Counts as an ongoing application. */
export const AWAITING_APPLICANT_STATUS = "awaiting_applicant";

const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/# -]{0,127}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 2000;

export interface OutcomeInput {
  kind: OutcomeKind;
  /** Government reference / application number (submitted). */
  reference?: string | null;
  /** Date it was submitted to the government, YYYY-MM-DD (submitted). */
  submittedOn?: string | null;
  /** Storage reference "application-documents/results/<appId>/<file>" (approved, optional for refused). */
  resultStoragePath?: string | null;
  /** Refusal reason given by the authority (refused). */
  reason?: string | null;
  /** What the applicant must provide (needs_info). */
  message?: string | null;
}

export interface OutcomeApplicationState {
  id: string;
  status: string | null;
  external_status: string | null;
  external_reference: string | null;
  result_status: string | null;
  submitted_at: string | null;
}

export interface OutcomePlan {
  fromStatus: string | null;
  toStatus: string;
  patch: Record<string, string | null>;
  history: {
    from_status: string | null;
    to_status: string;
    actor_kind: "staff";
    reason: OutcomeKind;
    metadata: Record<string, string | null>;
  };
  event: {
    event_type: string;
    message: string;
    metadata: Record<string, string | null>;
  };
  notification: {
    event: TransitionEvent;
    detailByLocale?: { en: string; "zh-CN": string };
  };
}

export type ValidatedOutcome =
  | { ok: true; value: OutcomeInput }
  | { ok: false; error: string };

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function isOutcomeKind(value: unknown): value is OutcomeKind {
  return typeof value === "string" && (OUTCOME_KINDS as readonly string[]).includes(value);
}

export function resultPathPrefix(applicationId: string): string {
  return `${RESULT_BUCKET}/${RESULT_FOLDER}/${applicationId}/`;
}

/** Storage object path (inside the bucket) for a new staff upload. */
export function buildResultObjectPath(applicationId: string, filename: string, now: Date = new Date()): string {
  const base = filename.split(/[\\/]/).pop() ?? "result";
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "result";
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
  return `${RESULT_FOLDER}/${applicationId}/${stamp}-${stem}${ext ? `.${ext}` : ""}`;
}

export function validateOutcomeInput(
  applicationId: string,
  input: OutcomeInput,
  today: Date = new Date(),
): ValidatedOutcome {
  if (!isOutcomeKind(input.kind)) return { ok: false, error: "Choose an outcome." };

  const resultPath = clean(input.resultStoragePath);
  if (resultPath && !resultPath.startsWith(resultPathPrefix(applicationId))) {
    return { ok: false, error: "The result file does not belong to this application." };
  }
  if (resultPath.includes("..")) return { ok: false, error: "Invalid result file path." };

  switch (input.kind) {
    case "submitted": {
      const reference = clean(input.reference);
      if (!REFERENCE_PATTERN.test(reference)) {
        return { ok: false, error: "Enter the government reference (letters, numbers, . _ : / # - and spaces, up to 128 characters)." };
      }
      const submittedOn = clean(input.submittedOn);
      if (submittedOn) {
        if (!DATE_PATTERN.test(submittedOn) || Number.isNaN(Date.parse(`${submittedOn}T00:00:00Z`))) {
          return { ok: false, error: "Enter the submission date as YYYY-MM-DD." };
        }
        const tomorrow = new Date(today.getTime() + 36 * 3600_000).toISOString().slice(0, 10);
        if (submittedOn > tomorrow) return { ok: false, error: "The submission date cannot be in the future." };
      }
      return { ok: true, value: { kind: "submitted", reference, submittedOn: submittedOn || null } };
    }
    case "approved":
      if (!resultPath) return { ok: false, error: "Upload the visa, eTA or arrival card file first." };
      return { ok: true, value: { kind: "approved", resultStoragePath: resultPath, reference: clean(input.reference) || null } };
    case "refused": {
      const reason = clean(input.reason);
      if (!reason) return { ok: false, error: "Enter the refusal reason." };
      if (reason.length > MAX_TEXT) return { ok: false, error: `Keep the reason under ${MAX_TEXT} characters.` };
      return { ok: true, value: { kind: "refused", reason, resultStoragePath: resultPath || null } };
    }
    case "needs_info": {
      const message = clean(input.message);
      if (!message) return { ok: false, error: "Enter what the applicant needs to provide." };
      if (message.length > MAX_TEXT) return { ok: false, error: `Keep the message under ${MAX_TEXT} characters.` };
      return { ok: true, value: { kind: "needs_info", message } };
    }
  }
}

/** Midnight Singapore time for a staff-entered calendar date. */
export function submittedOnToTimestamp(submittedOn: string): string {
  return new Date(`${submittedOn}T00:00:00+08:00`).toISOString();
}

function formatDisplayDate(iso: string, locale: "en" | "zh-CN"): string {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-SG", {
    dateStyle: "long",
    timeZone: "Asia/Singapore",
  }).format(new Date(iso));
}

export function planOutcomeTransition(
  application: OutcomeApplicationState,
  input: OutcomeInput,
  actorId: string,
  now: Date = new Date(),
): OutcomePlan {
  const nowIso = now.toISOString();
  const fromStatus = application.status;
  const clearsAttention = (application.result_status ?? "").toLowerCase() === "needs_attention";
  const audit = { actor_id: actorId, recorded_at: nowIso };

  switch (input.kind) {
    case "submitted": {
      const reference = clean(input.reference);
      const submittedAt = input.submittedOn
        ? submittedOnToTimestamp(input.submittedOn)
        : application.submitted_at ?? nowIso;
      const patch: Record<string, string | null> = {
        status: "submitted",
        external_status: "submitted",
        external_reference: reference,
        external_status_updated_at: nowIso,
        submitted_at: submittedAt,
        staff_review_status: "completed",
        staff_reviewed_at: nowIso,
        staff_reviewed_by: actorId,
        updated_at: nowIso,
      };
      if (clearsAttention) {
        patch.result_status = null;
        patch.result_notes = null;
      }
      const metadata = { ...audit, external_reference: reference, submitted_at: submittedAt };
      return {
        fromStatus,
        toStatus: "submitted",
        patch,
        history: { from_status: fromStatus, to_status: "submitted", actor_kind: "staff", reason: "submitted", metadata },
        event: {
          event_type: "external_status_updated",
          message: `Staff recorded government submission (reference ${reference}).`,
          metadata,
        },
        notification: {
          event: "submitted",
          detailByLocale: {
            en: `The VIZA team submitted it to the government on ${formatDisplayDate(submittedAt, "en")}. Your government reference is ${reference}. We will email you as soon as there is a decision.`,
            "zh-CN": `VIZA 团队已于 ${formatDisplayDate(submittedAt, "zh-CN")} 向官方递交，官方申请编号为 ${reference}。一有结果我们会立即邮件通知您。`,
          },
        },
      };
    }
    case "approved": {
      const path = clean(input.resultStoragePath);
      const patch: Record<string, string | null> = {
        status: "approved",
        result_status: "approved",
        result_storage_path: path,
        result_notes: null,
        external_status: "completed",
        external_status_updated_at: nowIso,
        staff_review_status: "completed",
        staff_reviewed_at: nowIso,
        staff_reviewed_by: actorId,
        updated_at: nowIso,
      };
      const reference = clean(input.reference);
      if (reference) patch.external_reference = reference;
      if (!application.submitted_at) patch.submitted_at = nowIso;
      const metadata = { ...audit, result_storage_path: path };
      return {
        fromStatus,
        toStatus: "approved",
        patch,
        history: { from_status: fromStatus, to_status: "approved", actor_kind: "staff", reason: "approved", metadata },
        event: { event_type: "result_received", message: "Staff recorded an approval and attached the visa document.", metadata },
        notification: { event: "visa_approved" },
      };
    }
    case "refused": {
      const reason = clean(input.reason);
      const path = clean(input.resultStoragePath);
      const patch: Record<string, string | null> = {
        status: "rejected",
        result_status: "refused",
        result_notes: reason,
        external_status: "completed",
        external_status_updated_at: nowIso,
        staff_review_status: "completed",
        staff_reviewed_at: nowIso,
        staff_reviewed_by: actorId,
        updated_at: nowIso,
      };
      if (path) patch.result_storage_path = path;
      if (!application.submitted_at) patch.submitted_at = nowIso;
      const metadata = { ...audit, result_storage_path: path || null };
      return {
        fromStatus,
        toStatus: "rejected",
        patch,
        history: { from_status: fromStatus, to_status: "rejected", actor_kind: "staff", reason: "refused", metadata: { ...metadata, refusal_reason: reason } },
        event: { event_type: "result_received", message: "Staff recorded a refusal.", metadata },
        notification: {
          event: "visa_refused",
          detailByLocale: {
            en: `The reason given was: ${reason}. Reply to this email or contact VIZA support if you would like help with next steps.`,
            "zh-CN": `官方给出的原因：${reason}。如需协助了解后续步骤，请直接回复本邮件或联系 VIZA 客服。`,
          },
        },
      };
    }
    case "needs_info": {
      const message = clean(input.message);
      const patch: Record<string, string | null> = {
        status: AWAITING_APPLICANT_STATUS,
        result_status: "needs_attention",
        result_notes: message,
        staff_review_status: "awaiting_applicant",
        staff_reviewed_at: nowIso,
        staff_reviewed_by: actorId,
        updated_at: nowIso,
      };
      const metadata = { ...audit };
      return {
        fromStatus,
        toStatus: AWAITING_APPLICANT_STATUS,
        patch,
        history: { from_status: fromStatus, to_status: AWAITING_APPLICANT_STATUS, actor_kind: "staff", reason: "needs_info", metadata: { ...metadata, message } },
        event: { event_type: "more_information_requested", message: "Staff asked the applicant for more information.", metadata },
        notification: { event: "info_requested", detailByLocale: { en: message, "zh-CN": message } },
      };
    }
  }
}

type LifecycleKey =
  | "intake"
  | "consent_pending"
  | "document_collection"
  | "packet_generation"
  | "ready_for_external_handoff"
  | "external_submission"
  | "result_delivery"
  | "completed"
  | "attention";

const LIFECYCLE_SENTENCES: Record<LifecycleKey, { en: string; "zh-CN": string }> = {
  intake: {
    en: "Your application is started. Please finish the form in your VIZA portal so we can continue.",
    "zh-CN": "您的申请已创建，请在 VIZA 客户端完成表格，以便我们继续办理。",
  },
  consent_pending: {
    en: "We are waiting for your consent and signature in the VIZA portal before we can continue.",
    "zh-CN": "我们正在等待您在 VIZA 客户端确认授权并签名，完成后即可继续办理。",
  },
  document_collection: {
    en: "We are waiting for some documents. Please upload them in your VIZA portal.",
    "zh-CN": "我们还在等待部分材料，请在 VIZA 客户端上传。",
  },
  packet_generation: {
    en: "We have what we need and are preparing your application package.",
    "zh-CN": "材料已齐全，我们正在准备您的申请材料包。",
  },
  ready_for_external_handoff: {
    en: "Your application is ready and queued for submission to the government.",
    "zh-CN": "您的申请已准备就绪，正在排队等待向官方递交。",
  },
  external_submission: {
    en: "Your application is with the government. We will email you as soon as there is a decision.",
    "zh-CN": "您的申请已递交官方审理，一有结果我们会立即邮件通知您。",
  },
  result_delivery: {
    en: "A decision has arrived and we are preparing your documents.",
    "zh-CN": "官方结果已出，我们正在为您准备相关文件。",
  },
  completed: {
    en: "Your application is complete. You can find everything in your VIZA portal.",
    "zh-CN": "您的申请已办结，所有文件均可在 VIZA 客户端查看。",
  },
  attention: {
    en: "Your application needs your attention. Please open your VIZA portal to see what is needed.",
    "zh-CN": "您的申请需要您处理，请打开 VIZA 客户端查看具体事项。",
  },
};

/** Customer-safe status line for the admin "status email" button. */
export function customerStatusDetail(lifecycleState: string): { en: string; "zh-CN": string } {
  return LIFECYCLE_SENTENCES[lifecycleState as LifecycleKey] ?? LIFECYCLE_SENTENCES.intake;
}
