/**
 * France-Visas "My applications" dashboard (accueil.xhtml).
 *
 * The accueil dashboard lists existing draft/submitted applications and
 * exposes the primary actions for each: edit, delete, download draft PDF,
 * download completed PDF (after Finalize), and the per-group "Continue"
 * button that finalizes the application and unlocks the completed PDF.
 *
 * Selectors and flow confirmed via live walk 2026-04-24/25.
 */

import type { Download, Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { waitForPage } from "./pages";
import { NavigationError } from "./errors";

export interface CreateApplicationOptions {
  /** Upper bound for step1 identity check after the CTA click. Default 30s. */
  timeoutMs?: number;
}

/**
 * Click "Create a new application in a new group of applications" and wait
 * for step1.xhtml to load. Returns when the page identity settles on step1.
 *
 * The CTA is a regular anchor/button (not a PrimeFaces widget) that
 * navigates directly — no AJAX dance needed.
 */
export async function startNewApplication(
  page: Page,
  options: CreateApplicationOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  // The button's label is localized — match against EN + FR.
  const cta = page.locator(
    [
      'a:has-text("Create a new application")',
      'button:has-text("Create a new application")',
      'a:has-text("Créer une nouvelle demande")',
      'button:has-text("Créer une nouvelle demande")',
      'input[type="submit"][value*="Create a new application"]',
    ].join(", "),
  ).first();

  const count = await cta.count();
  if (count === 0) {
    throw new NavigationError(
      `"Create a new application" CTA not found on accueil.xhtml`,
      { url: page.url() },
    );
  }

  await cta.click({ force: true });
  await waitForPage(page, "step1", { timeoutMs });
}

export interface FinalizeResult {
  /** FRA-format reference assigned by France-Visas after finalize. */
  applicationReference: string;
  /** Local path to the downloaded CERFA PDF. */
  pdfPath: string;
}

export interface FinalizeOptions {
  /** Where to save the PDF. Default: a fresh temp dir. */
  outputDir?: string;
  /** Upper bound for the finalize → reference-appears wait. Default 60s. */
  timeoutMs?: number;
  /**
   * The 13-digit draft reference observed on accueil immediately after
   * step 6. Used to locate the just-created application's group when
   * the dashboard contains other drafts. If omitted, the helper
   * defaults to clicking the LAST visible Continue button (most-recent
   * group), which works for fresh accounts but is brittle when the
   * applicant has multiple in-progress drafts.
   */
  draftReference?: string;
}

/**
 * Capture the just-created application's reference and download its CERFA
 * PDF (the printable form the applicant brings to the visa center).
 * Caller must already be on accueil.xhtml with the draft visible.
 *
 * Why we do NOT click Continue / Finalize:
 *   The accueil "Continue" button on a fresh draft initiates a 3-step
 *   transmission flow:
 *     accueil → phase2.xhtml (applicable rate) → phase3.xhtml
 *   Phase3 requires the applicant to certify "I made contact with my
 *   visa center [and] an appointment date has been assigned to me" —
 *   which is a fact-attestation to French government, not a click we
 *   can automate honestly. Crossing that line transmits the application
 *   to the consulate and locks the file before the applicant has
 *   booked biometrics. So our autofiller stops at the in-progress PDF.
 *
 * The "Read pdf application in progress" link is available on every
 * draft (post-step-6) and gives the same CERFA Schengen visa form the
 * applicant needs. The applicant logs in, walks the transmission flow
 * themselves once they have a VAC appointment, and downloads the
 * "completed" PDF from accueil at that point.
 *
 * Flow (verified via live walk 2026-04-25):
 *   1. Find the row for our draft (matched by 13-digit reference) and
 *      capture the FRA-format reference assigned to it during step 6.
 *   2. Click the row's "Read pdf application in progress" link, race
 *      `page.waitForEvent('download')` with the click.
 *   3. Save the PDF to `outputDir`.
 */
export async function finalizeAndDownloadPdf(
  page: Page,
  options: FinalizeOptions = {},
): Promise<FinalizeResult> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const outputDir = options.outputDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "fv-pdf-"));
  fs.mkdirSync(outputDir, { recursive: true });

  // 1. Locate the just-created application's row + its in-progress PDF
  //    link + the FRA reference assigned during step 6.
  const target = await pickInProgressPdfTarget(page, options.draftReference);
  if (!target) {
    throw new NavigationError(
      `Could not locate "Read pdf application in progress" link for our draft on accueil`,
      { url: page.url(), details: { draftReference: options.draftReference } },
    );
  }
  const { pdfLinkId, applicationReference } = target;

  // 2. Race the download with the click.
  let download: Download;
  try {
    [download] = await Promise.all([
      page.waitForEvent("download", { timeout: timeoutMs }),
      page.evaluate((id) => {
        const el = document.getElementById(id);
        if (el instanceof HTMLElement) el.click();
      }, pdfLinkId),
    ]);
  } catch (err) {
    throw new NavigationError(
      `PDF download did not start within ${timeoutMs}ms`,
      {
        url: page.url(),
        details: {
          applicationReference,
          cause: err instanceof Error ? err.message : String(err),
        },
      },
    );
  }

  const fileName = `cerfa_${applicationReference}.pdf`;
  const pdfPath = path.join(outputDir, fileName);
  await download.saveAs(pdfPath);

  return { applicationReference, pdfPath };
}

interface InProgressPdfTarget {
  /** DOM id of the "Read pdf application in progress" link. */
  pdfLinkId: string;
  /** FRA-format reference assigned to the application. */
  applicationReference: string;
}

/**
 * Find our application's "Read pdf application in progress" link on
 * accueil. France-Visas renders one such link per application. We pick:
 *   - if `draftReference` is given, the link in the same group container
 *     that contains that 13-digit internal reference;
 *   - otherwise the LAST in-progress link on the page (most recently
 *     created application).
 *
 * The FRA-format reference is read out of the same container so we can
 * include it in the result without an extra round-trip.
 */
async function pickInProgressPdfTarget(
  page: Page,
  draftReference: string | undefined,
): Promise<InProgressPdfTarget | null> {
  return page.evaluate(({ draftReference }) => {
    const links = Array.from(
      document.querySelectorAll<HTMLElement>("a, button"),
    ).filter((l) => {
      if (l.offsetParent === null) return false;
      const text = (l.textContent || "").trim();
      return /Read\s+pdf\s+application\s+in\s+progress|Consulter le PDF de la demande en cours/i.test(text);
    });
    if (links.length === 0) return null;

    const findRefIn = (root: HTMLElement): string | null => {
      const m = (root.textContent ?? "").match(/\bFRA[A-Z0-9]{10,}\b/);
      return m ? m[0] : null;
    };

    if (draftReference) {
      for (const link of links) {
        let p: HTMLElement | null = link.parentElement;
        for (let i = 0; i < 12 && p; i += 1) {
          if (p.textContent?.includes(draftReference)) {
            const ref = findRefIn(p);
            if (ref) return { pdfLinkId: link.id, applicationReference: ref };
          }
          p = p.parentElement;
        }
      }
    }

    // Fallback: pick the LAST in-progress link.
    const last = links[links.length - 1];
    let p: HTMLElement | null = last.parentElement;
    for (let i = 0; i < 12 && p; i += 1) {
      const ref = findRefIn(p);
      if (ref) return { pdfLinkId: last.id, applicationReference: ref };
      p = p.parentElement;
    }
    return null;
  }, { draftReference });
}

