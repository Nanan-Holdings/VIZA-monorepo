/**
 * Notification drain worker (NOTIFY-001 / NOTIFY-002 / NOTIFY-003).
 *
 * Polls notification_event_log every 30s for outcome='queued' rows with
 * next_attempt_at <= now and retry_count < MAX_ATTEMPTS. Resolves the
 * template by template_key, dispatches via Resend (email) or Twilio
 * (sms), and updates the row.
 *
 * Failure path: increment retry_count, push next_attempt_at out by an
 * exponential backoff. After MAX_ATTEMPTS attempts mark the row
 * `failed_<reason>` and copy it to notification_dlq for manual replay.
 */

import { getSupabaseClient } from "../db/supabase-client.js";
import { resolveTemplate, validatePayload, type NotificationTemplate } from "./templates/index.js";

export const POLL_INTERVAL_MS = 30_000;
export const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [60_000, 300_000, 900_000, 1_800_000, 3_600_000];

interface QueuedEvent {
  id: number;
  applicant_id: string;
  application_id: string | null;
  event: string;
  template_key: string | null;
  channel: string;
  recipient: string | null;
  payload: Record<string, unknown> | null;
  retry_count: number;
}

interface DispatchResult {
  ok: boolean;
  externalId?: string;
  error?: string;
  retry: boolean;
}

export interface NotifyDeps {
  sendEmail?: (args: { to: string; subject: string; html: string; text: string }) => Promise<DispatchResult>;
  sendSms?: (args: { to: string; body: string }) => Promise<DispatchResult>;
  now?: () => Date;
}

const dynamicRequire: (specifier: string) => Promise<unknown> = (specifier) =>
  // eslint-disable-next-line no-new-func
  new Function("specifier", "return import(specifier)")(specifier) as Promise<unknown>;

let cachedResend: { Resend: new (key: string) => { emails: { send: (args: Record<string, unknown>) => Promise<{ data?: { id?: string }; error?: { message?: string } }> } } } | null = null;
let cachedTwilio: { default: (sid: string, token: string) => { messages: { create: (args: Record<string, unknown>) => Promise<{ sid?: string }> } } } | null = null;

async function defaultSendEmail(args: { to: string; subject: string; html: string; text: string }): Promise<DispatchResult> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, retry: false, error: "RESEND_API_KEY not set" };
  }
  if (!cachedResend) {
    cachedResend = (await dynamicRequire("resend")) as typeof cachedResend;
  }
  const resend = new cachedResend!.Resend(process.env.RESEND_API_KEY);
  try {
    const out = await resend.emails.send({
      from: process.env.RESEND_FROM || "VIZA <noreply@viza.app>",
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    if (out.error) {
      const msg = out.error.message ?? "resend failed";
      return { ok: false, retry: /5\d\d|timeout|network|rate/i.test(msg), error: msg };
    }
    return { ok: true, externalId: out.data?.id, retry: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, retry: /timeout|network|fetch|ECONN/i.test(msg), error: msg };
  }
}

async function defaultSendSms(args: { to: string; body: string }): Promise<DispatchResult> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM) {
    return { ok: false, retry: false, error: "Twilio env not set" };
  }
  if (!cachedTwilio) {
    cachedTwilio = (await dynamicRequire("twilio")) as typeof cachedTwilio;
  }
  const client = cachedTwilio!.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  try {
    const msg = await client.messages.create({ to: args.to, from: process.env.TWILIO_FROM, body: args.body });
    return { ok: true, externalId: msg.sid, retry: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, retry: /timeout|network|503|429/i.test(msg), error: msg };
  }
}

function nextAttemptIso(retryCount: number): string {
  const idx = Math.min(retryCount, BACKOFF_MS.length - 1);
  return new Date(Date.now() + BACKOFF_MS[idx]).toISOString();
}

async function dispatch(
  template: NotificationTemplate,
  event: QueuedEvent,
  deps: NotifyDeps,
): Promise<DispatchResult> {
  const payload = event.payload ?? {};
  const recipient = event.recipient ?? "";
  if (!recipient) return { ok: false, retry: false, error: "missing recipient" };
  if (event.channel === "email") {
    const send = deps.sendEmail ?? defaultSendEmail;
    return send({
      to: recipient,
      subject: template.subject(payload),
      html: template.emailHtml(payload),
      text: template.emailText(payload),
    });
  }
  if (event.channel === "sms") {
    const send = deps.sendSms ?? defaultSendSms;
    return send({ to: recipient, body: template.smsText(payload) });
  }
  return { ok: false, retry: false, error: `unsupported channel '${event.channel}'` };
}

export async function processOnce(deps: NotifyDeps = {}): Promise<{ processed: number; sent: number; dlq: number }> {
  const supabase = getSupabaseClient();
  const nowIso = (deps.now?.() ?? new Date()).toISOString();
  const { data: rows, error } = await supabase
    .from("notification_event_log")
    .select("id, applicant_id, application_id, event, template_key, channel, recipient, payload, retry_count")
    .eq("outcome", "queued")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .lt("retry_count", MAX_ATTEMPTS)
    .order("id", { ascending: true })
    .limit(50);
  if (error) {
    console.error("[notify-worker] poll failed:", error.message);
    return { processed: 0, sent: 0, dlq: 0 };
  }
  let sent = 0;
  let dlq = 0;
  for (const row of (rows ?? []) as QueuedEvent[]) {
    const template = row.template_key ? resolveTemplate(row.template_key) : null;
    if (!template) {
      await supabase
        .from("notification_event_log")
        .update({ outcome: `failed_no_template:${row.template_key ?? "(none)"}`, error: "no template" })
        .eq("id", row.id);
      continue;
    }
    const validationErr = validatePayload(template, row.payload ?? {});
    if (validationErr) {
      await supabase
        .from("notification_event_log")
        .update({ outcome: "failed_payload", error: validationErr })
        .eq("id", row.id);
      continue;
    }

    const result = await dispatch(template, row, deps);
    if (result.ok) {
      await supabase
        .from("notification_event_log")
        .update({ outcome: "sent", external_id: result.externalId, error: null })
        .eq("id", row.id);
      sent += 1;
      continue;
    }

    const nextRetryCount = row.retry_count + 1;
    if (!result.retry || nextRetryCount >= MAX_ATTEMPTS) {
      await supabase
        .from("notification_event_log")
        .update({
          outcome: `failed_${result.error?.slice(0, 60) ?? "unknown"}`,
          error: result.error ?? null,
          retry_count: nextRetryCount,
        })
        .eq("id", row.id);
      await supabase.from("notification_dlq").insert({
        source_event_id: row.id,
        applicant_id: row.applicant_id,
        application_id: row.application_id,
        template_key: template.key,
        channel: row.channel,
        recipient: row.recipient,
        payload: row.payload,
        error: result.error ?? "unknown",
        retry_count: nextRetryCount,
      });
      dlq += 1;
    } else {
      await supabase
        .from("notification_event_log")
        .update({
          retry_count: nextRetryCount,
          next_attempt_at: nextAttemptIso(nextRetryCount),
          error: result.error ?? null,
        })
        .eq("id", row.id);
    }
  }
  return { processed: rows?.length ?? 0, sent, dlq };
}

let shutdownRequested = false;

export function requestShutdown(): void {
  shutdownRequested = true;
}

export async function startWorker(): Promise<void> {
  console.log(`[notify-worker] starting — poll every ${POLL_INTERVAL_MS}ms, max ${MAX_ATTEMPTS} attempts`);
  const onSignal = (sig: NodeJS.Signals): void => {
    console.log(`[notify-worker] received ${sig} — draining current tick then exiting`);
    requestShutdown();
  };
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);

  while (!shutdownRequested) {
    try {
      const result = await processOnce();
      if (result.processed > 0) {
        console.log(
          `[notify-worker] tick processed=${result.processed} sent=${result.sent} dlq=${result.dlq}`,
        );
      }
    } catch (err) {
      console.error("[notify-worker] tick failed:", err instanceof Error ? err.message : String(err));
    }
    if (shutdownRequested) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.log("[notify-worker] drained — bye");
}
