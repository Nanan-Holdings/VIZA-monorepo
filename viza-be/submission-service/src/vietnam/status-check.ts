import { chromium, type Page } from "@playwright/test";
import { solveImageCaptcha } from "../captcha";

export type VietnamOfficialStatus =
  | "payment_required"
  | "processing"
  | "approved"
  | "rejected"
  | "needs_correction"
  | "needs_human"
  | "unknown";

export interface VietnamStatusCheckInput {
  registrationCode: string;
  email: string;
  dateOfBirth: string;
  headless?: boolean;
  searchUrl?: string;
  screenshotPath?: string;
  timeoutMs?: number;
}

export interface VietnamStatusCheckResult {
  status: VietnamOfficialStatus;
  summary: string;
  registrationCode: string;
  passportNumber: string | null;
  visaNumber: string | null;
  deniedReason: string | null;
  downloadAvailable: boolean;
  rawText: string;
  screenshotPath?: string;
}

const DEFAULT_SEARCH_URL = "https://evisa.gov.vn/e-visa/search";

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function toVietnamDob(value: string): string {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slash) return `${slash[1].padStart(2, "0")}/${slash[2].padStart(2, "0")}/${slash[3]}`;
  return trimmed;
}

function extractLabeledValue(text: string, label: string): string | null {
  const pattern = new RegExp(`${label}\\s*[:：]?\\s*([^\\n\\r]+)`, "i");
  const match = pattern.exec(text);
  const value = normalizeSpace(match?.[1] ?? "");
  return value || null;
}

export function parseVietnamOfficialStatus(text: string): Omit<VietnamStatusCheckResult, "registrationCode" | "screenshotPath"> {
  const normalized = normalizeSpace(text);
  const applicationStatus =
    extractLabeledValue(text, "Application status") ??
    extractLabeledValue(text, "Status") ??
    extractLabeledValue(text, "Trạng thái hồ sơ") ??
    "";
  const deniedReason =
    extractLabeledValue(text, "Denied Reason") ??
    extractLabeledValue(text, "Reason") ??
    extractLabeledValue(text, "Lý do") ??
    null;
  const passportNumber =
    extractLabeledValue(text, "Passport number") ??
    extractLabeledValue(text, "Số hộ chiếu") ??
    null;
  const visaNumber =
    extractLabeledValue(text, "Visa number") ??
    extractLabeledValue(text, "Số thị thực") ??
    null;

  let status: VietnamOfficialStatus = "unknown";
  if (/denied|rejected|refused|từ chối/i.test(normalized)) status = "rejected";
  else if (/amended|amend|correction|edit|bổ sung|sửa đổi|chỉnh sửa/i.test(normalized)) status = "needs_correction";
  else if (/pay\s+visa\s+fee|payment required|pay to edit|thanh toán/i.test(normalized)) status = "payment_required";
  else if (/granted|approved|download print visa|visa number|allowed to enter|được cấp|tải/i.test(normalized)) status = "approved";
  else if (/processing|in process|pending|đang xử lý|chờ xử lý/i.test(normalized)) status = "processing";

  return {
    status,
    summary: applicationStatus || (status === "unknown" ? "Official portal returned an unrecognized status." : status),
    passportNumber,
    visaNumber,
    deniedReason,
    downloadAvailable: /download print visa|download|tải/i.test(normalized),
    rawText: text.slice(0, 4000),
  };
}

async function fillByCandidates(page: Page, candidates: string[], value: string): Promise<boolean> {
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.isVisible({ timeout: 1_500 })) {
        await locator.fill(value, { timeout: 5_000 });
        return true;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return false;
}

async function fillSearchFields(page: Page, input: VietnamStatusCheckInput): Promise<void> {
  const filledCode = await fillByCandidates(page, [
    'input[name*="code" i]',
    'input[id*="code" i]',
    'input[placeholder*="code" i]',
    'input[placeholder*="profile" i]',
    'input[placeholder*="registration" i]',
  ], input.registrationCode);
  const filledEmail = await fillByCandidates(page, [
    'input[type="email"]',
    'input[name*="email" i]',
    'input[id*="email" i]',
    'input[placeholder*="email" i]',
  ], input.email);
  const filledDob = await fillByCandidates(page, [
    'input[name*="birth" i]',
    'input[id*="birth" i]',
    'input[placeholder*="birth" i]',
    'input[placeholder*="dd/mm/yyyy" i]',
  ], toVietnamDob(input.dateOfBirth));

  if (filledCode && filledEmail && filledDob) return;

  const missing = [
    filledCode ? null : "registration code",
    filledEmail ? null : "email",
    filledDob ? null : "date of birth",
  ].filter(Boolean).join(", ");
  throw new Error(`Could not locate Vietnam status search fields: ${missing}`);
}

async function solveSearchCaptcha(page: Page, timeoutMs: number): Promise<boolean> {
  const image = page.locator('img[src*="captcha" i], img[alt*="captcha" i], img[id*="captcha" i]').first();
  if (!(await image.isVisible({ timeout: 3_000 }).catch(() => false))) return true;
  const png = await image.screenshot({ timeout: Math.min(timeoutMs, 15_000) });
  const solution = await solveImageCaptcha(png, Math.min(timeoutMs, 120_000));
  const captchaInput = page.locator([
    'input[name*="captcha" i]',
    'input[id*="captcha" i]',
    'input[placeholder*="captcha" i]',
    'input[placeholder*="security" i]',
  ].join(", ")).first();
  await captchaInput.fill(solution.text.trim(), { timeout: 10_000 });
  return true;
}

async function submitSearch(page: Page): Promise<void> {
  const submitted =
    await page.locator('button:has-text("Search")').first().click({ timeout: 5_000 }).then(() => true).catch(() => false) ||
    await page.locator('button:has-text("Tra cứu")').first().click({ timeout: 5_000 }).then(() => true).catch(() => false) ||
    await page.locator('input[type="submit"]').first().click({ timeout: 5_000 }).then(() => true).catch(() => false);
  if (!submitted) throw new Error("Could not locate Vietnam status search submit button.");
  await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);
}

export async function queryVietnamOfficialStatus(
  input: VietnamStatusCheckInput,
): Promise<VietnamStatusCheckResult> {
  const browser = await chromium.launch({ headless: input.headless ?? true });
  const page = await browser.newPage();
  try {
    await page.goto(input.searchUrl ?? DEFAULT_SEARCH_URL, {
      waitUntil: "domcontentloaded",
      timeout: input.timeoutMs ?? 60_000,
    });
    await fillSearchFields(page, input);
    await solveSearchCaptcha(page, input.timeoutMs ?? 120_000);
    await submitSearch(page);
    if (input.screenshotPath) {
      await page.screenshot({ path: input.screenshotPath, fullPage: true }).catch(() => undefined);
    }
    const bodyText = await page.locator("body").innerText({ timeout: 10_000 });
    const parsed = parseVietnamOfficialStatus(bodyText);
    return {
      ...parsed,
      registrationCode: input.registrationCode,
      ...(input.screenshotPath ? { screenshotPath: input.screenshotPath } : {}),
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
