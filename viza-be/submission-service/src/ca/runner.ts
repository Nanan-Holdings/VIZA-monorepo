import { applicantVault } from "../applicant-vault.js";
import { writeSubmissionResult } from "../result-writer.js";
import { RetryableRunnerError, type DispatchOutcome } from "../queue/types.js";
import type { GenericSubmissionResult } from "../submission-result.js";
import {
  redactCanadaPortalDiagnostic,
  sanitizeCanadaPortalUrl,
} from "./diagnostics.js";
import { loadCanadaTrvPreflight } from "./preflight.js";
import {
  loginToCanadaIrccPortal,
  runCanadaIrccPortalFlow,
  type CanadaPortalFlowResult,
} from "./portal.js";
import {
  CanadaPasswordRecoveryError,
  recoverCanadaIrccPortalPassword,
} from "./password-recovery.js";
import {
  CANADA_PORTAL_SECRET_KEYS,
  canAdvanceCanadaPurposePageSafely,
} from "./readiness.js";

async function haltAtCheckpoint(input: {
  applicationId: string;
  checkpoint: string;
  message: string;
  portalUrl?: string;
}): Promise<DispatchOutcome> {
  const result: GenericSubmissionResult = {
    country: "GENERIC",
    targetCountry: "CA",
    visaType: "CA_TRV",
    status: "action_required",
    mode: "live_assisted",
    applicationId: input.applicationId,
    ...(input.portalUrl ? { portalUrl: input.portalUrl } : {}),
    actionType: input.checkpoint,
    actionInstructions: input.message,
    implementationStatus: "partial",
    message: input.message,
  };
  await writeSubmissionResult(input.applicationId, result, "action_required");
  return { outcome: "halted_before_pay", reachedStep: input.checkpoint, artefacts: [] };
}

function portalCheckpointMessage(
  portal: CanadaPortalFlowResult,
  missingFullFormAnswers: readonly string[],
): string {
  const suffix = missingFullFormAnswers.length > 0
    ? ` Full-form preflight still requires ${missingFullFormAnswers.length} answer(s).`
    : "";
  switch (portal.checkpoint) {
    case "terms_consent_required":
      return "IRCC requires Terms and Conditions acceptance. Record the versioned applicant authorization before the runner may click I accept.";
    case "terms_consent_record_required":
      return "The account no longer presents the IRCC terms screen, but VIZA has no versioned applicant authorization record. Record it before resuming the draft.";
    case "purpose_missing_answers":
      return `Purpose page is missing: ${(portal.missingFields ?? []).join(", ")}.${suffix}`;
    case "purpose_invalid_answers":
      return `Purpose page has invalid values for: ${(portal.invalidFields ?? []).join(", ")}.${suffix}`;
    case "purpose_selector_drift":
      return `IRCC purpose-page controls no longer match the verified map (${portal.detail ?? "unknown drift"}).`;
    case "purpose_transition_failed":
      return "IRCC did not leave the purpose page after Save and continue; the runner stopped without retrying the write.";
    case "draft_resume_link_missing":
      return "No resumable Canada visitor-visa draft link was found in the managed IRCC account.";
    case "draft_resume_link_ambiguous":
      return "More than one resumable IRCC draft was found; operator selection is required to avoid modifying the wrong application.";
    case "draft_resume_transition_failed":
      return "IRCC exposed one resumable draft, but its authenticated application route did not finish loading. The runner stopped without retrying the navigation.";
    case "purpose_filled":
      return `Purpose page was filled from stored answers and left unsaved.${suffix}`;
    case "next_section_mapping_required":
      return `Purpose page was saved, but the next authenticated section has not yet been mapped.${suffix}`;
    case "tourist_type_selector_drift":
      return "IRCC's tourist application-type Continue control no longer matches the verified selector.";
    case "tourist_type_transition_failed":
      return "IRCC did not leave the tourist application-type page after Continue; the runner stopped without retrying.";
    case "representative_selector_drift":
      return `IRCC's representative declaration controls no longer match the verified map (${portal.detail ?? "unknown drift"}).`;
    case "representative_status_required":
      return "IRCC states that preparing an application for someone else is representation. VIZA must not select No or claim an unpaid relationship unless that is truthful. Continue only after an authorized paid-representative credential or documented uncompensated status, verified identity/contact details, and the applicant's signed representative appointment are on record.";
    case "payment_checkpoint_observed":
      return "The official IRCC payment checkpoint was observed. No payment action was clicked.";
    case "payment_entry_ready":
      return "The official IRCC payment-entry controls were observed. No card data was entered and no payment action was clicked.";
    case "account_activation_required":
      return "The managed IRCC Portal account still requires activation.";
    case "credentials_rejected":
      return "The managed IRCC Portal credentials were rejected.";
    case "portal_api_unavailable":
      return "IRCC accepted the managed login, but its authenticated Portal API was unavailable.";
    case "login_response_unverified":
      return "The IRCC login response could not be verified before timeout.";
    default:
      return `Canada IRCC portal stopped at ${portal.checkpoint}.`;
  }
}

/**
 * Live-assisted Canada TRV runner. Every expected user-data/legal/payment gate
 * becomes a durable action-required checkpoint rather than a retry loop.
 */
export async function runOne(
  applicationId: string,
  jobId?: string,
): Promise<DispatchOutcome> {
  const preflight = await loadCanadaTrvPreflight(applicationId);
  if (!preflight.readiness.readyForPortalLogin) {
    const details = preflight.readiness.loginBlockers.map((blocker) => {
      const fields = blocker.fields ?? blocker.requirements ?? [];
      return fields.length > 0 ? `${blocker.code}(${fields.join(",")})` : blocker.code;
    });
    return haltAtCheckpoint({
      applicationId,
      checkpoint: "portal_login_preflight_blocked",
      message: `Canada portal login preflight blocked: ${details.join("; ")}`,
    });
  }

  const vaultOptions = {
    actor: "ca-trv-runner@submission-service",
    correlationId: jobId,
  };
  const [email, storedPassword] = await Promise.all([
    applicantVault.require(
      preflight.applicantId,
      CANADA_PORTAL_SECRET_KEYS.email,
      vaultOptions,
    ),
    applicantVault.require(
      preflight.applicantId,
      CANADA_PORTAL_SECRET_KEYS.password,
      vaultOptions,
    ),
  ]);

  if (email.trim().toLowerCase() !== preflight.managedAlias?.trim().toLowerCase()) {
    return haltAtCheckpoint({
      applicationId,
      checkpoint: "managed_account_mismatch",
      message: "The vault account email does not match the applicant's managed inbox alias.",
    });
  }

  let password = storedPassword;
  const advancePurposePage = canAdvanceCanadaPurposePageSafely(
    preflight.readiness,
  );
  let portal = await runCanadaIrccPortalFlow({
    email,
    password,
    answers: preflight.answers,
    portalTermsAuthorized: preflight.readiness.readyForTermsAcceptance,
    advancePurposePage,
    headless: process.env.CA_TRV_HEADFUL !== "1",
  });

  if (
    portal.checkpoint === "credentials_rejected" &&
    process.env.CA_TRV_MANAGED_PASSWORD_RECOVERY_DISABLED !== "1"
  ) {
    try {
      const recovered = await recoverCanadaIrccPortalPassword({
        applicantId: preflight.applicantId,
        email,
        headless: process.env.CA_TRV_HEADFUL !== "1",
      });
      password = recovered.password;

      let persisted = false;
      let lastVaultError: unknown;
      for (let attempt = 0; attempt < 3 && !persisted; attempt += 1) {
        try {
          await applicantVault.set(
            preflight.applicantId,
            CANADA_PORTAL_SECRET_KEYS.password,
            password,
            {
              ...vaultOptions,
              note: "IRCC managed-account recovery; official password update verified",
            },
          );
          persisted = true;
        } catch (error) {
          lastVaultError = error;
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          }
        }
      }
      if (!persisted) {
        throw lastVaultError instanceof Error
          ? lastVaultError
          : new Error("Canada recovered credential vault rotation failed");
      }

      const verified = await loginToCanadaIrccPortal({
        email,
        password,
        headless: process.env.CA_TRV_HEADFUL !== "1",
      });
      if (verified.checkpoint === "login_selector_drift") {
        throw new RetryableRunnerError(
          "canada_trv_recovered_login_selector_drift",
        );
      }
      if (verified.checkpoint === "unexpected_redirect") {
        throw new RetryableRunnerError(
          "canada_trv_recovered_login_unexpected_redirect",
        );
      }
      if (verified.checkpoint !== "authenticated_portal") {
        return haltAtCheckpoint({
          applicationId,
          checkpoint: "password_recovery_login_unverified",
          message:
            "IRCC confirmed the managed password update, but the follow-up account login was not verified.",
          portalUrl: sanitizeCanadaPortalUrl(verified.url),
        });
      }

      portal = await runCanadaIrccPortalFlow({
        email,
        password,
        answers: preflight.answers,
        portalTermsAuthorized: preflight.readiness.readyForTermsAcceptance,
        advancePurposePage,
        headless: process.env.CA_TRV_HEADFUL !== "1",
      });
    } catch (error) {
      if (error instanceof CanadaPasswordRecoveryError) {
        return haltAtCheckpoint({
          applicationId,
          checkpoint: error.checkpoint,
          message: error.message,
        });
      }
      throw error;
    }
  }

  if (portal.checkpoint === "login_selector_drift") {
    throw new RetryableRunnerError("canada_trv_login_selector_drift");
  }
  if (portal.checkpoint === "unexpected_redirect") {
    throw new RetryableRunnerError("canada_trv_unexpected_login_redirect");
  }
  if (portal.checkpoint === "portal_api_unavailable") {
    throw new RetryableRunnerError("canada_trv_portal_api_unavailable");
  }
  if (portal.checkpoint === "login_response_unverified") {
    throw new RetryableRunnerError("canada_trv_login_response_unverified");
  }

  if (
    portal.checkpoint === "payment_checkpoint_observed" ||
    portal.checkpoint === "payment_entry_ready"
  ) {
    const fee = preflight.feeCheckpoint;
    const missingFeeGates = [
      !fee.quotePresent && "official_fee_quote",
      !fee.paymentIntentPresent && "official_fee_payment_intent",
      !fee.userFeeConsentPresent && "user_fee_consent",
      !fee.adminApprovalPresent && "admin_fee_approval",
    ].filter((value): value is string => Boolean(value));
    if (missingFeeGates.length > 0) {
      return haltAtCheckpoint({
        applicationId,
        checkpoint: "managed_payment_authorization_required",
        message: `Official IRCC payment page was validated without charging. Missing gates: ${missingFeeGates.join(", ")}.`,
        portalUrl: sanitizeCanadaPortalUrl(portal.url),
      });
    }
  }

  const message = redactCanadaPortalDiagnostic(
    portalCheckpointMessage(portal, preflight.readiness.missingRequiredAnswers),
    { email, password },
  );
  return haltAtCheckpoint({
    applicationId,
    checkpoint: portal.checkpoint,
    message,
    portalUrl: sanitizeCanadaPortalUrl(portal.url),
  });
}

export const runCaRunner = runOne;
