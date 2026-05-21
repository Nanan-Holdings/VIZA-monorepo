import { supabase } from "../supabase.js";

/**
 * `inbox.waitForMessage` (INBOX-003).
 *
 * Resolves with the first inbound mail row addressed to the applicant's
 * alias for which `predicate` returns true, or rejects with `InboxTimeoutError`
 * after `timeoutMs`. Replaces the IMAP polling loop in
 * src/email/imap-poll.ts for new flows.
 *
 * Implementation: short-poll the `inbound_email` table joined to the
 * applicant's `inbox_alias`. The polling cadence (default 5 s) trades a
 * small worst-case latency for not needing a Supabase Realtime websocket
 * in the runner, which keeps the dependency surface small. A future
 * patch can swap to Supabase Realtime without changing the public API.
 */

export interface InboundMessage {
  id: string;
  to_addr: string;
  from_addr: string;
  subject: string | null;
  message_id: string | null;
  text: string | null;
  html: string | null;
  headers: Record<string, string> | null;
  raw_size: number;
  r2_key: string | null;
  spam_score: number | null;
  received_at: string;
  processed: boolean;
}

export interface WaitForMessageOpts {
  /** Polling cadence in ms. Default 5000. */
  pollIntervalMs?: number;
  /** Only consider messages received after this ISO timestamp. */
  since?: string;
  /** Mark the matched row processed=true on resolution. Default true. */
  markProcessed?: boolean;
  /** Override clock — used in tests. */
  now?: () => number;
}

export class InboxTimeoutError extends Error {
  constructor(applicantId: string, timeoutMs: number) {
    super(
      `inbox.waitForMessage timeout after ${timeoutMs}ms for applicant ${applicantId}`,
    );
    this.name = "InboxTimeoutError";
  }
}

export class InboxAliasMissingError extends Error {
  constructor(applicantId: string) {
    super(
      `applicant_profiles.inbox_alias is null for ${applicantId} — call assignApplicantInboxAlias() first`,
    );
    this.name = "InboxAliasMissingError";
  }
}

async function loadAlias(applicantId: string): Promise<string> {
  const { data, error } = await supabase
    .from("applicant_profiles")
    .select("inbox_alias")
    .eq("id", applicantId)
    .maybeSingle();
  if (error) {
    throw new Error(`waitForMessage alias read failed: ${error.message}`);
  }
  if (!data?.inbox_alias) {
    throw new InboxAliasMissingError(applicantId);
  }
  return data.inbox_alias.toLowerCase();
}

async function fetchUnprocessedSince(
  alias: string,
  since: string,
): Promise<InboundMessage[]> {
  const { data, error } = await supabase
    .from("inbound_email")
    .select(
      "id, to_addr, from_addr, subject, message_id, text, html, headers, raw_size, r2_key, spam_score, received_at, processed",
    )
    .eq("to_addr", alias)
    .gte("received_at", since)
    .eq("processed", false)
    .order("received_at", { ascending: true })
    .limit(20);
  if (error) {
    throw new Error(`waitForMessage poll failed: ${error.message}`);
  }
  return (data ?? []) as InboundMessage[];
}

async function markProcessed(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("inbound_email")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) {
    throw new Error(
      `waitForMessage markProcessed failed for ${messageId}: ${error.message}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForMessage(
  applicantId: string,
  predicate: (msg: InboundMessage) => boolean,
  timeoutMs: number,
  opts: WaitForMessageOpts = {},
): Promise<InboundMessage> {
  const pollIntervalMs = opts.pollIntervalMs ?? 5_000;
  const now = opts.now ?? (() => Date.now());
  const since = opts.since ?? new Date(now() - 60_000).toISOString();
  const alias = await loadAlias(applicantId);

  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const rows = await fetchUnprocessedSince(alias, since);
    for (const row of rows) {
      if (predicate(row)) {
        if (opts.markProcessed !== false) {
          await markProcessed(row.id);
        }
        return row;
      }
    }
    if (now() + pollIntervalMs >= deadline) break;
    await sleep(pollIntervalMs);
  }
  throw new InboxTimeoutError(applicantId, timeoutMs);
}

export const inbox = {
  waitForMessage,
};
