import { supabase } from "../supabase.js";

export const ALIAS_EMAIL_FORWARDING_CONSENT = {
  type: "alias_email_forwarding",
  version: "2026-07-22",
  documentHash:
    "sha256:5d2d7fcccd083bbde90b9d42529b5f8cab380fd7bf26a79eb2ba84315f1fb212",
} as const;

export async function hasAliasEmailForwardingConsent(
  applicantId: string,
): Promise<boolean> {
  const { data: accountConsent, error: accountError } = await supabase
    .from("consent_event")
    .select("id")
    .eq("applicant_id", applicantId)
    .eq("doc_kind", ALIAS_EMAIL_FORWARDING_CONSENT.type)
    .eq("doc_version", ALIAS_EMAIL_FORWARDING_CONSENT.version)
    .limit(1)
    .maybeSingle();
  if (accountError) {
    throw new Error(`Alias email forwarding account consent lookup failed: ${accountError.message}`);
  }
  if (accountConsent?.id) return true;

  const { data: applicationConsent, error: applicationError } = await supabase
    .from("consent_events")
    .select("id")
    .eq("applicant_id", applicantId)
    .eq("consent_type", ALIAS_EMAIL_FORWARDING_CONSENT.type)
    .eq("version", ALIAS_EMAIL_FORWARDING_CONSENT.version)
    .eq("document_hash", ALIAS_EMAIL_FORWARDING_CONSENT.documentHash)
    .eq("accepted", true)
    .limit(1)
    .maybeSingle();
  if (applicationError) {
    throw new Error(
      `Alias email forwarding application consent lookup failed: ${applicationError.message}`,
    );
  }
  return Boolean(applicationConsent?.id);
}
