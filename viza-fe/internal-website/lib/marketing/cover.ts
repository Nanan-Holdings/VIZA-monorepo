import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { MARKETING_ASSET_BUCKET, validateMarketingAsset } from "./assets";
import { createAdminClient } from "@/lib/supabase/admin";

function publicImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !host.includes(".") || host === "localhost" || host.endsWith(".local")) return null;
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":")) return null;
    return url;
  } catch { return null; }
}

function publicAddress(address: string): boolean {
  if (address.includes(":")) {
    const lower = address.toLowerCase();
    return lower !== "::1" && !lower.startsWith("fc") && !lower.startsWith("fd") && !lower.startsWith("fe80") && !lower.startsWith("::ffff:");
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a !== 0 && a !== 10 && a !== 127 && a < 224
    && !(a === 169 && b === 254)
    && !(a === 172 && b >= 16 && b <= 31)
    && !(a === 192 && b === 168)
    && !(a === 100 && b >= 64 && b <= 127)
    && !(a === 198 && (b === 18 || b === 19));
}

/** Re-hosts a source cover in the existing public marketing bucket. */
export async function rehostMarketingCover(source: string | null): Promise<string | null> {
  if (!source) return null;
  const url = publicImageUrl(source);
  if (!url) return null;
  try {
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some((entry) => !publicAddress(entry.address))) return null;
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!response.ok) return null;
    const mimeType = response.headers.get("content-type")?.split(";")[0].toLowerCase() ?? "";
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > 4 * 1024 * 1024) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > 4 * 1024 * 1024) { await reader.cancel(); return null; }
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const valid = validateMarketingAsset({ kind: "image", mimeType, size: bytes.byteLength });
    if (bytes.byteLength > 4 * 1024 * 1024) return null;
    const path = `image/editorial/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${valid.extension}`;
    const admin = createAdminClient();
    const uploaded = await admin.storage.from(MARKETING_ASSET_BUCKET).upload(path, bytes, { contentType: mimeType, cacheControl: "31536000", upsert: false });
    if (uploaded.error) return null;
    return admin.storage.from(MARKETING_ASSET_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch { return null; }
}
