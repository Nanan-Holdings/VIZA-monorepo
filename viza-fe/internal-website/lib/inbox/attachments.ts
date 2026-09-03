import "server-only";

import PostalMime from "postal-mime";

import { presignR2Get } from "@/lib/inbox/r2-presign";

/**
 * On-demand attachment access for inbound mail.
 *
 * The email worker archives only the complete raw `.eml` in R2 (`r2_key`) —
 * MIME parts are not persisted at ingest. This module fetches the raw message
 * server-side and parses it with postal-mime (the same parser the worker
 * uses), so the reading pane can list real attachments and stream a single
 * part. The parsed manifest is cached on `inbound_email.attachments_meta` by
 * the calling server action; part bytes are never stored, only re-derived.
 */

/** Refuse to buffer truly huge messages in the Next.js process. */
const MAX_PARSE_BYTES = 20 * 1024 * 1024;

export interface InboxAttachmentInfo {
  index: number;
  filename: string | null;
  mimeType: string | null;
  size: number;
}

export interface InboxAttachmentsMeta {
  v: 1;
  parsedAt: string;
  attachments: InboxAttachmentInfo[];
}

interface ParsedAttachment {
  filename?: string | null;
  mimeType?: string | null;
  content?: ArrayBuffer | string | null;
  disposition?: string | null;
}

function attachmentBytes(attachment: ParsedAttachment): Uint8Array {
  const content = attachment.content;
  if (typeof content === "string") return new TextEncoder().encode(content);
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  return new Uint8Array(0);
}

async function fetchRawEmail(r2Key: string): Promise<Uint8Array | null> {
  const url = presignR2Get({ key: r2Key, expiresIn: 120 });
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_PARSE_BYTES) return null;
  return new Uint8Array(buffer);
}

async function parseAttachments(
  r2Key: string,
): Promise<ParsedAttachment[] | null> {
  const raw = await fetchRawEmail(r2Key);
  if (!raw) return null;
  try {
    const parsed = await PostalMime.parse(raw);
    return (parsed.attachments ?? []) as ParsedAttachment[];
  } catch {
    return null;
  }
}

/**
 * Parse the raw message and return the attachment manifest. Returns null when
 * the raw mail is missing, oversized, or unparseable — callers should treat
 * that as "no attachment listing available", not as an empty mailbox.
 */
export async function buildAttachmentsMeta(
  r2Key: string,
): Promise<InboxAttachmentsMeta | null> {
  const attachments = await parseAttachments(r2Key);
  if (!attachments) return null;
  return {
    v: 1,
    parsedAt: new Date().toISOString(),
    attachments: attachments.map((attachment, index) => ({
      index,
      filename: attachment.filename?.trim() || null,
      mimeType: attachment.mimeType?.trim() || null,
      size: attachmentBytes(attachment).byteLength,
    })),
  };
}

export interface InboxAttachmentPart {
  filename: string;
  mimeType: string;
  data: Uint8Array;
}

/** Re-derive one attachment's bytes for download. */
export async function extractAttachmentPart(
  r2Key: string,
  index: number,
): Promise<InboxAttachmentPart | null> {
  if (!Number.isInteger(index) || index < 0) return null;
  const attachments = await parseAttachments(r2Key);
  const attachment = attachments?.[index];
  if (!attachment) return null;
  const data = attachmentBytes(attachment);
  if (data.byteLength === 0) return null;
  return {
    filename: attachment.filename?.trim() || `attachment-${index + 1}`,
    mimeType: attachment.mimeType?.trim() || "application/octet-stream",
    data,
  };
}

export function isAttachmentsMeta(
  value: unknown,
): value is InboxAttachmentsMeta {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as Partial<InboxAttachmentsMeta>;
  return meta.v === 1 && Array.isArray(meta.attachments);
}
