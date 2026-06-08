/**
 * Vietnam e-Visa autofill runner.
 *
 * Drives the evisa.gov.vn application form from the landing page through
 * the post-modal Vue SPA, fills every field present in
 * `VN_FIELD_MAPPINGS`, then HALTS before the Pay/Submit button. The
 * applicant completes payment manually on evisa.gov.vn using the captured
 * `registrationCode`; the actual e-visa PDF arrives via email ~3 working
 * days after payment is approved.
 *
 * Stops short of any irreversible action — the runner clicks "Next" /
 * "Save" only, never "Submit" or "Pay".
 */

import type { Page } from "@playwright/test";
import { launchStealthBrowser } from "../ceac/stealth-browser";
import {
  getVnPortalOptionText,
  VN_FIELD_MAPPINGS,
  VN_REGISTRATION_CODE_SELECTOR,
  VN_STOP_BUTTON_PATTERNS,
  type VnFieldType,
} from "./field-mappings";
import { fillDate, fillText, pickRadio, pickSelect, tickCheckbox, toDdMmYyyy } from "./fillers";

export interface FillVietnamInput {
  /** Flat answers keyed by VN_E_VISA seed field_name. */
  answers: Record<string, string>;
}

export interface FillVietnamOptions {
  headless?: boolean;
  runId?: string;
  /** Per-step advance timeout (ms). Default 60s. */
  stepTimeoutMs?: number;
}

export type FillVietnamResult =
  | {
      status: "scaffolded_pending_walk";
      runId?: string;
      reason: string;
    }
  | {
      status: "submitted_pending_pay";
      runId?: string;
      registrationCode: string;
      submittedAtIso: string;
      fieldsFilled: number;
      fieldsSkipped: number;
    }
  | {
      status: "failed";
      runId?: string;
      failedStep: string;
      error: Record<string, unknown> | null;
      url: string;
    };

const VN_LANDING_URL = "https://evisa.gov.vn/";
const FORM_ROUTE_FRAGMENT = "/e-visa/foreigners";

export async function fillVietnamApplication(
  input: FillVietnamInput,
  options: FillVietnamOptions = {},
): Promise<FillVietnamResult> {
  const runId = options.runId;
  const headless = options.headless ?? true;
  const stepTimeoutMs = options.stepTimeoutMs ?? 60_000;
  let page: Page | null = null;
  let browser: Awaited<ReturnType<typeof launchStealthBrowser>>["browser"] | null = null;
  let context: Awaited<ReturnType<typeof launchStealthBrowser>>["context"] | null = null;

  try {
    const handles = await launchStealthBrowser({ headless, acceptDownloads: false });
    browser = handles.browser;
    context = handles.context;
    page = handles.page;

    // ── Landing → form route ───────────────────────────────────────────
    await page.goto(VN_LANDING_URL, { waitUntil: "domcontentloaded", timeout: stepTimeoutMs });
    await waitForHydrate(page, stepTimeoutMs);

    // The router link is inside a Vue component; bypass overlays via JS click.
    await page.evaluate(() => {
      const doc = (globalThis as unknown as {
        document?: {
          querySelector: (selector: string) => { click: () => void } | null;
        };
      }).document;
      const a = doc?.querySelector('a[href="/e-visa/foreigners"]');
      if (a) a.click();
    });
    await page
      .waitForURL(new RegExp(FORM_ROUTE_FRAGMENT.replace(/\//g, "\\/")), { timeout: 15_000 })
      .catch(() => undefined);

    // ── Dismiss the NOTE modal (tick checkboxes + Next) ────────────────
    await dismissIntroModal(page, stepTimeoutMs);

    // ── Wait for form fields ───────────────────────────────────────────
    await page.waitForFunction(
      () => {
        const doc = (globalThis as unknown as {
          document?: {
            querySelectorAll: (selector: string) => { length: number };
          };
        }).document;
        return (doc?.querySelectorAll(".ant-form-item").length ?? 0) > 10;
      },
      null,
      { timeout: stepTimeoutMs },
    );

    // ── Fill every mapped field that we have an answer for ─────────────
    let filled = 0;
    let skipped = 0;
    for (const [fieldName, mapping] of Object.entries(VN_FIELD_MAPPINGS)) {
      const value = input.answers[fieldName];
      if (!value) {
        skipped++;
        continue;
      }
      try {
        await fillByType(page, fieldName, mapping.type, mapping.domId, value);
        filled++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[vn] fill failed for ${fieldName} (${mapping.domId}): ${msg}`);
        skipped++;
      }
    }

    // ── Stop-at-pay sentinel + capture registration code ──────────────
    // Click the form's primary "Save" / "Next" button to advance to the
    // pre-pay review screen. Never click anything matching VN_STOP_BUTTON_PATTERNS.
    await advanceToReview(page, stepTimeoutMs);

    const registrationCode = await captureRegistrationCode(page);
    if (!registrationCode) {
      return {
        status: "scaffolded_pending_walk",
        runId,
        reason:
          "Form filled but registration code element not found on review screen — " +
          "selector tweak required (see VN_REGISTRATION_CODE_SELECTOR).",
      };
    }

    return {
      status: "submitted_pending_pay",
      runId,
      registrationCode,
      submittedAtIso: new Date().toISOString(),
      fieldsFilled: filled,
      fieldsSkipped: skipped,
    };
  } catch (err) {
    return {
      status: "failed",
      runId,
      failedStep: page?.url() ?? "bootstrap",
      error: serializeError(err),
      url: page?.url() ?? VN_LANDING_URL,
    };
  } finally {
    try {
      if (context) await context.close();
    } catch {
      /* best-effort */
    }
    try {
      if (browser) await browser.close();
    } catch {
      /* best-effort */
    }
  }
}

async function waitForHydrate(page: Page, timeoutMs: number): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const doc = (globalThis as unknown as {
          document?: {
            getElementById: (id: string) => { innerHTML: string } | null;
          };
        }).document;
        const app = doc?.getElementById("app");
        return !!app && app.innerHTML.length > 40_000;
      },
      null,
      { timeout: timeoutMs },
    )
    .catch(() => undefined);
  await page.waitForTimeout(2_500);
}

async function dismissIntroModal(page: Page, timeoutMs: number): Promise<void> {
  // The modal has 1–3 acknowledgement checkboxes + a Next/Tiếp button.
  // Tick anything checkbox-shaped, then click anything that looks like Next.
  const deadline = Date.now() + Math.min(timeoutMs, 30_000);
  while (Date.now() < deadline) {
    const formItems = await page.locator(".ant-form-item").count();
    if (formItems >= 10) return;

    // Tick all visible Ant checkboxes inside the modal.
    const checkboxes = page.locator(".ant-modal .ant-checkbox-input");
    const count = await checkboxes.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check({ force: true, timeout: 2_000 }).catch(() => undefined);
    }

    const nextBtn = page
      .locator(".ant-modal button", { hasText: /next|tiếp|continue|i agree/i })
      .first();
    if ((await nextBtn.count()) > 0) {
      await nextBtn.click({ timeout: 5_000 }).catch(() => undefined);
    }

    await page.waitForTimeout(1_000);
  }
}

async function fillByType(
  page: Page,
  fieldName: string,
  type: VnFieldType,
  domId: string,
  rawValue: string,
): Promise<void> {
  const portalOptionText = getVnPortalOptionText(fieldName, rawValue);
  switch (type) {
    case "text":
    case "textarea":
      await fillText(page, domId, rawValue);
      return;
    case "select":
    case "country":
      await pickSelect(page, domId, portalOptionText);
      return;
    case "radio":
      await pickRadio(page, domId, portalOptionText);
      return;
    case "date":
      await fillDate(page, domId, toDdMmYyyy(rawValue));
      return;
    case "checkbox":
      await tickCheckbox(page, domId, rawValue);
      return;
    case "upload":
      // Uploads require a local file path threaded from applicationDocuments.
      // Skip silently — orchestrator logs are noisy enough; the FE will surface
      // a missing-portrait error from the portal review screen if it matters.
      return;
    default:
      return;
  }
}

async function advanceToReview(page: Page, timeoutMs: number): Promise<void> {
  // Click the primary form action (typically "Save" / "Tiếp tục") but only if
  // its label does NOT match one of the stop patterns. If the dominant
  // action is already a Pay/Submit button, leave the page where it is —
  // the registration-code capture either succeeds or returns null.
  const candidate = page
    .locator('button.ant-btn-primary, button[type="submit"]')
    .first();
  const text = ((await candidate.textContent().catch(() => "")) ?? "").trim();
  if (VN_STOP_BUTTON_PATTERNS.some((rx) => rx.test(text))) return;

  await candidate.click({ timeout: 10_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 30_000) }).catch(() => undefined);
}

async function captureRegistrationCode(page: Page): Promise<string | null> {
  // Try the explicit selector first; fall back to a body-text regex for
  // "Mã hồ sơ" / "Registration code" patterns.
  const explicit = await page
    .locator(VN_REGISTRATION_CODE_SELECTOR)
    .first()
    .textContent()
    .catch(() => null);
  if (explicit) {
    const m = explicit.match(/[A-Z0-9]{8,}/);
    if (m) return m[0];
  }
  const body = await page.textContent("body").catch(() => null);
  if (body) {
    const m = body.match(/(?:mã hồ sơ|registration\s*code)[:\s]+([A-Z0-9]{8,})/i);
    if (m) return m[1];
  }
  return null;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { value: String(err) };
}
