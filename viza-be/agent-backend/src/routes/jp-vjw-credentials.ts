export const JP_VJW_OFFICIAL_PORTAL_URL = "https://www.vjw.digital.go.jp/";

export const JP_VJW_LEGACY_CREDENTIAL_KEYS = {
  email: "japan.vjw.portal.email",
  password: "japan.vjw.portal.password",
  registrationState: "japan.vjw.portal.registration_state",
} as const;

export function getJpVjwCredentialKeys(applicationId: string) {
  const normalized = applicationId.trim();
  if (!normalized) throw new Error("Application ID is required");
  const prefix = `japan.vjw.${normalized}.portal`;
  return {
    email: `${prefix}.email`,
    password: `${prefix}.password`,
    registrationState: `${prefix}.registration_state`,
  } as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasAuthoritativeJpVjwResult(result: unknown): boolean {
  if (!isRecord(result)) return false;
  if (
    result.country !== "JP"
    || result.visaType !== "JP_VISIT_JAPAN_WEB"
    || result.status !== "qr_ready"
    || result.submitted !== true
    || result.qrReady !== true
  ) return false;
  if (!isRecord(result.artifacts) || !Array.isArray(result.artifacts.qrCodes)) return false;
  return result.artifacts.qrCodes.some(
    (path) => typeof path === "string" && path.trim().length > 0,
  );
}

export interface JpVjwStoredCredentialSet {
  email: string | null;
  password: string | null;
  registrationState: string | null;
}

export type JpVjwCredentialResolution =
  | { ok: true; email: string; password: string; source: "scoped" | "legacy" }
  | { ok: false; reason: "missing" | "partial" | "not_registered" | "alias_mismatch" };

export function resolveJpVjwStoredCredentials(input: {
  alias: string;
  scoped: JpVjwStoredCredentialSet;
  legacy: JpVjwStoredCredentialSet;
}): JpVjwCredentialResolution {
  const expectedAlias = input.alias.trim().toLowerCase();
  if (!expectedAlias) return { ok: false, reason: "missing" };
  const scopedHasData = Boolean(
    input.scoped.email || input.scoped.password || input.scoped.registrationState,
  );
  const selected = scopedHasData ? input.scoped : input.legacy;
  const source = scopedHasData ? "scoped" : "legacy";
  const hasEmail = Boolean(selected.email?.trim());
  const hasPassword = Boolean(selected.password);
  if (!hasEmail && !hasPassword && !selected.registrationState) {
    return { ok: false, reason: "missing" };
  }
  if (!hasEmail || !hasPassword) return { ok: false, reason: "partial" };
  if (selected.registrationState !== "registered") {
    return { ok: false, reason: "not_registered" };
  }
  const email = selected.email!.trim().toLowerCase();
  if (email !== expectedAlias) return { ok: false, reason: "alias_mismatch" };
  return { ok: true, email, password: selected.password!, source };
}
