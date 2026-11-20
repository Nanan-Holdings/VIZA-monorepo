/**
 * UK save-and-return account registration (the gated-portal keystone).
 *
 * `orchestrateUkFill` deliberately stops at the "register an email" page
 * because creating a UKVI account requires an email we can read verification
 * mail from. Now that the inbox pipeline is live (per-applicant
 * `appl-*@viza.it.com` alias → Cloudflare → ingest → `inbound_email`), this
 * worker completes the step:
 *
 *   reach registration → fill alias + generated password → submit →
 *   wait for UKVI's resume link via the inbox → persist an encrypted
 *   `uk_accounts` row (email, password, resume_url) for the runner to resume.
 *
 * SAFETY: submitting CREATES A REAL UKVI ACCOUNT. The submit is gated behind
 * `UK_REGISTER_COMMIT=1`. Without it the worker fills the form and stops
 * (`stopped_before_commit`) — safe to run against the live portal for QA.
 */
import { randomBytes } from "node:crypto";
import { supabase } from "../supabase.js";
import { startUkSession } from "./session.js";
import { orchestrateUkFill } from "./orchestrator.js";
import { UK_PAGE_SELECTORS, UK_SUBMIT_SELECTOR } from "./selectors.js";
import { waitForUkResumeEmail } from "./inbox.js";
import { solveUkRegistrationCaptchaWithRetry } from "./register-captcha.js";
import { ensureUkEgressCountry, ukUsesResidentialProxy } from "./proxy-egress.js";
import { encryptSecret } from "../secret-cipher.js";
import { ensureApplicationInboxAlias } from "../inbox/alias.js";
import {
  createUkTimingRecorder,
  type UkTimingClock,
  type UkTimingOutcome,
  type UkTimingRecorder,
  type UkTimingSink,
} from "./timing.js";

export interface UkRegisterInput {
  applicationId: string;
  applicantId: string;
  /** ISO3 biometrics country for the orchestrator. Required for registration. */
  biometricsCountryIso3?: string;
  headless?: boolean;
  runId?: string;
  /** Optional redacted timing recorder; defaults to a safe summary logger. */
  timing?: UkTimingRecorder;
  /** Clock/sink seams used when the runner creates its timing recorder. */
  timingClock?: UkTimingClock;
  timingSink?: UkTimingSink;
}

export type UkRegisterResult =
  | { status: "registered"; email: string; resumeUrl: string }
  | { status: "stopped_before_commit"; email: string; reason: string }
  | { status: "needs_attention"; reason: string }
  | { status: "failed"; reason: string; stoppedAt?: string };

/** UKVI password policy: 8–30 chars, upper+lower+digit+special. */
function generatePassword(): string {
  const pick = (set: string): string => set[randomBytes(1)[0] % set.length];
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digit = "23456789";
  const special = "!@$%^*";
  const core = randomBytes(8).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
  return `${pick(upper)}${core}${pick(lower)}${pick(digit)}${pick(special)}`;
}

export async function registerUkAccount(input: UkRegisterInput): Promise<UkRegisterResult> {
  const timing = input.timing ?? createUkTimingRecorder({
    runId: input.runId,
    clock: input.timingClock,
    sink: input.timingSink,
  });
  let runOutcome: UkTimingOutcome = "failed";
  const complete = <T extends UkRegisterResult>(result: T): T => {
    runOutcome = result.status === "registered"
      ? "success"
      : result.status === "failed"
        ? "failed"
        : "stopped";
    return result;
  };
  let session: Awaited<ReturnType<typeof startUkSession>> | null = null;

  try {
    if (!input.applicationId || !input.applicantId) {
      return complete({ status: "needs_attention", reason: "UK registration requires applicationId and applicantId" });
    }
    if (!input.biometricsCountryIso3) {
      return complete({ status: "needs_attention", reason: "UK registration requires an explicit biometrics country" });
    }

    // UK registration mail must be isolated to this application. Creating the
    // alias here also covers runner_job dispatch, which does not pass through
    // the legacy submission_queue processUkItem wrapper.
    const applicationAlias = await ensureApplicationInboxAlias(input.applicationId, input.applicantId);
    const email = applicationAlias.alias;
    const password = generatePassword();
    if (ukUsesResidentialProxy()) {
      ensureUkEgressCountry();
    }

    // UKVI behind a residential proxy is slow; give the first paint room.
    const browserLaunchSpan = timing.start("browser_launch", "registration");
    try {
      session = await startUkSession({
        headless: input.headless ?? true,
        runId: input.runId,
        navigationTimeoutMs: 120_000,
      });
      browserLaunchSpan.end("success");
    } catch (err) {
      browserLaunchSpan.end("failed");
      throw err;
    }

    const preAuthSpan = timing.start("registration", "pre_auth");
    let orchestrated: Awaited<ReturnType<typeof orchestrateUkFill>>;
    try {
      orchestrated = await orchestrateUkFill(session, {
        answers: {},
        biometricsCountryIso3: input.biometricsCountryIso3,
        runId: input.runId,
      });
      preAuthSpan.end(orchestrated.stoppedAt.id === "registration" ? "success" : "failed");
    } catch (err) {
      preAuthSpan.end("failed");
      throw err;
    }
    if (orchestrated.stoppedAt.id !== "registration") {
      return complete({ status: "failed", reason: "did not reach registration page", stoppedAt: orchestrated.stoppedAt.id });
    }

    const { page } = session;
    const fillRegistrationForm = async (): Promise<void> => {
      await page.fill(UK_PAGE_SELECTORS.registration.email.selector, email, { timeout: 10_000 });
      await page.fill(UK_PAGE_SELECTORS.registration.password1.selector, password, { timeout: 10_000 });
      await page.fill(UK_PAGE_SELECTORS.registration.password2.selector, password, { timeout: 10_000 });
    };
    const registrationFormSpan = timing.start("registration", "form");
    try {
      await fillRegistrationForm();
      registrationFormSpan.end("success");
    } catch (err) {
      registrationFormSpan.end("failed");
      throw err;
    }

    if (process.env.UK_REGISTER_COMMIT !== "1") {
      return complete({
        status: "stopped_before_commit",
        email,
        reason: "registration form filled; UK_REGISTER_COMMIT not set, so no UKVI account was created",
      });
    }

    // Best-effort CAPTCHA, mirroring the France-Visas registration flow: solve
    // via 2captcha when gov.uk presents an image CAPTCHA, no-op otherwise. A
    // failed solve reloads the page (clearing fields), so we pass the form
    // filler to re-enter email/password between retries.
    const captchaSpan = timing.start("captcha", "registration");
    let captchaResult: Awaited<ReturnType<typeof solveUkRegistrationCaptchaWithRetry>>;
    try {
      captchaResult = await solveUkRegistrationCaptchaWithRetry(page, 3, fillRegistrationForm);
      captchaSpan.end("success", captchaResult.telemetry.length);
    } catch (err) {
      captchaSpan.end("failed", 1);
      return complete({
        status: "failed",
        reason: `registration captcha: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // Fence the generated credentials before the irreversible portal click.
    // If the click times out or the worker is interrupted after UKVI creates
    // the account, the next run sees this exact application-bound row and
    // pauses for the missing resume link instead of creating a second account.
    const commitSpan = timing.start("registration", "commit");
    let registrationStartedAt: string;
    try {
      const { error: preInsertErr } = await supabase.from("uk_accounts").insert(
        {
          application_id: input.applicationId,
          applicant_id: input.applicantId,
          email,
          password_encrypted: encryptSecret(password),
          resume_url: "",
          updated_at: new Date().toISOString(),
        },
      );
      if (preInsertErr) {
        // A legacy applicant/email row (application_id IS NULL) or another
        // ambiguous account must never be adopted by this application.
        commitSpan.end("failed");
        if (/duplicate|unique|conflict|constraint/i.test(preInsertErr.message)) {
          return complete({
            status: "needs_attention",
            reason: "An existing UKVI account could not be bound unambiguously to this application",
          });
        }
        return complete({ status: "failed", reason: `uk_accounts credential fence failed: ${preInsertErr.message}` });
      }

      // COMMIT: creates the UKVI account and triggers the verification email.
      registrationStartedAt = new Date().toISOString();
      await page.click(UK_SUBMIT_SELECTOR, { timeout: 10_000 });
      commitSpan.end("success");
    } catch (err) {
      commitSpan.end("failed");
      throw err;
    }

    // UKVI emails a resume/continue link to the alias; the inbox ingest worker
    // must be running for this to resolve.
    const inboxSpan = timing.start("inbox", "resume");
    let resumeEmail: Awaited<ReturnType<typeof waitForUkResumeEmail>>;
    try {
      resumeEmail = await waitForUkResumeEmail(
        input.applicationId,
        input.applicantId,
        180_000,
        registrationStartedAt,
      );
      inboxSpan.end("success");
    } catch (err) {
      inboxSpan.end("failed");
      throw err;
    }
    const resumeUrl = resumeEmail.resumeUrl;
    if (!resumeUrl) {
      return complete({ status: "failed", reason: "registration submitted but no resume link found in verification email" });
    }

    const persistSpan = timing.start("registration", "persist");
    try {
      const { data: updatedRow, error } = await supabase
        .from("uk_accounts")
        .update({ resume_url: resumeUrl, updated_at: new Date().toISOString() })
        .eq("application_id", input.applicationId)
        .eq("applicant_id", input.applicantId)
        .select("id")
        .maybeSingle();
      if (error || !updatedRow) {
        persistSpan.end("failed");
        return complete({
          status: "failed",
          reason: `uk_accounts resume-link update failed: ${error?.message ?? "application-bound row was not found"}`,
        });
      }
      persistSpan.end("success");
    } catch (err) {
      persistSpan.end("failed");
      throw err;
    }

    return complete({ status: "registered", email, resumeUrl });
  } finally {
    try {
      if (session) {
        const cleanupSpan = timing.start("cleanup", "registration");
        try {
          await session.close();
          cleanupSpan.end("success");
        } catch (err) {
          cleanupSpan.end("failed");
          runOutcome = "failed";
          throw err;
        }
      }
    } finally {
      timing.finish(runOutcome);
    }
  }
}
