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
  const createTextPattern =
    /create\s+(a\s+)?(new\s+)?application|new\s+application|nouvelle\s+demande|créer\s+une\s+nouvelle\s+demande/i;
  // The button's label is localized — match against EN + FR.
  const cta = page.locator(
    [
      'a:has-text("Create a new application")',
      'a:has-text("Create an application")',
      'a:has-text("New application")',
      'button:has-text("Create a new application")',
      'button:has-text("Create an application")',
      'button:has-text("New application")',
      'a:has-text("Créer une nouvelle demande")',
      'a:has-text("Nouvelle demande")',
      'button:has-text("Créer une nouvelle demande")',
      'button:has-text("Nouvelle demande")',
      'input[type="submit"][value*="Create a new application"]',
      'input[type="submit"][value*="Create an application"]',
      'input[type="submit"][value*="New application"]',
      'input[type="submit"][value*="nouvelle demande" i]',
    ].join(", "),
  ).first();

  let target = cta;
  if ((await target.count()) === 0) {
    target = page
      .locator("a, button, input[type='submit'], input[type='button']")
      .filter({ hasText: createTextPattern })
      .first();
  }
  if ((await target.count()) === 0) {
    target = page
      .locator('a[href*="step1.xhtml"], a[href*="create" i], a[href*="nouvelle" i]')
      .first();
  }

  if ((await target.count()) === 0) {
    throw new NavigationError(
      `"Create a new application" CTA not found on accueil.xhtml`,
      { url: page.url() },
    );
  }

  await target.click({ force: true });
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

  await page.waitForFunction(
    `(() => {
      const text = document.body?.innerText || "";
      return /\\bFRA[A-Z0-9]{10,}\\b/.test(text)
        && /Read\\s+pdf\\s+application\\s+in\\s+progress|Consulter le PDF de la demande en cours/i.test(text);
    })()`,
    { timeout: Math.min(timeoutMs, 30_000) },
  ).catch(() => undefined);

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
      page.evaluate(`(() => {
        const id = ${JSON.stringify(pdfLinkId).replace(/</g, "\\u003c")};
        const el = document.getElementById(id);
        if (el) el.click();
      })()`),
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

export interface ContinueConfirmedApplicationResult {
  clickedDeclare: boolean;
  clickedContinue: boolean;
  resultingUrl: string;
}

export interface ContinueConfirmedApplicationOptions {
  applicationReference?: string | null;
  timeoutMs?: number;
}

/**
 * France-Visas shows a declaration checkbox + Continue button for confirmed
 * applications on accueil. When the applicant/operator has explicitly opted
 * into the post-confirmation action, tick the declaration in the matching
 * application group and click Continue. This helper stops after that click;
 * later payment/appointment pages are intentionally left to their own guards.
 */
export async function continueConfirmedApplication(
  page: Page,
  options: ContinueConfirmedApplicationOptions = {},
): Promise<ContinueConfirmedApplicationResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const result = await page.evaluate(`(() => {
    const applicationReference = ${JSON.stringify(options.applicationReference ?? null).replace(/</g, "\\u003c")};
    const visible = (el) => el.offsetParent !== null;
    const textOf = (el) => ((el.value || el.textContent || "") + "").trim().replace(/\\s+/g, " ");
    const containers = Array.from(document.querySelectorAll("form, section, article, div"))
      .filter((el) => visible(el) && (!applicationReference || (el.textContent || "").includes(applicationReference)));
    const root = containers
      .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length)[0] || document.body;

    const checkbox = Array.from(root.querySelectorAll('input[type="checkbox"]'))
      .find((el) => visible(el));
    let clickedDeclare = false;
    if (checkbox && !checkbox.checked) {
      checkbox.click();
      clickedDeclare = true;
    }

    const continueButton = Array.from(root.querySelectorAll('button, input[type="submit"], input[type="button"], a'))
      .filter((el) => visible(el))
      .find((el) => /^continue$|^continuer$/i.test(textOf(el)));
    if (!continueButton) {
      return { clickedDeclare, clickedContinue: false };
    }
    continueButton.click();
    return { clickedDeclare, clickedContinue: true };
  })()`) as { clickedDeclare: boolean; clickedContinue: boolean };

  if (result.clickedContinue) {
    await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs }).catch(() => undefined);
    await waitForPage(page, "accueil", { timeoutMs: 2_000 }).catch(() => undefined);
  }

  return {
    ...result,
    resultingUrl: page.url(),
  };
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
 *     that contains that official/draft reference;
 *   - otherwise the first in-progress link on the page. France-Visas renders
 *     the newest application group first.
 *
 * The FRA-format reference is read out of the same container so we can
 * include it in the result without an extra round-trip.
 */
async function pickInProgressPdfTarget(
  page: Page,
  draftReference: string | undefined,
): Promise<InProgressPdfTarget | null> {
  return page.evaluate(`(() => {
    const draftReference = ${JSON.stringify(draftReference ?? null).replace(/</g, "\\u003c")};
    const links = Array.from(
      document.querySelectorAll("a, button"),
    ).filter((l) => {
      const text = [
        l.textContent || "",
        l.getAttribute("title") || "",
        l.getAttribute("aria-label") || "",
      ].join(" ").trim();
      return /Read\s+pdf\s+application\s+in\s+progress|Consulter le PDF de la demande en cours/i.test(text);
    });
    if (links.length === 0) return null;

    const findRefIn = (root) => {
      const m = (root.textContent ?? "").match(/\bFRA[A-Z0-9]{10,}\b/);
      return m ? m[0] : null;
    };
    const ensureId = (el, index) => {
      if (!el.id) el.id = "viza-read-pdf-" + index;
      return el.id;
    };
    const candidateRoots = (link) => {
      const roots = [];
      const selectors = ["fieldset", ".group", "tr", "table", "form"];
      for (const selector of selectors) {
        const root = link.closest?.(selector);
        if (root && !roots.includes(root)) roots.push(root);
      }
      let p = link.parentElement;
      for (let i = 0; i < 30 && p; i += 1) {
        if (!roots.includes(p)) roots.push(p);
        p = p.parentElement;
      }
      return roots;
    };
    const targetFrom = (link, index, requiredReference) => {
      for (const root of candidateRoots(link)) {
        const text = root.textContent ?? "";
        if (requiredReference && !text.includes(requiredReference)) continue;
        const ref = findRefIn(root);
        if (ref) return { pdfLinkId: ensureId(link, index), applicationReference: ref };
      }
      return null;
    };

    if (draftReference) {
      for (let i = 0; i < links.length; i += 1) {
        const target = targetFrom(links[i], i, draftReference);
        if (target) return target;
      }
    }

    // Fallback: the dashboard shows the newest application group first.
    for (let i = 0; i < links.length; i += 1) {
      const target = targetFrom(links[i], i, null);
      if (target) return target;
    }
    const bodyRef = findRefIn(document.body);
    if (bodyRef) {
      return { pdfLinkId: ensureId(links[0], 0), applicationReference: bodyRef };
    }
    return null;
  })()`) as Promise<InProgressPdfTarget | null>;
}

