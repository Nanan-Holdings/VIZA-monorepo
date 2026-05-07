/**
 * Cloudflare Email Worker — `viza-email-worker` (INBOX-002).
 *
 * Bound at the Cloudflare dashboard via Email Routing's catch-all route.
 * For every inbound message at *@haggstorm.com:
 *   1. Read the raw RFC 822 stream once.
 *   2. Extract the standard headers we care about (from / to / subject /
 *      message-id) and the spam score Cloudflare exposes via the headers.
 *   3. Split out a text/plain and a text/html body when the mime structure
 *      is simple (single part or top-level multipart/alternative).
 *   4. If the raw size exceeds INLINE_BODY_MAX_BYTES (default 1 MB), upload
 *      the raw bytes to R2 and store the key on the row instead of the
 *      inline text/html columns.
 *   5. Insert one row into Supabase `inbound_email` via the service-role
 *      REST API.
 *
 * Failure mode: any error thrown here causes Cloudflare Email Routing to
 * 5xx the message, so the sender retries. Do NOT swallow errors silently.
 */

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  INLINE_BODY_MAX_BYTES?: string;
  INBOX_BODIES: R2Bucket;
}

interface ParsedMessage {
  text: string | null;
  html: string | null;
  /** Selected header lines we preserve for forensic / debugging use. */
  headers: Record<string, string>;
  messageId: string | null;
  subject: string | null;
  spamScore: number | null;
}

const HEADERS_OF_INTEREST = [
  "from",
  "to",
  "subject",
  "message-id",
  "date",
  "received",
  "x-spam-score",
  "authentication-results",
];

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  reader.releaseLock();
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function splitHeadersBody(raw: string): { headers: string; body: string } {
  const idx = raw.search(/\r?\n\r?\n/);
  if (idx === -1) return { headers: raw, body: "" };
  const sep = raw.startsWith("\r\n", idx) || raw[idx] === "\r" ? 4 : 2;
  return { headers: raw.slice(0, idx), body: raw.slice(idx + sep) };
}

function parseHeaderBlock(block: string): Record<string, string> {
  // unfold continuation lines per RFC 822 §3.1.1
  const unfolded = block.replace(/\r?\n[ \t]+/g, " ");
  const out: Record<string, string> = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!HEADERS_OF_INTEREST.includes(name)) continue;
    // collapse multiple Received headers under one key
    if (out[name]) {
      out[name] = `${out[name]}\n${value}`;
    } else {
      out[name] = value;
    }
  }
  return out;
}

function getContentType(headersAll: string): string {
  const m = /^content-type:\s*([^\r\n;]+)/im.exec(headersAll);
  return m ? m[1].toLowerCase().trim() : "text/plain";
}

function getBoundary(headersAll: string): string | null {
  const m = /boundary\s*=\s*"?([^";\r\n]+)"?/i.exec(headersAll);
  return m ? m[1] : null;
}

function pickBodies(
  rawText: string,
): { text: string | null; html: string | null } {
  const { headers, body } = splitHeadersBody(rawText);
  const ct = getContentType(headers);
  if (ct === "text/plain") return { text: body, html: null };
  if (ct === "text/html") return { text: null, html: body };
  if (!ct.startsWith("multipart/")) {
    // unknown single part — preserve as text for forensic visibility
    return { text: body, html: null };
  }
  const boundary = getBoundary(headers);
  if (!boundary) return { text: body, html: null };
  const parts = body.split(new RegExp(`--${escapeRegex(boundary)}(?:--)?`));
  let text: string | null = null;
  let html: string | null = null;
  for (const part of parts) {
    if (!part.trim()) continue;
    const { headers: ph, body: pb } = splitHeadersBody(part.replace(/^\r?\n/, ""));
    const partCt = getContentType(ph);
    if (partCt === "text/plain" && text === null) text = pb;
    else if (partCt === "text/html" && html === null) html = pb;
  }
  return { text, html };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseSpamScore(headers: Record<string, string>): number | null {
  const raw = headers["x-spam-score"];
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function parseMessage(rawText: string): ParsedMessage {
  const { headers: headerBlock } = splitHeadersBody(rawText);
  const headers = parseHeaderBlock(headerBlock);
  const { text, html } = pickBodies(rawText);
  return {
    text,
    html,
    headers,
    messageId: headers["message-id"] ?? null,
    subject: headers["subject"] ?? null,
    spamScore: parseSpamScore(headers),
  };
}

async function insertRow(
  env: Env,
  row: Record<string, unknown>,
): Promise<void> {
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/inbound_email`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`inbound_email insert failed: ${res.status} ${detail}`);
  }
}

export default {
  async email(message: CfEmailMessage, env: Env): Promise<void> {
    const inlineCap = Number.parseInt(env.INLINE_BODY_MAX_BYTES ?? "", 10) ||
      1_048_576;
    const rawBytes = await readAll(message.raw);
    const rawText = bytesToString(rawBytes);
    const parsed = parseMessage(rawText);
    const toAddr = message.to.toLowerCase();

    let r2Key: string | null = null;
    let inlineText: string | null = parsed.text;
    let inlineHtml: string | null = parsed.html;

    if (rawBytes.byteLength > inlineCap) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      r2Key = `inbound/${toAddr}/${stamp}-${parsed.messageId ?? crypto.randomUUID()}.eml`;
      await env.INBOX_BODIES.put(r2Key, rawBytes, {
        httpMetadata: { contentType: "message/rfc822" },
      });
      // Drop inline columns in favour of the R2 reference.
      inlineText = null;
      inlineHtml = null;
    }

    await insertRow(env, {
      to_addr: toAddr,
      from_addr: message.from,
      subject: parsed.subject,
      message_id: parsed.messageId,
      text: inlineText,
      html: inlineHtml,
      headers: parsed.headers,
      raw_size: message.rawSize,
      r2_key: r2Key,
      spam_score: parsed.spamScore,
      received_at: new Date().toISOString(),
      processed: false,
    });
  },
};
