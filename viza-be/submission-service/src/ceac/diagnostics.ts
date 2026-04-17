/**
 * CEAC DS-160 diagnostic artifact capture (US-007).
 *
 * This module provides screenshot capture for both success and failure paths:
 *
 *   - **Success:** `stopAtSignAndSubmit` captures a sign-page screenshot as
 *     proof-of-reach — the canonical artifact proving the worker arrived at the
 *     Sign and Submit page without clicking the final button.
 *   - **Failure:** `preserveRecoveryOnFailure` captures a last-state screenshot
 *     so ops can see exactly where the run died without replaying logs.
 *
 * All capture functions are non-throwing: screenshot failure never masks the
 * primary outcome (whether success or error). When the page is unavailable
 * (browser closed, context destroyed) the result is `null` — callers should
 * always treat screenshots as best-effort enrichment, not required artifacts.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { detectPage, type CeacPageId } from "./pages";

/**
 * A persisted screenshot artifact. Fully serializable so it can be embedded
 * in checkpoint details, recovery payloads, or worker output without
 * transformation.
 */
export interface ScreenshotArtifact {
  /** Absolute path to the screenshot file on disk. */
  path: string;
  /** ISO-8601 timestamp when the screenshot was captured. */
  capturedAt: string;
  /** Page identity at capture time (best-effort — may be `"unknown"`). */
  pageId: CeacPageId | "unknown";
  /** Page URL at capture time. */
  url: string;
  /** File size in bytes. */
  sizeBytes: number;
}

export interface CaptureScreenshotOptions {
  /** Directory to save the screenshot into. Created if missing. */
  outputDir: string;
  /**
   * Filename for the screenshot (without directory). Default: generated from
   * timestamp and page identity.
   */
  filename?: string;
  /** Whether to capture the full scrollable page. Default: false (viewport only). */
  fullPage?: boolean;
}

/**
 * Best-effort screenshot capture. Returns `null` when the page is unavailable,
 * the directory can't be created, or the write fails — never throws.
 *
 * This is the single entry point for all screenshot capture across the CEAC
 * module. Both success (sign-page proof) and failure (last-state diagnostic)
 * paths route through here.
 */
export async function tryCaptureScreenshot(
  page: Page | null,
  options: CaptureScreenshotOptions,
): Promise<ScreenshotArtifact | null> {
  if (!page) return null;

  try {
    const probe = await detectPage(page);
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const filename =
      options.filename ?? `ceac-${probe.id}-${timestamp}.png`;

    await fs.mkdir(options.outputDir, { recursive: true });
    const destination = path.resolve(options.outputDir, filename);

    await page.screenshot({
      path: destination,
      fullPage: options.fullPage ?? false,
    });

    const stats = await fs.stat(destination);

    return {
      path: destination,
      capturedAt: now.toISOString(),
      pageId: probe.id,
      url: page.url(),
      sizeBytes: stats.size,
    };
  } catch {
    // Screenshot capture is best-effort. The page may be closed, navigating,
    // or the output directory may be unwritable. None of these should surface
    // to the caller — the primary outcome (success or failure) takes priority.
    return null;
  }
}
