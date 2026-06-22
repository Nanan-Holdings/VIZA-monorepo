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
  const confirmationMarkers = [
    /print confirmation/i,
    /print application/i,
    /email confirmation/i,
    /confirmation page/i,
  ];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    if (confirmationMarkers.some((marker) => marker.test(text))) return;
    await page.waitForTimeout(1_000);
  }
  throw new Error("CEAC confirmation page was not reached after DS-160 retrieval.");
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
