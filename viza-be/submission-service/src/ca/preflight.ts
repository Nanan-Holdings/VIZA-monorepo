import { hasAliasEmailForwardingConsent } from "../inbox/forwarding-consent.js";
import { supabase } from "../supabase.js";
import { reusableDocumentAliases } from "../documents/reusable-document-aliases.js";
import {
  CANADA_IRCC_PORTAL_TERMS_CONSENT,
  CANADA_APPLICATION_CONSENT_DOCUMENTS,
  CANADA_APPLICATION_SIGNATURE,
  assessCanadaTrvReadiness,
  type CanadaApplicationDocument,
  type CanadaDocumentRequirement,
  type CanadaFormField,
  type CanadaReadinessResult,
} from "./readiness.js";

interface CanadaApplicationRow {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
  status: string | null;
}

interface CanadaProfileRow {
  inbox_alias: string | null;
}

interface CanadaAnswerRow {
  field_name: string;
  value_text: string | null;
}

interface CanadaConsentRow {
  consent_type: string;
  version: string;
  document_hash: string | null;
}

export interface CanadaFeeCheckpointReadiness {
  quotePresent: boolean;
  paymentIntentPresent: boolean;
  userFeeConsentPresent: boolean;
  adminApprovalPresent: boolean;
}

export interface CanadaTrvPreflightReport {
  applicationId: string;
  applicantId: string;
  managedAlias: string | null;
  answers: Record<string, string>;
  readiness: CanadaReadinessResult;
  feeCheckpoint: CanadaFeeCheckpointReadiness;
}

function fail(table: string, message: string): never {
  throw new Error(`Canada TRV preflight ${table} lookup failed: ${message}`);
}

export async function loadCanadaTrvPreflight(
  applicationId: string,
): Promise<CanadaTrvPreflightReport> {
  const { data: applicationData, error: applicationError } = await supabase
    .from("applications")
    .select(
      "id, applicant_id, country, visa_type, status",
    )
    .eq("id", applicationId)
    .single();
  if (applicationError || !applicationData) {
    fail("applications", applicationError?.message ?? "row not found");
  }
  const application = applicationData as CanadaApplicationRow;

  const [
    profileResult,
    answerResult,
    fieldResult,
    documentResult,
    universalDocumentResult,
    requirementResult,
    secretResult,
    consentResult,
    quoteResult,
    intentResult,
    portalTermsConsentResult,
    applicationConsentResult,
    applicationSignatureResult,
  ] = await Promise.all([
    supabase
      .from("applicant_profiles")
      .select("inbox_alias")
      .eq("id", application.applicant_id)
      .single(),
    supabase
      .from("visa_application_answers")
      .select("field_name, value_text")
      .eq("application_id", applicationId),
    supabase
      .from("visa_form_fields")
      .select("field_name, field_type, required, conditional_logic")
      .eq("visa_type", "CA_TRV"),
    supabase
      .from("application_documents")
      .select("requirement_key, document_type, storage_path, status")
      .eq("application_id", applicationId),
    supabase
      .from("universal_profile_documents")
      .select("document_type, storage_path, status")
      .eq("applicant_id", application.applicant_id)
      .neq("status", "missing"),
    supabase
      .from("document_requirements")
      .select("requirement_key, required, metadata")
      .eq("country", "canada")
      .eq("visa_type", "CA_TRV"),
    supabase
      .from("applicant_secret")
      .select("key")
      .eq("applicant_id", application.applicant_id),
    hasAliasEmailForwardingConsent(application.applicant_id),
    supabase
      .from("official_fee_quotes")
      .select("id, quote_status")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("official_fee_payment_intents")
      .select("id, status, user_consented_at, admin_approved_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("consent_events")
      .select("id")
      .eq("application_id", applicationId)
      .eq("consent_type", CANADA_IRCC_PORTAL_TERMS_CONSENT.type)
      .eq("version", CANADA_IRCC_PORTAL_TERMS_CONSENT.version)
      .eq("accepted", true)
      .is("revoked_at", null)
      .limit(1),
    supabase
      .from("consent_events")
      .select("consent_type, version, document_hash")
      .eq("application_id", applicationId)
      .eq("accepted", true)
      .is("revoked_at", null),
    supabase
      .from("application_signatures")
      .select("id")
      .eq("application_id", applicationId)
      .eq("signature_type", CANADA_APPLICATION_SIGNATURE.type)
      .eq("document_hash", CANADA_APPLICATION_SIGNATURE.documentHash)
      .limit(1),
  ]);

  if (profileResult.error || !profileResult.data) {
    fail("applicant_profiles", profileResult.error?.message ?? "row not found");
  }
  if (answerResult.error) fail("visa_application_answers", answerResult.error.message);
  if (fieldResult.error) fail("visa_form_fields", fieldResult.error.message);
  if (documentResult.error) fail("application_documents", documentResult.error.message);
  if (universalDocumentResult.error) {
    fail("universal_profile_documents", universalDocumentResult.error.message);
  }
  if (requirementResult.error) fail("document_requirements", requirementResult.error.message);
  if (secretResult.error) fail("applicant_secret", secretResult.error.message);
  if (quoteResult.error) fail("official_fee_quotes", quoteResult.error.message);
  if (intentResult.error) {
    fail("official_fee_payment_intents", intentResult.error.message);
  }
  if (portalTermsConsentResult.error) {
    fail("consent_events", portalTermsConsentResult.error.message);
  }
  if (applicationConsentResult.error) {
    fail("consent_events", applicationConsentResult.error.message);
  }
  if (applicationSignatureResult.error) {
    fail("application_signatures", applicationSignatureResult.error.message);
  }

  const profile = profileResult.data as CanadaProfileRow;
  const answers = Object.fromEntries(
    ((answerResult.data ?? []) as CanadaAnswerRow[])
      .filter((row) => row.value_text != null)
      .map((row) => [row.field_name, String(row.value_text)]),
  );
  const portalSecretKeys = (secretResult.data ?? []).map((row) => String(row.key));
  const applicationConsents = (applicationConsentResult.data ?? []) as CanadaConsentRow[];
  const applicationConsentPresent = CANADA_APPLICATION_CONSENT_DOCUMENTS.every((document) =>
    applicationConsents.some((row) =>
      row.consent_type === document.type &&
      row.version === document.version &&
      row.document_hash === document.hash
    )
  );
  const universalDocuments = (universalDocumentResult.data ?? []).flatMap((document) => {
    const documentType = String(document.document_type);
    const aliases = reusableDocumentAliases(documentType);
    return aliases.map((alias) => ({
      requirement_key: alias,
      document_type: alias,
      storage_path: document.storage_path,
      status: document.status,
    }));
  });
  const readiness = assessCanadaTrvReadiness({
    country: application.country,
    visaType: application.visa_type,
    applicationStatus: application.status,
    applicationConsentPresent,
    applicationSignaturePresent: Boolean(applicationSignatureResult.data?.[0]?.id),
    managedAliasPresent: Boolean(profile.inbox_alias?.trim()),
    aliasForwardingConsent: consentResult,
    portalTermsConsentPresent: Boolean(portalTermsConsentResult.data?.[0]?.id),
    portalSecretKeys,
    answers,
    fields: (fieldResult.data ?? []) as CanadaFormField[],
    documentRequirements: (requirementResult.data ?? []) as CanadaDocumentRequirement[],
    documents: [
      ...universalDocuments,
      ...((documentResult.data ?? []) as CanadaApplicationDocument[]),
    ],
  });

  const latestQuote = quoteResult.data?.[0];
  const latestIntent = intentResult.data?.[0];
  return {
    applicationId,
    applicantId: application.applicant_id,
    managedAlias: profile.inbox_alias,
    answers,
    readiness,
    feeCheckpoint: {
      quotePresent: Boolean(latestQuote?.id),
      paymentIntentPresent: Boolean(latestIntent?.id),
      userFeeConsentPresent: Boolean(latestIntent?.user_consented_at),
      adminApprovalPresent: Boolean(latestIntent?.admin_approved_at),
    },
  };
}

export function formatCanadaPreflightBlockers(report: CanadaTrvPreflightReport): string {
  return report.readiness.blockers
    .map((blocker) => {
      const details = blocker.fields ?? blocker.requirements ?? [];
      return details.length > 0 ? `${blocker.code}(${details.join(",")})` : blocker.code;
    })
    .join("; ");
}
