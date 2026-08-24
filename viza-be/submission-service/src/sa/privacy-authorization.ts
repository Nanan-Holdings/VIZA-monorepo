import { createHash } from "node:crypto";

export const SA_PRIVACY_AUTHORIZATION_TYPE = "sa_visitsaudi_privacy_policy_authorization" as const;
export const SA_PRIVACY_AUTHORIZATION_VERSION = "visitsaudi_privacy_2026-08-18" as const;
export const SA_PRIVACY_POLICY_URL = "https://visa.visitsaudi.com/Home/PrivacyPolicy?lang=en" as const;
export const SA_PRIVACY_POLICY_SHA256 = "cd7f3ff2e1f857f340488cc5a703eb16c80dd2b6284f9e4027fd296a88fb9480" as const;

export interface SaudiPrivacyAuthorization {
  consentEventId: string;
  applicationId: string;
  acceptedAt: string;
  documentHash: typeof SA_PRIVACY_POLICY_SHA256;
  officialUrl: typeof SA_PRIVACY_POLICY_URL;
  source: "viza_application_confirmation";
}

interface ConsentEventRow {
  id: string;
  application_id: string;
  accepted: boolean;
  document_hash: string | null;
  consent_scope: unknown;
  created_at: string;
  revoked_at: string | null;
}

export function normalizeSaudiPrivacyPolicyText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function hashSaudiPrivacyPolicyText(value: string): string {
  return createHash("sha256").update(normalizeSaudiPrivacyPolicyText(value)).digest("hex");
}

export function parseSaudiPrivacyAuthorization(
  row: ConsentEventRow | null | undefined,
): SaudiPrivacyAuthorization | null {
  if (!row || !row.accepted || row.revoked_at) return null;
  if (row.document_hash !== SA_PRIVACY_POLICY_SHA256) return null;
  if (!row.created_at || !Number.isFinite(Date.parse(row.created_at))) return null;
  if (!row.consent_scope || typeof row.consent_scope !== "object" || Array.isArray(row.consent_scope)) return null;
  const scope = row.consent_scope as Record<string, unknown>;
  if (
    scope.official_url !== SA_PRIVACY_POLICY_URL ||
    scope.source !== "viza_application_confirmation" ||
    scope.account_registration_authorized !== true ||
    scope.activation_authorized !== true ||
    scope.login_authorized !== true
  ) {
    return null;
  }
  return {
    consentEventId: row.id,
    applicationId: row.application_id,
    acceptedAt: row.created_at,
    documentHash: SA_PRIVACY_POLICY_SHA256,
    officialUrl: SA_PRIVACY_POLICY_URL,
    source: "viza_application_confirmation",
  };
}

export function assertSaudiPrivacyAuthorization(
  authorization: SaudiPrivacyAuthorization | null | undefined,
  applicationId: string,
): asserts authorization is SaudiPrivacyAuthorization {
  if (!authorization || authorization.applicationId !== applicationId) {
    throw new Error(
      "VisitSaudi account registration, activation, and login require an explicit, current Privacy Policy authorization for this application",
    );
  }
}

export async function loadSaudiPrivacyAuthorization(
  applicationId: string,
): Promise<SaudiPrivacyAuthorization | null> {
  const { supabase } = await import("../supabase.js");
  const { data, error } = await supabase
    .from("consent_events")
    .select("id,application_id,accepted,document_hash,consent_scope,created_at,revoked_at")
    .eq("application_id", applicationId)
    .eq("consent_type", SA_PRIVACY_AUTHORIZATION_TYPE)
    .eq("version", SA_PRIVACY_AUTHORIZATION_VERSION)
    .eq("accepted", true)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`VisitSaudi Privacy Policy authorization lookup failed: ${error.message}`);
  return parseSaudiPrivacyAuthorization(data as ConsentEventRow | null);
}
