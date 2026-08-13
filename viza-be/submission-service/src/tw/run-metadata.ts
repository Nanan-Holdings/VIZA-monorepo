import * as os from "node:os";
import * as path from "node:path";
import type { Page } from "@playwright/test";
import type { TwFieldVerificationEntry } from "./fillers";
import { tryCaptureTwMaskedScreenshot, type TwScreenshotArtifact } from "./diagnostics";

export interface TwFieldVerificationSummary {
  total: number;
  matched: number;
  skipped: number;
  required: number;
  files: number;
  fields: TwFieldVerificationEntry[];
}

export interface TwPageFingerprint {
  urlPath: string;
  title: string;
  hasCaptchaImage: boolean;
  hasCaptchaInput: boolean;
  hasFinalSubmitButton: boolean;
  formCount: number;
  inputCount: number;
  selectCount: number;
  fileInputCount: number;
}

export interface TwRunMetadata {
  runId?: string;
  capturedAt: string;
  auth: {
    officialLogin: "authenticated";
    method: string;
  };
  fieldVerification: TwFieldVerificationSummary;
  pageFingerprint: TwPageFingerprint;
  screenshot?: {
    path: string;
    bytes: number;
    urlPath: string;
    title: string;
  };
}

export function summarizeTwFieldAudit(fields: TwFieldVerificationEntry[]): TwFieldVerificationSummary {
  return {
    total: fields.length,
    matched: fields.filter((field) => field.status === "matched").length,
    skipped: fields.filter((field) => field.status === "skipped").length,
    required: fields.filter((field) => field.required).length,
    files: fields.filter((field) => field.kind === "file").length,
    fields,
  };
}

export async function fingerprintTwPage(page: Page): Promise<TwPageFingerprint> {
  const url = new URL(page.url());
  const title = await page.title().catch(() => "");
  return {
    urlPath: url.pathname,
    title,
    hasCaptchaImage: (await page.locator('img[src*="/coa-frontend/captcha"]').count().catch(() => 0)) > 0,
    hasCaptchaInput: (await page.getByPlaceholder("請輸入驗證碼").count().catch(() => 0)) > 0,
    hasFinalSubmitButton: (await page.getByRole("button", { name: "確認資料", exact: false }).count().catch(() => 0)) > 0,
    formCount: await page.locator("form").count().catch(() => 0),
    inputCount: await page.locator("input").count().catch(() => 0),
    selectCount: await page.locator("select").count().catch(() => 0),
    fileInputCount: await page.locator('input[type="file"]').count().catch(() => 0),
  };
}

export async function buildTwRunMetadata(input: {
  page: Page;
  runId?: string;
  auth: TwRunMetadata["auth"];
  fields: TwFieldVerificationEntry[];
  diagnosticsOutputDir?: string;
}): Promise<TwRunMetadata> {
  const outputDir = input.diagnosticsOutputDir ?? path.join(os.tmpdir(), "viza-tw-run-metadata");
  const [pageFingerprint, screenshot] = await Promise.all([
    fingerprintTwPage(input.page),
    tryCaptureTwMaskedScreenshot(input.page, {
      outputDir,
      runId: input.runId ?? `tw-${Date.now()}`,
      label: "captcha-boundary-masked",
      fullPage: true,
    }),
  ]);

  return {
    runId: input.runId,
    capturedAt: new Date().toISOString(),
    auth: input.auth,
    fieldVerification: summarizeTwFieldAudit(input.fields),
    pageFingerprint,
    ...(screenshot ? { screenshot: sanitizeScreenshot(screenshot) } : {}),
  };
}

function sanitizeScreenshot(screenshot: TwScreenshotArtifact): TwRunMetadata["screenshot"] {
  const url = screenshot.url ? new URL(screenshot.url) : null;
  return {
    path: screenshot.path,
    bytes: screenshot.bytes,
    urlPath: url?.pathname ?? "",
    title: screenshot.title,
  };
}
