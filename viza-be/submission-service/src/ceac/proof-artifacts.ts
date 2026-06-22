import type { Page } from "@playwright/test";
import type { UsSubmissionResult } from "../submission-result";

export type Ds160ProofStoragePaths = {
  confirmationPdfStoragePath?: string;
  applicationPdfStoragePath?: string;
  emailConfirmationPdfStoragePath?: string;
};

export function mergeUsProofStoragePaths(
  result: unknown,
  paths: Ds160ProofStoragePaths,
): UsSubmissionResult {
  if (!isSubmittedUsResult(result)) {
    throw new Error("DS-160 proof recovery requires a submitted US DS-160 result.");
  }
  return {
    ...result,
    ...withoutEmpty(paths),
  };
}

export async function waitForDs160ConfirmationPage(page: Page): Promise<void> {
  const printControlGroups = [
    [
      'input[type="submit"][value*="Print Confirmation" i]',
      'input[type="button"][value*="Print Confirmation" i]',
      'button:has-text("Print Confirmation")',
      'a:has-text("Print Confirmation")',
    ].join(", "),
    [
      'input[type="submit"][value*="Print Application" i]',
      'input[type="button"][value*="Print Application" i]',
      'button:has-text("Print Application")',
      'a:has-text("Print Application")',
    ].join(", "),
    [
      'input[type="submit"][value*="Email Confirmation" i]',
      'input[type="button"][value*="Email Confirmation" i]',
      'button:has-text("Email Confirmation")',
      'a:has-text("Email Confirmation")',
    ].join(", "),
  ];
  const viewConfirmationControls = [
    'input[type="submit"][value*="View Confirmation" i]',
    'input[type="button"][value*="View Confirmation" i]',
    'button:has-text("View Confirmation")',
    'a:has-text("View Confirmation")',
  ].join(", ");
  const continueControls = [
    'input[type="submit"][value="Continue" i]',
    'input[type="button"][value="Continue" i]',
    'button:has-text("Continue")',
    'a:has-text("Continue")',
  ].join(", ");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await hasOfficialProofControls(page, printControlGroups)) return;
    if (await clickFirstAvailable(page, viewConfirmationControls)) continue;
    if (await clickFirstAvailable(page, continueControls)) continue;
    await page.waitForTimeout(1_000);
  }
  throw new Error("CEAC confirmation page was not reached after DS-160 retrieval.");
}

async function hasOfficialProofControls(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    if ((await page.locator(selector).count().catch(() => 0)) === 0) return false;
  }
  return true;
}

async function clickFirstAvailable(page: Page, selector: string): Promise<boolean> {
  const control = page.locator(selector).first();
  if ((await control.count().catch(() => 0)) === 0) return false;
  try {
    await control.click({ force: true, timeout: 10_000 });
  } catch {
    await control.evaluate("el => el.click()");
  }
  try {
    await page.waitForLoadState("networkidle", { timeout: 20_000 });
  } catch {
    await page.waitForTimeout(2_000);
  }
  return true;
}

function isSubmittedUsResult(value: unknown): value is UsSubmissionResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Partial<UsSubmissionResult>;
  return result.country === "US" && result.status === "submitted" && typeof result.applicationId === "string";
}

function withoutEmpty(paths: Ds160ProofStoragePaths): Ds160ProofStoragePaths {
  return Object.fromEntries(
    Object.entries(paths).filter(([, value]) => typeof value === "string" && value.trim()),
  ) as Ds160ProofStoragePaths;
}
