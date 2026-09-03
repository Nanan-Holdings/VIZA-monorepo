import { createHash } from "node:crypto";

export function referrerHost(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().slice(0, 253) || null;
  } catch {
    return null;
  }
}

export function userAgentFamily(value: string | null): string | null {
  if (!value) return null;
  if (/Googlebot/i.test(value)) return "Googlebot";
  if (/bingbot/i.test(value)) return "Bingbot";
  if (/Edg\//i.test(value)) return "Edge";
  if (/OPR\//i.test(value)) return "Opera";
  if (/Firefox\//i.test(value)) return "Firefox";
  if (/Chrome\//i.test(value)) return "Chrome";
  if (/Safari\//i.test(value)) return "Safari";
  return "Other";
}

export function countryCode(value: string | null): string | null {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0 || pair.slice(0, separator).trim() !== name) continue;
    const value = pair.slice(separator + 1).trim();
    return /^[A-Za-z0-9_-]{16,128}$/.test(value) ? value : null;
  }
  return null;
}

export function sessionHash(cookieHeader: string | null, salt: string | undefined): string | null {
  const cleanSalt = salt?.trim();
  const session = cookieValue(cookieHeader, "viza_marketing_session");
  if (!cleanSalt || !session) return null;
  return createHash("sha256").update(cleanSalt).update("\0").update(session).digest("hex");
}
