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
 *   4. If an R2 binding is configured, archive the complete raw message for
 *      retry/recovery. Forwarding still works when the account has not enabled
 *      R2 yet.
 *   5. Insert one row into Supabase `inbound_email` via the service-role
 *      REST API.
 *
 * Failure mode: any error thrown here causes Cloudflare Email Routing to
 * 5xx the message, so the sender retries. Do NOT swallow errors silently.
 */

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Resend key used to forward official mail to the applicant's real email. */
  RESEND_API_KEY?: string;
  /** Must use a domain verified in Resend. */
  INBOX_FORWARD_FROM?: string;
  INLINE_BODY_MAX_BYTES?: string;
  /** Hard reject threshold in bytes. Default 26_214_400 (25 MB). */
  MAX_RAW_BYTES?: string;
  /** Spam score above which the worker quarantines the row (default 5). */
  SPAM_SCORE_QUARANTINE?: string;
  INBOX_BODIES?: R2Bucket;
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

interface InsertedEmailRow {
  id: string;
  to_addr: string;
  from_addr: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  r2_key: string | null;
  forwarding_attempts: number;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 32_768;
  let binary = "";
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function supabaseHeaders(env: Env): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

async function insertRow(
  env: Env,
  row: Record<string, unknown>,
): Promise<InsertedEmailRow> {
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/inbound_email`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...supabaseHeaders(env),
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`inbound_email insert failed: ${res.status} ${detail}`);
  }
  const rows = (await res.json()) as InsertedEmailRow[];
  if (!rows[0]?.id) throw new Error("inbound_email insert returned no row id");
  return rows[0];
}

async function updateInboundEmail(
  env: Env,
  id: string,
  values: Record<string, unknown>,
): Promise<void> {
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/inbound_email?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...supabaseHeaders(env),
      Prefer: "return=minimal",
    },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`inbound_email update failed: ${res.status} ${detail}`);
  }
}

async function loadRealEmail(env: Env, alias: string): Promise<string | null> {
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/applicant_profiles?inbox_alias=eq.${encodeURIComponent(alias)}&select=email&limit=1`;
  const res = await fetch(url, {
    method: "GET",
    headers: supabaseHeaders(env),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`alias owner lookup failed: ${res.status} ${detail}`);
  }
  const rows = (await res.json()) as Array<{ email: string | null }>;
  return rows[0]?.email?.trim().toLowerCase() || null;
}

async function sendForwardedEmail(
  env: Env,
  row: InsertedEmailRow,
  rawBytes: Uint8Array,
): Promise<void> {
  if (!env.RESEND_API_KEY?.trim()) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const destination = await loadRealEmail(env, row.to_addr);
  if (!destination) throw new Error("alias owner has no real email");
  if (destination === row.to_addr) {
    await updateInboundEmail(env, row.id, {
      forwarding_status: "skipped",
      forwarded_to: destination,
      forwarding_error: "alias and destination are identical",
      forwarding_attempts: row.forwarding_attempts + 1,
    });
    return;
  }

  const html = `
    <p>此邮件由 VIZA 申请专属邮箱自动接收并转发。</p>
    <p><strong>官方发件人：</strong> ${escapeHtml(row.from_addr)}</p>
    <hr />
    ${row.html || `<pre style="white-space:pre-wrap">${escapeHtml(row.text ?? "")}</pre>`}
    <hr />
    <p>完整原始邮件已作为 <code>official-message.eml</code> 附件保留，内含官方 QR、PDF 或其他附件。</p>
  `;
  const text = [
    "此邮件由 VIZA 申请专属邮箱自动接收并转发。",
    `官方发件人：${row.from_addr}`,
    "",
    row.text ?? "",
    "",
    "完整原始邮件已作为 official-message.eml 附件保留。",
  ].join("\n");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `viza-alias-forward-${row.id}`,
    },
    body: JSON.stringify({
      from: env.INBOX_FORWARD_FROM?.trim() || "VIZA <noreply@viza.app>",
      to: [destination],
      subject: row.subject ? `[VIZA 转发] ${row.subject}` : "[VIZA 转发] 官方申请邮件",
      html,
      text,
      attachments: [
        {
          filename: "official-message.eml",
          content: bytesToBase64(rawBytes),
        },
      ],
      tags: [
        { name: "source", value: "alias_forward" },
        { name: "inbound_email_id", value: row.id },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend forward failed: ${res.status} ${detail.slice(0, 300)}`);
  }

  await updateInboundEmail(env, row.id, {
    forwarding_status: "sent",
    forwarded_to: destination,
    forwarded_at: new Date().toISOString(),
    forwarding_attempts: row.forwarding_attempts + 1,
    forwarding_error: null,
  });
}

async function forwardOriginalEmail(
  env: Env,
  row: InsertedEmailRow,
  message: CfEmailMessage,
): Promise<void> {
  const destination = await loadRealEmail(env, row.to_addr);
  if (!destination) throw new Error("alias owner has no real email");
  if (destination === row.to_addr) {
    await updateInboundEmail(env, row.id, {
      forwarding_status: "skipped",
      forwarded_to: destination,
      forwarding_error: "alias and destination are identical",
      forwarding_attempts: row.forwarding_attempts + 1,
    });
    return;
  }

  // Cloudflare forwards the original RFC 822 message, preserving the official
  // sender, QR, PDF, inline images, and all MIME attachments.
  await message.forward(destination);
  await updateInboundEmail(env, row.id, {
    forwarding_status: "sent",
    forwarded_to: destination,
    forwarded_at: new Date().toISOString(),
    forwarding_attempts: row.forwarding_attempts + 1,
    forwarding_error: null,
  });
}

async function recordForwardFailure(
  env: Env,
  row: InsertedEmailRow,
  error: unknown,
): Promise<void> {
  const detail = error instanceof Error ? error.message : String(error);
  await updateInboundEmail(env, row.id, {
    forwarding_status: "failed",
    forwarding_attempts: row.forwarding_attempts + 1,
    forwarding_error: detail.slice(0, 500),
  });
  console.error(`[viza-email-worker] alias forward failed for ${row.id}: ${detail}`);
}

async function loadPendingForwards(env: Env): Promise<InsertedEmailRow[]> {
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const select = [
    "id",
    "to_addr",
    "from_addr",
    "subject",
    "text",
    "html",
    "r2_key",
    "forwarding_attempts",
  ].join(",");
  const url = `${base}/rest/v1/inbound_email?select=${select}&forwarding_status=in.(pending,failed)&forwarding_attempts=lt.5&quarantined=eq.false&order=received_at.asc&limit=25`;
  const res = await fetch(url, {
    method: "GET",
    headers: supabaseHeaders(env),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`pending alias forward query failed: ${res.status} ${detail}`);
  }
  return (await res.json()) as InsertedEmailRow[];
}

async function retryPendingForwards(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY?.trim()) return;
  const rows = await loadPendingForwards(env);
  for (const row of rows) {
    if (!env.INBOX_BODIES || !row.r2_key) {
      await recordForwardFailure(env, row, new Error("raw email is unavailable in R2"));
      continue;
    }
    const object = await env.INBOX_BODIES.get(row.r2_key);
    if (!object) {
      await recordForwardFailure(env, row, new Error("raw email R2 object was not found"));
      continue;
    }
    const rawBytes = new Uint8Array(await object.arrayBuffer());
    try {
      await sendForwardedEmail(env, row, rawBytes);
    } catch (error) {
      await recordForwardFailure(env, row, error);
    }
  }
}

async function aliasIsActive(env: Env, toAddr: string): Promise<boolean> {
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/applicant_profiles?inbox_alias=eq.${encodeURIComponent(toAddr)}&select=inbox_alias_retired_at&limit=1`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    // Fail open on a transient lookup error — better to record the
    // message than to bounce a real applicant's mail.
    return true;
  }
  const rows = (await res.json()) as Array<{ inbox_alias_retired_at: string | null }>;
  if (rows.length === 0) {
    // Unknown alias; the applicant_profiles row has not been minted yet.
    // Default-allow so we don't lose mail during the assignment race.
    return true;
  }
  return rows[0].inbox_alias_retired_at === null;
}

export default {
  async email(message: CfEmailMessage, env: Env): Promise<void> {
    const inlineCap = Number.parseInt(env.INLINE_BODY_MAX_BYTES ?? "", 10) ||
      1_048_576;
    const maxRawBytes = Number.parseInt(env.MAX_RAW_BYTES ?? "", 10) ||
      26_214_400; // 25 MB
    const spamQuarantineThreshold =
      Number.parseFloat(env.SPAM_SCORE_QUARANTINE ?? "") || 5;
    const toAddr = message.to.toLowerCase();

    // Hard reject oversized messages before reading the body. Cloudflare
    // surfaces rawSize on the message envelope so we don't have to drain
    // the stream first.
    if (message.rawSize > maxRawBytes) {
      throw new Error(
        `[viza-email-worker] reject oversized message ${message.rawSize}B > ${maxRawBytes}B from=${message.from} to=${toAddr}`,
      );
    }

    if (!(await aliasIsActive(env, toAddr))) {
      throw new Error(
        `[viza-email-worker] reject retired alias ${toAddr} from=${message.from}`,
      );
    }

    const rawBytes = await readAll(message.raw);
    const rawText = bytesToString(rawBytes);
    const parsed = parseMessage(rawText);

    let r2Key: string | null = null;
    let inlineText: string | null = parsed.text;
    let inlineHtml: string | null = parsed.html;

    // R2 is optional because a new Cloudflare account may not have the product
    // enabled. The immediate forward still attaches these same raw bytes.
    if (env.INBOX_BODIES) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      r2Key =
        `inbound/${toAddr}/${stamp}-${parsed.messageId ?? crypto.randomUUID()}.eml`;
      await env.INBOX_BODIES.put(r2Key, rawBytes, {
        httpMetadata: { contentType: "message/rfc822" },
      });
    }

    if (rawBytes.byteLength > inlineCap) {
      inlineText = null;
      inlineHtml = null;
    }

    const quarantined =
      parsed.spamScore !== null && parsed.spamScore >= spamQuarantineThreshold;

    const inserted = await insertRow(env, {
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
      quarantined,
      rejection_reason: quarantined
        ? `spam_score>=${spamQuarantineThreshold}`
        : null,
      received_at: new Date().toISOString(),
      processed: false,
      forwarding_status: quarantined ? "skipped" : "pending",
      forwarding_attempts: 0,
    });
    if (!quarantined) {
      try {
        await forwardOriginalEmail(env, inserted, message);
      } catch (error) {
        // Keep SMTP delivery successful. The scheduled handler retries when
        // raw-message archival is available.
        await recordForwardFailure(env, inserted, error);
      }
    }
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(retryPendingForwards(env));
  },
};
