#!/usr/bin/env npx tsx
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Page } from "@playwright/test";
import {
  classifyAppointmentPortalState,
  findMissingAppointmentFields,
  redactOfficialUrl,
  type AppointmentFreeSmokeVerdict,
} from "../src/appointment-free-smoke";
import { connectBrowserbaseCloudBrowser } from "../src/browserbase-session";
import { ensureApplicantInboxAlias } from "../src/inbox/alias";
import { loadCanonicalAnswers } from "../src/queue/answers";
import { supabase } from "../src/supabase";

interface Target {
  id: "us-appointment-cn" | "france-tls-cn" | "japan-vfs-sg";
  prefix: "US_APPOINTMENT" | "FRANCE_TLS" | "JP_VFS_SG";
  url: string;
  expectedMarker: RegExp;
  requiredFields: readonly string[];
}

const COMMON_PROFILE_FIELDS = [
  "surname",
  "given_names",
  "date_of_birth",
  "nationality",
  "passport_number",
  "passport_expiry_date",
  "email",
  "phone",
] as const;

const TARGETS: readonly Target[] = [
  {
    id: "us-appointment-cn",
    prefix: "US_APPOINTMENT",
    url: process.env.US_APPOINTMENT_BASE_URL ?? "https://www.usvisascheduling.com/",
    expectedMarker: /apply for a u\.s\. visa|sign in|login|new user|register|预约|签证/i,
    requiredFields: [...COMMON_PROFILE_FIELDS, "ds160_confirmation_number"],
  },
  {
    id: "france-tls-cn",
    prefix: "FRANCE_TLS",
    url: process.env.FRANCE_TLS_FREE_SMOKE_URL ?? "https://visas-fr.tlscontact.com/en-us/login",
    expectedMarker: /tlscontact|sign in|log in|register|book an appointment|预约/i,
    requiredFields: [...COMMON_PROFILE_FIELDS, "intended_date_of_arrival", "intended_date_of_departure"],
  },
  {
    id: "japan-vfs-sg",
    prefix: "JP_VFS_SG",
    url: process.env.JP_VFS_SG_FREE_SMOKE_URL ?? "https://visa.vfsglobal.com/sgp/en/jpn/book-an-appointment",
    expectedMarker: /vfs global|japan|book an appointment|sign in|log in|register/i,
    requiredFields: COMMON_PROFILE_FIELDS,
  },
];

function readArg(name: string): string | null {
  const marker = `--${name}=`;
  return process.argv.find((value) => value.startsWith(marker))?.slice(marker.length) ?? null;
}

function hasArg(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function redactFormValues(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((element) => {
      if (element.value) element.value = "[REDACTED]";
      element.setAttribute("value", "[REDACTED]");
    });
  }).catch(() => undefined);
}

async function loadApplicationPreflight(applicationId: string, prepareAlias: boolean) {
  const answers = await loadCanonicalAnswers(applicationId);
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("applicant_id")
    .eq("id", applicationId)
    .single();
  if (applicationError || !application?.applicant_id) {
    throw new Error(`applications lookup failed: ${applicationError?.message ?? "missing applicant_id"}`);
  }
  const { data: documents, error: documentsError } = await supabase
    .from("application_documents")
    .select("document_type, storage_path")
    .eq("application_id", applicationId);
  if (documentsError) throw new Error(`application_documents lookup failed: ${documentsError.message}`);

  let aliasPrepared = false;
  if (prepareAlias) {
    await ensureApplicantInboxAlias(application.applicant_id);
    aliasPrepared = true;
  }
  return {
    answers,
    aliasPrepared,
    availableDocumentTypes: Array.from(new Set((documents ?? [])
      .filter((row) => Boolean(row.storage_path))
      .map((row) => String(row.document_type)))),
  };
}

async function runTarget(
  target: Target,
  artifactDir: string,
  answers: Record<string, string> | null,
  proxiesEnabled: boolean,
  verifiedEnabled: boolean,
) {
  process.env[`${target.prefix}_BROWSERBASE_ENABLED`] = "true";
  process.env[`${target.prefix}_BROWSERBASE_PROXIES`] = proxiesEnabled ? "true" : "false";
  process.env[`${target.prefix}_BROWSERBASE_VERIFIED`] = verifiedEnabled ? "true" : "false";
  const cloud = await connectBrowserbaseCloudBrowser({ prefix: target.prefix });
  try {
    await cloud.page.setViewportSize({ width: 1440, height: 1000 }).catch(() => undefined);
    const response = await cloud.page.goto(target.url, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await cloud.page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
    await cloud.page.waitForFunction(
      () => (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().length > 40,
      undefined,
      { timeout: 12_000 },
    ).catch(() => undefined);
    await cloud.page.waitForTimeout(2_000);
    const title = await cloud.page.title().catch(() => "");
    const bodyText = await cloud.page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
    const state = classifyAppointmentPortalState({
      status: response?.status() ?? null,
      url: cloud.page.url(),
      title,
      bodyText: bodyText.slice(0, 30_000),
      expectedMarker: target.expectedMarker,
    });
    const browserErrorPage = !/^https?:\/\//i.test(cloud.page.url());
    if (browserErrorPage) {
      await cloud.page.setContent(`<!doctype html><html><body style="font-family: sans-serif; padding: 48px">
        <h1>Official portal navigation stopped</h1>
        <p>The cloud browser reached a browser-level navigation error. URL parameters and page contents were removed from this evidence.</p>
      </body></html>`);
    }
    await redactFormValues(cloud.page);
    const screenshotPath = path.join(artifactDir, `${target.id}.png`);
    await cloud.page.screenshot({ path: screenshotPath, fullPage: true, timeout: 30_000 });
    return {
      id: target.id,
      verdict: state.verdict,
      reason: proxiesEnabled && state.verdict === "proxy_required"
        ? "The proxied cloud session was rejected by an access or region policy."
        : state.reason,
      httpStatus: response?.status() ?? null,
      finalUrl: browserErrorPage ? "[REDACTED]" : redactOfficialUrl(cloud.page.url()),
      title,
      captchaDetected: state.captchaDetected,
      wafDetected: state.wafDetected,
      entryDetected: state.entryDetected,
      missingFields: answers ? findMissingAppointmentFields(answers, target.requiredFields) : [],
      screenshotPath,
      browserbaseReplayAvailable: Boolean(cloud.replayUrl),
      proxiesEnabled: cloud.proxiesEnabled,
      verifiedEnabled: cloud.verifiedEnabled,
    };
  } finally {
    await cloud.browser.close().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  if (!process.env.BROWSERBASE_API_KEY?.trim()) {
    throw new Error("BROWSERBASE_API_KEY is required for the Free Plan smoke.");
  }
  process.env.BROWSERBASE_MAX_CONCURRENCY = "1";
  const applicationId = readArg("application-id") ?? process.env.APPOINTMENT_FREE_SMOKE_APPLICATION_ID ?? null;
  const requestedTarget = readArg("target");
  const prepareAlias = hasArg("prepare-alias");
  const proxiesEnabled = hasArg("proxies");
  const verifiedEnabled = hasArg("verified");
  const selectedTargets = requestedTarget
    ? TARGETS.filter((target) => target.id === requestedTarget)
    : TARGETS;
  if (selectedTargets.length === 0) throw new Error(`Unknown appointment smoke target: ${requestedTarget}`);

  const artifactDir = path.resolve(
    process.env.APPOINTMENT_FREE_SMOKE_ARTIFACT_DIR ?? "artifacts/appointment-free-smoke",
  );
  fs.mkdirSync(artifactDir, { recursive: true });
  const preflight = applicationId
    ? await loadApplicationPreflight(applicationId, prepareAlias)
    : null;

  const results = [];
  for (const target of selectedTargets) {
    results.push(await runTarget(
      target,
      artifactDir,
      preflight?.answers ?? null,
      proxiesEnabled,
      verifiedEnabled,
    ));
  }
  const verdictCounts = results.reduce<Record<AppointmentFreeSmokeVerdict, number>>(
    (counts, result) => ({ ...counts, [result.verdict]: counts[result.verdict] + 1 }),
    { pass: 0, conditional: 0, proxy_required: 0 },
  );
  const report = {
    provider: verifiedEnabled
      ? "browserbase-verified"
      : proxiesEnabled
        ? "browserbase-developer"
        : "browserbase-free",
    proxiesEnabled,
    verifiedEnabled,
    maxConcurrency: 1,
    applicationPreflight: preflight
      ? {
          applicationId: "[REDACTED]",
          aliasPrepared: preflight.aliasPrepared,
          availableDocumentTypes: preflight.availableDocumentTypes,
        }
      : null,
    verdictCounts,
    results,
    observedAt: new Date().toISOString(),
  };
  const reportPath = path.join(artifactDir, `report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    status: "appointment_free_smoke_failed",
    message: error instanceof Error ? error.message.split("\n")[0] : String(error),
  }));
  process.exit(1);
});
