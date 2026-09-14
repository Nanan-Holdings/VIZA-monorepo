/**
 * Solve the CEAC start-page image CAPTCHA during session bootstrap.
 *
 * Locates the CAPTCHA image on the start page, captures it as a PNG buffer,
 * submits it to 2captcha via the captcha-solver client, types the answer into
 * the code input, and returns a typed outcome.
 *
 * Retry policy: the caller may retry up to N times. On wrong-answer
 * validation, this module calls reportBadCaptcha for a 2captcha refund.
 */

import type { Page } from "@playwright/test";
import { solveImageCaptcha, reportBadCaptcha, type CaptchaSolveResult, type CaptchaSolveTelemetry } from "../captcha";
import { SessionBootstrapError } from "./errors";
import { CEAC_URLS } from "./selectors";
import { waitForAspNetPostback } from "./aspnet";
import { gotoCeacStartPage } from "./start-page-navigation";

// ---------------------------------------------------------------------------
// Selectors — CEAC start-page CAPTCHA elements
// ---------------------------------------------------------------------------

/** The <img> tag containing the CAPTCHA image. */
const CAPTCHA_IMAGE_SELECTOR = 'img[id*="Captcha"]';

/** The start-page location selector CEAC requires before enabling Start. */
const LOCATION_SELECT_SELECTOR =
  'select[id*="ucLocation_ddlLocation"], select[name*="ucLocation$ddlLocation"]';

/** The text input where the user types the CAPTCHA answer. */
const CAPTCHA_INPUT_SELECTOR =
  'input[id*="IdentifyCaptcha1_txtCodeTextBox"], input[id*="CaptchaCodeTextBox"], input[id*="captcha" i][type="text"]';

/**
 * After the location postback, CEAC shows an "Additional Location
 * Information" modal. It MUST be dismissed by clicking its Close link —
 * which fires a server-side `__doPostBack` acknowledging the notification.
 * CSS-hiding alone isn't enough: CEAC tracks dismissal server-side, and
 * a subsequent START click on an undismissed session redirects to
 * `SessionTimedOut.aspx` even when the CAPTCHA answer is correct.
 *
 * The Close link triggers the postback; `CLOSE_SELECTOR` targets it.
 * Because the Close itself is an async postback (via the ScriptManager),
 * we also inject a CSS fallback so that if the postback races with our
 * CAPTCHA extraction, pointer-event interception cannot block fills or
 * clicks on the Start link.
 */
const POST_LOCATION_MODAL_CLOSE_SELECTOR =
  'a[id*="ucPostMessage"][id*="lnkClose"], a[id*="ucPost"][id*="lnkClose"]';
const POST_LOCATION_MODAL_HIDE_CSS =
  '.modalBackground, .modal-content, [id*="modalConfirm_backgroundElement"] { display: none !important; }';


// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type StartPageCaptchaOutcome =
  | { status: "solved"; solve: CaptchaSolveResult }
  | { status: "wrong_answer"; solve: CaptchaSolveResult; validationHint: string }
  | { status: "no_captcha" }
  | { status: "failed"; reason: string };

export interface StartPageCaptchaOptions {
  /** Applicant-selected CEAC post. Omit only to preserve the page selection. */
  startLocationCode?: string | null;
  /** Recovery must use Retrieve and must never create a new application. */
  startAction?: "start" | "retrieve";
}

export async function submitStartPageAction(
  page: Page,
  action: "start" | "retrieve",
): Promise<void> {
  const selector = action === "retrieve"
    ? 'a[id*="lnkRetrieve"], a[id*="lnkContinueApp"], input[id*="btnRetrieve"]'
    : 'a[id*="lnkNew"], input[type="submit"][value*="Start"]';
  const button = page.locator(selector).first();
  await button.waitFor({ state: "visible", timeout: 10_000 });
  await button.click({ timeout: 10_000 });
}

type StartPageLocationResolution =
  | { ok: true; locationCode: string }
  | { ok: false; reason: string };

async function resolveStartPageLocationCode(
  page: Page,
  options: StartPageCaptchaOptions,
): Promise<StartPageLocationResolution> {
  const locationSelect = page.locator(LOCATION_SELECT_SELECTOR).first();
  const explicitLocation = options.startLocationCode !== undefined && options.startLocationCode !== null;

  try {
    await locationSelect.waitFor({ state: "attached", timeout: 10_000 });
  } catch {
    return {
      ok: false,
      reason: "CEAC start page loaded but no location selector was found",
    };
  }

  let rawLocation = explicitLocation ? options.startLocationCode : undefined;
  if (!explicitLocation) {
    try {
      rawLocation = await locationSelect.inputValue();
    } catch {
      return {
        ok: false,
        reason: "CEAC start page location selection could not be read",
      };
    }
  }

  const locationCode = rawLocation?.trim().toUpperCase() ?? "";
  if (!locationCode) {
    return {
      ok: false,
      reason: "CEAC start page location selection is blank; an applicant-selected consular post is required",
    };
  }

  try {
    const optionExists = await locationSelect.evaluate((select, target) => {
      if (!(select instanceof HTMLSelectElement)) return false;
      return Array.from(select.options).some((option) => option.value.trim().toUpperCase() === target);
    }, locationCode);
    if (!optionExists) {
      return {
        ok: false,
        reason: `CEAC start page location ${locationCode} is not a legal option on the page`,
      };
    }
  } catch {
    return {
      ok: false,
      reason: "CEAC start page location selector could not be validated",
    };
  }

  return { ok: true, locationCode };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt to solve the CEAC start-page CAPTCHA once.
 *
 * Steps:
 *  1. Locate the CAPTCHA image via `img[id*="Captcha"]`.
 *  2. Screenshot just the image element to a PNG buffer.
 *  3. Send to 2captcha via `solveImageCaptcha()`.
 *  4. Select the CEAC location/post so the Start button becomes active.
 *  5. Type the answer into the CAPTCHA text input.
 *  6. Click the Start/Continue control to submit.
 *  7. Check for validation errors — if the CAPTCHA was wrong, report it.
 *
 * Does NOT retry internally — callers decide retry policy.
 */
export async function solveStartPageCaptcha(
  page: Page,
  options: StartPageCaptchaOptions = {},
): Promise<StartPageCaptchaOutcome> {
  // 1. Resolve the CEAC post/location FIRST.
  //
  //    The CEAC location dropdown has AutoPostBack=true. Selecting a value
  //    triggers a server postback that rebuilds the page — including
  //    regenerating the CAPTCHA image and its associated server-side
  //    expected value. If we screenshot/solve the CAPTCHA before this
  //    postback, we end up typing the pre-postback answer into the
  //    post-postback form, which CEAC rejects and then redirects to
  //    SessionTimedOut.aspx.
  //
  //    An explicit applicant location wins. Without one, preserve the
  //    existing legal page selection and never synthesize a default post.
  //    Wait for the element to be attached rather than failing immediately
  //    on count==0 — after a wrong-CAPTCHA re-render, the DOM is mid-swap
  //    and a zero count reflects timing rather than actual absence.
  const locationResolution = await resolveStartPageLocationCode(page, options);
  if (!locationResolution.ok) {
    return { status: "failed", reason: locationResolution.reason };
  }
  const locationCode = locationResolution.locationCode;

  const locationSelect = page.locator(LOCATION_SELECT_SELECTOR).first();
  try {
    await locationSelect.waitFor({ state: "attached", timeout: 10_000 });
  } catch {
    return {
      status: "failed",
      reason: "CEAC start page loaded but no location selector was found",
    };
  }

  let currentValue = "";
  try {
    currentValue = (await locationSelect.inputValue()).trim().toUpperCase();
  } catch {
    // If we can't read the current value, fall through and try to select.
  }

  if (currentValue !== locationCode) {
    try {
      await locationSelect.selectOption(locationCode);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: "failed",
        reason: `Could not select CEAC location ${locationCode}: ${msg}`,
      };
    }
    // Wait for the ASP.NET UpdatePanel postback triggered by the
    // location-dropdown AutoPostBack to FULLY finish. `networkidle`
    // alone isn't reliable here — CEAC keeps background XHRs running
    // after the postback settles. The authoritative signal is
    // `Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack()`
    // flipping back to false. Falling back to a 2s settle if the
    // PageRequestManager check throws.
    await waitForAspNetPostback(page, 15_000);
  }

  // 1b. Dismiss the "Additional Location Information" modal via its
  //     server-side Close link. CEAC tracks dismissal in session state;
  //     without it, a subsequent START click (even with a correct
  //     CAPTCHA) redirects to SessionTimedOut.aspx.
  //
  //     Do NOT force:true-click immediately. That races the modal's
  //     animated entrance and sometimes fires before the link is wired
  //     up, so CEAC never gets its server-side ack. Wait for the close
  //     link to become VISIBLE (or confirm no modal rendered), then
  //     click with a real actionability check, then wait for both the
  //     modal to disappear AND the resulting async postback to finish.
  const closeBtn = page.locator(POST_LOCATION_MODAL_CLOSE_SELECTOR).first();
  let closeAppeared = false;
  try {
    await closeBtn.waitFor({ state: "visible", timeout: 8_000 });
    closeAppeared = true;
  } catch {
    // Modal may not have rendered — not every CEAC deployment shows it
    // for every location. Fall through and assume no ack is needed.
  }
  if (closeAppeared) {
    try {
      await closeBtn.click({ timeout: 5_000 });
    } catch {
      // Try a JS click as a last resort. __doPostBack fires either way
      // as long as the href hook is intact.
      try {
        await closeBtn.evaluate("el => el.click()");
      } catch { /* noop */ }
    }
    // Wait for the modal to actually be gone AND the postback to finish.
    try {
      await closeBtn.waitFor({ state: "hidden", timeout: 8_000 });
    } catch {
      // Best effort — the CSS fallback below keeps pointer events unblocked
      // even if the close link is still present.
    }
    await waitForAspNetPostback(page, 10_000);
  }

  // Injected style fallback: keep any residual modal backdrop from
  // intercepting pointer events on the CAPTCHA input and Start link.
  try {
    await page.addStyleTag({ content: POST_LOCATION_MODAL_HIDE_CSS });
  } catch { /* best effort */ }

  // 2. Locate the CAPTCHA image element and extract the pixels the
  //     browser already rendered.
  //
  //     Do NOT re-fetch the CAPTCHA URL: BotDetect generates a fresh image
  //     on every HTTP request, but the expected answer is bound to the
  //     FIRST fetch the browser made when the page loaded. A second fetch
  //     would hand us the pixels of a different CAPTCHA than the one the
  //     server will validate against — so 2captcha's answer would always
  //     be rejected even when it read the image correctly.
  //
  //     Similarly, element.screenshot() races with the "Additional Location
  //     Information" modal overlay after the location postback and can
  //     capture blank/black pixels at the CAPTCHA's coordinates.
  //
  //     Instead: draw the already-loaded <img> onto an offscreen canvas
  //     and export as PNG. That returns the exact bytes the browser
  //     rendered, unaffected by page layout, overlays, or race conditions.
  const captchaImg = page.locator(CAPTCHA_IMAGE_SELECTOR).first();
  try {
    await captchaImg.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    return { status: "no_captcha" };
  }

  // Wait for the image bytes to finish decoding AND for naturalWidth to
  // be non-zero. After a wrong-CAPTCHA re-render, the <img> element may
  // be attached and even "visible" before the server has delivered the
  // new PNG bytes; canvas-drawing it at that moment produces an empty
  // PNG which the solver can't read.
  try {
    await captchaImg.evaluate(
      (el) =>
        new Promise<void>((resolve) => {
          const img = el as unknown as {
            complete: boolean;
            naturalWidth: number;
            addEventListener: (event: string, cb: () => void, opts?: unknown) => void;
          };
          const ready = () => img.complete && img.naturalWidth > 0;
          if (ready()) {
            resolve();
            return;
          }
          const done = () => {
            if (ready()) resolve();
          };
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
          // Poll every 200ms in case load already fired before we attached
          // (image was cached); cap at 10s.
          const poll = setInterval(() => {
            if (ready()) {
              clearInterval(poll);
              resolve();
            }
          }, 200);
          setTimeout(() => {
            clearInterval(poll);
            resolve();
          }, 10_000);
        }),
    );
  } catch {
    // Best effort — fall through to rasterize; if bytes are empty the
    // next step will return a structured "failed" result.
  }

  // 3. Rasterize the rendered image to PNG via canvas. Retry a few times
  //    in case naturalWidth is still 0 on the first attempt — the image
  //    load event races with the MSAJAX async postback completion.
  let imageBuffer: Buffer | null = null;
  for (let attempt = 0; attempt < 4 && !imageBuffer; attempt++) {
    if (attempt > 0) await page.waitForTimeout(500);
    try {
      const dataUrl: string = await captchaImg.evaluate((el) => {
        const img = el as unknown as { naturalWidth: number; naturalHeight: number };
        if (img.naturalWidth === 0 || img.naturalHeight === 0) return "";
        const doc = (globalThis as unknown as { document: unknown }).document as {
          createElement: (tag: string) => {
            width: number;
            height: number;
            getContext: (t: string) => { drawImage: (i: unknown, x: number, y: number) => void } | null;
            toDataURL: (type: string) => string;
          };
        };
        const canvas = doc.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return "";
        ctx.drawImage(el, 0, 0);
        return canvas.toDataURL("image/png");
      });
      if (dataUrl.startsWith("data:image/png;base64,")) {
        imageBuffer = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
      }
    } catch {
      // retry
    }
  }
  if (!imageBuffer) {
    return { status: "failed", reason: "Could not rasterize CAPTCHA image via canvas after retries" };
  }

  // 4. Solve via 2captcha
  let solve: CaptchaSolveResult;
  try {
    solve = await solveImageCaptcha(imageBuffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "failed", reason: `2captcha solve failed: ${msg}` };
  }

  // 5. Type the answer into the CAPTCHA input.
  //
  //    Submit as returned by 2captcha — do NOT force uppercase. The
  //    rendered CEAC CAPTCHA can be upper, lower, or mixed, and CEAC
  //    validates against whatever case the worker typed. Uppercasing a
  //    lowercase-correct answer breaks attempts where the worker read
  //    the chars correctly but the rendered case was ambiguous.
  const captchaInput = page.locator(CAPTCHA_INPUT_SELECTOR).first();
  const inputCount = await captchaInput.count();
  if (inputCount === 0) {
    return {
      status: "failed",
      reason: "CAPTCHA image found but no text input found on page",
    };
  }
  await captchaInput.fill(solve.text.trim());

  // 6. Recovery explicitly selects Retrieve. Never fall back to the Start
  // link or Enter: that can create a fresh draft during a recovery attempt.
  await submitStartPageAction(page, options.startAction ?? "start");

  // 7. Wait for the POST-START async postback to settle AND for the URL
  //    to transition off Default.aspx (or for a new CAPTCHA to render if
  //    CEAC rejected the answer). Two signals, bounded at 15s total.
  await waitForAspNetPostback(page, 15_000);
  try {
    await page.waitForLoadState("networkidle", { timeout: 5_000 });
  } catch { /* noop */ }

  // 7. Classify the post-submit state.
  //
  //    CEAC's behavior after lnkNew is one of three:
  //      - Redirect to ConfirmApplicationID.aspx (or similar downstream
  //        page) → CAPTCHA was correct, session OK → "solved".
  //      - Redirect to SessionTimedOut.aspx → session was invalidated
  //        despite a correct CAPTCHA (e.g. modal not dismissed server
  //        side, stealth fingerprint rejected). Treat as failed — the
  //        CAPTCHA retry loop cannot recover from this; a fresh session
  //        is required.
  //      - Stay on Default.aspx with a new CAPTCHA → wrong CAPTCHA,
  //        retryable via outer loop.
  const postUrl = page.url();
  if (/\/Common\/SessionTimedOut\.aspx/i.test(postUrl)) {
    return {
      status: "failed",
      reason: `CEAC redirected to SessionTimedOut.aspx after START click — session invalidated (url=${postUrl})`,
    };
  }

  const stillHasCaptcha = (await page.locator(CAPTCHA_IMAGE_SELECTOR).count()) > 0;
  if (stillHasCaptcha) {
    // Same start page, new CAPTCHA → the answer was rejected.
    try {
      await reportBadCaptcha(solve.solveId);
    } catch {
      // Best effort — don't fail the run over a refund request.
    }
    const validationEl = page
      .locator('[id*="ValidationSummary"], .error, [id*="RequiredFieldValidator"]:visible')
      .first();
    let hint = "";
    try {
      hint = (await validationEl.innerText({ timeout: 1_000 })).trim();
    } catch {
      hint = "";
    }
    return {
      status: "wrong_answer",
      solve,
      validationHint: hint || "CEAC re-rendered the start page (no explicit error)",
    };
  }

  // No CAPTCHA on the landing page and no SessionTimedOut redirect → we
  // successfully advanced past the start-page CAPTCHA surface.
  return { status: "solved", solve };
}

export interface CaptchaSolveWithTelemetry {
  solve: CaptchaSolveResult;
  telemetry: CaptchaSolveTelemetry[];
  /** Location/post frozen for every attempt, including page reloads. */
  locationCode: string;
}

/**
 * Attempt to solve the start-page CAPTCHA with retries.
 *
 * @param page - Playwright page on the CEAC start page.
 * @param maxAttempts - Maximum solve attempts (default 3).
 * @returns The solve result and an array of per-attempt telemetry records.
 * @throws SessionBootstrapError if all attempts are exhausted.
 */
export async function solveStartPageCaptchaWithRetry(
  page: Page,
  maxAttempts = 3,
  options: StartPageCaptchaOptions = {},
): Promise<CaptchaSolveWithTelemetry> {
  const attempts: StartPageCaptchaOutcome[] = [];
  const telemetry: CaptchaSolveTelemetry[] = [];

  // Resolve the post once before the first CAPTCHA attempt. CEAC reloads the
  // start page after a rejected answer and may reselect its IP-based default;
  // every subsequent attempt must keep using this same applicant/page post.
  const initialLocation = await resolveStartPageLocationCode(page, options);
  if (!initialLocation.ok) {
    throw new SessionBootstrapError(
      `CAPTCHA solve cannot start: ${initialLocation.reason}`,
      {
        url: page.url(),
        details: { locationResolution: initialLocation.reason },
      },
    );
  }
  const frozenLocationCode = initialLocation.locationCode;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const outcome = await solveStartPageCaptcha(page, {
      startLocationCode: frozenLocationCode,
      startAction: options.startAction,
    });
    attempts.push(outcome);

    switch (outcome.status) {
      case "solved":
        telemetry.push({
          solveId: outcome.solve.solveId,
          durationMs: outcome.solve.durationMs,
          attempt,
          outcome: "solved",
        });
        return { solve: outcome.solve, telemetry, locationCode: frozenLocationCode };

      case "no_captcha": {
        // A true "no captcha" state means the session is already past the
        // start page (e.g. a retry after an earlier solve advanced us).
        // But on a fresh bootstrap the captcha image failing to become
        // visible while we're still on Default.aspx is a broken page
        // load — treat it as a failed attempt, not a success. Otherwise
        // callers accept a session that never left the start surface.
        const currentUrl = page.url();
        if (/GenNIV\/Default\.aspx/i.test(currentUrl)) {
          telemetry.push({ solveId: "", durationMs: 0, attempt, outcome: "failed" });
          if (attempt === maxAttempts) {
            throw new SessionBootstrapError(
              `CAPTCHA solve failed after ${maxAttempts} attempts (last: captcha image not visible on start page)`,
              {
                url: currentUrl,
                details: { attempts: attempts.map(summarizeOutcome), telemetry },
              },
            );
          }
          try {
            await gotoCeacStartPage(page, 30_000);
          } catch {
            await page.waitForTimeout(1_000);
          }
          continue;
        }
        return {
          solve: { text: "", solveId: "", durationMs: 0 },
          telemetry,
          locationCode: frozenLocationCode,
        };
      }

      case "wrong_answer":
        telemetry.push({
          solveId: outcome.solve.solveId,
          durationMs: outcome.solve.durationMs,
          attempt,
          outcome: "wrong_answer_retry",
        });
        if (attempt === maxAttempts) {
          throw new SessionBootstrapError(
            `CAPTCHA solve failed after ${maxAttempts} attempts (last: wrong answer)`,
            {
              url: page.url(),
              details: {
                attempts: attempts.map(summarizeOutcome),
                telemetry,
                lastValidationHint: outcome.validationHint,
              },
            },
          );
        }
        // Full reload before next attempt: CEAC's UpdatePanel re-render
        // after a wrong-CAPTCHA submit sometimes leaves the DOM in a
        // partial state (missing location dropdown etc). A fresh goto
        // gives us a clean start-page structure.
        try {
          await gotoCeacStartPage(page, 30_000);
        } catch {
          await page.waitForTimeout(1_000);
        }
        continue;

      case "failed":
        telemetry.push({
          solveId: "",
          durationMs: 0,
          attempt,
          outcome: "failed",
        });
        // SessionTimedOut means CEAC invalidated the server-side session
        // — retrying within the same browser context will keep failing
        // because the context's ASP.NET cookie is flagged. Fail fast so
        // the caller can close the browser and start a fresh context on
        // a retry (or alert the operator).
        if (/SessionTimedOut/i.test(outcome.reason)) {
          throw new SessionBootstrapError(
            `CEAC invalidated session (SessionTimedOut). Fresh browser context required. Attempt ${attempt}/${maxAttempts}.`,
            {
              url: page.url(),
              details: {
                attempts: attempts.map(summarizeOutcome),
                telemetry,
                nonRetryableInContext: true,
              },
            },
          );
        }
        // Treat other "failed" as retryable unless this is the last attempt.
        // Common causes (transient 2captcha 5xx, flaky canvas rasterize,
        // DOM race after re-render) recover on the next attempt.
        if (attempt === maxAttempts) {
          throw new SessionBootstrapError(
            `CAPTCHA solve failed after ${maxAttempts} attempts (last: ${outcome.reason})`,
            {
              url: page.url(),
              details: { attempts: attempts.map(summarizeOutcome), telemetry },
            },
          );
        }
        // Reload before retry — same reasoning as the wrong_answer branch.
        try {
          await gotoCeacStartPage(page, 30_000);
        } catch {
          await page.waitForTimeout(1_000);
        }
        continue;
    }
  }

  throw new SessionBootstrapError("CAPTCHA solve exhausted all attempts", {
    url: page.url(),
    details: { attempts: attempts.map(summarizeOutcome), telemetry },
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function summarizeOutcome(o: StartPageCaptchaOutcome): Record<string, unknown> {
  switch (o.status) {
    case "solved":
      return { status: "solved", durationMs: o.solve.durationMs, solveId: o.solve.solveId };
    case "wrong_answer":
      return {
        status: "wrong_answer",
        durationMs: o.solve.durationMs,
        solveId: o.solve.solveId,
        hint: o.validationHint,
      };
    case "no_captcha":
      return { status: "no_captcha" };
    case "failed":
      return { status: "failed", reason: o.reason };
  }
}
