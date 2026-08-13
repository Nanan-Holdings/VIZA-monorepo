/**
 * Notification drain worker (NOTIFY-001 / NOTIFY-002 / NOTIFY-003).
 *
 * Atomically claims notification_event_log rows through a leased RPC. Resolves
 * the template by template_key, dispatches via Resend (email) or Twilio (sms),
 * then conditionally acknowledges or rejects the row while this process still
 * owns its lease.
 *
 * Failure path: increment retry_count, push next_attempt_at out by an
 * exponential backoff. After MAX_ATTEMPTS attempts mark the row
 * `failed_<reason>` and copy it to notification_dlq for manual replay.
 */

import { getSupabaseClient } from "../db/supabase-client.js";
import { resolveTemplate, validatePayload, type NotificationTemplate } from "./templates/index.js";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";

export const POLL_INTERVAL_MS = 30_000;
export const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [60_000, 300_000, 900_000, 1_800_000, 3_600_000];
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_LEASE_SECONDS = 900;
const PROCESS_WORKER_ID =
  process.env.NOTIFICATION_WORKER_ID?.trim() ||
  `notify-${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;

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
  client?: NotificationRpcClient;
  workerId?: string;
  batchSize?: number;
  leaseSeconds?: number;
}

interface RpcError {
  message: string;
}

interface RpcResult<T> {
  data: T;
  error: RpcError | null;
}

export interface NotificationRpcClient {
  rpc(
    name:
      | "claim_notification_event_batch"
      | "ack_notification_event"
      | "nack_notification_event",
    args: Record<string, unknown>,
  ): PromiseLike<RpcResult<unknown>>;
}

const dynamicRequire: (specifier: string) => Promise<unknown> = (specifier) =>
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

function nextAttemptIso(retryCount: number, now: Date): string {
  const idx = Math.min(retryCount, BACKOFF_MS.length - 1);
  return new Date(now.getTime() + BACKOFF_MS[idx]).toISOString();
}

function boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(Math.floor(value!), maximum));
}

function failureCode(value: string | undefined): string {
  const normalized = (value ?? "delivery")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return normalized || "delivery";
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
  const client = deps.client ?? getSupabaseClient();
  const workerId = deps.workerId?.trim() || PROCESS_WORKER_ID;
  const batchSize = boundedInteger(deps.batchSize, DEFAULT_BATCH_SIZE, 1, 100);
  const leaseSeconds = boundedInteger(deps.leaseSeconds, DEFAULT_LEASE_SECONDS, 30, 3_600);
  const now = deps.now?.() ?? new Date();
  const { data, error } = await client.rpc("claim_notification_event_batch", {
    p_worker_id: workerId,
    p_limit: batchSize,
    p_lease_seconds: leaseSeconds,
  });
  if (error) {
    console.error("[notify-worker] claim failed:", error.message);
    return { processed: 0, sent: 0, dlq: 0 };
  }
  const rows = (Array.isArray(data) ? data : []) as QueuedEvent[];
  let sent = 0;
  let dlq = 0;
  for (const row of rows) {
    const template = row.template_key ? resolveTemplate(row.template_key) : null;
    if (!template) {
      const { data: settled, error: nackError } = await client.rpc("nack_notification_event", {
        p_event_id: row.id,
        p_worker_id: workerId,
        p_error: `no template: ${row.template_key ?? "(none)"}`,
        p_retry_count: row.retry_count + 1,
        p_next_attempt_at: null,
        p_terminal: true,
        p_failure_code: "no_template",
      });
      if (nackError) console.error(`[notify-worker] nack ${row.id} failed:`, nackError.message);
      if (settled === true) dlq += 1;
      continue;
    }
    const validationErr = validatePayload(template, row.payload ?? {});
    if (validationErr) {
      const { data: settled, error: nackError } = await client.rpc("nack_notification_event", {
        p_event_id: row.id,
        p_worker_id: workerId,
        p_error: validationErr,
        p_retry_count: row.retry_count + 1,
        p_next_attempt_at: null,
        p_terminal: true,
        p_failure_code: "payload",
      });
      if (nackError) console.error(`[notify-worker] nack ${row.id} failed:`, nackError.message);
      if (settled === true) dlq += 1;
      continue;
    }

    const result = await dispatch(template, row, deps);
    if (result.ok) {
      const { data: settled, error: ackError } = await client.rpc("ack_notification_event", {
        p_event_id: row.id,
        p_worker_id: workerId,
        p_external_id: result.externalId ?? null,
      });
      if (ackError) console.error(`[notify-worker] ack ${row.id} failed:`, ackError.message);
      if (settled === true) {
        sent += 1;
      } else if (!ackError) {
        console.warn(`[notify-worker] ack ${row.id} rejected because its lease was lost or expired`);
      }
      continue;
    }

    const nextRetryCount = row.retry_count + 1;
    const terminal = !result.retry || nextRetryCount >= MAX_ATTEMPTS;
    const { data: settled, error: nackError } = await client.rpc("nack_notification_event", {
      p_event_id: row.id,
      p_worker_id: workerId,
      p_error: result.error ?? "unknown",
      p_retry_count: nextRetryCount,
      p_next_attempt_at: terminal ? null : nextAttemptIso(nextRetryCount, now),
      p_terminal: terminal,
      p_failure_code: failureCode(result.error),
    });
    if (nackError) {
      console.error(`[notify-worker] nack ${row.id} failed:`, nackError.message);
    } else if (settled !== true) {
      console.warn(`[notify-worker] nack ${row.id} rejected because its lease was lost or expired`);
    } else if (terminal) {
      dlq += 1;
    }
  }
  return { processed: rows.length, sent, dlq };
}

let shutdownRequested = false;

export function requestShutdown(): void {
  shutdownRequested = true;
}

export async function startWorker(): Promise<void> {
  console.log(
    `[notify-worker] starting worker=${PROCESS_WORKER_ID} — poll every ${POLL_INTERVAL_MS}ms, max ${MAX_ATTEMPTS} attempts`,
  );
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
