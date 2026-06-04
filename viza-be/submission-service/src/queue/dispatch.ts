/**
 * Canonical country dispatch table for the runner_job consumer (QUE-001).
 *
 * Maps a `runner_job.country` value to an async `runOne(applicationId)`
 * handler. The worker's JobHandler (QUE-003) looks up the country here and
 * delegates. Countries without a runner throw `UnsupportedCountryError` so
 * the worker dead-letters cleanly instead of silently dropping a paid order.
 *
 * Result normalization (QUE-005): a runner that halts before government
 * payment/signature resolves to a `halted_before_pay` outcome — the worker
 * treats a normal return as `succeeded`. Retryable portal failures
 * (`blocked`, `anti_bot_gate`) throw `RetryableRunnerError`; applicant-blocking
 * conditions throw `NeedsHumanError`.
 */
import { runInPrefill } from "../in/runner.js";
import { runLkPrefill } from "../lk/runner.js";
import { runKhPrefill } from "../kh/runner.js";
import { runLaPrefill } from "../la/runner.js";
import { runZaPrefill } from "../za/runner.js";
import { runOne as runVietnam } from "../vietnam/runner.js";
import { loadCanonicalAnswers, pick } from "./answers.js";
import { runUsHalt, runUkHalt, runAuHalt } from "./halt-runners.js";
import { runOne as runFrance } from "../france-visas/runner.js";
import { runOne as runIndonesia } from "../id/runner.js";
import { runOne as runEgypt } from "../egypt/runner.js";
import { runOne as runItaly } from "../italy-vfs-cn/runner.js";
import { runOne as runSaudi } from "../sa/runner.js";
import { runOne as runMalaysia } from "../my/runner.js";
import { runOne as runJapan } from "../jp/runner.js";
import { runOne as runCanada } from "../ca/runner.js";
import { runOne as runTurkey } from "../tr/runner.js";
import { runOne as runThailand } from "../th/runner.js";
import { runOne as runUae } from "../ae/runner.js";

// Types + error classes live in the leaf module ./types.js to avoid an
// import cycle (runners import these; dispatch imports runners). Re-exported
// here for back-compat with existing `from "./dispatch.js"` imports.
export {
  UnsupportedCountryError,
  RetryableRunnerError,
  NeedsHumanError,
  type DispatchOutcome,
  type RunOne,
} from "./types.js";
import {
  UnsupportedCountryError,
  RetryableRunnerError,
  NeedsHumanError,
  type DispatchOutcome,
  type RunOne,
} from "./types.js";

/** Standard runner result shape shared by the generic + dedicated runners. */
interface StandardResult {
  status: string;
  reason: string;
  reachedStep: string;
  artefacts: string[];
}

function normalizeStandard(r: StandardResult): DispatchOutcome {
  switch (r.status) {
    case "stopped_before_pay":
    case "stopped_before_signature":
      return {
        outcome: "halted_before_pay",
        reachedStep: r.reachedStep,
        artefacts: r.artefacts,
      };
    case "blocked":
    case "anti_bot_gate":
      throw new RetryableRunnerError(`${r.status}: ${r.reason}`);
    case "needs_human":
      throw new NeedsHumanError(r.reason);
    default:
      throw new Error(`unexpected runner status: ${r.status}`);
  }
}

/* ---------------------- Dedicated-runner adapters ---------------------- */

const runIndia: RunOne = async (applicationId, jobId) => {
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
  return normalizeStandard(result);
};

const runSriLanka: RunOne = async (applicationId, jobId) => {
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
  return normalizeStandard(result);
};

const runCambodia: RunOne = async (applicationId, jobId) => {
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
  return normalizeStandard(result);
};

const runLaos: RunOne = async (applicationId, jobId) => {
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
  return normalizeStandard(result);
};

const runSouthAfrica: RunOne = async (applicationId, jobId) => {
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
  return normalizeStandard(result);
};

/** Country code that is not yet wired — throws on invocation. */
function unsupported(country: string): RunOne {
  return async () => {
    throw new UnsupportedCountryError(country);
  };
}

/* --------------------------- Dispatch table --------------------------- */

/** The 16 launch countries (canonical codes). */
export const LAUNCH_COUNTRIES = [
  "indonesia",
  "egypt",
  "australia",
  "saudi_arabia",
  "united_kingdom",
  "vietnam",
  "malaysia",
  "japan",
  "united_states",
  "canada",
  "turkey",
  "thailand",
  "united_arab_emirates",
  "france",
  "italy",
  "india",
] as const;

export type LaunchCountry = (typeof LAUNCH_COUNTRIES)[number];

/**
 * Country → runOne. Includes the 16 launch countries plus the additional
 * prefill-capable countries that already have runners (Sri Lanka, Cambodia,
 * Laos, South Africa). `united_states`, `united_kingdom`, `france`,
 * `australia` are halt-via-legacy-queue and get real runOne wrappers in
 * QUE-005; `saudi_arabia` and `japan` have no runner yet.
 */
export const DISPATCH: Record<string, RunOne> = {
  // RUN-ID-001: dedicated Indonesia flagship runner (replaces the generic t3 scaffold).
  indonesia: (a, j) => runIndonesia(a, j),
  // RUN-EG-001: dedicated Egypt fill runner (replaces generic t3 scaffold).
  egypt: (a, j) => runEgypt(a, j),
  // RUN-IT-001: dedicated Italy VFS (CN corridor) runner (replaces generic t3 scaffold).
  italy: (a, j) => runItaly(a, j),
  // RUN-TH-001: dedicated Thailand runner (shared core).
  thailand: (a, j) => runThailand(a, j),
  // RUN-MY-001: dedicated Malaysia eVISA/MDAC runner (replaces generic t3 scaffold).
  malaysia: (a, j) => runMalaysia(a, j),
  // RUN-TR-001 / RUN-AE-001: dedicated Türkiye + UAE runners (shared core).
  turkey: (a, j) => runTurkey(a, j),
  united_arab_emirates: (a, j) => runUae(a, j),
  // RUN-CA-001: dedicated Canada runner (shared core).
  canada: (a, j) => runCanada(a, j),
  india: runIndia,
  sri_lanka: runSriLanka,
  cambodia: runCambodia,
  laos: runLaos,
  south_africa: runSouthAfrica,
  vietnam: (a, j) => runVietnam(a, j),
  // QUE-005: halt-before-gov-pay countries, wired to their orchestrators.
  united_states: (a, j) => runUsHalt(a, j),
  united_kingdom: (a, j) => runUkHalt(a, j),
  france: (a, j) => runFrance(a, j),
  australia: (a, j) => runAuHalt(a, j),
  // RUN-SA-001: Saudi Arabia e-Visa runner (built from scratch).
  saudi_arabia: (a, j) => runSaudi(a, j),
  // RUN-JP-001: Japan paper-pack runner (paper_ready terminal, no online submit).
  japan: (a, j) => runJapan(a, j),
};

/**
 * Static routing metadata for tests/observability — which runner backs each
 * country and whether it is live. Kept in sync with DISPATCH by hand.
 */
export const DISPATCH_META: Record<string, { runner: string; implemented: boolean }> = {
  indonesia: { runner: "id/runner.runOne", implemented: true },
  egypt: { runner: "egypt/runner.runOne", implemented: true },
  italy: { runner: "italy-vfs-cn/runner.runOne", implemented: true },
  thailand: { runner: "th/runner.runOne", implemented: true },
  malaysia: { runner: "my/runner.runOne", implemented: true },
  turkey: { runner: "tr/runner.runOne", implemented: true },
  united_arab_emirates: { runner: "ae/runner.runOne", implemented: true },
  canada: { runner: "ca/runner.runOne", implemented: true },
  india: { runner: "runInPrefill", implemented: true },
  sri_lanka: { runner: "runLkPrefill", implemented: true },
  cambodia: { runner: "runKhPrefill", implemented: true },
  laos: { runner: "runLaPrefill", implemented: true },
  south_africa: { runner: "runZaPrefill", implemented: true },
  vietnam: { runner: "vietnam/runner.runOne", implemented: true },
  united_states: { runner: "orchestrateFill (ceac)", implemented: true },
  united_kingdom: { runner: "resumeUkApplication", implemented: true },
  france: { runner: "france-visas/runner.runOne", implemented: true },
  australia: { runner: "fillVisitor600Application", implemented: true },
  saudi_arabia: { runner: "sa/runner.runOne", implemented: true },
  japan: { runner: "jp/runner.runOne (paper_ready)", implemented: true },
};

/**
 * Country-code normalization. Maps ISO-ish / alias inputs to the canonical
 * dispatch keys used here and by the portal producer (QUE-004).
 */
export const COUNTRY_ALIASES: Record<string, string> = {
  gb: "united_kingdom",
  uk: "united_kingdom",
  us: "united_states",
  usa: "united_states",
  ae: "united_arab_emirates",
  uae: "united_arab_emirates",
  id: "indonesia",
  eg: "egypt",
  au: "australia",
  sa: "saudi_arabia",
  vn: "vietnam",
  my: "malaysia",
  jp: "japan",
  ca: "canada",
  tr: "turkey",
  th: "thailand",
  fr: "france",
  it: "italy",
  in: "india",
  lk: "sri_lanka",
  kh: "cambodia",
  la: "laos",
  za: "south_africa",
};

export function normalizeCountry(country: string): string {
  const key = country.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return COUNTRY_ALIASES[key] ?? key;
}

/** Resolve a country to its runOne handler. Throws UnsupportedCountryError. */
export function getRunOne(country: string): RunOne {
  const key = normalizeCountry(country);
  const runOne = DISPATCH[key];
  if (!runOne) throw new UnsupportedCountryError(country);
  return runOne;
}
