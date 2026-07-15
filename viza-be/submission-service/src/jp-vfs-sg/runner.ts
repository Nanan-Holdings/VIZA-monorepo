import * as fs from "node:fs";
import * as path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import {
  browserbaseEnabled,
  connectBrowserbaseCloudBrowser,
} from "../browserbase-session";
import { ensureApplicantInboxAlias } from "../inbox/alias";
import { findMissingAppointmentFields } from "../appointment-free-smoke";
import { loadCanonicalAnswers } from "../queue/answers";
import { supabase } from "../supabase";

export type JapanVfsCheckpoint = "login" | "captcha" | "waf" | "identity_verification" | "selector_drift" | "no_slots";

export interface JapanVfsSlotObservation {
  appointmentDate: string;
  appointmentTime: string | null;
  appointmentLocation: string;
  source: "vfs_jp_sg";
}

export interface JapanVfsRunnerResult {
  slots: JapanVfsSlotObservation[];
  checkpoint?: { type: JapanVfsCheckpoint; message: string };
  evidence: {
    pageTitle: string;
    finalUrl: string;
    httpStatus: number | null;
    observedAt: string;
    screenshotPath?: string;
    browserbaseReplayAvailable: boolean;
  };
  profile?: {
    ready: boolean;
    missingFields: string[];
    aliasPrepared: boolean;
    availableDocumentTypes: string[];
  };
}

export interface JapanVfsObserveOptions {
  applicationId?: string;
  prepareAlias?: boolean;
}

const VFS_JAPAN_SINGAPORE_URL = "https://visa.vfsglobal.com/sgp/en/jpn/book-an-appointment";

function checkpointForText(text: string): JapanVfsCheckpoint | null {
  if (/cloudflare|access denied|security check|turnstile/i.test(text)) return "waf";
  if (/captcha|i am not a robot|recaptcha/i.test(text)) return "captcha";
  if (/sign in|log in|login|enter your email/i.test(text)) return "login";
  if (/verify your identity|one[- ]time password|otp|verification code/i.test(text)) return "identity_verification";
  return null;
}

async function openAuthorizedBrowser(): Promise<{
  browser: Browser;
  page: Page;
  browserbaseReplayAvailable: boolean;
}> {
  if (browserbaseEnabled("JP_VFS_SG")) {
    const cloud = await connectBrowserbaseCloudBrowser({ prefix: "JP_VFS_SG" });
    return {
      browser: cloud.browser,
      page: cloud.page,
      browserbaseReplayAvailable: Boolean(cloud.replayUrl),
    };
  }
  const endpoint = process.env.JP_VFS_SG_BROWSER_API_ENDPOINT?.trim();
  const browser = endpoint
    ? await chromium.connectOverCDP(endpoint, { timeout: 30_000 })
    : await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  return { browser, page, browserbaseReplayAvailable: false };
}

async function captureRedactedEvidence(page: Page): Promise<string | undefined> {
  const artifactDir = process.env.JP_VFS_SG_ARTIFACT_DIR?.trim();
  if (!artifactDir) return undefined;
  const resolvedDir = path.resolve(artifactDir);
  fs.mkdirSync(resolvedDir, { recursive: true });
  await page.evaluate(() => {
    document.querySelectorAll<HTMLInputElement>("input, textarea").forEach((element) => {
      if (element.value) element.value = "[REDACTED]";
    });
  }).catch(() => undefined);
  const screenshotPath = path.join(resolvedDir, `jp-vfs-sg-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  return screenshotPath;
}

/**
 * Reads the VFS booking landing state only. It intentionally does not enter
 * credentials, CAPTCHA values, payment details, or click final booking.
 */
export async function observeJapanVfsSingaporeSlots(
  options: JapanVfsObserveOptions = {},
): Promise<JapanVfsRunnerResult> {
  let profile: JapanVfsRunnerResult["profile"];
  if (options.applicationId) {
    const answers = await loadCanonicalAnswers(options.applicationId);
    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .select("applicant_id")
      .eq("id", options.applicationId)
      .single();
    if (applicationError || !application?.applicant_id) {
      throw new Error(`Japan VFS application lookup failed: ${applicationError?.message ?? "missing applicant_id"}`);
    }
    const { data: documents, error: documentError } = await supabase
      .from("application_documents")
      .select("document_type, storage_path")
      .eq("application_id", options.applicationId);
    if (documentError) throw new Error(`Japan VFS documents lookup failed: ${documentError.message}`);
    const missingFields = findMissingAppointmentFields(answers, [
      "surname", "given_names", "date_of_birth", "nationality", "passport_number",
      "passport_expiry_date", "email", "phone",
    ]);
    let aliasPrepared = false;
    if (options.prepareAlias) {
      await ensureApplicantInboxAlias(application.applicant_id);
      aliasPrepared = true;
    }
    profile = {
      ready: missingFields.length === 0,
      missingFields,
      aliasPrepared,
      availableDocumentTypes: Array.from(new Set((documents ?? [])
        .filter((row) => Boolean(row.storage_path))
        .map((row) => String(row.document_type)))),
    };
    if (missingFields.length > 0) {
      return {
        slots: [],
        checkpoint: {
          type: "selector_drift",
          message: `Missing required VIZA fields: ${missingFields.join(", ")}`,
        },
        evidence: {
          pageTitle: "",
          finalUrl: "",
          httpStatus: null,
          observedAt: new Date().toISOString(),
          browserbaseReplayAvailable: false,
        },
        profile,
      };
    }
  }
  const opened = await openAuthorizedBrowser();
  const { browser, page } = opened;
  try {
    const response = await page.goto(VFS_JAPAN_SINGAPORE_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const body = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
    const checkpoint = checkpointForText(body);
    const screenshotPath = await captureRedactedEvidence(page);
    const evidence = {
      pageTitle: await page.title(),
      finalUrl: page.url(),
      httpStatus: response?.status() ?? null,
      observedAt: new Date().toISOString(),
      ...(screenshotPath ? { screenshotPath } : {}),
      browserbaseReplayAvailable: opened.browserbaseReplayAvailable,
    };
    if (checkpoint) return { slots: [], checkpoint: { type: checkpoint, message: "Official VFS action is required before slots can be read." }, evidence, profile };
    if (/no appointments|no slots|not available/i.test(body)) return { slots: [], checkpoint: { type: "no_slots", message: "VFS currently shows no available appointment slots." }, evidence, profile };
    return { slots: [], checkpoint: { type: "login", message: "The VFS booking entry is reachable. An authenticated VFS account is required before calendar access." }, evidence, profile };
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export { VFS_JAPAN_SINGAPORE_URL };
