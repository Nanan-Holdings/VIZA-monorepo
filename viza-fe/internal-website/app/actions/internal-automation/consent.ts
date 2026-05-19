"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  getCustomerAutomationContext,
  getOwnedApplication,
  insertApplicationEvent,
  type ApplicationAutomationRow,
  type ApplicationSignatureRow,
  type ConsentEventRow,
  type InternalSupabaseClient,
} from "./db";
import {
  buildConsentStateSummary,
  readApplicationAutomationBundles,
} from "./read-model";
import {
  actionErrorMessage,
  actionFail,
  actionOk,
  type AutomationActionResult,
  type ConsentStateSummary,
} from "./types";

async function getRequestAttribution(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");

  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() || null,
    userAgent: headerStore.get("user-agent"),
  };
}

async function readConsentState(
  adminClient: InternalSupabaseClient,
  application: ApplicationAutomationRow,
): Promise<AutomationActionResult<ConsentStateSummary>> {
  const bundlesResult = await readApplicationAutomationBundles(adminClient, [application]);
  if (!bundlesResult.ok) return bundlesResult;

  const bundle = bundlesResult.data[0];
  if (!bundle) {
    return actionFail("NOT_FOUND", "Consent state was not found.");
  }

  return actionOk(
    buildConsentStateSummary(bundle.application, bundle.consentEvents, bundle.signatures),
  );
}

export async function getCustomerConsentState(input: {
  applicationId: string;
}): Promise<AutomationActionResult<ConsentStateSummary>> {
  try {
    if (!input.applicationId) {
      return actionFail("VALIDATION_ERROR", "applicationId is required.");
    }

    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

    const applicationResult = await getOwnedApplication(
      contextResult.data.adminClient,
      contextResult.data.applicantId,
      input.applicationId,
    );
    if (!applicationResult.ok) return applicationResult;

    return readConsentState(
      contextResult.data.adminClient,
      applicationResult.data,
    );
  } catch (error) {
    console.error(
      "[getCustomerConsentState]",
      actionErrorMessage(error, "Unexpected consent state error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load consent state.");
  }
}

export async function acceptCustomerConsent(input: {
  applicationId: string;
  consentType: string;
  version: string;
  documentHash?: string;
}): Promise<AutomationActionResult<ConsentStateSummary>> {
  try {
    const consentType = input.consentType?.trim();
    const version = input.version?.trim();

    if (!input.applicationId || !consentType || !version) {
      return actionFail(
        "VALIDATION_ERROR",
        "applicationId, consentType, and version are required.",
      );
    }

    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

    const applicationResult = await getOwnedApplication(
      contextResult.data.adminClient,
      contextResult.data.applicantId,
      input.applicationId,
    );
    if (!applicationResult.ok) return applicationResult;

    const { data: existing, error: existingError } = await contextResult.data.adminClient
      .from<ConsentEventRow>("consent_events")
      .select("id, application_id, applicant_id, consent_type, version, accepted, document_hash, created_at")
      .eq("application_id", applicationResult.data.id)
      .eq("consent_type", consentType)
      .eq("version", version)
      .eq("accepted", true)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return actionFail("DB_ERROR", "Could not verify existing consent.");
    }

    if (!existing) {
      const attribution = await getRequestAttribution();
      const { error } = await contextResult.data.adminClient
        .from<ConsentEventRow>("consent_events")
        .insert({
          application_id: applicationResult.data.id,
          applicant_id: contextResult.data.applicantId,
          consent_type: consentType,
          version,
          accepted: true,
          ip_address: attribution.ipAddress,
          user_agent: attribution.userAgent,
          document_hash: input.documentHash?.trim() || null,
        });

      if (error) {
        return actionFail("DB_ERROR", "Could not save consent.");
      }

      await insertApplicationEvent(contextResult.data.adminClient, {
        applicationId: applicationResult.data.id,
        applicantId: contextResult.data.applicantId,
        eventType: "consent_accepted",
        actorType: "customer",
        actorId: contextResult.data.userId,
        message: "Customer accepted a consent document.",
        metadata: {
          consent_type: consentType,
          version,
        },
      });
    }

    revalidatePath("/client/consent");
    revalidatePath("/client/status");

    return readConsentState(
      contextResult.data.adminClient,
      applicationResult.data,
    );
  } catch (error) {
    console.error(
      "[acceptCustomerConsent]",
      actionErrorMessage(error, "Unexpected consent acceptance error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not accept consent.");
  }
}

export async function saveCustomerApplicationSignature(input: {
  applicationId: string;
  signerName: string;
  signatureType?: string;
  signatureText?: string;
  signedDocumentPath?: string;
  documentHash?: string;
}): Promise<AutomationActionResult<ConsentStateSummary>> {
  try {
    const signerName = input.signerName?.trim();
    const signatureType = input.signatureType?.trim() || "agency_authorisation";

    if (!input.applicationId || !signerName || signerName.length < 2) {
      return actionFail(
        "VALIDATION_ERROR",
        "applicationId and signerName are required.",
      );
    }

    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

    const applicationResult = await getOwnedApplication(
      contextResult.data.adminClient,
      contextResult.data.applicantId,
      input.applicationId,
    );
    if (!applicationResult.ok) return applicationResult;

    let existingQuery = contextResult.data.adminClient
      .from<ApplicationSignatureRow>("application_signatures")
      .select(
        "id, application_id, applicant_id, signature_type, signer_name, signed_document_path, document_hash, signed_at, created_at",
      )
      .eq("application_id", applicationResult.data.id)
      .eq("signature_type", signatureType)
      .eq("signer_name", signerName)
      .limit(1);

    if (input.documentHash?.trim()) {
      existingQuery = existingQuery.eq("document_hash", input.documentHash.trim());
    }

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();

    if (existingError) {
      return actionFail("DB_ERROR", "Could not verify existing signature.");
    }

    if (!existing) {
      const attribution = await getRequestAttribution();
      const { error } = await contextResult.data.adminClient
        .from<ApplicationSignatureRow>("application_signatures")
        .insert({
          application_id: applicationResult.data.id,
          applicant_id: contextResult.data.applicantId,
          signature_type: signatureType,
          signer_name: signerName,
          signature_text: input.signatureText?.trim() || null,
          signed_document_path: input.signedDocumentPath?.trim() || null,
          document_hash: input.documentHash?.trim() || null,
          ip_address: attribution.ipAddress,
          user_agent: attribution.userAgent,
        });

      if (error) {
        return actionFail("DB_ERROR", "Could not save signature.");
      }

      await insertApplicationEvent(contextResult.data.adminClient, {
        applicationId: applicationResult.data.id,
        applicantId: contextResult.data.applicantId,
        eventType: "signature_saved",
        actorType: "customer",
        actorId: contextResult.data.userId,
        message: "Customer saved an application signature.",
        metadata: {
          signature_type: signatureType,
        },
      });
    }

    revalidatePath("/client/consent");
    revalidatePath("/client/status");

    return readConsentState(
      contextResult.data.adminClient,
      applicationResult.data,
    );
  } catch (error) {
    console.error(
      "[saveCustomerApplicationSignature]",
      actionErrorMessage(error, "Unexpected signature save error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not save signature.");
  }
}
