/**
 * Cross-runner form helpers for the messy widgets government portals use:
 *   - readonly jQuery-datepicker inputs (can't be typed into directly)
 *   - jQuery "Chosen" selects (real <select> is hidden behind a styled div)
 *
 * Both are handled by setting the value in-page and firing the events the
 * widgets listen for, rather than driving the visible UI (which is slow and
 * fragile across portals). Shared because India, Sri Lanka, and several
 * VFS-based portals all use these same plugins.
 */
import type { Page } from "@playwright/test";

/**
 * Set a readonly / datepicker input by removing the readonly guard and
 * dispatching input+change so any attached validators fire.
 */
export async function forceFill(
  page: Page,
  selector: string,
  value: string | undefined,
  label: string,
): Promise<void> {
  if (!value) return;
  try {
    await page.evaluate(
      ({ sel, val }) => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (!el) throw new Error("not found");
        el.removeAttribute("readonly");
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      },
      { sel: selector, val: value },
    );
  } catch (err) {
    console.warn(`[form] forceFill ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Select an <option> on a (possibly Chosen-wrapped) <select> by setting the
 * value in-page, dispatching change, and nudging Chosen to re-render. Tries
 * an exact value match first, then a case-insensitive label match.
 */
export async function chosenSelect(
  page: Page,
  selector: string,
  value: string | undefined,
  label: string,
): Promise<void> {
  if (!value) return;
  try {
    const ok = await page.evaluate(
      ({ sel, val }) => {
        const el = document.querySelector(sel) as HTMLSelectElement | null;
        if (!el) return false;
        const opts = Array.from(el.options);
        const match =
          opts.find((o) => o.value === val) ||
          opts.find((o) => o.text.trim().toLowerCase() === val.toLowerCase()) ||
          opts.find((o) => o.text.trim().toLowerCase().includes(val.toLowerCase()));
        if (!match) return false;
        el.value = match.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        // Nudge jQuery Chosen if present.
        const w = window as unknown as { jQuery?: (e: Element) => { trigger: (n: string) => void } };
        if (typeof w.jQuery === "function") {
          w.jQuery(el).trigger("chosen:updated");
        }
        return true;
      },
      { sel: selector, val: value },
    );
    if (!ok) {
      console.warn(`[form] chosenSelect ${label} (${selector}) — no option matched "${value}"`);
    }
  } catch (err) {
    console.warn(`[form] chosenSelect ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
  }
}
