/**
 * Handle the CEAC "Upload Photo" page.
 *
 * URL: `photo/photo_uploadthephoto.aspx?node=UploadPhoto`
 *
 * CEAC delegates photo upload to State Department's IDENTIX biometric
 * subsystem. The flow spans two domains:
 *
 *   1. On CEAC's upload-photo page, click the styled `btnUploadPhoto`
 *      submit. The form posts and the browser navigates to
 *      `https://identix.state.gov/qotw/Upload.aspx?<token>` — a separate
 *      ASP.NET page hosting the actual file input.
 *
 *   2. On identix.state.gov, fill `ctl00_cphMain_imageFileUpload` with the
 *      photo bytes, then click `ctl00_cphButtons_btnUpload` (an image
 *      input with class "next"). Identix uploads, runs face detection,
 *      and either:
 *        - redirects back to CEAC's "Confirm Photo" page on accept, or
 *        - re-renders the identix page with an error message on reject.
 *
 * The handler returns when CEAC's Confirm Photo page is reached, or
 * throws `PhotoRejectedError` for a photo-content rejection and
 * `IdentixPhotoServiceError` when the official service returns its own error
 * page.
 */

import type { Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

export class PhotoRejectedError extends Error {
  constructor(message: string, public readonly reason?: string) {
    super(message);
    this.name = "PhotoRejectedError";
  }
}

/**
 * Identix returned its own official error surface.  This is a provider
 * failure, not evidence that the applicant's photo was rejected.
 */
export class IdentixPhotoServiceError extends Error {
  readonly code = "IDENTIX_PHOTO_SERVICE_ERROR" as const;
  readonly serviceUrl: string;

  constructor(serviceUrl: string) {
    super("The official Identix photo service returned an error page.");
    this.name = "IdentixPhotoServiceError";
    this.serviceUrl = serviceUrl;
  }
}

/**
 * Return only the official Identix error-page origin/path.  Query strings can
 * carry a CEAC hand-off token, so they must never be copied into diagnostics
 * or error messages.
 */
export function getIdentixPhotoServiceErrorUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (
      url.protocol.toLowerCase() !== "https:" ||
      url.hostname.toLowerCase() !== "identix.state.gov" ||
      url.port !== "" ||
      url.pathname.toLowerCase() !== "/qotw/error.html"
    ) {
      return null;
    }
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export type PhotoFile =
  | { kind: "path"; path: string }
  | { kind: "buffer"; buffer: Buffer; filename: string; mimeType?: string };

export interface UploadPhotoOptions {
  photo: PhotoFile;
  /** Total time budget for the upload + processing step. Default 90s. */
  timeoutMs?: number;
  /**
   * Optional path; when set, the handler dumps DOM info as JSON before
   * attempting the upload so we can adjust selectors without a wasted
   * live round-trip.
   */
  diagnosticPath?: string;
}

export interface UploadPhotoResult {
  /** Did identix accept the photo? */
  accepted: boolean;
  /** Active CEAC page after Identix returns; Identix may replace/close the source page. */
  page: Page;
  /** URL after accept (CEAC Confirm Photo page). */
  postContinueUrl: string | null;
  /** Identix error text (if rejected). */
  rejectionReason: string | null;
}

// CEAC's styled "Upload Photo" submit. Posts a navigation to identix.
const CEAC_TRIGGER_SELECTOR =
  'input[type="submit"][id*="btnUploadPhoto"], input[type="submit"].uploadphoto';

// Identix file input (real <input type="file">).
const IDENTIX_FILE_INPUT_SELECTOR = '#ctl00_cphMain_imageFileUpload, input[type="file"]';
// Identix submit button — image input with class "next".
const IDENTIX_UPLOAD_BUTTON_SELECTOR =
  '#ctl00_cphButtons_btnUpload, input[type="image"].next';
// Identix Result.aspx Continue button — clicks back to CEAC.
const IDENTIX_CONTINUE_BUTTON_SELECTOR = '#ctl00_cphButtons_btnContinue';
// Identix sometimes lands on Default.aspx first and opens Upload.aspx from
// there. Keep this narrow so we do not accidentally click its cancel/back
// controls.
const IDENTIX_START_UPLOAD_SELECTOR =
  'a[href*="/qotw/Upload.aspx" i], input[type="submit"][value*="Upload Photo" i], button:has-text("Upload Photo")';
// Identix error surface — typically a span with class "error" or
// validation summary above the form.
const IDENTIX_ERROR_SELECTOR =
  '[id*="lblError"], [id*="ValidationSummary"], .error, .ErrorMessages';

const IDENTIX_ENTRY_PATTERN =
  /^https:\/\/identix\.state\.gov\/qotw\/(?:(?:Default|Upload)\.aspx|Error\.html)(?:[?#]|$)/i;
const IDENTIX_CONTINUATION_PATTERN =
  /^https:\/\/(?:identix\.state\.gov\/qotw\/(?:(?:Upload|Result)\.aspx|Error\.html)|ceac\.state\.gov\/GenNIV\/General\/photo\/photo_confirmphoto\.aspx)(?:[?#]|$)/i;
const CEAC_CONFIRM_PHOTO_PATTERN =
  /^https:\/\/ceac\.state\.gov\/GenNIV\/General\/photo\/photo_confirmphoto\.aspx(?:[?#]|$)/i;

function isCeacConfirmPhotoUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol.toLowerCase() === "https:" &&
      url.hostname.toLowerCase() === "ceac.state.gov" &&
      url.port === "" &&
      url.pathname.toLowerCase() ===
        "/genniv/general/photo/photo_confirmphoto.aspx"
    );
  } catch {
    return false;
  }
}

function queryFreeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[unrecognized URL]";
  }
}

function toSetFiles(file: PhotoFile): {
  name: string;
  mimeType: string;
  buffer: Buffer;
} {
  if (file.kind === "path") {
    const buf = fs.readFileSync(file.path);
    return {
      name: path.basename(file.path),
      mimeType: file.path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
      buffer: buf,
    };
  }
  return {
    name: file.filename,
    mimeType: file.mimeType ?? "image/jpeg",
    buffer: file.buffer,
  };
}

async function dumpUploadPageDom(page: Page, outPath: string): Promise<void> {
  try {
    const dom = await page.evaluate(`
      (function() {
        function row(el) {
          var r = el.getBoundingClientRect();
          return {
            id: el.id, name: el.name || '', type: el.type || el.tagName,
            value: (el.value || '').slice(0, 60), className: el.className,
            visible: r.width > 0 && r.height > 0,
            disabled: !!el.disabled, readonly: !!el.readOnly,
          };
        }
        function listAll(sel) {
          var out = [];
          var ns = document.querySelectorAll(sel);
          for (var i = 0; i < ns.length; i++) out.push(row(ns[i]));
          return out;
        }
        return {
          // Keep hand-off tokens and query parameters out of the diagnostic.
          url: location.origin + location.pathname,
          heading: ((document.querySelector('h2, .SubHead') || {}).textContent || '').trim(),
          fileInputs: listAll('input[type="file"]'),
          submits: listAll('input[type="submit"]'),
          buttons: listAll('button, input[type="button"], input[type="image"]'),
          allInputs: listAll('input'),
          bodySnippet: (document.body.innerText || '').slice(0, 400),
        };
      })()
    `);
    fs.writeFileSync(outPath, JSON.stringify(dom, null, 2));
  } catch {
    // best effort
  }
}

export async function handleUploadPhotoPage(
  page: Page,
  options: UploadPhotoOptions,
): Promise<UploadPhotoResult> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const context = page.context();
  let activePage = page;

  // Identix's pages render their action buttons below an image preview;
  // the default headless viewport (~720px) leaves the buttons off-screen,
  // and Playwright rejects clicks outside the viewport even with
  // force:true. Bumping the viewport tall enough keeps the buttons in
  // view for both Upload.aspx and Result.aspx.
  await activePage.setViewportSize({ width: 1280, height: 1600 });

  if (options.diagnosticPath) {
    await dumpUploadPageDom(activePage, options.diagnosticPath);
  }

  // 1. Watch the whole context while clicking: Identix can open in a popup
  //    while the original CEAC page stays on Upload Photo.
  const trigger = activePage.locator(CEAC_TRIGGER_SELECTOR).first();
  await trigger.waitFor({ state: "visible", timeout: 10_000 });
  [activePage] = await Promise.all([
    waitForPortalPage(context.pages(), IDENTIX_ENTRY_PATTERN, 30_000,
      "Identix photo entry", options.diagnosticPath),
    trigger.click({ force: true }),
  ]);
  await activePage.setViewportSize({ width: 1280, height: 1600 });

  // The live portal may first render qotw/Default.aspx, whose Upload Photo
  // action replaces the current window (and can close it while opening a new
  // one). Follow that transition and keep the surviving Page reference.
  if (/identix\.state\.gov\/qotw\/Default\.aspx/i.test(activePage.url())) {
    const startUpload = activePage.locator(IDENTIX_START_UPLOAD_SELECTOR).first();
    await startUpload.waitFor({ state: "visible", timeout: 15_000 });
    [activePage] = await Promise.all([
      waitForPortalPage(context.pages(),
        /^https:\/\/identix\.state\.gov\/qotw\/(?:Upload\.aspx|Error\.html)(?:[?#]|$)/i,
        30_000, "Identix photo upload", options.diagnosticPath),
      startUpload.click({ force: true, timeout: 10_000 }),
    ]);
    await activePage.setViewportSize({ width: 1280, height: 1600 });
  }

  // 2. On identix: set the file on the real file input, then click the
  //    image-input upload submit. Identix processes the upload server-
  //    side; on accept it 302s back to CEAC's Confirm Photo page.
  const fileInput = activePage.locator(IDENTIX_FILE_INPUT_SELECTOR).first();
  await fileInput.waitFor({ state: "attached", timeout: 15_000 });
  const payload = toSetFiles(options.photo);
  await fileInput.setInputFiles(payload);

  const uploadBtn = activePage.locator(IDENTIX_UPLOAD_BUTTON_SELECTOR).first();
  await uploadBtn.waitFor({ state: "visible", timeout: 10_000 });

  // 3. Click upload and inspect the resulting official page below.
  // Image-input buttons on identix submit via x/y coords, so we need a
  // real click (JS .click() on <input type="image"> does not always
  // trigger an ASP.NET form post). Ensure the button is in view first
  // so headless viewport doesn't trip Playwright's actionability check.
  await uploadBtn.evaluate("el => el.scrollIntoView({ block: 'center' })");
  await uploadBtn.click({ force: true, timeout: 10_000 });

  // Poll for accept (Result.aspx with btnContinue → click → back to CEAC)
  // OR reject (error visible on identix Upload.aspx).
  const deadline = Date.now() + timeoutMs;
  let accepted = false;
  let resultPageHandled = false;
  while (Date.now() < deadline) {
    const identixErrorPage = context.pages().find((candidate) =>
      !candidate.isClosed() && getIdentixPhotoServiceErrorUrl(candidate.url()) !== null,
    );
    if (identixErrorPage) {
      activePage = identixErrorPage;
    }

    const identixErrorUrl = getIdentixPhotoServiceErrorUrl(activePage.url());
    if (identixErrorUrl) {
      if (options.diagnosticPath) {
        await dumpUploadPageDom(activePage, options.diagnosticPath);
      }
      throw new IdentixPhotoServiceError(identixErrorUrl);
    }

    const ceacPage = context
      .pages()
      .find((candidate) =>
        !candidate.isClosed() &&
        isCeacConfirmPhotoUrl(candidate.url()),
      );
    if (ceacPage) {
      activePage = ceacPage;
      accepted = true;
      break;
    }

    if (activePage.isClosed()) {
      activePage = await waitForPortalPage(
        context.pages(),
        IDENTIX_CONTINUATION_PATTERN,
        15_000,
        "photo continuation",
        options.diagnosticPath,
      );
    }
    const url = activePage.url();

    if (isCeacConfirmPhotoUrl(url)) {
      accepted = true;
      break;
    }

    // Identix Result page: face-detection succeeded. ASP.NET image-input
    // buttons require `<name>.x` and `<name>.y` fields in the form post
    // for the server to recognize which button was clicked — neither
    // Playwright's click (rejected because the button is below the
    // viewport) nor el.click() (browsers don't add x/y) accomplishes
    // that. We submit the form directly with the coords appended.
    if (/identix\.state\.gov\/qotw\/Result\.aspx/i.test(url) && !resultPageHandled) {
      const continueBtn = activePage.locator(IDENTIX_CONTINUE_BUTTON_SELECTOR).first();
      if ((await continueBtn.count()) > 0) {
        resultPageHandled = true;
        [activePage] = await Promise.all([
          waitForPortalPage(context.pages(), CEAC_CONFIRM_PHOTO_PATTERN,
            timeoutMs, "CEAC photo confirmation", options.diagnosticPath),
          activePage.evaluate(`
            (function() {
              var btn = document.querySelector('#ctl00_cphButtons_btnContinue');
              if (!btn) return;
              var form = btn.closest('form') || document.forms[0];
              if (!form) return;
              var name = btn.name;
              ['x', 'y'].forEach(function(c) {
                var inp = document.createElement('input');
                inp.type = 'hidden'; inp.name = name + '.' + c; inp.value = '5';
                form.appendChild(inp);
              });
              form.submit();
            })();
          `),
        ]);
        continue;
      }
    }

    // Identix Upload.aspx still showing → check for error banner.
    if (/identix\.state\.gov\/qotw\/Upload\.aspx/i.test(url)) {
      const errLoc = activePage.locator(IDENTIX_ERROR_SELECTOR).first();
      if ((await errLoc.count()) > 0) {
        const visible = await errLoc.isVisible().catch(() => false);
        if (visible) {
          const text = (
            (await errLoc.textContent({ timeout: 1_000 }).catch(() => "")) ?? ""
          ).trim();
          if (text.length > 0) {
            if (options.diagnosticPath) {
              await dumpUploadPageDom(activePage, options.diagnosticPath);
            }
            throw new PhotoRejectedError(text, text);
          }
        }
      }
    }
    await activePage.waitForTimeout(500);
  }

  if (!accepted) {
    if (options.diagnosticPath) {
      await dumpUploadPageDom(activePage, options.diagnosticPath);
    }
    throw new PhotoRejectedError(
      `Upload Photo flow did not return to CEAC within ${timeoutMs}ms (currently at ${queryFreeUrl(activePage.url())})`,
    );
  }

  // 4. Settle on CEAC's Confirm Photo page before returning.
  try {
    await activePage.waitForLoadState("networkidle", { timeout: 15_000 });
  } catch {
    await activePage.waitForTimeout(2_000);
  }

  return {
    accepted: true,
    page: activePage,
    postContinueUrl: activePage.url(),
    rejectionReason: null,
  };
}

async function waitForPortalPage(
  currentPages: Page[],
  urlPattern: RegExp,
  timeoutMs: number,
  label: string,
  diagnosticPath?: string,
): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  let pages = currentPages;

  while (Date.now() < deadline) {
    const errorPage = pages.find((candidate) => !candidate.isClosed() &&
      getIdentixPhotoServiceErrorUrl(candidate.url()) !== null);
    if (errorPage) {
      if (diagnosticPath) await dumpUploadPageDom(errorPage, diagnosticPath);
      throw new IdentixPhotoServiceError(getIdentixPhotoServiceErrorUrl(errorPage.url())!);
    }

    const match = pages.find(
      (candidate) => !candidate.isClosed() && urlPattern.test(candidate.url()),
    );
    if (match) {
      await match.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
      return match;
    }

    const context = pages[0]?.context();
    if (context) pages = context.pages();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const liveUrls = pages
    .filter((candidate) => !candidate.isClosed())
    .map((candidate) => queryFreeUrl(candidate.url()))
    .join(", ");
  throw new PhotoRejectedError(
    `${label} did not open within ${timeoutMs}ms${liveUrls ? ` (open pages: ${liveUrls})` : ""}`,
  );
}
