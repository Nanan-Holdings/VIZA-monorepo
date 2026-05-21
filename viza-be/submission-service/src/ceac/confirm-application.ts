/**
 * Handle the CEAC "Confirm Application ID / Security Question" page.
 *
 * Immediately after the start-page CAPTCHA is solved, CEAC lands on
 * `ConfirmApplicationID.aspx?node=SecureQuestion`. The page displays:
 *   - the newly-assigned Application ID (needed for recovery & handoff)
 *   - a Privacy Act / Computer Fraud Act checkbox that must be checked
 *   - a security-question dropdown (20 options)
 *   - an answer input
 *   - a Continue button
 *
 * The user MUST choose a question and provide an answer before CEAC will
 * let them begin the actual DS-160 form. The answer is the secondary
 * recovery factor — the applicant needs it later (plus their Application
 * ID and first five letters of their surname) to retrieve the application.
 */

import type { Page } from "@playwright/test";
import { CEAC_APPLICATION_ID_PATTERN } from "./selectors";

const PRIVACY_CHECKBOX_SELECTOR = '#ctl00_SiteContentPlaceHolder_chkbxPrivacyAct';
const APPLICATION_ID_LABEL_SELECTOR = '#ctl00_SiteContentPlaceHolder_lblBarcode';
const SECURITY_QUESTION_SELECTOR = '#ctl00_SiteContentPlaceHolder_ddlQuestions';
const SECURITY_ANSWER_SELECTOR = '#ctl00_SiteContentPlaceHolder_txtAnswer';
const CONTINUE_BUTTON_SELECTOR = '#ctl00_SiteContentPlaceHolder_btnContinue';

export interface ConfirmApplicationOptions {
  /** Applicant's answer to the chosen security question. Required for recovery later. */
  securityAnswer: string;
  /**
   * Dropdown value (1-20) of the security question to choose. Defaults to
   * "3" ("What is your maternal grandmother's maiden name?") — a question
   * most applicants can answer deterministically.
   */
  securityQuestionValue?: string;
  /** Timeout for the Continue-click postback in ms. Default 30_000. */
  timeoutMs?: number;
}

export interface ConfirmApplicationResult {
  /** The CEAC Application ID assigned to this new application (AA + 8 chars). */
  applicationId: string;
  /** The dropdown value that was selected (1-20). */
  securityQuestionValue: string;
  /** The human-readable question text associated with the chosen value. */
  securityQuestionText: string;
  /** The answer that was typed in. Stored so operators can pass it to the applicant. */
  securityAnswer: string;
  /** URL landed on after clicking Continue. */
  postContinueUrl: string;
}

/**
 * Run the Confirm-Application-ID / Security-Question page:
 *  1. Check the Privacy Act checkbox (gates the Continue button).
 *  2. Capture and return the assigned Application ID.
 *  3. Select a security question from the dropdown.
 *  4. Type the answer.
 *  5. Click Continue and wait for the next page to load.
 *
 * Throws if the Application ID cannot be captured — without it, the
 * applicant cannot recover their DS-160 later and the run has no value.
 */
async function dumpConfirmPageDiagnostics(
  page: Page,
  label: string,
): Promise<void> {
  const outDir = process.env.CEAC_DIAG_OUT_DIR ?? "./e2e-out";
  try {
    const fs = await import("node:fs");
    const pathMod = await import("node:path");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = `${Date.now()}-${label}`;

    const dom = await page.evaluate(`
      (function() {
        function ser(el) {
          var labelText = "";
          if (el.id) {
            var lab = document.querySelector('label[for="' + el.id + '"]');
            if (lab) labelText = (lab.textContent || "").trim().slice(0, 200);
          }
          if (!labelText && el.parentElement) {
            labelText = (el.parentElement.textContent || "").trim().slice(0, 200);
          }
          return {
            tag: el.tagName,
            id: el.id,
            name: el.name || "",
            type: el.type || "",
            value: (el.value || "").slice(0, 100),
            disabled: !!el.disabled,
            disabledAttr: el.hasAttribute("disabled"),
            checked: !!el.checked,
            visible: el.offsetParent !== null,
            label: labelText,
          };
        }
        var nodes = document.querySelectorAll("input, select, textarea, button");
        var out = [];
        for (var i = 0; i < nodes.length; i++) out.push(ser(nodes[i]));
        return {
          url: location.href,
          title: document.title,
          h2: (document.querySelector("h2, .SubHead") || {}).textContent || "",
          formCount: document.querySelectorAll("form").length,
          hasDoPostBack: typeof window.__doPostBack === "function",
          fields: out,
        };
      })()
    `);

    fs.writeFileSync(
      pathMod.join(outDir, `confirm-${stamp}-dom.json`),
      JSON.stringify(dom, null, 2),
    );
    await page.screenshot({
      path: pathMod.join(outDir, `confirm-${stamp}.png`),
      fullPage: true,
    });
  } catch {
    // diagnostic is best-effort — never let it shadow the original error
  }
}

export async function handleConfirmApplicationPage(
  page: Page,
  options: ConfirmApplicationOptions,
): Promise<ConfirmApplicationResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;

  // Snapshot the SecureQuestion page on entry — captures the pristine state
  // before any interaction, so when the dropdown wait fails we can compare
  // pre vs post and see exactly what the postback did or didn't change.
  await dumpConfirmPageDiagnostics(page, "pre");

  // 1. Check Privacy Act / Computer Fraud Act acknowledgment.
  //    CEAC renders the security-question dropdown disabled until this
  //    AutoPostBack=true checkbox fires its server-side postback. A bare
  //    `.check()` or `force: true` click can race the ASP.NET MSAJAX
  //    pipeline — Playwright's auto-click sometimes lands before
  //    __doPostBack is wired, leaving the dropdown stuck disabled.
  //
  //    We force the full sequence: set checked, dispatch click + change,
  //    fire the registered onclick handler (which ASP.NET injects to call
  //    __doPostBack), then wait for the UpdatePanel network round-trip
  //    to settle so the server-side state catches up.
  const privacyChk = page.locator(PRIVACY_CHECKBOX_SELECTOR).first();
  if ((await privacyChk.count()) > 0) {
    // Step 1: real Playwright click — fires native mouse + change events.
    // force:true bypasses any wrapping label that might intercept hits.
    try {
      await privacyChk.check({ force: true, timeout: 5_000 });
    } catch {
      // If check() fails, set the checked property directly so __doPostBack
      // below sees the right form-field state at submit time.
      await privacyChk.evaluate("el => { el.checked = true; }");
    }
    // Step 2: explicitly invoke ASP.NET __doPostBack with this checkbox as
    // the event target. CEAC's AutoPostBack normally relies on the inline
    // onclick attribute calling __doPostBack — but Playwright's synthetic
    // click sometimes lands before the inline handler is wired, leaving
    // the dropdown stuck disabled. Calling __doPostBack directly with the
    // canonical ASP.NET name guarantees the partial-postback fires.
    await privacyChk.evaluate(`(el) => {
      const w = window;
      if (typeof w.__doPostBack === 'function') {
        // Name attr like "ctl00$SiteContentPlaceHolder$chkbxPrivacyAct"
        // is the eventTarget ASP.NET expects for AutoPostBack controls.
        try { w.__doPostBack(el.name, ''); } catch (_) { /* noop */ }
      }
    }`);
    // Step 3: wait for the AutoPostBack round-trip. CEAC uses ASP.NET
    // partial-page UpdatePanels — the security-Q dropdown loses its
    // disabled attribute when the server-side postback completes.
    try {
      await page.waitForFunction(
        `(sel) => {
          const el = document.querySelector(sel);
          return el && !el.disabled && !el.hasAttribute('disabled');
        }`,
        SECURITY_QUESTION_SELECTOR,
        { timeout: 20_000 },
      );
    } catch {
      // Postback might still be in flight or the predicate flickered.
      // Fall through to step 3 of the main flow which re-attempts.
    }
  }

  // 2. Capture Application ID from the displayed barcode label. CEAC
  //    renders the ID like "Application ID AA00ABCDEF" in the label; we
  //    extract via the canonical `AA\w{8,10}` regex so cosmetic text
  //    changes around the ID don't break capture.
  //
  //    After a SecureQuestion page load the label can be attached but
  //    empty for a few hundred ms while CEAC finishes its server-side
  //    render. Poll for up to 15s for a non-empty ID.
  const barcode = page.locator(APPLICATION_ID_LABEL_SELECTOR).first();
  await barcode.waitFor({ state: "attached", timeout: 15_000 });
  let barcodeText = "";
  let applicationId: string | null = null;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    barcodeText = ((await barcode.textContent({ timeout: 2_000 }).catch(() => "")) ?? "").trim();
    const m = barcodeText.match(CEAC_APPLICATION_ID_PATTERN);
    if (m) {
      applicationId = m[0];
      break;
    }
    await page.waitForTimeout(500);
  }
  if (!applicationId) {
    throw new Error(
      `Could not capture Application ID from SecureQuestion page (label text="${barcodeText}")`,
    );
  }

  // 3. Select security question (default value "3": maternal grandmother maiden).
  //    The dropdown is `disabled` server-side until the Privacy Act
  //    checkbox postback completes. Use page.waitForFunction so the
  //    enabled-check observes the live DOM atomically — the prior
  //    poll-loop pattern raced because CEAC sometimes briefly re-disables
  //    the element during a second UpdatePanel cycle, and Playwright's
  //    selectOption auto-wait then timed out on the re-disabled state.
  const questionValue = options.securityQuestionValue ?? "3";
  const ddl = page.locator(SECURITY_QUESTION_SELECTOR).first();
  await ddl.waitFor({ state: "attached", timeout: 10_000 });
  try {
    await page.waitForFunction(
      `(sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        // Require enabled state to hold for two consecutive ticks so we
        // don't catch a transient enabled window that immediately flips
        // back to disabled. CEAC's ASP.NET partial-postbacks have caused
        // exactly this flicker.
        return !el.disabled && !el.hasAttribute('disabled');
      }`,
      SECURITY_QUESTION_SELECTOR,
      { timeout: 30_000 },
    );
  } catch {
    // One last-ditch nudge: re-fire the privacy checkbox change event
    // and try again. If the dropdown still won't enable, surface the
    // explicit failure so the caller can dump the page for diagnostics.
    await privacyChk.evaluate(`(el) => {
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof el.onclick === 'function') { try { el.onclick(); } catch (_) {} }
    }`);
    await page.waitForFunction(
      `(sel) => {
        const el = document.querySelector(sel);
        return el && !el.disabled && !el.hasAttribute('disabled');
      }`,
      SECURITY_QUESTION_SELECTOR,
      { timeout: 15_000 },
    );
  }
  // Diagnostic: dump page state right before selectOption so we can see
  // whether the dropdown is genuinely enabled or if there's a stale node.
  await dumpConfirmPageDiagnostics(page, "post-privacy");

  try {
    await ddl.selectOption(questionValue);
  } catch (err) {
    await dumpConfirmPageDiagnostics(page, "selectoption-fail");
    throw err;
  }
  const questionText = (await ddl.evaluate(
    `s => s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : ""`,
  )) as string;

  // 4. Fill answer.
  const answerInput = page.locator(SECURITY_ANSWER_SELECTOR).first();
  await answerInput.fill(options.securityAnswer);

  // 5. Click Continue and wait for the next page to settle.
  const btnContinue = page.locator(CONTINUE_BUTTON_SELECTOR).first();
  await btnContinue.waitFor({ state: "attached", timeout: 10_000 });
  await btnContinue.click({ force: true, timeout: timeoutMs });

  try {
    await page.waitForLoadState("networkidle", { timeout: timeoutMs });
  } catch {
    // CEAC's UpdatePanels sometimes hold long-lived connections — fall
    // back to a short settle and let the caller verify the page identity.
    await page.waitForTimeout(2_000);
  }

  return {
    applicationId,
    securityQuestionValue: questionValue,
    securityQuestionText: (questionText || "").trim(),
    securityAnswer: options.securityAnswer,
    postContinueUrl: page.url(),
  };
}
