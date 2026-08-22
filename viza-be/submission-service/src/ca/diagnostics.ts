import { isTrustedCanadaBrowserUrl } from "./readiness.js";

export function redactCanadaPortalDiagnostic(
  value: string,
  secrets: { email: string; password: string },
): string {
  let redacted = value;
  for (const secret of [secrets.email, secrets.password]) {
    const normalized = secret.trim();
    if (!normalized) continue;
    redacted = redacted.split(normalized).join("[redacted]");
    const encoded = encodeURIComponent(normalized);
    redacted = redacted.split(encoded).join("[redacted]");
  }
  return redacted;
}

export function sanitizeCanadaPortalUrl(value: string): string | undefined {
  try {
    const source = new URL(value);
    if (!isTrustedCanadaBrowserUrl(source)) return undefined;
    const safe = new URL(`${source.protocol}//${source.host}${source.pathname}`);
    for (const key of ["appId", "appPkgId", "continue", "lang"]) {
      const entry = source.searchParams.get(key);
      if (entry) safe.searchParams.set(key, entry);
    }
    return safe.toString();
  } catch {
    return undefined;
  }
}
