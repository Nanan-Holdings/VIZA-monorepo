import "dotenv/config";
import { getCountrySubmissionProvider } from "../src/country-submissions/registry";
import { normalizeMdacPortalPayload } from "../src/mdac/normalize";
import { runMdacPortalSubmission } from "../src/mdac/runner";
import { normalizePhEtravelPortalPayload } from "../src/ph-etravel/normalize";
import { runPhEtravelPortalSubmission } from "../src/ph-etravel/runner";
import { loadCountrySubmissionContext } from "../src/queue/answers";
import { normalizeSgacPortalPayload } from "../src/sgac/normalize";
import { runSgacPortalSubmission } from "../src/sgac/runner";
import { normalizeTdacPortalPayload } from "../src/tdac/normalize";
import { runTdacPortalSubmission } from "../src/tdac/runner";
import { normalizeVnPrearrivalPortalPayload } from "../src/vn-prearrival/normalize";
import { runVietnamPrearrivalPortalSubmission } from "../src/vn-prearrival/runner";

const SUPPORTED_TYPES = new Set([
  "MY_MDAC_ARRIVAL_CARD",
  "PH_ETRAVEL_ARRIVAL_CARD",
  "PH_ETRAVEL_DEPARTURE_CARD",
  "SG_ARRIVAL_CARD",
  "TH_TDAC_ARRIVAL_CARD",
  "VN_PREARRIVAL_DECLARATION",
]);

function argumentValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim();
}

function forceLocalPreSubmitOnly() {
  process.env.ARRIVAL_CARD_PLAYWRIGHT_CHANNEL = "chrome";
  for (const name of [
    "TWOCAPTCHA_API_KEY", "TWO_CAPTCHA_API_KEY", "CAPTCHA_API_KEY",
    "BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID",
    "BRIGHTDATA_BROWSER_WS", "BRIGHTDATA_BROWSER_API_ENDPOINT", "SBR_WS_ENDPOINT",
  ]) delete process.env[name];
  for (const prefix of ["MDAC", "SGAC", "TDAC", "PH_ETRAVEL", "VN_PREARRIVAL"]) {
    delete process.env[`${prefix}_BROWSER_API_ENDPOINT`];
    delete process.env[`${prefix}_BRIGHTDATA_BROWSER_API_ENDPOINT`];
    delete process.env[`${prefix}_CDP_ENDPOINT`];
    delete process.env[`${prefix}_CHROME_CDP_ENDPOINT`];
    process.env[`${prefix}_BROWSERBASE_ENABLED`] = "false";
    process.env[`${prefix}_PLAYWRIGHT_HEADLESS`] = "false";
    process.env[`${prefix}_PLAYWRIGHT_CHANNEL`] = "chrome";
  }
}

async function runOne(applicationId: string) {
  const context = await loadCountrySubmissionContext(applicationId);
  if (context.application.purpose !== "VIZA_PLACEHOLDER_DRY_RUN") {
    throw new Error(`${applicationId}: refusing an application that is not a tagged dry-run QA draft`);
  }
  const visaType = context.application.visa_type;
  if (!SUPPORTED_TYPES.has(visaType)) throw new Error(`${visaType}: unsupported by this pre-submit QA runner`);
  const provider = getCountrySubmissionProvider(context.application.country, visaType);
  if (!provider) throw new Error(`${visaType}: provider not found`);
  const validation = provider.validate(context.submissionApplication);
  if (!validation.ok) throw new Error(`${visaType}: missing ${validation.missingRequiredFields.join(", ")}`);
  const payload = provider.mapToSubmissionPayload(context.submissionApplication, {
    dryRun: false,
    idempotencyKey: `official-pre-submit-qa:${applicationId}`,
  });

  let result;
  if (visaType === "MY_MDAC_ARRIVAL_CARD") {
    result = await runMdacPortalSubmission(normalizeMdacPortalPayload(payload), { headless: false, stopBeforeSubmit: true });
  } else if (visaType === "SG_ARRIVAL_CARD") {
    result = await runSgacPortalSubmission(normalizeSgacPortalPayload(payload), { headless: false, stopBeforeSubmit: true });
  } else if (visaType === "TH_TDAC_ARRIVAL_CARD") {
    result = await runTdacPortalSubmission(normalizeTdacPortalPayload(payload), { headless: false, stopBeforeSubmit: true });
  } else if (visaType === "VN_PREARRIVAL_DECLARATION") {
    result = await runVietnamPrearrivalPortalSubmission(normalizeVnPrearrivalPortalPayload(payload), {
      headless: false,
      stopBeforeSubmit: true,
      applicantId: context.profile.id,
    });
  } else {
    result = await runPhEtravelPortalSubmission(normalizePhEtravelPortalPayload(payload), {
      headless: false,
      stopBeforeSubmit: true,
      applicantId: context.profile.id,
      profilePhotoPath: "/Users/edward/Images/Personal/Portrait.JPG",
      forceLocalBrowser: true,
    });
  }
  return {
    visaType,
    applicationId,
    status: "status" in result ? result.status : result.submitted ? "submitted" : "stopped_before_submit",
    submitted: result.submitted,
    portalUrl: result.portalUrl,
    screenshots: result.screenshots.length,
  };
}

async function main() {
  const ids = (argumentValue("application-ids") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (ids.length === 0) throw new Error("Usage: npm run qa:arrival-card-pre-submit -- --application-ids=<id,id,...>");
  forceLocalPreSubmitOnly();
  const settled = await Promise.allSettled(ids.map(runOne));
  const results = settled.map((result, index) => {
    if (result.status === "fulfilled") return { ok: true, ...result.value };
    const error = result.reason as {
      code?: string;
      message?: string;
      screenshotPaths?: string[];
      portalSummary?: string;
      reachedReview?: boolean;
    };
    return {
      ok: false,
      applicationId: ids[index],
      code: error.code ?? "pre_submit_qa_failed",
      message: error.message ?? String(result.reason),
      reachedReview: error.reachedReview ?? false,
      screenshots: error.screenshotPaths?.length ?? 0,
      portalSummary: error.portalSummary?.slice(0, 300) ?? null,
    };
  });
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
