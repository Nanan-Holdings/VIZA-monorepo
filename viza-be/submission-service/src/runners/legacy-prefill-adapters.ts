import {
  loadCanonicalAnswers,
  loadSubmissionPreflightContext,
  matchesSubmissionPreflightApplication,
  pick,
} from "../queue/answers.js";
import { mapStandardToOutcome } from "./result-map.js";
import { NeedsHumanError, type DispatchOutcome } from "../queue/types.js";
import { runInPrefill } from "../in/runner.js";
import { ensureApplicantInboxAlias } from "../inbox/alias.js";
import { formatInPreflightFailure, validateInSubmissionPreflight } from "../in/preflight.js";
import { runLkPrefill } from "../lk/runner.js";
import { runKhPrefill } from "../kh/runner.js";
import { runLaPrefill } from "../la/runner.js";
import { runZaPrefill } from "../za/runner.js";
import { createManagedPaymentHooks } from "../official-fee/managed-payment-hooks.js";
import type { ManagedPaymentHooks } from "./managed-payment-boundary.js";

/**
 * runOne adapters for the dedicated-CanonicalAnswers prefill runners
 * (RUN-IN/LK/KH/LA/ZA-001). Each loads canonical answers, builds the
 * country's CanonicalAnswers, runs the prefill, and maps the result to a
 * DispatchOutcome via the shared result-map (RUN-CORE-002). Re-exported as
 * `runOne` from each country's runner.ts and bound in dispatch.ts.
 */

export async function runIndia(
  applicationId: string,
  jobId?: string,
  paymentHooks?: ManagedPaymentHooks,
): Promise<DispatchOutcome> {
  const [rec, context] = await Promise.all([
    loadCanonicalAnswers(applicationId),
    loadSubmissionPreflightContext(applicationId),
  ]);
  if (!matchesSubmissionPreflightApplication(context, "india", "IN_E_VISA")) {
    throw new NeedsHumanError(
      "India runner received an application outside IN_E_VISA",
    );
  }
  const managedEmailAlias =
    context.inboxAlias ?? (await ensureApplicantInboxAlias(context.applicantId)).alias;
  const preflight = validateInSubmissionPreflight({
    answers: rec,
    managedEmailAlias,
    documents: context.documents,
    captchaConfigured: Boolean(process.env.TWOCAPTCHA_API_KEY?.trim()),
  });
  if (!preflight.ready) {
    throw new NeedsHumanError(`IN_E_VISA preflight failed: ${formatInPreflightFailure(preflight)}`);
  }

  const result = await runInPrefill({
    jobId: jobId ?? applicationId,
    applicationId,
    answers: {
      surname: preflight.normalizedAnswers.surname,
      given_names: preflight.normalizedAnswers.given_names,
      date_of_birth: preflight.registration.dateOfBirth,
      nationality: preflight.registration.nationality,
      passport_number: preflight.normalizedAnswers.passport_number,
      passport_expiry_date: preflight.normalizedAnswers.passport_expiry_date,
      passport_issuing_country: preflight.normalizedAnswers.passport_issuing_country,
      email: preflight.registration.emailAddress,
      phone: preflight.normalizedAnswers.phone_number,
      intended_arrival_date: preflight.registration.expectedArrivalDate,
      port_of_arrival: preflight.registration.arrivalPortId,
      occupation: preflight.normalizedAnswers.occupation || undefined,
      passport_type: preflight.registration.passportTypeId,
      mission_code: preflight.registration.arrivalPortId,
      visa_service_id: preflight.registration.touristServiceId,
      visa_purpose: preflight.registration.touristPurposeId,
      visited_drc_uganda_south_sudan_last_21_days:
        preflight.normalizedAnswers.visited_drc_uganda_south_sudan_last_21_days,
      completed_21_days_after_exit:
        preflight.normalizedAnswers.completed_21_days_after_exit || undefined,
      ebola_symptoms_last_21_days:
        preflight.normalizedAnswers.ebola_symptoms_last_21_days || undefined,
      ebola_symptom: preflight.normalizedAnswers.ebola_symptom || undefined,
    },
    allowOfficialApplicationCreation: process.env.IN_LIVE_QA_TO_PAYMENT === "1",
    paymentHooks: paymentHooks ?? createManagedPaymentHooks({
      applicationId,
      workerId: jobId ?? applicationId,
      country: "india",
      visaType: "IN_E_VISA",
    }),
  });
  return mapStandardToOutcome(result);
}

export async function runSriLanka(
  applicationId: string,
  jobId?: string,
  paymentHooks?: ManagedPaymentHooks,
): Promise<DispatchOutcome> {
  const rec = await loadCanonicalAnswers(applicationId);
  const result = await runLkPrefill({
    jobId: jobId ?? applicationId,
    applicationId,
    answers: {
      surname: pick(rec, "surname"),
      given_names: pick(rec, "given_names"),
      date_of_birth: pick(rec, "date_of_birth"),
      nationality: pick(rec, "nationality"),
      passport_number: pick(rec, "passport_number"),
      passport_expiry_date: pick(rec, "passport_expiry_date"),
      passport_issuing_country: pick(rec, "passport_issuing_country", pick(rec, "nationality")),
      email: pick(rec, "email"),
      phone: pick(rec, "phone"),
      intended_arrival_date: pick(rec, "intended_arrival_date"),
      port_of_arrival: pick(rec, "port_of_arrival", "CMB"),
      occupation: pick(rec, "occupation"),
      address_in_sri_lanka: pick(rec, "address_in_sri_lanka"),
      visa_variant: pick(rec, "visa_variant", "tourist_double"),
    },
    paymentHooks: paymentHooks ?? createManagedPaymentHooks({
      applicationId,
      workerId: jobId ?? applicationId,
      country: "sri_lanka",
      visaType: "LK_ETA",
    }),
  });
  return mapStandardToOutcome(result);
}

export async function runCambodia(
  applicationId: string,
  jobId?: string,
  paymentHooks?: ManagedPaymentHooks,
): Promise<DispatchOutcome> {
  const rec = await loadCanonicalAnswers(applicationId);
  const result = await runKhPrefill({
    jobId: jobId ?? applicationId,
    applicationId,
    answers: {
      surname: pick(rec, "surname"),
      given_names: pick(rec, "given_names"),
      date_of_birth: pick(rec, "date_of_birth"),
      nationality: pick(rec, "nationality"),
      passport_number: pick(rec, "passport_number"),
      passport_expiry_date: pick(rec, "passport_expiry_date"),
      passport_issuing_country: pick(rec, "passport_issuing_country", pick(rec, "nationality")),
      email: pick(rec, "email"),
      phone: pick(rec, "phone"),
    },
    paymentHooks: paymentHooks ?? createManagedPaymentHooks({
      applicationId,
      workerId: jobId ?? applicationId,
      country: "cambodia",
      visaType: "KH_TOURIST_E_VISA",
    }),
  });
  return mapStandardToOutcome(result);
}

export async function runLaos(
  applicationId: string,
  jobId?: string,
  paymentHooks?: ManagedPaymentHooks,
): Promise<DispatchOutcome> {
  const rec = await loadCanonicalAnswers(applicationId);
  const result = await runLaPrefill({
    jobId: jobId ?? applicationId,
    applicationId,
    answers: {
      surname: pick(rec, "surname"),
      given_names: pick(rec, "given_names"),
      date_of_birth: pick(rec, "date_of_birth"),
      nationality: pick(rec, "nationality"),
      passport_number: pick(rec, "passport_number"),
      passport_expiry_date: pick(rec, "passport_expiry_date"),
      passport_issuing_country: pick(rec, "passport_issuing_country", pick(rec, "nationality")),
      email: pick(rec, "email"),
      phone: pick(rec, "phone"),
      intended_arrival_date: pick(rec, "intended_arrival_date"),
      port_of_entry: pick(rec, "port_of_entry", "VTE"),
      occupation: pick(rec, "occupation"),
    },
    paymentHooks: paymentHooks ?? createManagedPaymentHooks({
      applicationId,
      workerId: jobId ?? applicationId,
      country: "laos",
      visaType: "LA_TOURIST_E_VISA",
    }),
  });
  return mapStandardToOutcome(result);
}

export async function runSouthAfrica(
  applicationId: string,
  jobId?: string,
  paymentHooks?: ManagedPaymentHooks,
): Promise<DispatchOutcome> {
  const rec = await loadCanonicalAnswers(applicationId);
  const result = await runZaPrefill({
    jobId: jobId ?? applicationId,
    applicationId,
    answers: {
      surname: pick(rec, "surname"),
      given_names: pick(rec, "given_names"),
      date_of_birth: pick(rec, "date_of_birth"),
      nationality: pick(rec, "nationality"),
      passport_number: pick(rec, "passport_number"),
      passport_expiry_date: pick(rec, "passport_expiry_date"),
      passport_issuing_country: pick(rec, "passport_issuing_country", pick(rec, "nationality")),
      email: pick(rec, "email"),
      phone: pick(rec, "phone"),
      intended_arrival_date: pick(rec, "intended_arrival_date"),
      intended_departure_date: pick(rec, "intended_departure_date"),
      purpose_of_visit: pick(rec, "purpose_of_visit", "Tourism"),
      occupation: pick(rec, "occupation"),
    },
    paymentHooks: paymentHooks ?? createManagedPaymentHooks({
      applicationId,
      workerId: jobId ?? applicationId,
      country: "south_africa",
      visaType: "ZA_VISITOR_VISA",
    }),
  });
  return mapStandardToOutcome(result);
}
