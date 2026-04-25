/**
 * PrimeFaces / JSF AJAX helpers for the France-Visas step pages.
 *
 * France-Visas is built on Jakarta Faces with PrimeFaces widgets. Filling
 * a cascading select naively (setting `<select>.value` and firing a
 * synthetic `change` event) does NOT trigger the server-side postback
 * that rebuilds dependent dropdowns. Discovered during the live walk
 * 2026-04-24 — only calls through the PrimeFaces widget's
 * `triggerChange()` method actually fire the JSF AJAX cycle.
 *
 * Working pattern (confirmed):
 *   1. `widget.selectValue(value)` — updates visible UI and native <select>
 *   2. `widget.triggerChange()` — dispatches the JSF AJAX `change` behavior,
 *      server rebuilds dependent selects, browser replaces their options
 *   3. Wait for the POST request to `stepN.xhtml` to complete before
 *      reading downstream option lists.
 *
 * Side effect: every postback can CLEAR downstream selects that were set
 * before the cascade stabilized (observed: travel-document reset after a
 * later destination change). The orchestrator must re-fill dependent
 * fields AFTER their upstream cascade has settled, not before.
 */

import type { Page } from "@playwright/test";
import { NavigationError } from "./errors";

/**
 * Wait until a PrimeFaces widget is registered with the API we need.
 * Conditionally-revealed widgets (e.g. businessSegment after occupation
 * selection) appear only after the AJAX postback re-renders the DOM AND
 * PrimeFaces re-runs its widget bootstrap — that bootstrap is async.
 */
async function waitForPrimeFacesWidget(
  page: Page,
  widgetVar: string,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const exists = await page.evaluate(
      (widgetVar) => {
        const win = window as unknown as {
          PrimeFaces?: { widgets?: Record<string, unknown> };
        };
        const widget = win.PrimeFaces?.widgets?.[widgetVar] as
          | { selectValue?: unknown; triggerChange?: unknown }
          | undefined;
        return !!(widget && typeof widget.selectValue === "function" && typeof widget.triggerChange === "function");
      },
      widgetVar,
    );
    if (exists) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

/**
 * Select a value on a PrimeFaces SelectOneMenu widget AND fire the JSF
 * AJAX postback. Waits for the corresponding POST to complete.
 *
 * @param page - Playwright page on a JSF step page.
 * @param widgetVar - The PrimeFaces widget variable (e.g.
 *   `widget_formStep1_visas_selected_nationality`).
 * @param value - The option value to select (not the label).
 */
export async function selectPrimeFacesOption(
  page: Page,
  widgetVar: string,
  value: string,
  options: { postbackTimeoutMs?: number; widgetWaitMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.postbackTimeoutMs ?? 15_000;
  const widgetWaitMs = options.widgetWaitMs ?? 5_000;
  const url = page.url();

  // Conditionally-rendered widgets aren't yet registered when this is
  // called right after their gating field changes — wait briefly for the
  // PrimeFaces bootstrap to register them before failing.
  const widgetReady = await waitForPrimeFacesWidget(page, widgetVar, widgetWaitMs);
  if (!widgetReady) {
    throw new NavigationError(
      `PrimeFaces widget "${widgetVar}" could not be updated to value "${value}": widget not found or missing API`,
      { url, details: { widgetVar, value } },
    );
  }

  const postbackPromise = page.waitForResponse(
    (res) => res.url() === url && res.request().method() === "POST",
    { timeout: timeoutMs },
  ).catch(() => null);

  await page.evaluate(
    ({ widgetVar, value }) => {
      const win = window as unknown as {
        PrimeFaces?: { widgets?: Record<string, unknown> };
      };
      const widget = win.PrimeFaces?.widgets?.[widgetVar] as
        | { selectValue: (v: string) => void; triggerChange: () => void }
        | undefined;
      if (widget) {
        widget.selectValue(value);
        widget.triggerChange();
      }
    },
    { widgetVar, value },
  );

  await postbackPromise;
}

/**
 * Set a plain JSF text input and fire input/change/blur events. No AJAX
 * postback is expected — JSF text fields typically validate on submit,
 * not on change. Upstream cascade postbacks CAN reset text fields, so
 * callers should set text values AFTER all surrounding selects have
 * stabilized.
 */
export async function setJsfTextInput(
  page: Page,
  fieldName: string,
  value: string,
): Promise<void> {
  const result = await page.evaluate(
    ({ fieldName, value }) => {
      const el = document.querySelector(
        `input[name="${fieldName.replace(/"/g, '\\"')}"]`,
      ) as HTMLInputElement | null;
      if (!el) return { ok: false };
      el.focus();
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      return { ok: true, value: el.value };
    },
    { fieldName, value },
  );

  if (!result.ok) {
    throw new NavigationError(
      `JSF text input "${fieldName}" not found`,
      { url: page.url(), details: { fieldName } },
    );
  }
}

/**
 * Select a PrimeFaces radio-button group value. Radio groups aren't
 * SelectOneMenu widgets — use the input's native click to trigger JSF
 * behaviors cleanly.
 */
export async function selectPrimeFacesRadio(
  page: Page,
  baseName: string,
  value: "Yes" | "No",
): Promise<void> {
  const index = value === "Yes" ? "0" : "1";
  await page.evaluate(
    ({ baseName, index }) => {
      const el = document.querySelector(
        `input[name="${baseName.replace(/"/g, '\\"')}"][id$=":${index}"]`,
      ) as HTMLInputElement | null;
      if (el) el.click();
    },
    { baseName, index },
  );
}

/**
 * Toggle a single checkbox by name. Pass `checked=true` to ensure it's on,
 * `false` to ensure it's off — idempotent.
 */
export async function setJsfCheckbox(
  page: Page,
  name: string,
  checked: boolean,
): Promise<void> {
  await page.evaluate(
    ({ name, checked }) => {
      const el = document.querySelector(
        `input[type="checkbox"][name="${name.replace(/"/g, '\\"')}"]`,
      ) as HTMLInputElement | null;
      if (!el) return;
      if (el.checked !== checked) el.click();
    },
    { name, checked },
  );
}

/**
 * Check one or more options in a PrimeFaces checkbox group (like
 * `formStep5:autoFundings`). The group name is shared by multiple inputs
 * with id suffixes `:0`, `:1`, etc.; values are matched by the `value` attr.
 */
export async function setJsfCheckboxGroup(
  page: Page,
  groupName: string,
  values: readonly string[],
): Promise<void> {
  await page.evaluate(
    ({ groupName, values }) => {
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          `input[type="checkbox"][name="${groupName.replace(/"/g, '\\"')}"]`,
        ),
      );
      for (const input of inputs) {
        const shouldCheck = values.includes(input.value);
        if (input.checked !== shouldCheck) input.click();
      }
    },
    { groupName, values },
  );
}

/**
 * Waits for the JSF ViewState to stabilize — no pending AJAX requests.
 * Useful between transitions where multiple cascading postbacks may still
 * be in flight. Returns when the page has been idle for `quietMs`.
 */
export async function waitForJsfIdle(
  page: Page,
  options: { quietMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  const quietMs = options.quietMs ?? 800;
  const timeoutMs = options.timeoutMs ?? 15_000;
  try {
    await page.waitForLoadState("networkidle", { timeout: timeoutMs });
  } catch {
    // networkidle can be noisy on JSF apps with long-polling; fall back
    // to a plain quiet-period sleep.
    await page.waitForTimeout(quietMs);
  }
}
