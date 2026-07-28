import { redirect } from "next/navigation";
import { ConsentClient } from "./consent-client";
import {
  AGENCY_AUTHORISATION_DOCUMENT,
  AGENCY_SIGNATURE_TYPE,
  CONSENT_DOCUMENTS,
  type ConsentApplication,
  type ConsentDocumentCounts,
  type ConsentDocumentStatus,
  type ConsentHistoryEvent,
  type ConsentProgressCounts,
  type NextConsentStep,
  type SignatureMode,
  type SignatureStatus,
} from "./consent-config";
import { getConsentApplicantSession } from "./session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDestinationDisplayName,
  getDestinationDisplayNameZh,
  getDestinationFlag,
  getFormVisaType,
  getVisaTypeDisplayName,
  getVisaTypeDisplayNameZh,
} from "@/lib/visa-destinations";

export const dynamic = "force-dynamic";

interface ConsentPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

interface ApplicationRow {
  id: string;
  country: string;
  visa_type: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  packet_status: string | null;
  external_status: string | null;
}

interface ConsentEventRow {
  id: string;
  consent_type: string;
  version: string;
  accepted: boolean;
  document_hash: string | null;
  created_at: string | null;
}

interface SignatureRow {
  signer_name: string | null;
  signature_text: string | null;
  document_hash: string | null;
  signed_at: string | null;
  created_at: string | null;
}

interface AnswerRow {
  field_name: string;
  value_text: string | null;
}

interface DocumentRow {
  status: string;
}

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

function mapApplication(row: ApplicationRow): ConsentApplication {
  const normalizedVisaType = getFormVisaType(row.visa_type);

  return {
    id: row.id,
    country: row.country,
    visaType: normalizedVisaType,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    packetStatus: row.packet_status,
    externalStatus: row.external_status,
    countryName: getDestinationDisplayName(row.country),
    countryNameZh: getDestinationDisplayNameZh(row.country),
    countryFlag: getDestinationFlag(row.country),
    visaTypeLabel: getVisaTypeDisplayName(normalizedVisaType),
    visaTypeLabelZh: getVisaTypeDisplayNameZh(normalizedVisaType),
  };
}

function buildApplicationHref(application: ConsentApplication): string {
  const params = new URLSearchParams({
    applicationId: application.id,
    country: application.country,
    visaType: application.visaType,
  });
  return `/client/application?${params.toString()}`;
}

function buildDocumentsHref(applicationId: string): string {
  const params = new URLSearchParams({
    view: "detail",
    applicationId,
  });
  return `/client/documents?${params.toString()}`;
}

function buildStatusHref(applicationId: string): string {
  return `/client/status?applicationId=${encodeURIComponent(applicationId)}`;
}

function buildConsentStatuses(rows: ConsentEventRow[]): ConsentDocumentStatus[] {
  return CONSENT_DOCUMENTS.map((document) => {
    const acceptedRows = rows.filter(
      (row) => row.consent_type === document.consentType && row.accepted,
    );
    const currentAccepted = acceptedRows.find(
      (row) =>
        row.version === document.version &&
        row.document_hash === document.documentHash,
    );
    const latestAccepted = acceptedRows[0] ?? null;

    return {
      consentType: document.consentType,
      title: document.title,
      shortTitle: document.shortTitle,
      version: document.version,
      href: document.href,
      documentHash: document.documentHash,
      summary: document.summary,
      accepted: Boolean(latestAccepted),
      acceptedVersion: latestAccepted?.version ?? null,
      acceptedAt: latestAccepted?.created_at ?? null,
      currentVersionAccepted: Boolean(currentAccepted),
    };
  });
}

function buildConsentHistory(rows: ConsentEventRow[]): ConsentHistoryEvent[] {
  return rows
    .filter((row) => row.accepted)
    .map((row) => {
      const document = CONSENT_DOCUMENTS.find(
        (item) => item.consentType === row.consent_type,
      );

      return {
        id: row.id,
        consentType: (document?.consentType ?? "agency_authorisation") as ConsentHistoryEvent["consentType"],
        title: document?.title ?? row.consent_type.replace(/_/g, " "),
        version: row.version,
        acceptedAt: row.created_at,
        documentHash: row.document_hash,
      };
    });
}

function inferSignatureMode(signatureText: string | null): SignatureMode | "unknown" | null {
  if (!signatureText) return null;
  if (signatureText.startsWith("data:image/")) return "drawn";
  return "typed";
}

function buildSignatureStatus(rows: SignatureRow[]): SignatureStatus {
  const currentSignature = rows.find(
    (row) => row.document_hash === AGENCY_AUTHORISATION_DOCUMENT.documentHash,
  );
  const latestSignature = currentSignature ?? rows[0] ?? null;

  return {
    currentVersionSigned: Boolean(currentSignature),
    signerName: latestSignature?.signer_name ?? null,
    signedAt: latestSignature?.signed_at ?? latestSignature?.created_at ?? null,
    documentHash: latestSignature?.document_hash ?? null,
    signatureMode: inferSignatureMode(latestSignature?.signature_text ?? null),
  };
}

function buildDocumentCounts(rows: DocumentRow[]): ConsentDocumentCounts {
  return rows.reduce<ConsentDocumentCounts>(
    (counts, document) => {
      counts.total += 1;
      if (document.status === "missing") counts.missing += 1;
      else if (document.status === "rejected") counts.rejected += 1;
      else counts.ready += 1;
      return counts;
    },
    { total: 0, ready: 0, missing: 0, rejected: 0 },
  );
}

function buildProgressCounts(
  answerRows: AnswerRow[],
  documentRows: DocumentRow[],
): ConsentProgressCounts {
  const filledFields = new Set(
    answerRows
      .filter((answer) => answer.value_text?.trim())
      .map((answer) => answer.field_name),
  );

  return {
    answerCount: [...filledFields].filter((fieldName) => fieldName !== "photo_path").length,
    hasPhoto: filledFields.has("photo_path"),
    documents: buildDocumentCounts(documentRows),
  };
}

function resolveNextStep({
  selectedApplication,
  consentStatuses,
  signatureStatus,
  progressCounts,
}: {
  selectedApplication: ConsentApplication | null;
  consentStatuses: ConsentDocumentStatus[];
  signatureStatus: SignatureStatus;
  progressCounts: ConsentProgressCounts;
}): NextConsentStep {
  if (!selectedApplication) {
    return {
      key: "start_application",
      href: "/client/application",
      label: "Start application",
      reason: "Consent records are scoped to one visa application.",
    };
  }

  const currentConsentMissing = consentStatuses.some(
    (document) => !document.currentVersionAccepted,
  );
  if (currentConsentMissing) {
    return {
      key: "complete_consent",
      href: `/client/consent?applicationId=${encodeURIComponent(selectedApplication.id)}`,
      label: "Complete consent",
      reason: "Packet generation and external handoff stay locked until all current consent versions are accepted.",
    };
  }

  if (!signatureStatus.currentVersionSigned) {
    return {
      key: "sign_authorisation",
      href: `/client/consent?applicationId=${encodeURIComponent(selectedApplication.id)}`,
      label: "Sign authorisation",
      reason: "The agency authorisation mandate still needs the applicant e-signature.",
    };
  }

  const alreadySubmitted =
    selectedApplication.status === "submitted" ||
    Boolean(selectedApplication.submittedAt);
  if (!alreadySubmitted && progressCounts.answerCount === 0) {
    return {
      key: "fill_application",
      href: buildApplicationHref(selectedApplication),
      label: "Continue form",
      reason: "Consent is complete; the application form is the next missing step.",
    };
  }

  const documentsMissing =
    progressCounts.documents.total === 0 ||
    progressCounts.documents.missing > 0 ||
    progressCounts.documents.rejected > 0;
  if (!alreadySubmitted && documentsMissing) {
    return {
      key: "upload_documents",
      href: buildDocumentsHref(selectedApplication.id),
      label: "Review documents",
      reason: "Consent is complete; supporting documents are the next missing step.",
    };
  }

  return {
    key: "view_status",
    href: buildStatusHref(selectedApplication.id),
    label: "View status",
    reason: "Consent and signature are complete for VIZA packet preparation. Official final signatures remain outside this step.",
  };
}

export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  const applicantSession = await getConsentApplicantSession();
  if (!applicantSession) {
    redirect("/client/login");
  }

  const params = (await searchParams) ?? {};
  const requestedApplicationId = getSearchParam(params, "applicationId");
  const requestedCountry = getSearchParam(params, "country");
  const requestedVisaType = getSearchParam(params, "visaType") ?? getSearchParam(params, "visa_type");

  const adminClient = createAdminClient();
  const { data: profileData } = await adminClient
    .from("applicant_profiles")
    .select("full_name, email")
    .eq("id", applicantSession.applicantId)
    .maybeSingle();

  const { data: applicationData } = await adminClient
    .from("applications")
    .select(
      "id, country, visa_type, status, created_at, updated_at, submitted_at, packet_status, external_status",
    )
    .eq("applicant_id", applicantSession.applicantId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const applications = ((applicationData ?? []) as ApplicationRow[]).map(mapApplication);
  const normalizedRequestedVisaType = requestedVisaType
    ? getFormVisaType(requestedVisaType).toLowerCase()
    : null;
  const selectedApplication =
    applications.find((application) => application.id === requestedApplicationId) ??
    applications.find(
      (application) =>
        requestedCountry &&
        normalizedRequestedVisaType &&
        application.country.toLowerCase() === requestedCountry.toLowerCase() &&
        application.visaType.toLowerCase() === normalizedRequestedVisaType,
    ) ??
    applications[0] ??
    null;

  let consentStatuses: ConsentDocumentStatus[] = buildConsentStatuses([]);
  let consentHistory: ConsentHistoryEvent[] = [];
  let signatureStatus: SignatureStatus = {
    currentVersionSigned: false,
    signerName: null,
    signedAt: null,
    documentHash: null,
    signatureMode: null,
  };
  let progressCounts: ConsentProgressCounts = {
    answerCount: 0,
    hasPhoto: false,
    documents: { total: 0, ready: 0, missing: 0, rejected: 0 },
  };

  if (selectedApplication) {
    const [
      { data: consentData },
      { data: signatureData },
      { data: answerData },
      { data: documentData },
    ] = await Promise.all([
      adminClient
        .from("consent_events")
        .select("id, consent_type, version, accepted, document_hash, created_at")
        .eq("application_id", selectedApplication.id)
        .order("created_at", { ascending: false }),
      adminClient
        .from("application_signatures")
        .select("signer_name, signature_text, document_hash, signed_at, created_at")
        .eq("application_id", selectedApplication.id)
        .eq("signature_type", AGENCY_SIGNATURE_TYPE)
        .order("signed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      adminClient
        .from("visa_application_answers")
        .select("field_name, value_text")
        .eq("application_id", selectedApplication.id),
      adminClient
        .from("application_documents")
        .select("status")
        .eq("application_id", selectedApplication.id),
    ]);

    const consentRows = (consentData ?? []) as ConsentEventRow[];
    consentStatuses = buildConsentStatuses(consentRows);
    consentHistory = buildConsentHistory(consentRows);
    signatureStatus = buildSignatureStatus((signatureData ?? []) as SignatureRow[]);
    progressCounts = buildProgressCounts(
      (answerData ?? []) as AnswerRow[],
      (documentData ?? []) as DocumentRow[],
    );
  }

  const nextStep = resolveNextStep({
    selectedApplication,
    consentStatuses,
    signatureStatus,
    progressCounts,
  });
  const applicantName =
    (profileData as { full_name: string | null; email: string | null } | null)?.full_name ??
    applicantSession.name;

  return (
    <ConsentClient
      applications={applications}
      selectedApplication={selectedApplication}
      consentStatuses={consentStatuses}
      consentHistory={consentHistory}
      signatureStatus={signatureStatus}
      progressCounts={progressCounts}
      nextStep={nextStep}
      applicantName={applicantName}
    />
  );
}
