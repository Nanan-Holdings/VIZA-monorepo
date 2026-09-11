import type { PageIdentityResult } from "./pages";
import { detectPage } from "./pages";
import { ManualActionRequiredError, SessionBootstrapError } from "./errors";
import { assertNoGate } from "./gates";
import { fillRetrieveApplicationForm, type RecoveryCredentials } from "./resume-application";
import {
  isAttachableCeacFormPage,
  readCeacPageApplicationId,
  type CeacSession,
} from "./session";

const START_CAPTCHA_INPUT_SELECTOR = [
  'input[id*="IdentifyCaptcha"][type="text"]',
  'input[name*="IdentifyCaptcha"][type="text"]',
  'input[id*="Captcha"][type="text"]',
].join(", ");

const START_CAPTCHA_IMAGE_SELECTOR = 'img[id*="Captcha"]';

export interface AttachedCeacResumeDependencies {
  fillRetrieveApplicationForm(page: CeacSession["page"], credentials: RecoveryCredentials): Promise<void>;
  assertNoGate(page: CeacSession["page"]): Promise<void>;
  detectPage(page: CeacSession["page"]): Promise<PageIdentityResult>;
  waitForManualStartCaptcha(
    page: CeacSession["page"],
    timeoutMs: number,
  ): Promise<PageIdentityResult>;
  readApplicationId(page: CeacSession["page"]): Promise<string | null>;
}

const DEFAULT_DEPENDENCIES: AttachedCeacResumeDependencies = {
  fillRetrieveApplicationForm,
  assertNoGate,
  detectPage,
  waitForManualStartCaptcha,
  readApplicationId: readCeacPageApplicationId,
};

/**
 * Wait until the applicant has entered the Start-page CAPTCHA themselves.
 * The answer is never returned, logged, persisted, or sent to a solver.
 */
export async function waitForManualStartCaptcha(
  page: CeacSession["page"],
  timeoutMs: number,
): Promise<PageIdentityResult> {
  const boundedTimeoutMs = Math.max(0, timeoutMs);
  const deadline = Date.now() + boundedTimeoutMs;

  while (true) {
    const identity = await detectPage(page);
    if (identity.id !== "start") return identity;

    const input = page.locator(START_CAPTCHA_INPUT_SELECTOR).first();
    const [inputCount, imageCount] = await Promise.all([
      input.count().catch(() => 0),
      page.locator(START_CAPTCHA_IMAGE_SELECTOR).count().catch(() => 0),
    ]);
    if (inputCount === 0 && imageCount === 0) return identity;

    const applicantEnteredAnswer = inputCount > 0
      ? await input.evaluate((node) => {
          const value = (node as HTMLInputElement).value;
          return value.trim().length > 0;
        }).catch(() => false)
      : false;
    if (applicantEnteredAnswer) return identity;

    if (Date.now() >= deadline) {
      throw new ManualActionRequiredError(
        "ceac_start_captcha",
        "Complete the CEAC Start-page CAPTCHA in the attached browser; VIZA will retrieve the saved draft automatically afterward.",
        {
          detected: "start",
          url: page.url(),
          details: {
            reason: "manual_start_captcha_wait_expired",
            timeoutMs: boundedTimeoutMs,
          },
        },
      );
    }

    await page.waitForTimeout(Math.min(250, Math.max(1, deadline - Date.now())));
  }
}

export function requiresAttachedCeacResume(
  session: Pick<CeacSession, "attachedExistingForm" | "attachedPageId">,
): boolean {
  return (
    session.attachedExistingForm === true &&
    (session.attachedPageId === "start" || session.attachedPageId === "retrieve_application")
  );
}

/** Resume a stored CEAC draft from an explicitly approved attached entry page. */
export async function resumeAttachedCeacApplication(
  session: CeacSession,
  credentials: RecoveryCredentials,
  dependencies: AttachedCeacResumeDependencies = DEFAULT_DEPENDENCIES,
): Promise<PageIdentityResult> {
  if (!requiresAttachedCeacResume(session)) {
    throw new SessionBootstrapError("Attached CEAC session is not on an approved resume entry page.");
  }

  if (session.attachedPageId === "start") {
    const afterManualCaptcha = await dependencies.waitForManualStartCaptcha(
      session.page,
      session.manualStartWaitMs ?? 0,
    );
    if (
      afterManualCaptcha.id !== "start" &&
      afterManualCaptcha.id !== "retrieve_application"
    ) {
      if (!isAttachableCeacFormPage(afterManualCaptcha.id)) {
        throw new SessionBootstrapError(
          "CEAC left the approved recovery path after the manual CAPTCHA checkpoint.",
          { detected: afterManualCaptcha.id, url: afterManualCaptcha.url },
        );
      }
      const applicationId = await dependencies.readApplicationId(session.page);
      if (!applicationId || applicationId !== credentials.applicationId) {
        throw new SessionBootstrapError(
          "CEAC recovery could not verify that the attached form matches the stored draft.",
          { detected: afterManualCaptcha.id, url: afterManualCaptcha.url },
        );
      }
      session.attachedPageId = afterManualCaptcha.id;
      return afterManualCaptcha;
    }
  }

  await dependencies.fillRetrieveApplicationForm(session.page, credentials);
  await dependencies.assertNoGate(session.page);
  const identity = await dependencies.detectPage(session.page);
  if (!isAttachableCeacFormPage(identity.id)) {
    throw new SessionBootstrapError(
      "CEAC retrieval did not reach a trusted entered DS-160 form page.",
      { detected: identity.id, url: identity.url },
    );
  }
  const applicationId = await dependencies.readApplicationId(session.page);
  if (!applicationId || applicationId !== credentials.applicationId) {
    throw new SessionBootstrapError(
      "CEAC recovery could not verify that the retrieved form matches the stored draft.",
      { detected: identity.id, url: identity.url },
    );
  }
  session.attachedPageId = identity.id;
  return identity;
}
