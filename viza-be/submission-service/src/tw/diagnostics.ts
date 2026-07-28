/**
 * Failure-time diagnostics for Taiwan Online Entry Permit automation runs.
 * Mirrors src/uk/diagnostics.ts.
 *
 * On any orchestrator throw the worker captures a screenshot + page
 * metadata so an operator can replay what the browser was doing without
 * needing to reproduce the run. Outputs land in the run's temp dir; the
 * worker decides whether to upload them to Supabase Storage.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Page } from "@playwright/test";

export interface TwScreenshotArtifact {
  path: string;
  bytes: number;
  url: string;
  title: string;
}

export interface CaptureTwScreenshotOptions {
  outputDir: string;
  runId: string;
  label: string;
  fullPage?: boolean;
}

/** Best-effort screenshot capture. Returns null on failure rather than
 *  throwing so the caller's primary error path isn't masked by a
 *  diagnostics failure. */
export async function tryCaptureTwScreenshot(
  page: Page,
  options: CaptureTwScreenshotOptions,
): Promise<TwScreenshotArtifact | null> {
  try {
    await fs.mkdir(options.outputDir, { recursive: true });
    const slug = slugify(options.label);
    const filename = `tw-${options.runId}-${slug}.png`;
    const filepath = path.join(options.outputDir, filename);
    const buffer = await page.screenshot({ fullPage: options.fullPage ?? true, timeout: 10_000 });
    await fs.writeFile(filepath, buffer);
    let url = "";
    let title = "";
    try {
      url = page.url();
      title = await page.title();
    } catch {
      /* ignore */
    }
    return { path: filepath, bytes: buffer.length, url, title };
  } catch {
    return null;
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "capture";
}
