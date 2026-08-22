import { resolveMx } from "node:dns/promises";
import { supabase } from "../supabase";

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
  /** Include already-consumed mail when an external ingest worker owns marking. */
  includeProcessed?: boolean;
  /** Prefer the newest matching message. Default false preserves FIFO behavior. */
  newestFirst?: boolean;
  /**
   * Country-service alias derived from the applicant's canonical alias.
   * Only the reversible Indonesia `id-<ULID>` form is accepted.
   */
  aliasOverride?: string;
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

export class InboxDomainUnroutableError extends Error {
  constructor(domain: string, reason?: string) {
    super(
      `Managed inbox domain ${domain} cannot receive email because it has no usable MX record${reason ? `: ${reason}` : "."}`,
    );
    this.name = "InboxDomainUnroutableError";
  }
}

type MxResolver = (domain: string) => Promise<Array<{ exchange: string; priority: number }>>;

interface DnsJsonAnswer {
  type?: number;
  data?: string;
}

interface DnsJsonResponse {
  Status?: number;
  Answer?: DnsJsonAnswer[];
}

const TRANSIENT_DNS_ERROR_CODES = new Set([
  "ETIMEOUT",
  "EAI_AGAIN",
  "ESERVFAIL",
  "ECONNREFUSED",
]);

function isTransientDnsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code).toUpperCase() : "";
  return TRANSIENT_DNS_ERROR_CODES.has(code);
}

function hasUsableMxRecord(
  records: Array<{ exchange: string; priority: number }>,
): boolean {
  return records.some((record) => {
    const exchange = record.exchange.trim();
    return exchange.length > 0 && exchange !== ".";
  });
}

/**
 * HTTPS fallback for runtimes whose libc DNS resolver cannot reach an MX
 * nameserver. Cloudflare's public DoH endpoint accepts JSON GET queries when
 * the client sends Accept: application/dns-json.
 */
export async function resolveMxOverHttps(domain: string): ReturnType<MxResolver> {
  const endpoint = new URL("https://cloudflare-dns.com/dns-query");
  endpoint.searchParams.set("name", domain);
  endpoint.searchParams.set("type", "MX");

  const response = await fetch(endpoint, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`Cloudflare DNS-over-HTTPS returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as DnsJsonResponse;
  if (payload.Status !== 0) {
    throw new Error(`Cloudflare DNS-over-HTTPS returned DNS status ${payload.Status ?? "unknown"}`);
  }

  return (payload.Answer ?? [])
    .filter((answer) => answer.type === 15 && typeof answer.data === "string")
    .flatMap((answer) => {
      const match = answer.data?.trim().match(/^(\d+)\s+(.+)$/);
      if (!match) return [];
      return [{
        priority: Number.parseInt(match[1], 10),
        exchange: match[2].replace(/\.$/, ""),
      }];
    });
}

export async function assertInboxAliasDomainRoutable(
  alias: string,
  resolver: MxResolver = resolveMx,
  options: {
    retryDelaysMs?: number[];
    fallbackResolver?: MxResolver | null;
  } = {},
): Promise<void> {
  const domain = alias.trim().toLowerCase().split("@")[1];
  if (!domain) {
    throw new InboxDomainUnroutableError(alias, "the alias address is invalid");
  }

  const retryDelaysMs = options.retryDelaysMs ?? [250, 750];
  const fallbackResolver = options.fallbackResolver === undefined
    ? resolveMxOverHttps
    : options.fallbackResolver;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const records = await resolver(domain);
      if (!hasUsableMxRecord(records)) {
        throw new InboxDomainUnroutableError(domain);
      }
      return;
    } catch (error) {
      if (error instanceof InboxDomainUnroutableError) throw error;
      const retryDelay = retryDelaysMs[attempt];
      if (isTransientDnsError(error) && retryDelay !== undefined) {
        if (retryDelay > 0) await sleep(retryDelay);
        continue;
      }
      if (isTransientDnsError(error) && fallbackResolver) {
        try {
          const fallbackRecords = await fallbackResolver(domain);
          if (!hasUsableMxRecord(fallbackRecords)) {
            throw new InboxDomainUnroutableError(domain);
          }
          return;
        } catch (fallbackError) {
          if (fallbackError instanceof InboxDomainUnroutableError) throw fallbackError;
          const nativeReason = error instanceof Error ? error.message : String(error);
          const fallbackReason = fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);
          throw new InboxDomainUnroutableError(
            domain,
            `${nativeReason}; DNS-over-HTTPS fallback failed: ${fallbackReason}`,
          );
        }
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new InboxDomainUnroutableError(domain, reason);
    }
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

async function loadApplicationAlias(
  applicationId: string,
  applicantId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("application_inbox_aliases")
    .select("alias, applicant_id, retired_at")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (error) {
    throw new Error(`waitForApplicationMessage alias read failed: ${error.message}`);
  }
  if (!data?.alias || data.applicant_id !== applicantId || data.retired_at) {
    throw new InboxAliasMissingError(`${applicantId}/${applicationId}`);
  }
  return String(data.alias).toLowerCase();
}

async function loadAppointmentAccountAlias(input: {
  applicationId: string;
  applicantId: string;
  accountId: string;
  portal: string;
}): Promise<string> {
  const [{ data: application, error: applicationError }, { data: account, error: accountError }] =
    await Promise.all([
      supabase
        .from("applications")
        .select("applicant_id")
        .eq("id", input.applicationId)
        .maybeSingle(),
      supabase
        .from("appointment_accounts")
        .select("application_id,account_email,portal")
        .eq("id", input.accountId)
        .maybeSingle(),
    ]);
  if (applicationError) {
    throw new Error(`waitForAppointmentAccountMessage application read failed: ${applicationError.message}`);
  }
  if (accountError) {
    throw new Error(`waitForAppointmentAccountMessage account read failed: ${accountError.message}`);
  }
  if (
    application?.applicant_id !== input.applicantId
    || account?.application_id !== input.applicationId
    || account?.portal !== input.portal
    || typeof account.account_email !== "string"
    || !account.account_email.trim()
  ) {
    throw new InboxAliasMissingError(
      `${input.applicantId}/${input.applicationId}/${input.portal}`,
    );
  }
  return account.account_email.trim().toLowerCase();
}

export async function assertAppointmentAccountInboxRoutable(input: {
  applicationId: string;
  applicantId: string;
  accountId: string;
  portal: string;
}): Promise<void> {
  const alias = await loadAppointmentAccountAlias(input);
  await assertInboxAliasDomainRoutable(alias);
}

export function resolveApplicantInboxAlias(
  canonicalAlias: string,
  aliasOverride?: string,
): string {
  const canonical = canonicalAlias.trim().toLowerCase();
  const requested = aliasOverride?.trim().toLowerCase();
  if (!requested || requested === canonical) return canonical;

  const canonicalMatch = canonical.match(/^appl-([0-9a-z]{26})@(viza\.it\.com)$/i);
  if (canonicalMatch && requested === `id-${canonicalMatch[1]}@${canonicalMatch[2]}`) {
    return requested;
  }
  throw new Error("Inbox alias override does not belong to the applicant canonical alias");
}

async function fetchUnprocessedSince(
  alias: string,
  since: string,
  includeProcessed = false,
  newestFirst = false,
): Promise<InboundMessage[]> {
  let query = supabase
    .from("inbound_email")
    .select(
      "id, to_addr, from_addr, subject, message_id, text, html, headers, raw_size, r2_key, spam_score, received_at, processed",
    )
    .eq("to_addr", alias)
    .gte("received_at", since)
    .order("received_at", { ascending: !newestFirst })
    .limit(20);
  if (!includeProcessed) query = query.eq("processed", false);
  const { data, error } = await query;
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
  const canonicalAlias = await loadAlias(applicantId);
  const alias = resolveApplicantInboxAlias(canonicalAlias, opts.aliasOverride);
  return waitForResolvedAlias(alias, applicantId, predicate, timeoutMs, opts);
}

export async function waitForApplicationMessage(
  applicationId: string,
  applicantId: string,
  predicate: (msg: InboundMessage) => boolean,
  timeoutMs: number,
  opts: Omit<WaitForMessageOpts, "aliasOverride"> = {},
): Promise<InboundMessage> {
  const alias = await loadApplicationAlias(applicationId, applicantId);
  return waitForResolvedAlias(alias, `${applicantId}/${applicationId}`, predicate, timeoutMs, opts);
}

/**
 * Wait on the immutable alias bound to an official appointment account. The
 * DB relationship is revalidated before reading mail so alias rotation on the
 * applicant profile cannot redirect password-recovery messages or expose an
 * unrelated managed inbox.
 */
export async function waitForAppointmentAccountMessage(
  input: {
    applicationId: string;
    applicantId: string;
    accountId: string;
    portal: string;
  },
  predicate: (msg: InboundMessage) => boolean,
  timeoutMs: number,
  opts: Omit<WaitForMessageOpts, "aliasOverride"> = {},
): Promise<InboundMessage> {
  const alias = await loadAppointmentAccountAlias(input);
  return waitForResolvedAlias(
    alias,
    `${input.applicantId}/${input.applicationId}/${input.portal}`,
    predicate,
    timeoutMs,
    opts,
  );
}

async function waitForResolvedAlias(
  alias: string,
  timeoutIdentity: string,
  predicate: (msg: InboundMessage) => boolean,
  timeoutMs: number,
  opts: Omit<WaitForMessageOpts, "aliasOverride">,
): Promise<InboundMessage> {
  const pollIntervalMs = opts.pollIntervalMs ?? 5_000;
  const now = opts.now ?? (() => Date.now());
  const since = opts.since ?? new Date(now() - 60_000).toISOString();
  await assertInboxAliasDomainRoutable(alias);

  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const rows = await fetchUnprocessedSince(
      alias,
      since,
      opts.includeProcessed,
      opts.newestFirst,
    );
    for (const row of rows) {
      if (predicate(row)) {
        if (opts.markProcessed !== false && !row.processed) {
          await markProcessed(row.id);
        }
        return row;
      }
    }
    if (now() + pollIntervalMs >= deadline) break;
    await sleep(pollIntervalMs);
  }
  throw new InboxTimeoutError(timeoutIdentity, timeoutMs);
}

export const inbox = {
  waitForMessage,
  waitForApplicationMessage,
  waitForAppointmentAccountMessage,
  assertAppointmentAccountInboxRoutable,
};
