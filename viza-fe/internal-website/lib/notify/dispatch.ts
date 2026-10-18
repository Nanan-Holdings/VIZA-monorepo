import "server-only";

import { withAdmin } from "@/lib/auth/with-admin";
import { sendEmail } from "@/lib/email/resend";
import {
  renderTemplate,
  type TemplateLocale,
  type TransitionEvent,
  type TemplateContext,
} from "./templates";
import { resolveApplicantLocale, resolveNotifyFrom, senderDomain } from "./sender";

/**
 * Per-applicant transition dispatcher (CS-002).
 *
 * `sendTransitionNotification(applicantId, event, ctx)` looks up the
 * applicant's preferences and locale, suppresses non-essential opt-outs,
 * sends the email (Resend) and / or push (Expo), and records every
 * attempt twice:
 *
 *   - `notification_event_log`: one row per channel attempt (ops log).
 *   - `notification_events`: the applicant-visible notification record
 *     that `/client/status` counts.
 *
 * Server-only on purpose: this module runs with the service role and
 * must never be reachable as a server action from the browser.
 */

interface PrefRow {
  channel_email: boolean;
  channel_push: boolean;
  notify_runner_started: boolean;
  notify_runner_stopped_for_input: boolean;
  notify_submitted: boolean;
  notify_document_ready: boolean;
  push_token: string | null;
  push_provider: string | null;
}

interface ApplicantRow {
  id: string;
  full_name: string | null;
  email: string | null;
  auth_user_id: string | null;
  language_pref: string | null;
  nationality: string | null;
}

export interface DispatchOptions {
  /** Who triggered the email, for the audit payload. */
  actorId?: string | null;
  /** Code path, e.g. "admin_outcome" or "external_submission". */
  source?: string;
  /** Force a locale instead of the applicant's preference. */
  locale?: TemplateLocale;
}

export interface DispatchResult {
  delivered: Array<"email" | "push">;
  suppressed: boolean;
  recipient: string | null;
  messageId: string | null;
  error: string | null;
  locale: TemplateLocale;
}

const NON_ESSENTIAL_GUARD: Partial<Record<TransitionEvent, keyof PrefRow>> = {
  runner_started: "notify_runner_started",
  submitted: "notify_submitted",
  doc_ready: "notify_document_ready",
};

const DEFAULT_PREFS: PrefRow = {
  channel_email: true,
  channel_push: false,
  notify_runner_started: true,
  notify_runner_stopped_for_input: true,
  notify_submitted: true,
  notify_document_ready: true,
  push_token: null,
  push_provider: null,
};

async function sendPushExpo(
  token: string,
  subject: string,
  body: string,
): Promise<{ id?: string; error?: string }> {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      to: token,
      title: subject,
      body,
      sound: "default",
    }),
  });
  if (!res.ok) {
    return { error: `expo ${res.status}` };
  }
  const json = (await res.json()) as { data?: { id?: string } };
  return { id: json.data?.id };
}

export async function sendTransitionNotification(
  applicantId: string,
  event: TransitionEvent,
  ctx: TemplateContext,
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  return withAdmin("system", `notify:${event}`, async (admin) => {
    const { data: applicant } = await admin
      .from("applicant_profiles")
      .select("id, full_name, email, auth_user_id, language_pref, nationality")
      .eq("id", applicantId)
      .maybeSingle();
    if (!applicant) {
      return {
        delivered: [],
        suppressed: false,
        recipient: null,
        messageId: null,
        error: "applicant_not_found",
        locale: options.locale ?? "en",
      } satisfies DispatchResult;
    }
    const a = applicant as ApplicantRow;
    const locale = options.locale ?? resolveApplicantLocale(a.language_pref, a.nationality);

    let recipient = a.email?.trim() || null;
    if (!recipient && a.auth_user_id) {
      const { data: authUser } = await admin.auth.admin.getUserById(a.auth_user_id);
      recipient = authUser?.user?.email?.trim() || null;
    }

    const { data: prefRow } = await admin
      .from("notification_preferences")
      .select(
        "channel_email, channel_push, notify_runner_started, notify_runner_stopped_for_input, notify_submitted, notify_document_ready, push_token, push_provider",
      )
      .eq("applicant_id", applicantId)
      .maybeSingle();
    const prefs: PrefRow = (prefRow as PrefRow | null) ?? DEFAULT_PREFS;

    const tpl = renderTemplate(
      event,
      {
        ...ctx,
        applicantName: ctx.applicantName || a.full_name || (locale === "zh-CN" ? "您" : "there"),
      },
      locale,
    );
    const from = resolveNotifyFrom();
    const now = new Date().toISOString();
    const auditPayload = {
      subject: tpl.subject,
      locale,
      from_domain: senderDomain(from),
      source: options.source ?? "system",
      actor_id: options.actorId ?? null,
      detail: ctx.detail ?? null,
    };

    const guard = NON_ESSENTIAL_GUARD[event];
    if (!tpl.essential && guard && prefs[guard] === false) {
      await admin.from("notification_event_log").insert({
        applicant_id: applicantId,
        application_id: ctx.applicationId,
        event,
        channel: "suppressed",
        outcome: "suppressed_by_pref",
        template_key: event,
        recipient,
        payload: auditPayload,
      });
      return {
        delivered: [],
        suppressed: true,
        recipient,
        messageId: null,
        error: null,
        locale,
      } satisfies DispatchResult;
    }

    const delivered: Array<"email" | "push"> = [];
    let messageId: string | null = null;
    let emailError: string | null = null;

    if (!prefs.channel_email) {
      emailError = "email_channel_disabled";
    } else if (!recipient) {
      emailError = "no_recipient_email";
    } else {
      try {
        const result = await sendEmail({
          from,
          to: recipient,
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
        });
        messageId = result.id;
        delivered.push("email");
      } catch (err) {
        emailError = err instanceof Error ? err.message : String(err);
      }
    }

    await admin.from("notification_event_log").insert({
      applicant_id: applicantId,
      application_id: ctx.applicationId,
      event,
      channel: "email",
      external_id: messageId,
      outcome: messageId ? "sent" : "error",
      error: emailError,
      template_key: event,
      recipient,
      payload: auditPayload,
    });
    await admin.from("notification_events").insert({
      application_id: ctx.applicationId,
      applicant_id: applicantId,
      auth_user_id: a.auth_user_id,
      channel: "email",
      template_key: event,
      recipient,
      status: messageId ? "sent" : "failed",
      provider: "resend",
      provider_message_id: messageId,
      error_message: emailError,
      payload: auditPayload,
      sent_at: messageId ? now : null,
      updated_at: now,
    });

    if (prefs.channel_push && prefs.push_token && prefs.push_provider === "expo") {
      const r = await sendPushExpo(prefs.push_token, tpl.subject, tpl.text);
      await admin.from("notification_event_log").insert({
        applicant_id: applicantId,
        application_id: ctx.applicationId,
        event,
        channel: "push",
        external_id: r.id ?? null,
        outcome: r.error ? "error" : "sent",
        error: r.error ?? null,
        template_key: event,
        payload: auditPayload,
      });
      if (!r.error) delivered.push("push");
    }

    return {
      delivered,
      suppressed: false,
      recipient,
      messageId,
      error: emailError,
      locale,
    } satisfies DispatchResult;
  });
}
