"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AGENCY_AUTHORISATION_DOCUMENT,
  AGENCY_SIGNATURE_TYPE,
  CONSENT_DOCUMENTS,
  type ConsentSubmissionInput,
  type ConsentSubmissionResult,
} from "./consent-config";
import { getConsentApplicantSession } from "./session";

interface ApplicationRow {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  status: string;
  submitted_at: string | null;
}

interface AnswerRow {
  field_name: string;
  value_text: string | null;
}

interface DocumentRow {
  status: string;
}

interface AuditMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

function applicationHref(application: Pick<ApplicationRow, "id" | "country" | "visa_type">): string {
  const params = new URLSearchParams({
    applicationId: application.id,
    country: application.country,
    visaType: application.visa_type,
  });
  return `/client/application?${params.toString()}`;
}

function documentsHref(applicationId: string): string {
  const params = new URLSearchParams({
    view: "detail",
    applicationId,
  });
  return `/client/documents?${params.toString()}`;
}

function consentHref(applicationId: string): string {
  return `/client/consent?applicationId=${encodeURIComponent(applicationId)}`;
}

function statusHref(applicationId: string): string {
  return `/client/status?applicationId=${encodeURIComponent(applicationId)}`;
}

async function getAuditMetadata(): Promise<AuditMetadata> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    null;

  return {
    ipAddress,
    userAgent: headerStore.get("user-agent"),
  };
}

async function recordApplicationEvent(
  adminClient: ReturnType<typeof createAdminClient>,
  applicationId: string,
  applicantId: string,
  eventType: string,
  message: string,
  metadata: Record<string, string | string[] | null>,
): Promise<void> {
  const { error } = await adminClient.from("application_events").insert({
    application_id: applicationId,
    applicant_id: applicantId,
    event_type: eventType,
    actor_type: "applicant",
    actor_id: applicantId,
    message,
    metadata,
  });

  if (error) {
    console.warn("[client-consent] Failed to record application event:", error.message);
  }
}

async function getNextHrefAfterConsent(
  adminClient: ReturnType<typeof createAdminClient>,
  application: ApplicationRow,
): Promise<string> {
  if (application.status !== "submitted" && !application.submitted_at) {
    const [{ data: answerData }, { data: documentData }] = await Promise.all([
      adminClient
        .from("visa_application_answers")
        .select("field_name, value_text")
        .eq("application_id", application.id),
      adminClient
        .from("application_documents")
        .select("status")
        .eq("application_id", application.id),
    ]);

    const answerRows = (answerData ?? []) as AnswerRow[];
    const documentRows = (documentData ?? []) as DocumentRow[];
    const nonEmptyAnswerFields = new Set(
      answerRows
        .filter((answer) => answer.value_text?.trim())
        .map((answer) => answer.field_name),
    );
    const hasApplicationAnswers = [...nonEmptyAnswerFields].some(
      (fieldName) => fieldName !== "photo_path",
    );

    if (!hasApplicationAnswers) {
      return applicationHref(application);
    }

    const hasMissingDocuments =
      documentRows.length === 0 ||
      documentRows.some((document) =>
        document.status === "missing" || document.status === "rejected",
      );

    if (hasMissingDocuments) {
      return documentsHref(application.id);
    }
  }

  return statusHref(application.id);
}

async function isCurrentConsentComplete(
  adminClient: ReturnType<typeof createAdminClient>,
  applicationId: string,
): Promise<boolean> {
  const { data } = await adminClient
    .from("consent_events")
    .select("consent_type, version, document_hash")
    .eq("application_id", applicationId)
    .eq("accepted", true);

  const rows = (data ?? []) as Array<{
    consent_type: string;
    version: string;
    document_hash: string | null;
  }>;

  return CONSENT_DOCUMENTS.every((document) =>
    rows.some(
      (row) =>
        row.consent_type === document.consentType &&
        row.version === document.version &&
        row.document_hash === document.documentHash,
    ),
  );
}

async function isCurrentSignatureComplete(
  adminClient: ReturnType<typeof createAdminClient>,
  applicationId: string,
): Promise<boolean> {
  const { data } = await adminClient
    .from("application_signatures")
    .select("id")
    .eq("application_id", applicationId)
    .eq("signature_type", AGENCY_SIGNATURE_TYPE)
    .eq("document_hash", AGENCY_AUTHORISATION_DOCUMENT.documentHash)
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}

export async function acceptConsentAndSignature(
  input: ConsentSubmissionInput,
): Promise<ConsentSubmissionResult> {
  try {
    const session = await getConsentApplicantSession();
    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    if (!input.applicationId) {
      return { success: false, error: "Application is required" };
    }

    const adminClient = createAdminClient();
    const { data: applicationData, error: applicationError } = await adminClient
      .from("applications")
      .select("id, applicant_id, country, visa_type, status, submitted_at")
      .eq("id", input.applicationId)
      .maybeSingle();

    if (applicationError) {
      return { success: false, error: applicationError.message };
    }

    const application = applicationData as ApplicationRow | null;
    if (!application || application.applicant_id !== session.applicantId) {
      return { success: false, error: "Application not found" };
    }

    const requestedTypes = new Set<string>(input.acceptedConsentTypes);
    const requestedDocuments = CONSENT_DOCUMENTS.filter((document) =>
      requestedTypes.has(document.consentType),
    );

    if (requestedDocuments.length !== requestedTypes.size) {
      return { success: false, error: "Unsupported consent document" };
    }

    const audit = await getAuditMetadata();
    const acceptedNow: string[] = [];

    for (const document of requestedDocuments) {
      const { data: existing } = await adminClient
        .from("consent_events")
        .select("id")
        .eq("application_id", application.id)
        .eq("consent_type", document.consentType)
        .eq("version", document.version)
        .eq("document_hash", document.documentHash)
        .eq("accepted", true)
        .limit(1)
        .maybeSingle();

      if (existing) continue;

      const { error: insertError } = await adminClient.from("consent_events").insert({
        application_id: application.id,
        applicant_id: session.applicantId,
        consent_type: document.consentType,
        version: document.version,
        accepted: true,
        ip_address: audit.ipAddress,
        user_agent: audit.userAgent,
        document_hash: document.documentHash,
      });

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      acceptedNow.push(document.consentType);
    }

    if (acceptedNow.length > 0) {
      await recordApplicationEvent(
        adminClient,
        application.id,
        session.applicantId,
        "consent.accepted",
        "Applicant accepted current VIZA consent documents.",
        {
          consent_types: acceptedNow,
          versions: requestedDocuments
            .filter((document) => acceptedNow.includes(document.consentType))
            .map((document) => document.version),
        },
      );
    }

    if (input.signature) {
      const signerName = input.signature.signerName.trim();
      const signatureText = input.signature.signatureText.trim();

      if (signerName.length < 2) {
        return { success: false, error: "Signer name is required" };
      }

      if (signatureText.length < 2) {
        return { success: false, error: "Signature is required" };
      }

      if (
        input.signature.mode === "drawn" &&
        !signatureText.startsWith("data:image/png;base64,")
      ) {
        return { success: false, error: "Drawn signature could not be captured" };
      }

      const { data: existingSignature } = await adminClient
        .from("application_signatures")
        .select("id")
        .eq("application_id", application.id)
        .eq("signature_type", AGENCY_SIGNATURE_TYPE)
        .eq("document_hash", AGENCY_AUTHORISATION_DOCUMENT.documentHash)
        .limit(1)
        .maybeSingle();

      if (!existingSignature) {
        const { error: signatureError } = await adminClient
          .from("application_signatures")
          .insert({
            application_id: application.id,
            applicant_id: session.applicantId,
            signature_type: AGENCY_SIGNATURE_TYPE,
            signer_name: signerName,
            signature_text: signatureText,
            document_hash: AGENCY_AUTHORISATION_DOCUMENT.documentHash,
            ip_address: audit.ipAddress,
            user_agent: audit.userAgent,
          });

        if (signatureError) {
          return { success: false, error: signatureError.message };
        }

        await recordApplicationEvent(
          adminClient,
          application.id,
          session.applicantId,
          "consent.signature_created",
          "Applicant signed the VIZA agency authorisation mandate.",
          {
            signature_type: AGENCY_SIGNATURE_TYPE,
            signature_mode: input.signature.mode,
            document_hash: AGENCY_AUTHORISATION_DOCUMENT.documentHash,
          },
        );
      }
    }

    const consentComplete = await isCurrentConsentComplete(adminClient, application.id);
    const signatureComplete = await isCurrentSignatureComplete(adminClient, application.id);
    const nextHref =
      consentComplete && signatureComplete
        ? await getNextHrefAfterConsent(adminClient, application)
        : consentHref(application.id);

    revalidatePath("/client/consent");
    revalidatePath("/client/status");
    revalidatePath("/admin/applications");

    return { success: true, nextHref };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save consent",
    };
  }
}
