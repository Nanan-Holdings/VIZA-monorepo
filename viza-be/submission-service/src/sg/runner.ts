import * as fs from "node:fs/promises";
import * as path from "node:path";
import { artifact } from "../artifact.js";
import { getCountrySubmissionProvider } from "../country-submissions/index.js";
import { loadCanonicalAnswers } from "../queue/answers.js";
import { NeedsHumanError, RetryableRunnerError, type DispatchOutcome } from "../queue/types.js";
import {
  RunnerJobOwnershipLostError,
  requirePoolExecutionIdentity,
  type RunnerExecutionContext,
} from "../queue/execution-context.js";
import { writeRunnerPoolSubmissionResult } from "../result-writer.js";
import {
  normalizeSgacPortalPayload,
  runSgacPortalSubmission,
  SGAC_OFFICIAL_PORTAL_URL,
  SgacPortalError,
  SgacPortalValidationError,
} from "../sgac/index.js";
import type { CountrySubmissionApplication } from "../country-submissions/types.js";
import type { SgArrivalCardSubmissionResult } from "../submission-result.js";

async function persistFiles(
  jobId: string,
  prefix: "screenshots" | "pdfs",
  paths: string[],
  contentType: "image/png" | "application/pdf",
): Promise<string[]> {
  const stored: string[] = [];
  for (let index = 0; index < paths.length; index += 1) {
    const filePath = paths[index];
    try {
      const bytes = await fs.readFile(filePath);
      const extension = contentType === "image/png" ? "png" : "pdf";
      const safeBase = path.basename(filePath).replace(/[^a-zA-Z0-9._-]+/gu, "-");
      const ref = await artifact.put(
        jobId,
        `sgac/${prefix}/${String(index + 1).padStart(2, "0")}-${safeBase || `artifact.${extension}`}`,
        bytes,
        { contentType, upsert: true },
      );
      stored.push(ref.path);
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
      console.warn(`[runner-pool] sgac/${prefix} artifact persistence failed: ${message}`);
    }
  }
  return stored;
}

function fullName(answers: Record<string, string>): string | null {
  const value = answers.full_name ?? [answers.given_names, answers.surname].filter(Boolean).join(" ");
  return value.trim() || null;
}

function toSgacApplication(applicationId: string, answers: Record<string, string>): CountrySubmissionApplication {
  return {
    applicationId,
    countryCode: "SG",
    visaType: "SG_ARRIVAL_CARD",
    profile: {
      fullName: fullName(answers),
      dateOfBirth: answers.date_of_birth ?? null,
      gender: answers.sex ?? answers.gender ?? null,
      nationality: answers.nationality ?? null,
      passportNumber: answers.passport_number ?? null,
      passportExpiryDate: answers.passport_expiry_date ?? null,
      passportIssuingCountry: answers.passport_issuing_country ?? null,
      email: answers.email ?? answers.email_address ?? null,
      phone: answers.phone ?? answers.phone_number ?? null,
    },
    trip: {
      destinationCountry: "Singapore",
      arrivalDate: answers.arrival_date ?? null,
      departureDate: answers.departure_date ?? null,
      purpose: answers.purpose_of_travel ?? null,
      accommodationName: answers.accommodation_name ?? null,
      accommodationAddress: answers.accommodation_address ?? null,
    },
    // SGAC's provider preserves these exact values as countrySpecific fields.
    answers,
  };
}

/** Cloud runner_job adapter for ICA SG Arrival Card. */
export async function runOne(
  applicationId: string,
  jobId?: string,
  executionContext?: RunnerExecutionContext,
): Promise<DispatchOutcome> {
  const identity = requirePoolExecutionIdentity(
    executionContext,
    jobId,
    "SG Arrival Card pool execution",
  );
  const poolExecutionContext = identity.executionContext;
  const answers = await loadCanonicalAnswers(applicationId);
  const provider = getCountrySubmissionProvider("singapore", "SG_ARRIVAL_CARD");
  if (!provider) throw new NeedsHumanError("SGAC provider is not registered");

  const sgacApplication = toSgacApplication(applicationId, answers);
  const validation = provider.validate(sgacApplication);
  if (!validation.ok) {
    throw new NeedsHumanError(`sgac: missing required answers: ${validation.missingRequiredFields.join(", ")}`);
  }

  const payload = provider.mapToSubmissionPayload(sgacApplication, {
    dryRun: false,
    idempotencyKey: `runner-job:${identity.jobId}`,
  });
  try {
    const portal = await runSgacPortalSubmission(normalizeSgacPortalPayload(payload), {
      headless: process.env.SGAC_PLAYWRIGHT_HEADLESS !== "false",
      stopBeforeSubmit: process.env.SGAC_STOP_BEFORE_SUBMIT === "1",
      executionContext: poolExecutionContext,
    });
    poolExecutionContext.assertOwned();
    const screenshots = await persistFiles(identity.jobId, "screenshots", portal.screenshots, "image/png");
    const pdfs = await persistFiles(identity.jobId, "pdfs", portal.pdfs, "application/pdf");
    const result: SgArrivalCardSubmissionResult = {
      country: "SG",
      visaType: "SG_ARRIVAL_CARD",
      status: portal.submitted ? "submitted" : "official_portal_error",
      mode: "live_assisted",
      provider: "sg_arrival_card_live",
      applicationId,
      submitted: portal.submitted,
      confirmationNumber: portal.confirmationNumber ?? null,
      referenceNumber: portal.referenceNumber ?? null,
      portalUrl: portal.portalUrl,
      portalResponseSummary: portal.portalResponseSummary,
      confirmationPdfStoragePath: pdfs[0] ?? null,
      artifacts: { screenshots, pdfs, logs: portal.logs, traces: [] },
    };
    poolExecutionContext.assertOwned();
    const resultStatus = portal.submitted ? "submitted" : "failed";
    await writeRunnerPoolSubmissionResult(poolExecutionContext, result, resultStatus);
    if (!portal.submitted) {
      throw new NeedsHumanError("sgac: ICA runner stopped before official confirmation");
    }
    return { outcome: "submitted_pending_pay", reachedStep: "official_confirmation", artefacts: pdfs };
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === "AbortError";
    if (error instanceof RunnerJobOwnershipLostError || isAbortError || poolExecutionContext.signal.aborted) {
      const abortReason = poolExecutionContext.signal.reason;
      throw abortReason instanceof Error ? abortReason : error;
    }
    if (error instanceof SgacPortalValidationError) {
      throw new NeedsHumanError(`sgac: ${error.message}`);
    }
    if (error instanceof SgacPortalError) {
      throw new RetryableRunnerError(`sgac: ${error.message}`);
    }
    throw error;
  }
}
