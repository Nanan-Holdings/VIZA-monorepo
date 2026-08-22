export const CANADA_IRCC_HOSTS = {
  portal: "portal-portail.apps.cic.gc.ca",
  application: "tr-rt.apps.cic.gc.ca",
  cognito: "cognito-idp.ca-central-1.amazonaws.com",
} as const;

export const CANADA_TRV_PORTAL_URL =
  `https://${CANADA_IRCC_HOSTS.portal}/signin?lang=en`;

function hasExactHttpsOrigin(value: string | URL, hostname: string): boolean {
  try {
    const url = value instanceof URL ? value : new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === hostname &&
      url.port === "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

export function isTrustedCanadaPortalUrl(value: string | URL): boolean {
  return hasExactHttpsOrigin(value, CANADA_IRCC_HOSTS.portal);
}

export function isTrustedCanadaApplicationUrl(value: string | URL): boolean {
  return hasExactHttpsOrigin(value, CANADA_IRCC_HOSTS.application);
}

export function isTrustedCanadaBrowserUrl(value: string | URL): boolean {
  return isTrustedCanadaPortalUrl(value) || isTrustedCanadaApplicationUrl(value);
}

export function isTrustedCanadaCognitoUrl(value: string | URL): boolean {
  return hasExactHttpsOrigin(value, CANADA_IRCC_HOSTS.cognito);
}

export const CANADA_PORTAL_SECRET_KEYS = {
  email: "canada.portal.email",
  password: "canada.portal.password",
  invitationCode: "canada.portal.invitation_code",
} as const;

export const CANADA_IRCC_PORTAL_TERMS_CONSENT = {
  type: "canada_ircc_portal_terms",
  version: "2026-05-13",
} as const;

// Must stay aligned with the applicant Consent Center's versioned documents.
export const CANADA_APPLICATION_CONSENT_DOCUMENTS = [
  { type: "terms_of_service", version: "2026-05-19", hash: "sha256:f77f54b9367ddafb8ab66018e3ed07f82dfc2b269a27280e92f8fb0990a3ab57" },
  { type: "privacy_policy", version: "2026-05-19", hash: "sha256:e79ff0eaf46afc3afa2be2691e82a2f7f6c9ec54e36fb851373310233b36e41e" },
  { type: "agency_authorisation", version: "2026-05-19", hash: "sha256:13833f3c1a57eb894da05efb96819d2d4232abb9d48949829134d9f3e36d6c9f" },
  { type: "alias_email_forwarding", version: "2026-07-22", hash: "sha256:5d2d7fcccd083bbde90b9d42529b5f8cab380fd7bf26a79eb2ba84315f1fb212" },
] as const;

export const CANADA_APPLICATION_SIGNATURE = {
  type: "agency_authorisation",
  documentHash: CANADA_APPLICATION_CONSENT_DOCUMENTS[2].hash,
} as const;

export const CANADA_PURPOSE_REQUIRED_FIELDS = [
  "visit_details",
  "intended_stay_from",
  "intended_stay_to",
] as const;

export interface CanadaFormField {
  field_name: string;
  field_type?: string | null;
  required: boolean;
  conditional_logic?: { showIf?: unknown } | null;
}

export interface CanadaDocumentRequirement {
  requirement_key: string;
  required: boolean;
  metadata?: { document_type?: unknown } | null;
}

export interface CanadaApplicationDocument {
  requirement_key?: string | null;
  document_type?: string | null;
  storage_path?: string | null;
  status?: string | null;
}

export interface CanadaReadinessInput {
  country: string | null;
  visaType: string | null;
  applicationStatus: string | null;
  applicationConsentPresent: boolean;
  applicationSignaturePresent: boolean;
  managedAliasPresent: boolean;
  aliasForwardingConsent: boolean;
  portalTermsConsentPresent: boolean;
  portalSecretKeys: readonly string[];
  answers: Record<string, string>;
  fields: readonly CanadaFormField[];
  documentRequirements: readonly CanadaDocumentRequirement[];
  documents: readonly CanadaApplicationDocument[];
}

export type CanadaReadinessBlockerCode =
  | "wrong_application_product"
  | "application_already_submitted"
  | "missing_required_answers"
  | "missing_required_documents"
  | "documents_pending_review"
  | "missing_application_consent"
  | "missing_application_signature"
  | "missing_managed_alias"
  | "missing_alias_forwarding_consent"
  | "missing_portal_terms_consent"
  | "missing_portal_credentials"
  | "missing_portal_invitation_code";

export interface CanadaReadinessBlocker {
  code: CanadaReadinessBlockerCode;
  fields?: string[];
  requirements?: string[];
}

export interface CanadaReadinessResult {
  readyForPortalLogin: boolean;
  readyForTermsAcceptance: boolean;
  readyForPurposePage: boolean;
  readyForFullForm: boolean;
  blockers: CanadaReadinessBlocker[];
  loginBlockers: CanadaReadinessBlocker[];
  purposeMissingAnswers: string[];
  missingRequiredAnswers: string[];
  missingRequiredDocuments: string[];
  documentsPendingReview: string[];
  missingPortalSecretKeys: string[];
}

/**
 * Purpose answers may be safely saved and the truthful tourist application
 * type confirmed before final application consent/signature is complete. The
 * portal flow still halts before the representative declaration and every
 * later certification/submission boundary.
 */
export function canAdvanceCanadaPurposePageSafely(
  readiness: Pick<CanadaReadinessResult, "readyForPurposePage">,
): boolean {
  return readiness.readyForPurposePage;
}

const PRESENT_DOCUMENT_STATUSES = new Set([
  "uploaded",
  "pending_review",
  "approved",
  "accepted",
  "validated",
]);

const REVIEWED_DOCUMENT_STATUSES = new Set([
  "approved",
  "accepted",
  "validated",
]);

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasAnswer(value: unknown): boolean {
  const text = normalize(value);
  return text.length > 0 && text !== "[]" && text !== "{}";
}

function isAcceptedCertification(value: unknown): boolean {
  return ["true", "yes", "1", "on"].includes(normalize(value).toLowerCase());
}

/**
 * Deliberately small evaluator for the expression grammar used by the CA_TRV
 * seed. Unknown atoms fail closed as not-visible; their controlling required
 * question is still reported separately when it has no answer.
 */
export function evaluateCanadaShowIf(
  expression: string,
  answers: Record<string, string>,
): boolean {
  const evaluateAtom = (atom: string): boolean => {
    const equality = atom.match(/^(\S+)\s*===\s*(\S+)$/);
    if (equality) {
      return normalize(answers[equality[1]]).toLowerCase() === equality[2].toLowerCase();
    }
    const inequality = atom.match(/^(\S+)\s*!==\s*(\S+)$/);
    if (inequality) {
      return normalize(answers[inequality[1]]).toLowerCase() !== inequality[2].toLowerCase();
    }
    return false;
  };

  return expression
    .split("||")
    .map((group) => group.trim())
    .some((group) =>
      group
        .split("&&")
        .map((atom) => atom.trim())
        .every(evaluateAtom),
    );
}

export function findMissingCanadaAnswers(
  fields: readonly CanadaFormField[],
  answers: Record<string, string>,
): string[] {
  return fields
    .filter((field) => {
      if (!field.required) return false;
      const showIf = field.conditional_logic?.showIf;
      if (typeof showIf === "string" && !evaluateCanadaShowIf(showIf, answers)) {
        return false;
      }
      if (normalize(field.field_type).toLowerCase() === "checkbox") {
        return !isAcceptedCertification(answers[field.field_name]);
      }
      return !hasAnswer(answers[field.field_name]);
    })
    .map((field) => field.field_name)
    .sort();
}

function documentKeys(document: CanadaApplicationDocument): string[] {
  return [document.requirement_key, document.document_type]
    .map(normalize)
    .filter(Boolean);
}

export function assessCanadaTrvReadiness(
  input: CanadaReadinessInput,
): CanadaReadinessResult {
  const blockers: CanadaReadinessBlocker[] = [];
  const missingRequiredAnswers = findMissingCanadaAnswers(input.fields, input.answers);

  const presentDocumentKeys = new Set(
    input.documents
      .filter(
        (document) =>
          Boolean(normalize(document.storage_path)) &&
          PRESENT_DOCUMENT_STATUSES.has(normalize(document.status).toLowerCase()),
      )
      .flatMap(documentKeys),
  );
  const reviewedDocumentKeys = new Set(
    input.documents
      .filter(
        (document) =>
          Boolean(normalize(document.storage_path)) &&
          REVIEWED_DOCUMENT_STATUSES.has(normalize(document.status).toLowerCase()),
      )
      .flatMap(documentKeys),
  );

  const requiredRequirements = input.documentRequirements.filter(
    (requirement) => requirement.required,
  );
  const missingRequiredDocuments = requiredRequirements
    .filter((requirement) => {
      const documentType = normalize(requirement.metadata?.document_type);
      return (
        !presentDocumentKeys.has(requirement.requirement_key) &&
        (!documentType || !presentDocumentKeys.has(documentType))
      );
    })
    .map((requirement) => requirement.requirement_key)
    .sort();
  const documentsPendingReview = requiredRequirements
    .filter((requirement) => {
      const documentType = normalize(requirement.metadata?.document_type);
      const present =
        presentDocumentKeys.has(requirement.requirement_key) ||
        Boolean(documentType && presentDocumentKeys.has(documentType));
      const reviewed =
        reviewedDocumentKeys.has(requirement.requirement_key) ||
        Boolean(documentType && reviewedDocumentKeys.has(documentType));
      return present && !reviewed;
    })
    .map((requirement) => requirement.requirement_key)
    .sort();

  const portalKeys = new Set(input.portalSecretKeys);
  const credentialKeys = [
    CANADA_PORTAL_SECRET_KEYS.email,
    CANADA_PORTAL_SECRET_KEYS.password,
  ];
  const missingPortalSecretKeys = credentialKeys.filter((key) => !portalKeys.has(key));

  if (
    normalize(input.country).toLowerCase() !== "canada" ||
    normalize(input.visaType).toUpperCase() !== "CA_TRV"
  ) {
    blockers.push({ code: "wrong_application_product" });
  }
  if (["submitted", "completed", "approved"].includes(normalize(input.applicationStatus).toLowerCase())) {
    blockers.push({ code: "application_already_submitted" });
  }
  if (missingRequiredAnswers.length > 0) {
    blockers.push({ code: "missing_required_answers", fields: missingRequiredAnswers });
  }
  if (missingRequiredDocuments.length > 0) {
    blockers.push({
      code: "missing_required_documents",
      requirements: missingRequiredDocuments,
    });
  }
  if (documentsPendingReview.length > 0) {
    blockers.push({
      code: "documents_pending_review",
      requirements: documentsPendingReview,
    });
  }
  if (!input.applicationConsentPresent) {
    blockers.push({ code: "missing_application_consent" });
  }
  if (!input.applicationSignaturePresent) {
    blockers.push({ code: "missing_application_signature" });
  }
  if (!input.managedAliasPresent) blockers.push({ code: "missing_managed_alias" });
  if (!input.aliasForwardingConsent) {
    blockers.push({ code: "missing_alias_forwarding_consent" });
  }
  if (missingPortalSecretKeys.length > 0) {
    blockers.push({ code: "missing_portal_credentials", fields: missingPortalSecretKeys });
    if (!portalKeys.has(CANADA_PORTAL_SECRET_KEYS.invitationCode)) {
      blockers.push({
        code: "missing_portal_invitation_code",
        fields: [CANADA_PORTAL_SECRET_KEYS.invitationCode],
      });
    }
  }

  if (!input.portalTermsConsentPresent) {
    blockers.push({ code: "missing_portal_terms_consent" });
  }

  const loginBlockerCodes = new Set<CanadaReadinessBlockerCode>([
    "wrong_application_product",
    "application_already_submitted",
    "missing_managed_alias",
    "missing_alias_forwarding_consent",
    "missing_portal_credentials",
    "missing_portal_invitation_code",
  ]);
  const loginBlockers = blockers.filter((blocker) => loginBlockerCodes.has(blocker.code));
  const purposeMissingAnswers = CANADA_PURPOSE_REQUIRED_FIELDS.filter(
    (field) => !hasAnswer(input.answers[field]),
  );
  const readyForPortalLogin = loginBlockers.length === 0;
  const readyForTermsAcceptance = readyForPortalLogin && input.portalTermsConsentPresent;
  const readyForFullForm =
    readyForTermsAcceptance &&
    input.applicationConsentPresent &&
    input.applicationSignaturePresent &&
    missingRequiredAnswers.length === 0 &&
    missingRequiredDocuments.length === 0 &&
    documentsPendingReview.length === 0;

  return {
    readyForPortalLogin,
    readyForTermsAcceptance,
    readyForPurposePage: readyForTermsAcceptance && purposeMissingAnswers.length === 0,
    readyForFullForm,
    blockers,
    loginBlockers,
    purposeMissingAnswers,
    missingRequiredAnswers,
    missingRequiredDocuments,
    documentsPendingReview,
    missingPortalSecretKeys,
  };
}
