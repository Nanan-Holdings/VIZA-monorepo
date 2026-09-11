import type { PageIdentityResult } from "./pages";
import { detectPage } from "./pages";
import { ManualActionRequiredError, SessionBootstrapError } from "./errors";
import { waitForManualStartCaptcha } from "./resume-entry";
import type { CeacSession } from "./session";

const START_NEW_APPLICATION_SELECTOR =
  'a[id*="lnkNew"], input[id*="lnkNew"], input[type="submit"][value*="START AN APPLICATION" i]';
const CONFIRM_APPLICATION_ROUTE = /\/GenNIV\/Common\/ConfirmApplicationID\.aspx/i;

export interface AttachedNewApplicationDependencies {
  waitForManualStartCaptcha(
    page: CeacSession["page"],
    timeoutMs: number,
  ): Promise<PageIdentityResult>;
  detectPage(page: CeacSession["page"]): Promise<PageIdentityResult>;
  clickStart(page: CeacSession["page"]): Promise<void>;
}

const DEFAULT_DEPENDENCIES: AttachedNewApplicationDependencies = {
  waitForManualStartCaptcha,
  detectPage,
  clickStart: async (page) => {
    const start = page.locator(START_NEW_APPLICATION_SELECTOR).first();
    await start.waitFor({ state: "attached", timeout: 10_000 });
    await start.click({ force: true, timeout: 10_000 });
  },
};

/**
 * Continue an explicitly approved attached Start-page flow after the
 * applicant enters CAPTCHA. This helper never reads the answer and targets
 * only CEAC's Start control, never Retrieve or Sign and Submit.
 */
export async function startAttachedCeacNewApplication(
  session: CeacSession,
  dependencies: AttachedNewApplicationDependencies = DEFAULT_DEPENDENCIES,
): Promise<void> {
  if (
    session.attachedExistingForm !== true ||
    session.attachedPageId !== "start" ||
    session.newApplicationFromStart !== true
  ) {
    throw new SessionBootstrapError(
      "Attached CEAC session is not approved for a new-application Start flow.",
    );
  }

  const timeoutMs = Math.max(0, session.manualStartWaitMs ?? 0);
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const remainingMs = Math.max(0, deadline - Date.now());
    await dependencies.waitForManualStartCaptcha(session.page, remainingMs);
    await dependencies.clickStart(session.page);

    try {
      await session.page.waitForURL(CONFIRM_APPLICATION_ROUTE, { timeout: 15_000 });
      return;
    } catch {
      const identity = await dependencies.detectPage(session.page);
      if (CONFIRM_APPLICATION_ROUTE.test(session.page.url())) return;
      if (identity.id !== "start") {
        throw new SessionBootstrapError(
          "CEAC did not reach the Confirm Application page after the manual CAPTCHA checkpoint.",
          { detected: identity.id, url: identity.url },
        );
      }
      if (Date.now() >= deadline) {
        throw new ManualActionRequiredError(
          "ceac_start_captcha",
          "Complete the refreshed CEAC Start-page CAPTCHA in the attached browser.",
          {
            detected: "start",
            url: identity.url,
            details: { reason: "manual_start_captcha_wait_expired", timeoutMs },
          },
        );
      }
    }
  }
}
