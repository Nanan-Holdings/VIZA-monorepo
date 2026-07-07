"use server";

import { withAdmin } from "@/lib/auth/with-admin";
import { sendEmail } from "@/lib/email/resend";
import {
  renderTemplate,
  type TransitionEvent,
  type TemplateContext,
} from "./templates";

/**
 * Per-applicant transition dispatcher (CS-002).
 *
 * `sendTransitionNotification(applicantId, event, ctx)` looks up the
 * applicant's preferences, suppresses non-essential opt-outs, sends
 * the email (Resend) and / or push (Expo / OneSignal — stubbed here
 * with the same env contract), and writes one row to
 * `notification_event_log` per channel attempt.
 *
 * Push is conservative: when no token / no provider, we skip without
 * logging an error.
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
}

const NON_ESSENTIAL_GUARD: Partial<Record<TransitionEvent, keyof PrefRow>> = {
  runner_started: "notify_runner_started",
  submitted: "notify_submitted",
  doc_ready: "notify_document_ready",
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
): Promise<{ delivered: Array<"email" | "push">; suppressed: boolean }> {
  return withAdmin("system", `notify:${event}`, async (admin) => {
    const { data: applicant } = await admin
      .from("applicant_profiles")
      .select("id, full_name, email")
      .eq("id", applicantId)
      .maybeSingle();
    if (!applicant) {
      return { delivered: [] as Array<"email" | "push">, suppressed: false };
    }
    const a = applicant as ApplicantRow;

    const { data: prefRow } = await admin
      .from("notification_preferences")
      .select(
        "channel_email, channel_push, notify_runner_started, notify_runner_stopped_for_input, notify_submitted, notify_document_ready, push_token, push_provider",
      )
      .eq("applicant_id", applicantId)
      .maybeSingle();
    const prefs: PrefRow =
      (prefRow as PrefRow | null) ?? {
        channel_email: true,
        channel_push: false,
        notify_runner_started: true,
        notify_runner_stopped_for_input: true,
        notify_submitted: true,
        notify_document_ready: true,
        push_token: null,
        push_provider: null,
      };

    const tpl = renderTemplate(event, {
      ...ctx,
      applicantName: ctx.applicantName || a.full_name || "there",
    });

    const guard = NON_ESSENTIAL_GUARD[event];
    if (!tpl.essential && guard && prefs[guard] === false) {
      await admin.from("notification_event_log").insert({
        applicant_id: applicantId,
        application_id: ctx.applicationId,
        event,
        channel: "suppressed",
        outcome: "suppressed_by_pref",
      });
      return { delivered: [] as Array<"email" | "push">, suppressed: true };
    }

    const delivered: Array<"email" | "push"> = [];

    if (prefs.channel_email && a.email) {
      try {
        const result = await sendEmail({
          from: "VIZA <updates@haggstorm.com>",
          to: a.email,
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
        });
        await admin.from("notification_event_log").insert({
          applicant_id: applicantId,
          application_id: ctx.applicationId,
          event,
          channel: "email",
          external_id: result.id,
          outcome: "sent",
        });
        delivered.push("email");
      } catch (err) {
        await admin.from("notification_event_log").insert({
          applicant_id: applicantId,
          application_id: ctx.applicationId,
          event,
          channel: "email",
          outcome: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

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
      });
      if (!r.error) delivered.push("push");
    }

    return { delivered, suppressed: false };
  });
}
