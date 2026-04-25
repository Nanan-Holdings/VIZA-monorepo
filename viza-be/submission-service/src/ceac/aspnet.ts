/**
 * ASP.NET / Microsoft AJAX helpers shared across the CEAC automation.
 *
 * CEAC's DS-160 UI is built on ASP.NET WebForms + the MSAJAX
 * PageRequestManager. Nearly every user interaction — location
 * dropdown change, radio Yes/No click, "Does Not Apply" checkbox —
 * fires an async postback that re-renders a fragment of the page.
 * Until that postback finishes the visible DOM is a transient mix of
 * pre- and post-render state; filling dependent fields during the
 * window causes silent drops or CEAC-side validation rejection.
 *
 * The single authoritative signal is
 * `Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack()`
 * flipping back to false. This module wraps that poll with a timeout
 * and a fallback so callers get a bounded wait regardless of page
 * state.
 */

import type { Page } from "@playwright/test";

/**
 * Wait for any in-flight ASP.NET UpdatePanel async postback to
 * complete. Returns as soon as `isInAsyncPostBack()` is false.
 *
 * If the PageRequestManager isn't present (non-MSAJAX surface, or
 * scripts blocked), falls back to a short fixed settle so callers
 * still get non-zero delay before proceeding.
 */
export async function waitForAspNetPostback(page: Page, timeoutMs = 10_000): Promise<void> {
  // We can't rely on `isInAsyncPostBack()` alone — calling it
  // immediately after a click returns `false` because the postback
  // hasn't been dispatched yet, and we'd return before it actually
  // fires. Instead, wait for a fresh `endRequest` event from the
  // PageRequestManager. If the MSAJAX runtime isn't present (plain
  // ASP.NET page with no UpdatePanel), fall back to a short settle.
  try {
    await page.evaluate(
      `(function(timeoutMs) {
        return new Promise(function(resolve) {
          try {
            var Sys = (typeof window !== 'undefined' ? window : globalThis).Sys;
            if (!Sys || !Sys.WebForms || !Sys.WebForms.PageRequestManager) {
              setTimeout(resolve, 500);
              return;
            }
            var mgr = Sys.WebForms.PageRequestManager.getInstance();
            if (!mgr) { setTimeout(resolve, 500); return; }
            // If a postback is already in flight, hook its end.
            // Otherwise, wait briefly for one to start; if none starts,
            // resolve anyway (no-op click).
            var settled = false;
            var done = function() { if (!settled) { settled = true; resolve(); } };
            var handler = function() { mgr.remove_endRequest(handler); done(); };
            mgr.add_endRequest(handler);
            if (!mgr.get_isInAsyncPostBack()) {
              // Give it 400ms to start. If nothing starts, treat as settled.
              setTimeout(function() {
                if (!mgr.get_isInAsyncPostBack() && !settled) {
                  mgr.remove_endRequest(handler);
                  done();
                }
              }, 400);
            }
            setTimeout(function() {
              mgr.remove_endRequest(handler);
              done();
            }, timeoutMs);
          } catch (e) {
            setTimeout(resolve, 300);
          }
        });
      })(${timeoutMs})`,
    );
  } catch {
    // best effort — don't throw
  }
}
