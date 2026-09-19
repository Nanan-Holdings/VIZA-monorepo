/** CEAC UpdatePanel completion and failure detection. Never trust a stale DOM. */
import type { Page, Request } from "@playwright/test";
import { CeacError, GateDetectedError, NavigationError } from "./errors";

interface PostbackMonitor {
  failure?: CeacError;
  pending: Set<Request>;
}

const monitors = new WeakMap<Page, PostbackMonitor>();

function isOfficialFormUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === "https://ceac.state.gov" && /^\/GenNIV\//i.test(url.pathname);
  } catch { return false; }
}

function postbackFailure(status?: number): CeacError {
  // Do not copy response bodies, URLs, exception messages or applicant answers.
  const context = { details: { phase: "aspnet_postback", ...(status ? { status } : {}) } };
  return status === 403 || status === 429
    ? new GateDetectedError(`CEAC rejected a form update (HTTP ${status}); the page cannot be used until a new verified session is available.`, context)
    : new NavigationError(`CEAC form update failed${status ? ` (HTTP ${status})` : ""}; dependent controls were not verified.`, context);
}

/** Install before interacting: a failed response may arrive before the wait starts. */
export function installCeacPostbackMonitor(page: Page): void {
  if (monitors.has(page)) return;
  const state: PostbackMonitor = { pending: new Set() };
  monitors.set(page, state);
  const isFormRequest = (request: Request): boolean => {
    if (!isOfficialFormUrl(request.url())) return false;
    if (request.isNavigationRequest() && request.resourceType() === "document") {
      return request.frame() === page.mainFrame();
    }
    return request.method() === "POST" && ["xhr", "fetch"].includes(request.resourceType()) &&
      isOfficialFormUrl(page.url());
  };
  page.on("request", request => {
    if (isFormRequest(request)) state.pending.add(request);
  });
  page.on("requestfinished", request => { state.pending.delete(request); });
  page.on("requestfailed", request => {
    if (state.pending.delete(request)) state.failure ??= postbackFailure();
  });
  page.on("response", response => {
    const request = response.request();
    // Save-to-file is a legitimate document response followed by Chromium's
    // navigation cancellation when the download takes over.
    if (response.ok() && /attachment/i.test(response.headers()["content-disposition"] ?? "")) {
      state.pending.delete(request);
    }
    if (!isFormRequest(request) || response.status() < 400) return;
    const failure = postbackFailure(response.status());
    if (!state.failure || failure instanceof GateDetectedError) state.failure = failure;
  });
  page.on("pageerror", error => {
    if (!isOfficialFormUrl(page.url()) || !/Sys\.WebForms\.PageRequestManager\w*Exception/.test(error.message)) return;
    const match = error.message.match(/(?:status\s+code[^:\r\n]*:\s*|HTTP\s+)([45]\d{2})\b/i);
    state.failure ??= postbackFailure(match ? Number(match[1]) : undefined);
  });
}

export function assertCeacPostbackHealthy(page: Page): void {
  const failure = monitors.get(page)?.failure;
  if (failure) throw failure;
}

type PostbackOutcome = { kind: "settled" | "timeout" | "failed"; status?: number };

async function evaluateWithinBudget(page: Page, script: string, timeoutMs: number): Promise<PostbackOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      page.evaluate<PostbackOutcome>(script),
      // Navigation can suspend the page's JS before its own timer starts.
      new Promise<PostbackOutcome>(resolve => {
        timer = setTimeout(() => resolve({ kind: "timeout" }), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** A timeout or endRequest error is a failure, never successful DOM settlement. */
export async function waitForAspNetPostback(page: Page, timeoutMs = 10_000): Promise<void> {
  installCeacPostbackMonitor(page);
  assertCeacPostbackHealthy(page);
  const budget = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(timeoutMs, 60_000)) : 10_000;
  const deadline = Date.now() + budget;
  let outcome: PostbackOutcome;
  while (true) {
    assertCeacPostbackHealthy(page);
    const remaining = deadline - Date.now();
    if (remaining <= 0) { outcome = { kind: "timeout" }; break; }
    try {
      outcome = await evaluateWithinBudget(page,
        `(function(timeoutMs) {
        return new Promise(function(resolve) {
          var mgr, handler, idleTimer, timeoutTimer, settled = false;
          var done = function(result) {
            if (settled) return;
            settled = true;
            clearTimeout(idleTimer);
            clearTimeout(timeoutTimer);
            if (mgr && handler) mgr.remove_endRequest(handler);
            resolve(result);
          };
          try {
            var Sys = window.Sys;
            mgr = Sys && Sys.WebForms && Sys.WebForms.PageRequestManager && Sys.WebForms.PageRequestManager.getInstance();
            if (!mgr) { setTimeout(function() { done({kind: 'settled'}); }, Math.min(500, timeoutMs / 2)); return; }
            handler = function(sender, args) {
              try {
                var error = args && args.get_error && args.get_error();
                if (error) {
                  var response = args.get_response && args.get_response();
                  var status = response && response.get_statusCode && response.get_statusCode();
                  if (!(status >= 400 && status <= 599)) {
                    var match = String(error.message || '').match(/(?:status\\s+code[^:\\r\\n]*:\\s*|HTTP\\s+)([45]\\d{2})\\b/i);
                    status = match ? Number(match[1]) : undefined;
                  }
                  done({kind: 'failed', status: status});
                } else if (!mgr.get_isInAsyncPostBack()) {
                  done({kind: 'settled'});
                }
              } catch (_) { done({kind: 'failed'}); }
            };
            mgr.add_endRequest(handler);
            // Give a click's scheduled postback time to start; a no-op can settle.
            idleTimer = setTimeout(function() {
              try { if (!mgr.get_isInAsyncPostBack()) done({kind: 'settled'}); }
              catch (_) { done({kind: 'failed'}); }
            }, Math.min(400, timeoutMs));
            timeoutTimer = setTimeout(function() { done({kind: 'timeout'}); }, timeoutMs);
          } catch (_) { done({kind: 'failed'}); }
        });
      })(${remaining})`,
        remaining,
      );
      assertCeacPostbackHealthy(page);
      if (outcome.kind === "settled" && monitors.get(page)!.pending.size > 0) {
        await page.waitForTimeout(Math.min(50, Math.max(1, deadline - Date.now())));
        continue;
      }
      break;
    } catch (error) {
      assertCeacPostbackHealthy(page);
      // A successful full WebForms navigation destroys the old JS context.
      // Recheck the new document within the original budget; other failures
      // cannot be treated as successful settlement.
      if (error instanceof Error && /Execution context was destroyed|Cannot find context with specified id/i.test(error.message) &&
        !page.isClosed() && Date.now() < deadline) {
        await page.waitForLoadState("domcontentloaded", { timeout: Math.max(1, deadline - Date.now()) }).catch(() => undefined);
        continue;
      }
      throw new NavigationError("CEAC form update could not be verified because the page became unavailable.", {
        details: { phase: "aspnet_postback" },
      });
    }
  }
  assertCeacPostbackHealthy(page);
  if (outcome.kind === "failed") {
    const failure = postbackFailure(outcome.status);
    monitors.get(page)!.failure = failure;
    throw failure;
  }
  if (outcome.kind === "timeout") {
    const failure = new NavigationError("CEAC form update did not finish within the allowed wait.", {
      details: { phase: "aspnet_postback", timeoutMs: budget },
    });
    monitors.get(page)!.failure = failure;
    throw failure;
  }
}
