/**
 * UK Standard Visitor visa orchestrator.
 *
 * Walks the pre-auth flow (language → country → VAC → visa-type-start) to
 * prove the stealth session reaches the registration page. Post-auth
 * pages are not yet selector-mapped; the orchestrator stops at the
 * registration page and returns a `handoffReady=false` result with a
 * clear reason. Selectors for post-auth pages are harvested via
 * `form-recon.ts` and plugged into `field-mappings.ts`.
 */

import type { Page } from "@playwright/test";
import { dismissUkCookieBanner } from "./cookies";
import { UK_PAGE_SELECTORS, UK_SUBMIT_SELECTOR } from "./selectors";
import { detectPage, type UkPageIdentity } from "./pages";
import { assertNoGate } from "./gates";
import { UkNavigationError, UkWidgetFillError } from "./errors";
import { deriveUkBiometricsCountryIso3, resolveCountryIso3 } from "./country-iso3";
import { tryCaptureScreenshot, type UkScreenshotArtifact } from "./diagnostics";
import type { UkSession } from "./session";

export interface UkOrchestrateOptions {
  /** Flattened application answers keyed by seed field_name. */
  answers: Record<string, string>;
  /** Biometrics country (ISO-3 alpha). Usually the applicant's country of
   *  residence. Defaults to the first country we can derive from answers. */
  biometricsCountryIso3?: string;
  /** Runtime identifier for structured logging. */
  runId?: string;
  /** Navigation wait timeout per step (ms). Default 30_000. */
  navigationTimeoutMs?: number;
  /** Where to write failure screenshots. If unset, no screenshots. */
  outputDir?: string;
}

export interface UkOrchestrateResult {
  /** True once the full form has been filled up to the payment step.
   *  Always false today — post-auth pages are not yet mapped. */
  handoffReady: boolean;
  /** Terminal page identity. */
  stoppedAt: UkPageIdentity;
  /** Pages successfully traversed in this run (in order). */
  pagesVisited: string[];
  /** Reason the run stopped (human-readable). */
  reason: string;
  /** Failure screenshot if one was captured. */
  failureScreenshot?: UkScreenshotArtifact | null;
}

/** Drive the UK flow from language selection up to the registration page.
 *
 *  Does NOT submit the registration form — that creates a real UKVI
 *  account. Stops with `handoffReady=false` and `stoppedAt.id =
 *  "registration"` so the caller can hand off to a human, or (once
 *  post-auth selectors are mapped) continue into the 222-field form. */
export async function orchestrateUkFill(
  session: UkSession,
  options: UkOrchestrateOptions,
): Promise<UkOrchestrateResult> {
  const { page } = session;
  const navTimeout = options.navigationTimeoutMs ?? 30_000;
  const visited: string[] = [];

  try {
    // ── Page 1: language selection ──────────────────────────────────
    // The live flow shows a cookie banner and can render the language
    // page more than once (the `-skip-visa` entry posts to
    // `/alt-language-selection`, which re-renders language before moving
    // on). Dismiss cookies and loop the language step until the page is
    // no longer a language selector.
    await assertNoGate(page);
    await dismissUkCookieBanner(page);
    await walkLanguagePages(page, navTimeout);
    visited.push("language_selection");

    // ── Page: confirm visa type (live flow inserts this before country) ─
    // "Confirm your visa type" (/apply-uk-visa) — pick the Standard Visitor
    // route ("Visit or transit visa"). Conditional so the walk still works
    // if gov.uk reorders/removes this step.
    await assertNoGate(page);
    await dismissUkCookieBanner(page);
    if ((await page.locator(UK_PAGE_SELECTORS.confirm_visa_type.visaType.selector).count()) > 0) {
      await selectRadio(
        page,
        UK_PAGE_SELECTORS.confirm_visa_type.visaType.selector,
        UK_PAGE_SELECTORS.confirm_visa_type.visaType.standardVisitorValue,
        UK_PAGE_SELECTORS.confirm_visa_type.visaType.idPattern,
      );
      await clickNext(page, navTimeout, "confirm_visa_type");
      visited.push("confirm_visa_type");
      await dismissUkCookieBanner(page);
    }

    // ── Page 2: country for biometrics ──────────────────────────────
    await assertNoGate(page);
    await dismissUkCookieBanner(page);
    await waitForCountryPage(page, navTimeout);
    const countryIso = resolveCountryIso3(
      options.biometricsCountryIso3
        ?? deriveBiometricsCountry(options.answers)
        ?? deriveUkBiometricsCountryIso3(options.answers),
    ) ?? "CHN";
    await fillIso3Autocomplete(
      page,
      UK_PAGE_SELECTORS.country_selection.countryCode.selector,
      UK_PAGE_SELECTORS.country_selection.countryCode.uiSelector,
      countryIso,
    );
    await clickNext(page, navTimeout, "country_selection");
    visited.push("country_selection");

    if (!page.url().includes("/vac-information-page/")) {
      throw new UkNavigationError("Country selection did not advance to the VAC page", {
        details: { url: page.url(), countryIso },
      });
    }

    // ── Page 3: VAC availability confirm ────────────────────────────
    await assertNoGate(page);
    await dismissUkCookieBanner(page);
    await waitForVacPage(page, navTimeout);
    await selectRadio(
      page,
      UK_PAGE_SELECTORS.vac_information.vacAvailabilityConfirmed.selector,
      "true",
      UK_PAGE_SELECTORS.vac_information.vacAvailabilityConfirmed.idPattern,
    );
    await clickNext(page, navTimeout, "vac_information");
    visited.push("vac_information");

    // ── Page 4: visa-type start (no fields, just Start now) ─────────
    await assertNoGate(page);
    await clickNext(page, navTimeout, "visa_type_start");
    visited.push("visa_type_start");

    // ── Page 5: registration — STOP HERE ────────────────────────────
    // Submitting this form creates a real UKVI account. Don't submit
    // until post-auth selectors are mapped AND the applicant has an
    // enrolled email account we can use for verification.
    await assertNoGate(page);
    const identity = await detectPage(page);

    return {
      handoffReady: false,
      stoppedAt: identity,
      pagesVisited: visited,
      reason:
        identity.id === "registration"
          ? "Reached registration page. Post-auth form selectors are not yet mapped — " +
            "run src/uk/form-recon.ts against a logged-in browser session to harvest them, " +
            "then extend UK_FIELD_DEFINITIONS in field-mappings.ts."
          : `Unexpected terminal page: ${identity.id} (url=${identity.url})`,
    };
  } catch (err) {
    // Best-effort screenshot for the operator. Doesn't mask the real
    // error — we capture, then re-throw.
    let failureScreenshot: UkScreenshotArtifact | null = null;
    if (options.outputDir) {
      failureScreenshot = await tryCaptureScreenshot(page, {
        outputDir: options.outputDir,
        runId: options.runId ?? "unknown",
        label: `failure-after-${visited[visited.length - 1] ?? "bootstrap"}`,
      });
    }
    // Attach the screenshot path to the error if it's a UkError so the
    // caller can include it in the queue payload.
    if (failureScreenshot && typeof err === "object" && err !== null && "context" in err) {
      const ctx = (err as { context: Record<string, unknown> }).context;
      ctx.details = { ...(ctx.details as Record<string, unknown> ?? {}), failureScreenshot: failureScreenshot.path };
    }
    throw err;
  }
}

// ── helpers ───────────────────────────────────────────────────────────

/** Walk the language page(s). The live flow can present the language
 *  selector up to twice before advancing; loop until it's gone. */
async function walkLanguagePages(page: Page, navTimeout: number): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    const langRadio = page.locator(UK_PAGE_SELECTORS.language_selection.languageCode.selector).first();
    if ((await langRadio.count()) === 0) return; // no longer a language page
    await selectRadio(
      page,
      UK_PAGE_SELECTORS.language_selection.languageCode.selector,
      "en",
      UK_PAGE_SELECTORS.language_selection.languageCode.idPattern,
    );
    await clickNext(page, navTimeout, `language_selection_${i}`);
    await dismissUkCookieBanner(page);
    if ((await page.locator(UK_PAGE_SELECTORS.language_selection.languageCode.selector).count()) === 0) {
      return;
    }
  }
}

/** Wait for the biometrics country page's <select> to attach. Leaves the
 *  page untouched on timeout so selectOption raises a precise error. */
async function waitForCountryPage(page: Page, navTimeout: number): Promise<void> {
  try {
    await page
      .locator(UK_PAGE_SELECTORS.country_selection.countryCode.selector)
      .first()
      .waitFor({ state: "attached", timeout: Math.min(navTimeout, 30_000) });
  } catch {
    /* fall through — selectOption will throw with the real diagnostic */
  }
}

async function waitForVacPage(page: Page, navTimeout: number): Promise<void> {
  try {
    await page.waitForURL(/\/vac-information-page\//i, {
      timeout: Math.min(navTimeout, 30_000),
    });
    await page
      .locator(UK_PAGE_SELECTORS.vac_information.vacAvailabilityConfirmed.selector)
      .first()
      .waitFor({ state: "attached", timeout: 10_000 });
  } catch {
    /* fall through — selectRadio will throw with the real diagnostic */
  }
}

async function selectRadio(
  page: Page,
  selector: string,
  value: string,
  idPattern?: string,
): Promise<void> {
  const byId = idPattern ? `#${idPattern.replace("{value}", value)}` : null;
  const byValue = `${selector}[value="${value}"]`;
  const byLabelFor = byId ? `label[for="${byId.slice(1)}"]` : null;

  const attempts: Array<{ mode: "check" | "click"; target: string }> = [];
  if (byId) attempts.push({ mode: "check", target: byId });
  attempts.push({ mode: "check", target: byValue });
  if (byLabelFor) attempts.push({ mode: "click", target: byLabelFor });

  for (const attempt of attempts) {
    try {
      const loc = page.locator(attempt.target).first();
      if ((await loc.count()) === 0) continue;
      if (attempt.mode === "check") {
        await loc.check({ force: true, timeout: 5_000 });
      } else {
        await loc.click({ timeout: 5_000 });
      }
      return;
    } catch {
      /* try next strategy */
    }
  }

  try {
    await page
      .getByRole("radio", {
        name: /identified a location|identified a visa application centre|I've identified/i,
      })
      .first()
      .check({ force: true, timeout: 5_000 });
    return;
  } catch (err) {
    throw new UkWidgetFillError(`Pre-auth radio fill failed (${selector}=${value})`, {
      details: {
        selector: byValue,
        idSelector: byId,
        cause: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

/** Fill a gov.uk accessible-autocomplete country field. The enhancement
 *  hides the real <select> and only commits a value when the user picks a
 *  menu option, so we drive the visible text input and click the matching
 *  option. Falls back to a forced <select> set if the menu never appears. */
async function fillIso3Autocomplete(
  page: Page,
  selectSelector: string,
  uiSelector: string,
  value: string,
): Promise<void> {
  const select = page.locator(selectSelector).first();
  const iso3 =
    (resolveCountryIso3(value) ??
      (await select
        .evaluate((el, label) => {
          const normalized = label.trim().toLowerCase();
          const opt = Array.from((el as HTMLSelectElement).options).find(
            (o) =>
              o.value.toUpperCase() === label.toUpperCase() ||
              o.text.trim().toLowerCase() === normalized,
          );
          return opt?.value ?? "";
        }, value)
        .catch(() => ""))) ||
    value.toUpperCase();

  // Resolve the human-readable option text for the ISO-3 value.
  const optionText = await select
    .evaluate((el, v) => {
      const opt = Array.from((el as HTMLSelectElement).options).find((o) => o.value === v);
      return opt?.text ?? "";
    }, iso3)
    .catch(() => "");

  const ui = page.locator(uiSelector).first();
  if (optionText && (await ui.count()) > 0) {
    try {
      await ui.click({ timeout: 5_000 });
      await ui.fill("");
      await ui.pressSequentially(optionText, { delay: 25, timeout: 10_000 });
      await page.waitForTimeout(400);
      // The menu renders <li role="option"> entries; click the exact match when visible.
      const option = page
        .getByRole("option", { name: optionText, exact: true })
        .first();
      const optionVisible = (await option.count()) > 0 && (await option.isVisible().catch(() => false));
      if (optionVisible) {
        await option.click({ timeout: 5_000 });
      } else {
        // Headless runs often see zero menu nodes even though the widget is
        // open — ArrowDown + Enter still commits the ISO-3 on the live portal.
        await ui.press("ArrowDown", { timeout: 2_000 });
        await page.waitForTimeout(200);
        await ui.press("Enter", { timeout: 2_000 });
      }
      // Confirm the hidden select committed; if so we're done.
      const committed = await select.evaluate((el) => (el as HTMLSelectElement).value).catch(() => "");
      if (committed === iso3) return;
    } catch {
      /* fall through to the forced-select fallback */
    }
  }

  // Fallback: force-set the hidden <select> and fire change.
  try {
    await select.selectOption(iso3, { timeout: 8_000, force: true });
    await select
      .evaluate((el) => {
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      })
      .catch(() => undefined);
  } catch (err) {
    throw new UkWidgetFillError(`Pre-auth select fill failed (${selectSelector}=${iso3})`, {
      details: { selector: selectSelector, value: iso3, cause: err instanceof Error ? err.message : String(err) },
    });
  }
}

async function clickNext(page: Page, navTimeout: number, fromPage: string): Promise<void> {
  const before = page.url();
  try {
    await page.locator(UK_SUBMIT_SELECTOR).first().click({ timeout: 10_000 });
    // The old implementation raced click against waitForLoadState, but the
    // page is already "domcontentloaded" so that resolved immediately without
    // waiting for the real navigation — the next step then probed a stale
    // page. Wait for the URL to actually change (govuk gives each step its own
    // path), then settle on the new DOM.
    await page
      .waitForURL((url) => url.href !== before, { timeout: navTimeout })
      .catch(() => undefined);
    await page.waitForLoadState("domcontentloaded", { timeout: navTimeout }).catch(() => undefined);
  } catch (err) {
    throw new UkNavigationError(`Navigation after ${fromPage} failed`, {
      details: { fromPage, cause: err instanceof Error ? err.message : String(err) },
    });
  }
}

/** Best-effort: pull a biometrics country from the applicant's answer
 *  set. The seed doesn't have an explicit `biometrics_country` field
 *  today, so we fall back to home-address or nationality. Returns the
 *  value verbatim — caller is responsible for ISO-3 normalization. */
function deriveBiometricsCountry(answers: Record<string, string>): string | undefined {
  return (
    answers.biometrics_country ??
    answers.home_address_country ??
    answers.current_residence_country ??
    answers.nationality ??
    undefined
  );
}
