import { loadCanonicalAnswers, pick } from "../queue/answers.js";
import { mapStandardToOutcome } from "./result-map.js";
import type { DispatchOutcome } from "../queue/types.js";
import { runInPrefill } from "../in/runner.js";
import { runLkPrefill } from "../lk/runner.js";
import { runKhPrefill } from "../kh/runner.js";
import { runLaPrefill } from "../la/runner.js";
import { runZaPrefill } from "../za/runner.js";

/**
 * runOne adapters for the dedicated-CanonicalAnswers prefill runners
 * (RUN-IN/LK/KH/LA/ZA-001). Each loads canonical answers, builds the
 * country's CanonicalAnswers, runs the prefill, and maps the result to a
 * DispatchOutcome via the shared result-map (RUN-CORE-002). Re-exported as
 * `runOne` from each country's runner.ts and bound in dispatch.ts.
 */

export async function runIndia(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
  const rec = await loadCanonicalAnswers(applicationId);
  const result = await runInPrefill({
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
      port_of_arrival: pick(rec, "port_of_arrival") || undefined,
      occupation: pick(rec, "occupation") || undefined,
      visa_purpose: "tourism",
    },
  });
  return mapStandardToOutcome(result);
}

export async function runSriLanka(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
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
  });
  return mapStandardToOutcome(result);
}

export async function runCambodia(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
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
  });
  return mapStandardToOutcome(result);
}

export async function runLaos(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
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
  });
  return mapStandardToOutcome(result);
}

export async function runSouthAfrica(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
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
  });
  return mapStandardToOutcome(result);
}
