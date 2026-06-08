/**
 * Inbound email ingest worker (INBOX keystone).
 *
 * Cloudflare Email Routing catch-alls `*@haggstorm.com` and forwards into the
 * mailbox addressed by IMAP_EMAIL. This worker reads that mailbox, recovers
 * the ORIGINAL per-applicant alias (`appl-<ulid>@haggstorm.com`) from the
 * preserved headers, and writes a row into `inbound_email` — the table that
 * `inbox.waitForMessage()` (and therefore every gated-portal runner) reads.
 *
 * Without this worker `inbound_email` is never populated, so OTP / verification
 * waits time out. With it, the whole alias → register → OTP → resume flow works.
 *
 * Run once (process current backlog):   npx tsx scripts/inbox-ingest.ts
 * Run as a loop:                         npx tsx scripts/inbox-ingest.ts --loop
 *
 * Env: IMAP_HOST, IMAP_PORT, IMAP_EMAIL, IMAP_PASSWORD (mailbox the catch-all
 * forwards to); SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { ImapFlow } from "imapflow";
import { imapConfigFromEnv } from "./imap-poll.js";
import { supabase } from "../supabase.js";

const ALIAS_DOMAIN = process.env.INBOX_ALIAS_DOMAIN ?? "haggstorm.com";
const ALIAS_RE = new RegExp(`([a-z0-9._+-]+@${ALIAS_DOMAIN.replace(/\./g, "\\.")})`, "i");

export interface IngestResult {
  scanned: number;
  ingested: number;
  skippedNoAlias: number;
  skippedDuplicate: number;
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

/** Pull the @ALIAS_DOMAIN recipient out of the preserved header block. */
function aliasFromHeaders(headerBlock: string): string | null {
  // Prefer Delivered-To / X-Forwarded-To / To / Cc lines, but a raw scan of
  // the header block is the robust fallback — Cloudflare keeps the original
  // recipient somewhere in the chain even after forwarding.
  const match = ALIAS_RE.exec(headerBlock);
  return match ? match[1].toLowerCase() : null;
}

/** Split a downloaded TEXT body into decoded text/html alternatives. */
function splitBodies(raw: string): { text: string; html: string | null } {
  let text = raw;
  let html: string | null = null;
  const htmlMatch = raw.match(
    /Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$)/i,
  );
  if (htmlMatch) html = decodeQuotedPrintable(htmlMatch[1]);
  const textMatch = raw.match(
    /Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$)/i,
  );
  if (textMatch) text = decodeQuotedPrintable(textMatch[1]);
  return { text, html };
}

async function alreadyIngested(messageId: string | null): Promise<boolean> {
  if (!messageId) return false;
  const { data } = await supabase
    .from("inbound_email")
    .select("id")
    .eq("message_id", messageId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * One ingest pass: scan messages received since `sinceMs` ago, write any
 * addressed to an alias that we have not already stored.
 */
export async function ingestOnce(sinceMs = 24 * 60 * 60 * 1000): Promise<IngestResult> {
  const config = imapConfigFromEnv();
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });
  const result: IngestResult = { scanned: 0, ingested: 0, skippedNoAlias: 0, skippedDuplicate: 0 };

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - sinceMs);
      const search = await client.search({ since }, { uid: true });
      const uids: number[] = Array.isArray(search) ? search : [];
      for (const uid of uids) {
        result.scanned += 1;
        const message = await client.fetchOne(
          String(uid),
          { envelope: true, internalDate: true, headers: true },
          { uid: true },
        );
        if (!message) continue;

        const headerBlock =
          message.headers instanceof Buffer ? message.headers.toString("utf8") : String(message.headers ?? "");
        const alias = aliasFromHeaders(headerBlock);
        if (!alias) {
          result.skippedNoAlias += 1;
          continue;
        }

        const messageId = message.envelope?.messageId ?? null;
        if (await alreadyIngested(messageId)) {
          result.skippedDuplicate += 1;
          continue;
        }

        const download = await client.download(String(uid), "TEXT", { uid: true }).catch(() => null);
        const rawBody = download?.content ? await streamToString(download.content) : "";
        const { text, html } = splitBodies(rawBody);

        const fromAddr = (message.envelope?.from?.[0]?.address ?? "").toLowerCase();
        const subject = message.envelope?.subject ?? null;
        const receivedAt =
          message.internalDate instanceof Date ? message.internalDate : new Date(message.internalDate ?? Date.now());

        const { error } = await supabase.from("inbound_email").insert({
          to_addr: alias,
          from_addr: fromAddr,
          subject,
          message_id: messageId,
          text: text || null,
          html,
          headers: { raw: headerBlock.slice(0, 8192) },
          raw_size: Buffer.byteLength(rawBody, "utf8"),
          received_at: receivedAt.toISOString(),
        });
        if (error) {
          console.error(`[ingest] insert failed for ${alias} (${messageId}): ${error.message}`);
          continue;
        }
        result.ingested += 1;
        console.log(`[ingest] ${alias} <- ${fromAddr} | ${subject ?? "(no subject)"}`);
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => { /* best effort */ });
  }
  return result;
}
