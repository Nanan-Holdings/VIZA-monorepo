/**
 * Shared IMAP mailbox helper for per-country submission runners.
 *
 * Visa portals routinely email a verification link (account activation),
 * a one-time code (login MFA), or a reference number (post-submission).
 * Country-specific orchestrators call `waitForEmail` with sender/subject
 * filters and a since-timestamp; this module connects to the configured
 * IMAP inbox, polls for a match, and returns the message body so the
 * caller can extract a link or OTP via `extractFirstUrl` / `extractOtp`.
 *
 * Transport-only. No country-specific knowledge — keep filters and link
 * patterns in the country module that calls this helper.
 *
 * Credentials live in `.env` (gitignored). Use a scoped IMAP app
 * password (Gmail: https://myaccount.google.com/apppasswords) — never
 * the account main password.
 */

import { ImapFlow, type FetchMessageObject } from "imapflow";

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** TLS on connect. Default true (Gmail port 993). */
  secure?: boolean;
}

export interface ReceivedEmail {
  uid: number;
  from: string;
  subject: string;
  receivedAt: Date;
  textBody: string;
  htmlBody: string | null;
}

export interface WaitForEmailOptions {
  config: ImapConfig;
  /** Match against the From header (full address, lower-cased). */
  from?: RegExp;
  /** Match against the Subject header. */
  subject?: RegExp;
  /** Only consider messages received at or after this timestamp. */
  since?: Date;
  /** Max wait. Default 120000 (2 min). */
  timeoutMs?: number;
  /** Re-poll cadence. Default 5000 (5 s). */
  pollIntervalMs?: number;
  /** Mailbox to watch. Default "INBOX". */
  mailbox?: string;
}

export class ImapTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImapTimeoutError";
  }
}

/**
 * Build an `ImapConfig` from process.env. Throws if required vars are
 * missing — callers should fail fast at bootstrap time rather than
 * mid-run.
 */
export function imapConfigFromEnv(): ImapConfig {
  const host = process.env.IMAP_HOST?.trim();
  const portRaw = process.env.IMAP_PORT?.trim();
  const user = process.env.IMAP_EMAIL?.trim();
  const pass = process.env.IMAP_PASSWORD;
  if (!host || !portRaw || !user || !pass) {
    throw new Error(
      "IMAP env not configured — set IMAP_HOST, IMAP_PORT, IMAP_EMAIL, IMAP_PASSWORD in submission-service/.env",
    );
  }
  const port = Number.parseInt(portRaw, 10);
  if (Number.isNaN(port)) {
    throw new Error(`IMAP_PORT must be numeric, got "${portRaw}"`);
  }
  return { host, port, user, pass, secure: port === 993 };
}

/**
 * Poll the IMAP inbox until a message matching the supplied filters
 * arrives, then return its parsed body. Throws `ImapTimeoutError` on
 * timeout — never returns null.
 *
 * The `since` parameter is critical: without it, a previous run's
 * verification email could be returned for a fresh registration.
 * Callers should snapshot `new Date()` immediately before triggering
 * the action that produces the email and pass it as `since`.
 */
export async function waitForEmail(
  options: WaitForEmailOptions,
): Promise<ReceivedEmail> {
  const {
    config,
    from,
    subject,
    since,
    timeoutMs = 120_000,
    pollIntervalMs = 5_000,
    mailbox = "INBOX",
  } = options;

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure ?? true,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const deadline = Date.now() + timeoutMs;
      const sinceDate = since ?? new Date(Date.now() - 60_000);
      const seenUids = new Set<number>();

      while (Date.now() < deadline) {
        const search = await client.search({ since: sinceDate }, { uid: true });
        const uids: number[] = Array.isArray(search) ? search : [];
        const candidates = uids.filter((uid: number) => !seenUids.has(uid));

        for (const uid of candidates) {
          seenUids.add(uid);
          const message = await client.fetchOne(
            String(uid),
            { source: false, envelope: true, internalDate: true, bodyStructure: true },
            { uid: true },
          );
          if (!message) continue;

          const fromAddr = formatFromAddress(message);
          const subj = message.envelope?.subject ?? "";
          const rawDate = message.internalDate ?? new Date();
          const receivedAt = rawDate instanceof Date ? rawDate : new Date(rawDate);

          if (since && receivedAt < since) continue;
          if (from && !from.test(fromAddr)) continue;
          if (subject && !subject.test(subj)) continue;

          const { textBody, htmlBody } = await fetchBodies(client, uid);
          return { uid, from: fromAddr, subject: subj, receivedAt, textBody, htmlBody };
        }

        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        await sleep(Math.min(pollIntervalMs, remaining));
      }

      throw new ImapTimeoutError(
        `No matching email arrived within ${timeoutMs}ms` +
          (from ? ` (from=${from})` : "") +
          (subject ? ` (subject=${subject})` : ""),
      );
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => { /* best effort */ });
  }
}

/**
 * Extract the first URL found in a message body. Prefer `htmlBody`
 * over `textBody` — quoted-printable encoding mangles raw URLs in the
 * text alternative on some senders.
 *
 * Optional `hostMatch` restricts the result to URLs whose host matches
 * the pattern (e.g. `/evisa\.gov\.kh$/i`).
 */
export function extractFirstUrl(
  email: Pick<ReceivedEmail, "textBody" | "htmlBody">,
  hostMatch?: RegExp,
): URL | null {
  const sources = [email.htmlBody, email.textBody].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  const urlPattern = /https?:\/\/[^\s"'<>)]+/gi;
  for (const source of sources) {
    const matches = source.match(urlPattern) ?? [];
    for (const raw of matches) {
      const cleaned = raw.replace(/[.,;:!?)]+$/, "");
      try {
        const url = new URL(cleaned);
        if (!hostMatch || hostMatch.test(url.host)) return url;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Extract a numeric OTP from a message body. Default pattern matches
 * 4–8 consecutive digits — pass a custom `pattern` for portals that
 * use alphanumeric codes.
 */
export function extractOtp(
  email: Pick<ReceivedEmail, "textBody" | "htmlBody">,
  pattern: RegExp = /\b(\d{4,8})\b/,
): string | null {
  const sources = [email.textBody, email.htmlBody].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  for (const source of sources) {
    const m = source.match(pattern);
    if (m) return m[1] ?? m[0];
  }
  return null;
}

function formatFromAddress(message: FetchMessageObject): string {
  const fromList = message.envelope?.from ?? [];
  const first = fromList[0];
  if (!first) return "";
  const addr = first.address ?? "";
  return addr.toLowerCase();
}

async function fetchBodies(
  client: ImapFlow,
  uid: number,
): Promise<{ textBody: string; htmlBody: string | null }> {
  const text = await client.download(String(uid), "TEXT", { uid: true }).catch(() => null);
  let textBody = "";
  if (text?.content) {
    textBody = await streamToString(text.content);
  }

  let htmlBody: string | null = null;
  const htmlMatch = textBody.match(
    /Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$)/i,
  );
  if (htmlMatch) {
    htmlBody = decodeQuotedPrintable(htmlMatch[1]);
  }
  const textMatch = textBody.match(
    /Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$)/i,
  );
  if (textMatch) {
    textBody = decodeQuotedPrintable(textMatch[1]);
  }

  return { textBody, htmlBody };
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
