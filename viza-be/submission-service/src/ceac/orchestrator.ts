/**
 * CEAC DS-160 page-by-page fill orchestration (US-012).
 *
 * Drives the new CEAC runtime path through the DS-160 form: detects the
 * current page, fills any fields that have matching answer mappings, advances
 * to the next page, and repeats until the Sign and Submit page is reached.
 *
 * Key contracts:
 *   - When `finalSubmit` is supplied, the worker enters the passport
 *     signature, solves the final CAPTCHA, and clicks the final submit
 *     button. Without it, legacy callers still stop at Sign and Submit.
 *   - Failure paths preserve recovery metadata (Application ID, last
 *     checkpoint, `.dat` artifact) through the typed result contract.
 *   - Checkpoint and `.dat` capture are wired at natural section boundaries.
 */

import type { Locator, Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { FormFieldMapping } from "../form-mappings";
import {
  ds160PersonalInfoMappings,
  ds160PersonalInfo2Mappings,
  ds160TravelMappings,
  ds160TravelCompanionsMappings,
  ds160TravelCompanionRepeaterSelectors,
  ds160PreviousUsTravelMappings,
  ds160PassportMappings,
  ds160ContactMappings,
  ds160SocialMediaRepeaterSelectors,
  ds160UsContactMappings,
  ds160FamilyRelativesMappings,
  ds160FamilySpouseMappings,
  ds160WorkMappings,
  ds160WorkPreviousMappings,
  ds160WorkAdditionalMappings,
  ds160SecurityBackground1Mappings,
  ds160SecurityBackground2Mappings,
  ds160SecurityBackground3Mappings,
  ds160SecurityBackground4Mappings,
  ds160SecurityBackground5Mappings,
} from "../ds160-form-mappings";
import { detectPage, type CeacPageId } from "./pages";
import { advance, saveCurrent } from "./navigator";
import {
  recordSectionCheckpoint,
  type CheckpointEmitOptions,
} from "./checkpoints";
import {
  captureDatArtifact,
  type RecoveryTracker,
  type DatArtifact,
} from "./artifacts";
import {
  stopAtSignAndSubmit,
  detectSignAndSubmit,
  type HandoffReadyOutcome,
} from "./stop-at-sign";
import {
  preserveRecoveryOnFailure,
  type PreservedRecovery,
} from "./artifacts";
import { buildSuccessResult, buildFailureResult, type CeacRunResult } from "./result";
import { serializeError } from "./errors";
import type { CeacSession } from "./session";
import { rebuildSessionForResume } from "./session";
import { tryCaptureScreenshot } from "./diagnostics";
import {
  fillRetrieveApplicationForm,
  type RecoveryCredentials,
} from "./resume-application";
import { waitForAspNetPostback } from "./aspnet";
import {
  handleUploadPhotoPage,
  PhotoRejectedError,
  type PhotoFile,
} from "./upload-photo";
import { signAndSubmitApplication } from "./final-submit";
import { solveImageCaptcha } from "../captcha";
import { CEAC_APPLICATION_ID_PATTERN } from "./selectors";
import { assertDs160ReadyForCeac } from "../ds160-completeness-verify";

/**
 * Map from CeacPageId to the DS160_MAPPING_GROUPS entry that should be
 * filled on that page. Pages without mappings are advanced past without
 * filling.
 */
const PAGE_FILL_MAP: Partial<Record<CeacPageId, Record<string, FormFieldMapping>>> = {
  personal_information_1: ds160PersonalInfoMappings,
  personal_information_2: ds160PersonalInfo2Mappings,
  travel_information: ds160TravelMappings,
  travel_companions: ds160TravelCompanionsMappings,
  previous_us_travel: ds160PreviousUsTravelMappings,
  address_and_phone: ds160ContactMappings,
  passport: ds160PassportMappings,
  us_contact: ds160UsContactMappings,
  family_relatives: ds160FamilyRelativesMappings,
  family_spouse: ds160FamilySpouseMappings,
  work_education_present: ds160WorkMappings,
  work_education_previous: ds160WorkPreviousMappings,
  work_education_additional: ds160WorkAdditionalMappings,
  security_background_1: ds160SecurityBackground1Mappings,
  security_background_2: ds160SecurityBackground2Mappings,
  security_background_3: ds160SecurityBackground3Mappings,
  security_background_4: ds160SecurityBackground4Mappings,
  security_background_5: ds160SecurityBackground5Mappings,
};

const CONTACT_SOCIAL_MAPPING_KEYS = new Set([
  "social_media_provider",
  "social_media_identifier",
  "has_other_social_media",
  "other_social_media_platform",
  "other_social_media_handle",
]);
const DS160_CONTACT_SCALAR_MAPPINGS = Object.fromEntries(
  Object.entries(ds160ContactMappings).filter(([key]) => !CONTACT_SOCIAL_MAPPING_KEYS.has(key)),
) as Record<string, FormFieldMapping>;

/**
 * Pages that the orchestrator navigates through in order. The DS-160 flow
 * is linear from personal_information_1 through sign_and_submit. Some pages
 * are conditional (e.g. family_spouse depends on marital status) — the
 * orchestrator handles this by detecting the actual current page rather than
 * assuming a rigid sequence.
 */
const TERMINAL_PAGES: ReadonlySet<CeacPageId> = new Set([
  "sign_and_submit",
  "confirmation",
  "session_expired",
]);

/** Maximum pages to traverse before aborting (safety valve). */
const MAX_PAGE_TRANSITIONS = 30;

export interface OrchestrateOptions {
  /** Answers from visa_application_answers keyed by field_name. */
  answers: Record<string, string>;
  /** Applicant profile for fallback field values. */
  profile: Record<string, unknown>;
  /** Recovery tracker to accumulate checkpoints and Application ID. */
  tracker: RecoveryTracker;
  /** Run identifier for structured logging. */
  runId?: string;
  /** Directory for .dat and screenshot artifacts. */
  outputDir?: string;
  /**
   * Credentials needed to auto-resume after a mid-fill session timeout.
   * Required if the run may take longer than CEAC's ~10-minute idle
   * window — without them, a session expiry is unrecoverable. When
   * omitted, session expiry surfaces as a failure.
   */
  recoveryCredentials?: RecoveryCredentials;
  /**
   * Maximum number of auto-resume attempts per orchestration run.
   * Default: 2. Each resume consumes a fresh 2captcha solve; cap so a
   * pathological loop doesn't burn balance.
   */
  maxResumeAttempts?: number;
  /**
   * Applicant photo to upload on the upload_photo page. When provided, the
   * orchestrator uploads the photo and continues through Review.
   */
  photo?: PhotoFile;
  /**
   * Final submit credentials. When set, reaching Sign and Submit performs
   * the irreversible DS-160 submit and returns `status: "submitted"`.
   */
  finalSubmit?: {
    passportNumber: string;
    maxCaptchaAttempts?: number;
  };
}

export interface SectionCoverage {
  /** Sections that had mappings and were filled. */
  filled: string[];
  /** Sections that were advanced past without filling. */
  skipped: string[];
}

export interface OrchestrateResult {
  /** The typed CEAC run result (handoff_ready or failed). */
  result: CeacRunResult;
  /** .dat artifact if captured during the run. */
  datArtifact: DatArtifact | null;
  /** Which DS-160 sections were filled vs skipped during the run. */
  sectionCoverage: SectionCoverage;
}

/**
 * Drive the DS-160 form page-by-page from the current page through to the
 * Sign and Submit page.
 *
 * The caller should have already bootstrapped a CEAC session and navigated
 * past the start page to the first form page (personal_information_1).
 * This function fills fields on each page using the answer mappings, advances
 * through the form, and stops at the Sign and Submit page.
 *
 * Returns a `CeacRunResult` — either `handoff_ready` (reached sign page) or
 * `failed` (error during fill/navigation).
 */
export async function orchestrateFill(
  session: CeacSession,
  options: OrchestrateOptions,
): Promise<OrchestrateResult> {
  // Fail before reading or mutating the CEAC page. This keeps an incomplete
  // intake from partially filling an official application.
  const answers = assertDs160ReadyForCeac(options.answers);
  const { profile, tracker, runId } = options;
  const outputDir = options.outputDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "ceac-orch-"));
  const maxResumeAttempts = options.maxResumeAttempts ?? 2;

  const checkpointOpts: CheckpointEmitOptions = {
    sink: tracker,
    runId,
  };

  let datArtifact: DatArtifact | null = null;
  let transitions = 0;
  let resumeAttempts = 0;
  const sectionsFilled: string[] = [];
  const sectionsSkipped: string[] = [];

  try {
    // Fill-and-advance loop: detect current page, fill if we have mappings,
    // advance to the next page. Stop when we reach a terminal page.
    while (transitions < MAX_PAGE_TRANSITIONS) {
      // Always use session.page — rebuildSessionForResume may have
      // swapped the Page ref between iterations after a recovery.
      const page = session.page;

      // Detect CEAC's mid-fill session timeout BEFORE running fill logic.
      // The timeout manifests as a URL redirect to SessionTimedOut.aspx
      // or a page-identity of "session_expired" (heading-based match).
      if (
        /SessionTimedOut/i.test(page.url()) &&
        options.recoveryCredentials &&
        resumeAttempts < maxResumeAttempts
      ) {
        console.log(`[orchestrator] Session expired mid-fill — attempting resume (attempt ${resumeAttempts + 1}/${maxResumeAttempts})`);
        resumeAttempts++;
        await rebuildSessionForResume(session);
        await fillRetrieveApplicationForm(session.page, options.recoveryCredentials);
        // Fall through: next iteration will re-probe the page identity
        // and pick up fill at the section CEAC restored to.
        continue;
      }

      const probe = await detectPage(page);
      const currentPageId = probe.id;

      if (currentPageId === "session_expired" && options.recoveryCredentials && resumeAttempts < maxResumeAttempts) {
        console.log(`[orchestrator] session_expired page detected — attempting resume (attempt ${resumeAttempts + 1}/${maxResumeAttempts})`);
        resumeAttempts++;
        await rebuildSessionForResume(session);
        await fillRetrieveApplicationForm(session.page, options.recoveryCredentials);
        continue;
      }

      // Photo Upload page. With a photo provided, upload it and continue
      // through Review to Sign and Submit. Without a photo (or if CEAC
      // rejects it), stop at upload_photo with handoff_ready so the
      // applicant uploads the photo themselves.
      if (currentPageId === "upload_photo") {
        if (options.photo) {
          try {
            console.log(`[orchestrator] Uploading applicant photo`);
            const uploadResult = await handleUploadPhotoPage(page, {
              photo: options.photo,
              diagnosticPath: path.join(outputDir, "upload-photo-dom.json"),
            });
            console.log(
              `[orchestrator] Photo accepted — landed at ${uploadResult.postContinueUrl}`,
            );
            session.page = uploadResult.page;
            await recordSectionCheckpoint(uploadResult.page, {
              ...checkpointOpts,
              details: { section: "upload_photo", filled: true, photoUploaded: true },
            });
            sectionsFilled.push("upload_photo");
            transitions++;
            continue; // Next iteration handles Review and Sign and Submit
          } catch (err) {
            const reason =
              err instanceof PhotoRejectedError
                ? err.reason ?? err.message
                : err instanceof Error
                  ? err.message
                  : String(err);
            console.warn(
              `[orchestrator] Photo upload did not complete (${reason})`,
            );
            if (options.finalSubmit?.passportNumber) {
              throw new PhotoRejectedError(
                `Automatic DS-160 submission stopped because the official photo step failed: ${reason}`,
                reason,
              );
            }
            // Legacy prefill-only callers may still hand off the photo step.
          }
        }

        if (!datArtifact) {
          try { datArtifact = await captureDatArtifact(page, { outputDir }); } catch { /* best effort */ }
        }
        const tracked = tracker.snapshot();
        const reachedAt = new Date().toISOString();
        const stopCheckpoint = {
          action: "handoff_ready" as const,
          at: reachedAt,
          pageId: "upload_photo" as const,
          heading: probe.heading,
          url: page.url(),
          applicationId: tracked.applicationId ?? null,
          runId,
          details: { section: "upload_photo", terminal: true },
        };
        await tracker.record(stopCheckpoint);
        const result = buildSuccessResult({
          status: "handoff_ready",
          applicationId: tracked.applicationId ?? null,
          pageId: "upload_photo",
          heading: probe.heading,
          url: page.url(),
          signPageMarkers: {
            headingMatches: false,
            signatureFieldPresent: false,
            finalSubmitPresent: false,
            captchaPresent: false,
          },
          reachedAt,
          runId,
          checkpoint: stopCheckpoint,
          lastCheckpoint: tracked.lastCheckpoint ?? stopCheckpoint,
          datArtifact,
          signPageScreenshot: null,
        });
        return { result, datArtifact, sectionCoverage: { filled: sectionsFilled, skipped: sectionsSkipped } };
      }

      // Save Confirmation interstitial. Appears after clicking Save on
      // confirm_photo — CEAC asks whether to continue or exit. Click
      // "Continue Application" to resume the form.
      if (currentPageId === "save_confirmation") {
        console.log(`[orchestrator] Save Confirmation — clicking Continue Application`);
        const continueBtn = page.locator(
          '#ctl00_btnContinueApp, input[type="submit"][value="Continue Application"]',
        ).first();
        await continueBtn.waitFor({ state: "visible", timeout: 10_000 });
        await continueBtn.click({ force: true, timeout: 10_000 });
        try {
          await page.waitForLoadState("networkidle", { timeout: 15_000 });
        } catch {
          await page.waitForTimeout(2_000);
        }
        transitions++;
        continue;
      }

      // Confirm Photo page. CEAC does not render a Next button on this
      // page — the user is meant to navigate to Review via the sidebar
      // (which becomes enabled once the photo is saved). When we return
      // from identix the URL carries `?save` and the REVIEW sidebar is
      // disabled; the canonical URL (without `?save`) enables REVIEW.
      // Navigate to the canonical URL first to flip REVIEW on, then go
      // directly to the Review section.
      if (currentPageId === "confirm_photo") {
        const url = page.url();
        if (/[?&]save\b/i.test(url)) {
          console.log(`[orchestrator] Confirm Photo (?save mode) — navigating to canonical URL`);
          await page.goto(
            "https://ceac.state.gov/GenNIV/General/photo/photo_confirmphoto.aspx?node=ConfirmPhoto",
            { waitUntil: "domcontentloaded" },
          );
          continue;
        }

        console.log(`[orchestrator] Confirm Photo — navigating to Review via sidebar URL`);
        await recordSectionCheckpoint(page, {
          ...checkpointOpts,
          details: { section: "confirm_photo", filled: false },
        });
        sectionsSkipped.push("confirm_photo");
        const reviewLink = page.locator('a#REVIEW[href]').first();
        const reviewHref = await reviewLink.getAttribute("href").catch(() => null);
        const reviewUrl = reviewHref
          ? new URL(reviewHref, page.url()).toString()
          : "https://ceac.state.gov/GenNIV/General/review/review_reviewpersonal.aspx?node=ReviewPersonal";
        await page.goto(reviewUrl, { waitUntil: "domcontentloaded" });
        try {
          await page.waitForLoadState("networkidle", { timeout: 15_000 });
        } catch {
          await page.waitForTimeout(2_000);
        }
        transitions++;
        continue;
      }

      // Check for sign-and-submit page — terminal stop. Try the strict
      // marker-based detection first (passport-signature input + final
      // submit button); if those markers match we use the dedicated
      // stopAtSignAndSubmit path. If only the heading + URL match (which
      // is the case for the live SignCertify page that precedes the
      // signature step), we still terminate as handoff_ready — going
      // beyond is a contract violation.
      if (currentPageId === "sign_and_submit") {
        if (!datArtifact) {
          try { datArtifact = await captureDatArtifact(page, { outputDir }); } catch { /* best effort */ }
        }
        const signIdentity = await detectSignAndSubmit(page);
        if (signIdentity) {
          if (options.finalSubmit?.passportNumber) {
            const submitResult = await signAndSubmitApplication(page, options.finalSubmit);
            const tracked = tracker.snapshot();
            const checkpoint = {
              action: "manual" as const,
              at: submitResult.submittedAt,
              pageId: "confirmation" as const,
              heading: "Confirmation",
              url: submitResult.url,
              applicationId: submitResult.applicationId ?? tracked.applicationId ?? null,
              runId,
              details: {
                section: "confirmation",
                terminal: true,
                confirmationNumber: submitResult.confirmationNumber,
                captchaAttempts: submitResult.captchaAttempts,
              },
            };
            await tracker.record(checkpoint);
            return {
              result: {
                status: "submitted",
                applicationId: submitResult.applicationId ?? tracked.applicationId ?? null,
                confirmationNumber: submitResult.confirmationNumber,
                submittedAt: submitResult.submittedAt,
                url: submitResult.url,
                captchaAttempts: submitResult.captchaAttempts,
                runId,
                checkpoint,
                datArtifact,
              },
              datArtifact,
              sectionCoverage: { filled: sectionsFilled, skipped: sectionsSkipped },
            };
          }

          const outcome = await stopAtSignAndSubmit(page, {
            tracker,
            runId,
            screenshotDir: outputDir,
          });
          const result = buildSuccessResult(outcome);
          return { result, datArtifact, sectionCoverage: { filled: sectionsFilled, skipped: sectionsSkipped } };
        }

        if (options.finalSubmit?.passportNumber) {
          console.log(
            `[orchestrator] Sign certification page detected — advancing to final signature controls`,
          );
          const finalSignaturePage = await certifySignAndSubmitPage(page, {
            passportNumber: options.finalSubmit.passportNumber,
            diagnosticPath: path.join(outputDir, "sign-certify-dom.json"),
          });
          session.page = finalSignaturePage;
          const afterSignCertify = await detectPage(finalSignaturePage);
          if (afterSignCertify.id === "confirmation") {
            return await buildSubmittedResultFromConfirmation(finalSignaturePage, {
              tracker,
              runId,
              datArtifact,
              sectionCoverage: { filled: sectionsFilled, skipped: sectionsSkipped },
              captchaAttempts: 1,
            });
          }
          await advance(finalSignaturePage, {
            from: "sign_and_submit",
            to: ["sign_and_submit", "confirmation"],
          });
          transitions++;
          continue;
        }

        // Heading + URL match but strict markers (signature input,
        // final submit) absent — typical for the SignCertify
        // attestation page that precedes the actual signature.
        // Capture handoff state and stop here.
        const tracked = tracker.snapshot();
        const reachedAt = new Date().toISOString();
        const stopCheckpoint = {
          action: "handoff_ready" as const,
          at: reachedAt,
          pageId: "sign_and_submit" as const,
          heading: probe.heading,
          url: page.url(),
          applicationId: tracked.applicationId ?? null,
          runId,
          details: { section: "sign_and_submit", terminal: true },
        };
        await tracker.record(stopCheckpoint);
        const result = buildSuccessResult({
          status: "handoff_ready",
          applicationId: tracked.applicationId ?? null,
          pageId: "sign_and_submit",
          heading: probe.heading,
          url: page.url(),
          signPageMarkers: {
            headingMatches: true,
            signatureFieldPresent: false,
            finalSubmitPresent: false,
            captchaPresent: false,
          },
          reachedAt,
          runId,
          checkpoint: stopCheckpoint,
          lastCheckpoint: tracked.lastCheckpoint ?? stopCheckpoint,
          datArtifact,
          signPageScreenshot: null,
        });
        return { result, datArtifact, sectionCoverage: { filled: sectionsFilled, skipped: sectionsSkipped } };
      }

      // Check for other terminal states
      if (currentPageId === "session_expired") {
        throw new Error("CEAC session expired during fill orchestration");
      }

      if (currentPageId === "confirmation") {
        if (options.finalSubmit?.passportNumber) {
          return await buildSubmittedResultFromConfirmation(page, {
            tracker,
            runId,
            datArtifact,
            sectionCoverage: { filled: sectionsFilled, skipped: sectionsSkipped },
            captchaAttempts: 1,
          });
        }
        throw new Error("Unexpectedly reached confirmation page before final submission was enabled");
      }

      // Fill fields if we have mappings for this page
      const mappings = currentPageId !== "unknown"
        ? PAGE_FILL_MAP[currentPageId]
        : undefined;

      if (currentPageId === "travel_companions") {
        console.log(`[orchestrator] Filling page: ${currentPageId}`);
        await fillTravelCompanionsPage(page, answers, profile);
        sectionsFilled.push(currentPageId);
      } else if (currentPageId === "address_and_phone") {
        console.log(`[orchestrator] Filling page: ${currentPageId}`);
        await fillPageFields(page, DS160_CONTACT_SCALAR_MAPPINGS, answers, profile);
        await fillSocialMediaPage(page, answers, profile);
        sectionsFilled.push(currentPageId);
      } else if (mappings) {
        console.log(`[orchestrator] Filling page: ${currentPageId}`);
        await fillPageFields(page, mappings, answers, profile);
        sectionsFilled.push(currentPageId);
      } else {
        console.log(`[orchestrator] No mappings for page: ${currentPageId} — advancing`);
        if (currentPageId !== "unknown") {
          sectionsSkipped.push(currentPageId);
        }
      }

      // Record section checkpoint after filling
      await recordSectionCheckpoint(page, {
        ...checkpointOpts,
        details: { section: currentPageId, filled: !!mappings },
      });

      // Capture .dat at strategic points (after passport and work/education).
      // The Save-to-File click may trigger an MSAJAX postback and then a
      // file download; wait for that to settle before attempting Next.
      if (currentPageId === "passport" || currentPageId === "work_education_present") {
        try {
          datArtifact = await captureDatArtifact(page, { outputDir });
          console.log(`[orchestrator] .dat captured at ${currentPageId}`);
          await waitForAspNetPostback(page, 8_000);
        } catch {
          console.warn(`[orchestrator] .dat capture failed at ${currentPageId} — continuing`);
          await waitForAspNetPostback(page, 5_000);
        }
      }

      // Determine next page and advance.
      // We don't hardcode the expected destination since CEAC may skip
      // conditional pages. Instead we accept any known DS-160 page.
      const nextPageCandidates = getExpectedNextPages(currentPageId);

      // Wait for the primary Next button to be attached before advancing.
      // Some CEAC pages re-render their button row asynchronously after
      // a fill-triggered postback settles; resolveNavButton can otherwise
      // see count=0 during that transient window.
      try {
        await page.locator('input[type="submit"].next, input[type="submit"][value^="Next:"]').first().waitFor({ state: "visible", timeout: 10_000 });
      } catch {
        // Best effort — if the button never appears, advance() will
        // surface a clear NavigationError.
      }

      try {
        await advance(page, {
          from: currentPageId !== "unknown" ? currentPageId : "start",
          to: nextPageCandidates,
        });
      } catch (navErr) {
        // Navigation failed — check what we actually landed on.
        const recheck = await detectPage(page);
        if (recheck.id === "sign_and_submit") {
          continue; // Loop back to handle sign page at top
        }
        // If navigation left us on SessionTimedOut or session_expired,
        // the next loop iteration's guards will catch and resume.
        if (
          /SessionTimedOut/i.test(page.url()) ||
          recheck.id === "session_expired"
        ) {
          continue;
        }
        throw navErr;
      }

      transitions++;
    }

    // Safety valve: too many transitions without reaching sign page
    throw new Error(
      `Fill orchestration exceeded ${MAX_PAGE_TRANSITIONS} page transitions without reaching Sign and Submit`,
    );
  } catch (err) {
    // Preserve recovery metadata on any failure. Use session.page since
    // we moved the per-iteration page binding into the loop body.
    const recovery = await preserveRecoveryOnFailure({
      tracker,
      error: err,
      page: session.page,
      screenshotDir: outputDir,
    });

    const result = buildFailureResult(recovery, {
      error: serializeError(err),
      failureScreenshot: recovery.failureScreenshot,
    });

    return { result, datArtifact, sectionCoverage: { filled: sectionsFilled, skipped: sectionsSkipped } };
  }
}

/**
 * Fill fields on the current page using the provided mappings and answer data.
 * Fields without matching answers are silently skipped.
 */
async function selectCeacOption(el: Locator, value: string): Promise<void> {
  try {
    await el.selectOption(value, { timeout: 5_000 });
    return;
  } catch (firstError) {
    const normalizedTarget = value.trim().toLowerCase();
    const matchedValue = await el.evaluate((select, target) => {
      if (!(select instanceof HTMLSelectElement)) return null;
      const options = Array.from(select.options);
      const match = options.find((option) => {
        if (option.disabled) return false;
        const optionValue = option.value.trim().toLowerCase();
        const optionText = option.text.trim().toLowerCase();
        return optionValue === target || optionText === target || optionText.includes(target);
      });
      return match?.value ?? null;
    }, normalizedTarget).catch(() => null);

    if (!matchedValue) throw firstError;
    try {
      await el.selectOption(matchedValue, { timeout: 5_000 });
      return;
    } catch {
      await el.evaluate((node, nextValue) => {
        const select = node as HTMLSelectElement;
        select.value = nextValue;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }, matchedValue);
    }
  }
}

async function certifySignAndSubmitPage(
  page: Page,
  options: { passportNumber: string; diagnosticPath?: string },
): Promise<Page> {
  if (options.diagnosticPath) await dumpSignCertifyDom(page, options.diagnosticPath);
  await choosePreparerNo(page);
  await fillSignCertifyPassportNumber(page, options.passportNumber.trim());
  await solveSignCertifyCaptcha(page);
  const activePage = await clickSignCertifySubmit(page);

  await activePage.evaluate(() => {
    const maybeValidNavigation = (window as unknown as { ValidNavigation?: () => unknown }).ValidNavigation;
    if (typeof maybeValidNavigation === "function") maybeValidNavigation();
    const maybeValidatorUpdate = (window as unknown as { ValidatorUpdateIsValid?: () => unknown }).ValidatorUpdateIsValid;
    if (typeof maybeValidatorUpdate === "function") maybeValidatorUpdate();
  }).catch(() => undefined);

  const afterSubmit = await detectPage(activePage);
  if (afterSubmit.id === "confirmation") return activePage;

  const next = activePage
    .locator('input[type="submit"].next, input[type="submit"][value^="Next:"], input[id*="UpdateButton"]')
    .first();
  await next.waitFor({ state: "visible", timeout: 10_000 });
  await activePage.waitForFunction(
    (selector) => {
      const button = document.querySelector(selector) as HTMLInputElement | null;
      return Boolean(button && !button.disabled);
    },
    'input[type="submit"].next, input[type="submit"][value^="Next:"], input[id*="UpdateButton"]',
    { timeout: 10_000 },
  ).catch(async () => {
    await next.evaluate((el) => {
      (el as HTMLInputElement).disabled = false;
      el.removeAttribute("disabled");
    });
  });
  return activePage;
}

async function choosePreparerNo(page: Page): Promise<void> {
  const noRadio = page
    .locator(
      [
        'input[type="radio"][value="N"]',
        'input[type="radio"][value="NO"]',
        'input[type="radio"][value="No"]',
        'input[type="radio"][id$="_rblPreparer_1"]',
        'input[type="radio"][name*="Preparer"][value="N"]',
      ].join(", "),
    )
    .first();
  if ((await noRadio.count().catch(() => 0)) > 0) {
    await noRadio.check({ force: true, timeout: 5_000 }).catch(async () => {
      await noRadio.click({ force: true, timeout: 5_000 });
    });
    return;
  }

  await page.evaluate(() => {
    const radios = Array.from(document.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
    for (const radio of radios) {
      const text = (radio.closest("label, td, span, div")?.textContent ?? "").trim();
      const isNo = /^no$/i.test(text) || /\bno\b/i.test(text);
      radio.checked = isNo;
      radio.dispatchEvent(new Event("input", { bubbles: true }));
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }).catch(() => undefined);
}

async function fillSignCertifyPassportNumber(page: Page, passportNumber: string): Promise<void> {
  const filled = await page.evaluate((value) => {
    const inputs = Array.from(
      document.querySelectorAll('input[type="text"], input[type="password"], input:not([type])'),
    ) as HTMLInputElement[];
    const editable = inputs.filter((input) => {
      if (input.disabled || input.readOnly) return false;
      const rect = input.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const key = `${input.id} ${input.name}`.toLowerCase();
      return !/captcha|code|answer/i.test(key);
    });
    const passportInput =
      editable.find((input) => /passport|travel/i.test(`${input.id} ${input.name}`)) ??
      editable[0] ??
      null;
    if (!passportInput) return false;

    passportInput.value = value;
    passportInput.dispatchEvent(new Event("input", { bubbles: true }));
    passportInput.dispatchEvent(new Event("change", { bubbles: true }));
    passportInput.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    passportInput.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }, passportNumber);

  if (!filled) {
    throw new Error("Could not find SignCertify passport/travel document field.");
  }
}

async function solveSignCertifyCaptcha(page: Page): Promise<void> {
  const captchaImage = page.locator('img[id*="Captcha"], img[src*="Captcha"], img[alt*="captcha" i]').first();
  if ((await captchaImage.count().catch(() => 0)) === 0) return;
  if (!(await captchaImage.isVisible().catch(() => false))) return;

  const captchaPng = await captchaImage.screenshot({ timeout: 10_000 });
  const solve = await solveImageCaptcha(captchaPng);
  const captchaInput = page
    .locator(
      [
        'input[id*="CaptchaCodeTextBox"]',
        'input[id*="IdentifyCaptcha"][type="text"]',
        'input[id*="captcha" i][type="text"]',
        'input[name*="captcha" i]',
        'input[id*="CodeTextBox"]',
      ].join(", "),
    )
    .first();
  await captchaInput.waitFor({ state: "visible", timeout: 10_000 });
  await captchaInput.fill(solve.text.trim());
}

async function clickSignCertifySubmit(page: Page): Promise<Page> {
  const signButton = page
    .locator(
      [
        'input[type="submit"][value*="Sign and Submit" i]',
        'input[type="button"][value*="Sign and Submit" i]',
        'button:has-text("Sign and Submit")',
        'input[id*="Sign"][type="submit"]',
      ].join(", "),
    )
    .first();
  if ((await signButton.count().catch(() => 0)) === 0) return page;

  const context = page.context();
  const popupPromise = context.waitForEvent("page", { timeout: 15_000 }).catch(() => null);
  await signButton.scrollIntoViewIfNeeded().catch(() => undefined);
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined),
    signButton.click({ force: true, timeout: 10_000 }),
  ]);

  if (page.isClosed()) {
    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
      return popup;
    }
    const survivingPage = context.pages().find((candidate) => !candidate.isClosed());
    if (survivingPage) return survivingPage;
    throw new Error("CEAC closed the Sign and Submit page without opening a continuation page.");
  }

  const popup = await Promise.race([
    popupPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_000)),
  ]);
  if (popup) {
    await popup.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
    return popup;
  }
  return page;
}

async function buildSubmittedResultFromConfirmation(
  page: Page,
  options: {
    tracker: RecoveryTracker;
    runId?: string;
    datArtifact: DatArtifact | null;
    sectionCoverage: SectionCoverage;
    captchaAttempts: number;
  },
): Promise<OrchestrateResult> {
  const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  const tracked = options.tracker.snapshot();
  const submittedAt = new Date().toISOString();
  const applicationId = extractApplicationId(bodyText) ?? tracked.applicationId ?? null;
  const confirmationNumber = extractConfirmationNumber(bodyText) ?? applicationId;
  const checkpoint = {
    action: "manual" as const,
    at: submittedAt,
    pageId: "confirmation" as const,
    heading: "Confirmation",
    url: page.url(),
    applicationId,
    runId: options.runId,
    details: {
      section: "confirmation",
      terminal: true,
      confirmationNumber,
      captchaAttempts: options.captchaAttempts,
    },
  };
  await options.tracker.record(checkpoint);

  return {
    result: {
      status: "submitted",
      applicationId,
      confirmationNumber,
      submittedAt,
      url: page.url(),
      captchaAttempts: options.captchaAttempts,
      runId: options.runId,
      checkpoint,
      datArtifact: options.datArtifact,
    },
    datArtifact: options.datArtifact,
    sectionCoverage: options.sectionCoverage,
  };
}

function extractApplicationId(text: string): string | null {
  return text.match(CEAC_APPLICATION_ID_PATTERN)?.[0] ?? null;
}

function extractConfirmationNumber(text: string): string | null {
  const labeled = text.match(/confirmation\s+(?:number|no\.?|#)\s*:?\s*([A-Z0-9-]{6,})/i);
  return labeled?.[1] ?? null;
}

async function dumpSignCertifyDom(page: Page, outPath: string): Promise<void> {
  try {
    const dom = await page.evaluate(() => {
      function row(el: Element) {
        const input = el as HTMLInputElement;
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          id: input.id ?? "",
          name: input.name ?? "",
          type: input.type ?? "",
          value: input.value ?? "",
          checked: Boolean(input.checked),
          disabled: Boolean(input.disabled),
          visible: rect.width > 0 && rect.height > 0,
          text: (el.textContent ?? "").trim().slice(0, 120),
        };
      }
      return {
        url: location.href,
        bodySnippet: (document.body.innerText ?? "").slice(0, 1200),
        inputs: Array.from(document.querySelectorAll("input")).map(row),
        buttons: Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button']")).map(row),
        labels: Array.from(document.querySelectorAll("label")).map((label) => ({
          for: label.getAttribute("for"),
          text: (label.textContent ?? "").trim().slice(0, 200),
        })),
      };
    });
    fs.writeFileSync(outPath, JSON.stringify(dom, null, 2));
  } catch {
    // best effort
  }
}

async function forceTextValue(el: Locator, value: string): Promise<void> {
  await el.evaluate((node, nextValue) => {
    const input = node as HTMLInputElement | HTMLTextAreaElement;
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

const RADIO_FIELDS_REQUIRING_CLICK: ReadonlySet<string> = new Set([
  "has_immediate_us_relatives",
  // CEAC's passport lost/stolen RadioButtonList participates in WebForms
  // client validation. A DOM-only checked assignment looks selected but
  // does not run the control's click handler, so Next can remain on Passport.
  "passport_lost_or_stolen",
]);

export interface Ds160TravelCompanion {
  surname: string;
  givenNames: string;
  relationship: string;
}

export interface Ds160TravelCompanionsPlan {
  hasCompanions: boolean;
  groupTravel: boolean | null;
  groupName: string | null;
  companions: Ds160TravelCompanion[];
}

const COMPANION_RELATIONSHIP_CODES: Readonly<Record<string, string>> = {
  spouse: "SPOUSE",
  child: "CHILD",
  parent: "PARENT",
  sibling: "SIBLING",
  relative: "OTHER RELATIVE",
  other_relative: "OTHER RELATIVE",
  "other relative": "OTHER RELATIVE",
  business_partner: "BUSINESS ASSOCIATE",
  business_associate: "BUSINESS ASSOCIATE",
  "business associate": "BUSINESS ASSOCIATE",
  friend: "FRIEND",
  schoolmate: "SCHOOLMATES",
  schoolmates: "SCHOOLMATES",
  other: "OTHER",
};

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("[") && !trimmed.startsWith("{"))) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  const parsed = parseJson(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
}

function firstDefined(values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function requiredBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["y", "yes", "true", "1"].includes(normalized)) return true;
  if (["n", "no", "false", "0"].includes(normalized)) return false;
  throw new Error(`DS-160 missing or invalid ${fieldName}`);
}

export interface Ds160SocialMediaRow {
  platform: string;
  identifier: string;
}

export interface Ds160OtherSocialMediaRow {
  platform: string;
  handle: string;
}

export interface Ds160SocialMediaPlan {
  socialMedia: Ds160SocialMediaRow[];
  hasOtherSocialMedia: boolean;
  otherSocialMedia: Ds160OtherSocialMediaRow[];
}

function indexedAnswerRows(
  answers: Record<string, unknown>,
  leftKey: string,
  rightKeys: string[],
): Array<Record<string, unknown>> {
  const indexes = new Set<number>();
  for (const key of Object.keys(answers)) {
    const match = key.match(new RegExp(`^${leftKey}(?:__(\\d+))?$`));
    if (match) indexes.add(match[1] ? Number(match[1]) : 1);
  }
  return [...indexes].sort((a, b) => a - b).map((index) => {
    const suffix = index === 1 ? "" : `__${index}`;
    return {
      left: answers[`${leftKey}${suffix}`],
      right: firstDefined(rightKeys.map((key) => answers[`${key}${suffix}`])),
    };
  });
}

/** Build the two official AddressPhone social-media repeater groups. */
export function buildDs160SocialMediaPlan(
  rawAnswers: Record<string, unknown>,
  rawProfile: Record<string, unknown> = {},
): Ds160SocialMediaPlan {
  const socialSource = parseJson(firstDefined([
    rawAnswers["social_media[]"],
    rawProfile["social_media[]"],
  ]));
  const socialRows = Array.isArray(socialSource)
    ? socialSource
    : indexedAnswerRows(rawAnswers, "social_media_platform", [
      "social_media_handle",
      "social_media_identifier",
      "social_media_username",
    ]).map((row) => ({ platform: row.left, identifier: row.right }));
  if (socialRows.length === 0) {
    const provider = firstDefined([
      rawAnswers.social_media_provider,
      rawProfile.social_media_provider,
    ]);
    if (provider !== undefined) {
      socialRows.push({
        platform: provider,
        identifier: firstDefined([
          rawAnswers.social_media_identifier,
          rawAnswers.social_media_username,
          rawProfile.social_media_identifier,
        ]),
      });
    }
  }
  if (socialRows.length === 0) {
    throw new Error("DS-160 social_media[] requires at least one provider row or NONE");
  }

  const socialMedia = socialRows.map((entry, index) => {
    const row = asRecord(entry);
    if (!row) throw new Error(`DS-160 social_media[${index}] must be an object`);
    const platform = String(row.platform ?? row.provider ?? "").trim().toUpperCase();
    const identifier = String(row.identifier ?? row.handle ?? row.username ?? "").trim();
    if (!platform) throw new Error(`DS-160 social_media[${index}].platform is required`);
    if (platform !== "NONE" && !identifier) {
      throw new Error(`DS-160 social_media[${index}].identifier is required`);
    }
    return { platform, identifier: platform === "NONE" ? "" : identifier };
  });
  if (socialMedia.length > 1 && socialMedia.some((row) => row.platform === "NONE")) {
    throw new Error("DS-160 social_media[] cannot mix NONE with provider rows");
  }

  const hasOtherSocialMedia = requiredBoolean(
    firstDefined([
      rawAnswers.has_other_social_media,
      rawProfile.has_other_social_media,
    ]),
    "has_other_social_media",
  );
  const otherSource = parseJson(firstDefined([
    rawAnswers["other_social_media[]"],
    rawProfile["other_social_media[]"],
  ]));
  const otherRows = Array.isArray(otherSource)
    ? otherSource
    : indexedAnswerRows(rawAnswers, "other_social_media_platform", [
      "other_social_media_handle",
      "other_social_media_identifier",
    ]).map((row) => ({ platform: row.left, handle: row.right }));

  if (!hasOtherSocialMedia) {
    return { socialMedia, hasOtherSocialMedia: false, otherSocialMedia: [] };
  }
  if (otherRows.length === 0) {
    throw new Error("DS-160 other_social_media[] requires at least one row when has_other_social_media is yes");
  }
  const otherSocialMedia = otherRows.map((entry, index) => {
    const row = asRecord(entry);
    if (!row) throw new Error(`DS-160 other_social_media[${index}] must be an object`);
    const platform = String(row.platform ?? row.name ?? "").trim();
    const handle = String(row.handle ?? row.identifier ?? row.username ?? "").trim();
    if (!platform) throw new Error(`DS-160 other_social_media[${index}].platform is required`);
    if (!handle) throw new Error(`DS-160 other_social_media[${index}].handle is required`);
    return { platform, handle };
  });
  return { socialMedia, hasOtherSocialMedia: true, otherSocialMedia };
}

function normalizeCompanionRelationship(value: unknown, index: number): string {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error(`DS-160 companions[${index}].relationship is required`);
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const code = COMPANION_RELATIONSHIP_CODES[normalized]
    ?? COMPANION_RELATIONSHIP_CODES[raw.toLowerCase()];
  if (!code) {
    throw new Error(`DS-160 companions[${index}].relationship is unsupported: ${raw}`);
  }
  return code;
}

function normalizeCompanion(value: unknown, index: number): Ds160TravelCompanion {
  const record = asRecord(value);
  if (!record) throw new Error(`DS-160 companions[${index}] must be an object`);
  const surname = String(firstDefined([
    record.surname,
    record.lastName,
    record.last_name,
    record.familyName,
  ]) ?? "").trim();
  const givenNames = String(firstDefined([
    record.givenNames,
    record.given_names,
    record.firstName,
    record.first_name,
  ]) ?? "").trim();
  if (!surname) throw new Error(`DS-160 companions[${index}].surname is required`);
  if (!givenNames) throw new Error(`DS-160 companions[${index}].givenNames is required`);
  return {
    surname,
    givenNames,
    relationship: normalizeCompanionRelationship(record.relationship, index),
  };
}

function collectIndexedCompanions(answers: Record<string, unknown>): unknown[] {
  const rows = new Map<number, Record<string, unknown>>();
  const assign = (index: number, key: string, value: unknown) => {
    const row = rows.get(index) ?? {};
    row[key] = value;
    rows.set(index, row);
  };

  for (const [key, value] of Object.entries(answers)) {
    const nested = key.match(/^companions(?:\[(\d+)\]|\.(\d+))\.(firstName|first_name|givenNames|given_names|lastName|last_name|surname|relationship)$/);
    if (nested) {
      assign(Number(nested[1] ?? nested[2]), nested[3], value);
      continue;
    }
    const flat = key.match(/^(companion_surname|companion_given_names|companion_relationship)(?:__(\d+))?$/);
    if (!flat) continue;
    const index = flat[2] ? Number(flat[2]) - 1 : 0;
    const property = flat[1] === "companion_surname"
      ? "surname"
      : flat[1] === "companion_given_names"
        ? "givenNames"
        : "relationship";
    assign(index, property, value);
  }

  return [...rows.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, row]) => row);
}

/** Build and validate the complete CEAC companion branch before touching DOM. */
export function buildTravelCompanionsPlan(
  rawAnswers: Record<string, unknown>,
  rawProfile: Record<string, unknown> = {},
): Ds160TravelCompanionsPlan {
  const travel = asRecord(firstDefined([rawAnswers.travel, rawProfile.travel])) ?? {};
  const hasCompanions = requiredBoolean(firstDefined([
    rawAnswers["travel.hasCompanions"],
    travel.hasCompanions,
    rawAnswers.has_companions,
    rawProfile.has_companions,
  ]), "travel.hasCompanions");

  const companionSource = firstDefined([
    rawAnswers["companions[]"],
    rawAnswers["travel.companions"],
    travel.companions,
    rawAnswers.companions,
    rawProfile.companions,
  ]);
  const parsedCompanions = parseJson(companionSource);
  const rawCompanions = Array.isArray(parsedCompanions)
    ? parsedCompanions
    : collectIndexedCompanions(rawAnswers);

  if (!hasCompanions) {
    if (rawCompanions.length > 0) {
      throw new Error("DS-160 travel.hasCompanions is no but companions[] is not empty");
    }
    return { hasCompanions: false, groupTravel: null, groupName: null, companions: [] };
  }

  const groupTravel = requiredBoolean(firstDefined([
    rawAnswers["travel.companionGroupTravel"],
    travel.companionGroupTravel,
    rawAnswers.companion_group_travel,
    rawProfile.companion_group_travel,
  ]), "travel.companionGroupTravel");

  if (groupTravel) {
    const groupName = String(firstDefined([
      rawAnswers["travel.companionGroupName"],
      travel.companionGroupName,
      rawAnswers.companion_group_name,
      rawProfile.companion_group_name,
    ]) ?? "").trim();
    if (!groupName) throw new Error("DS-160 travel.companionGroupName is required for group travel");
    return { hasCompanions: true, groupTravel: true, groupName, companions: [] };
  }

  if (rawCompanions.length === 0) {
    throw new Error("DS-160 companions[] requires at least one person when not traveling as a group");
  }
  return {
    hasCompanions: true,
    groupTravel: false,
    groupName: null,
    companions: rawCompanions.map(normalizeCompanion),
  };
}

async function clickBooleanRadio(
  page: Page,
  selector: string,
  value: boolean,
  label: string,
): Promise<void> {
  const expected = value ? new Set(["y", "yes", "true", "1"]) : new Set(["n", "no", "false", "0"]);
  const candidates = page.locator(selector);
  const count = await candidates.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const candidateValue = String(await candidate.getAttribute("value") ?? "").trim().toLowerCase();
    if (!expected.has(candidateValue)) continue;
    await candidate.click({ timeout: 5_000 });
    await waitForAspNetPostback(page, 8_000);
    // WebForms postbacks can replace the entire RadioButtonList. Re-query
    // after the postback instead of checking the now-detached locator.
    const refreshed = page.locator(selector);
    let checked = false;
    for (let refreshedIndex = 0; refreshedIndex < await refreshed.count(); refreshedIndex += 1) {
      const refreshedCandidate = refreshed.nth(refreshedIndex);
      const refreshedValue = String(await refreshedCandidate.getAttribute("value") ?? "").trim().toLowerCase();
      if (!expected.has(refreshedValue)) continue;
      checked = await refreshedCandidate.isChecked().catch(() => false);
      if (checked) break;
    }
    if (!checked) throw new Error(`CEAC ${label} radio did not remain selected`);
    return;
  }
  throw new Error(`CEAC ${label} radio option ${value ? "yes" : "no"} was not found`);
}

async function visibleEnabledLocators(page: Page, selector: string): Promise<Locator[]> {
  const all = page.locator(selector);
  const result: Locator[] = [];
  for (let index = 0; index < await all.count(); index += 1) {
    const candidate = all.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    if (!(await candidate.isEnabled().catch(() => false))) continue;
    result.push(candidate);
  }
  return result;
}

async function visibleEnabledLocatorsWithLabel(
  page: Page,
  selector: string,
  label: string,
): Promise<Locator[]> {
  const matched = await visibleEnabledLocators(page, selector);
  if (matched.length > 0) return matched;

  const labeled = page.getByLabel(label, { exact: true });
  const result: Locator[] = [];
  for (let index = 0; index < await labeled.count(); index += 1) {
    const candidate = labeled.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    if (!(await candidate.isEnabled().catch(() => false))) continue;
    result.push(candidate);
  }
  return result;
}

async function addSocialMediaRepeaterRow(
  page: Page,
  addAnotherSelector: string,
  rowCount: () => Promise<number>,
  previousCount: number,
  label: string,
): Promise<void> {
  const buttons = await visibleEnabledLocators(page, addAnotherSelector);
  if (!buttons[0]) throw new Error(`CEAC Add Another ${label} control was not found`);
  await buttons[0].click({ timeout: 5_000 });
  await waitForAspNetPostback(page, 8_000);
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (await rowCount() > previousCount) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`CEAC Add Another did not create a new ${label} row`);
}

async function socialProviderRows(page: Page): Promise<Locator[]> {
  return visibleEnabledLocatorsWithLabel(
    page,
    ds160SocialMediaRepeaterSelectors.provider,
    "Social Media Provider/Platform",
  );
}

async function socialIdentifierRows(page: Page): Promise<Locator[]> {
  return visibleEnabledLocatorsWithLabel(
    page,
    ds160SocialMediaRepeaterSelectors.identifier,
    "Social Media Identifier",
  );
}

async function otherSocialPlatformRows(page: Page): Promise<Locator[]> {
  return visibleEnabledLocatorsWithLabel(
    page,
    ds160SocialMediaRepeaterSelectors.otherPlatform,
    "Additional Social Media Platform",
  );
}

async function otherSocialHandleRows(page: Page): Promise<Locator[]> {
  return visibleEnabledLocatorsWithLabel(
    page,
    ds160SocialMediaRepeaterSelectors.otherHandle,
    "Additional Social Media Handle",
  );
}

async function ensureSocialProviderRowCount(page: Page, expected: number): Promise<void> {
  let rows = await socialProviderRows(page);
  if (rows.length > expected) {
    throw new Error(`CEAC has ${rows.length} social-media rows but VIZA only has ${expected}; refusing to leave stale rows`);
  }
  if (rows.length === 0) throw new Error("CEAC social-media provider row was not found");
  while (rows.length < expected) {
    await addSocialMediaRepeaterRow(
      page,
      ds160SocialMediaRepeaterSelectors.addAnother,
      async () => (await socialProviderRows(page)).length,
      rows.length,
      "social-media provider",
    );
    rows = await socialProviderRows(page);
  }
}

async function ensureOtherSocialRowCount(page: Page, expected: number): Promise<void> {
  let rows = await otherSocialPlatformRows(page);
  if (rows.length > expected) {
    throw new Error(`CEAC has ${rows.length} additional-social rows but VIZA only has ${expected}; refusing to leave stale rows`);
  }
  if (rows.length === 0) {
    await page.getByLabel("Additional Social Media Platform", { exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 8_000 })
      .catch(() => undefined);
    rows = await otherSocialPlatformRows(page);
  }
  if (rows.length === 0) throw new Error("CEAC additional social-media row was not found after selecting Yes");
  while (rows.length < expected) {
    await addSocialMediaRepeaterRow(
      page,
      ds160SocialMediaRepeaterSelectors.otherAddAnother,
      async () => (await otherSocialPlatformRows(page)).length,
      rows.length,
      "additional social-media",
    );
    rows = await otherSocialPlatformRows(page);
  }
}

async function fillSocialProviderRow(
  page: Page,
  index: number,
  row: Ds160SocialMediaRow,
): Promise<void> {
  let providers = await socialProviderRows(page);
  if (!providers[index]) throw new Error(`CEAC social-media row ${index + 1} is unavailable`);
  await selectCeacOption(providers[index], row.platform);
  await waitForAspNetPostback(page, 8_000);

  providers = await socialProviderRows(page);
  const provider = providers[index];
  if (!provider) throw new Error(`CEAC social-media row ${index + 1} disappeared after selecting its provider`);
  const selectedText = String(
    await provider.locator("option:checked").textContent().catch(() => "")
      ?? await provider.inputValue().catch(() => ""),
  ).trim().toUpperCase();
  if (selectedText !== row.platform && !selectedText.includes(row.platform)) {
    throw new Error(`CEAC social-media row ${index + 1} provider was not retained`);
  }

  const allIdentifiers = page.locator(ds160SocialMediaRepeaterSelectors.identifier);
  if (row.platform === "NONE") {
    const identifier = allIdentifiers.nth(index);
    if ((await identifier.count()) > 0 && (await identifier.inputValue().catch(() => "")).trim()) {
      throw new Error("CEAC NONE social-media row retained an identifier");
    }
    return;
  }

  const identifiers = await socialIdentifierRows(page);
  if (!identifiers[index]) throw new Error(`CEAC social-media row ${index + 1} identifier is unavailable`);
  await identifiers[index].fill(row.identifier);
  if ((await identifiers[index].inputValue()).trim() !== row.identifier) {
    throw new Error(`CEAC social-media row ${index + 1} identifier was not retained`);
  }
}

async function fillOtherSocialRow(
  page: Page,
  index: number,
  row: Ds160OtherSocialMediaRow,
): Promise<void> {
  const platforms = await otherSocialPlatformRows(page);
  const handles = await otherSocialHandleRows(page);
  if (!platforms[index] || !handles[index]) {
    throw new Error(`CEAC additional social-media row ${index + 1} is incomplete or unavailable`);
  }
  await platforms[index].fill(row.platform);
  await handles[index].fill(row.handle);
  if ((await platforms[index].inputValue()).trim() !== row.platform) {
    throw new Error(`CEAC additional social-media row ${index + 1} platform was not retained`);
  }
  if ((await handles[index].inputValue()).trim() !== row.handle) {
    throw new Error(`CEAC additional social-media row ${index + 1} handle was not retained`);
  }
}

/** Fill both official AddressPhone social-media repeaters without advancing. */
export async function fillSocialMediaPage(
  page: Page,
  answers: Record<string, string>,
  profile: Record<string, unknown> = {},
): Promise<void> {
  const plan = buildDs160SocialMediaPlan(answers as Record<string, unknown>, profile);
  await ensureSocialProviderRowCount(page, plan.socialMedia.length);
  for (let index = 0; index < plan.socialMedia.length; index += 1) {
    await fillSocialProviderRow(page, index, plan.socialMedia[index]);
  }

  await clickBooleanRadio(
    page,
    ds160SocialMediaRepeaterSelectors.hasOther,
    plan.hasOtherSocialMedia,
    "additional social media",
  );
  if (!plan.hasOtherSocialMedia) return;

  // The Yes postback replaces the social-media UpdatePanel. Confirm the first
  // provider group survived before adding conditional rows.
  await ensureSocialProviderRowCount(page, plan.socialMedia.length);
  await ensureOtherSocialRowCount(page, plan.otherSocialMedia.length);
  for (let index = 0; index < plan.otherSocialMedia.length; index += 1) {
    await fillOtherSocialRow(page, index, plan.otherSocialMedia[index]);
  }
}

async function fillCompanionRow(page: Page, index: number, companion: Ds160TravelCompanion): Promise<void> {
  const surnames = await visibleEnabledLocators(page, ds160TravelCompanionRepeaterSelectors.surname);
  const givenNames = await visibleEnabledLocators(page, ds160TravelCompanionRepeaterSelectors.givenNames);
  const relationships = await visibleEnabledLocators(page, ds160TravelCompanionRepeaterSelectors.relationship);
  if (!surnames[index] || !givenNames[index] || !relationships[index]) {
    throw new Error(`CEAC companion row ${index + 1} is incomplete or unavailable`);
  }
  await surnames[index].fill(companion.surname);
  await givenNames[index].fill(companion.givenNames);
  await selectCeacOption(relationships[index], companion.relationship);
  if ((await surnames[index].inputValue()).trim() !== companion.surname) {
    throw new Error(`CEAC companion row ${index + 1} surname was not retained`);
  }
  if ((await givenNames[index].inputValue()).trim() !== companion.givenNames) {
    throw new Error(`CEAC companion row ${index + 1} given names were not retained`);
  }
}

async function assertCompanionRowsRetained(
  page: Page,
  companions: Ds160TravelCompanion[],
): Promise<void> {
  const surnames = await visibleEnabledLocators(page, ds160TravelCompanionRepeaterSelectors.surname);
  const givenNames = await visibleEnabledLocators(page, ds160TravelCompanionRepeaterSelectors.givenNames);
  const relationships = await visibleEnabledLocators(page, ds160TravelCompanionRepeaterSelectors.relationship);
  if (surnames.length !== companions.length || givenNames.length !== companions.length || relationships.length !== companions.length) {
    throw new Error("CEAC travel companion row count changed after filling");
  }
  for (let index = 0; index < companions.length; index += 1) {
    const companion = companions[index];
    if ((await surnames[index].inputValue()).trim() !== companion.surname) {
      throw new Error(`CEAC companion row ${index + 1} surname was lost after adding another person`);
    }
    if ((await givenNames[index].inputValue()).trim() !== companion.givenNames) {
      throw new Error(`CEAC companion row ${index + 1} given names were lost after adding another person`);
    }
    const selectedRelationship = await relationships[index].locator("option:checked").textContent().catch(() => null);
    if (String(selectedRelationship ?? "").trim().toUpperCase() !== companion.relationship) {
      throw new Error(`CEAC companion row ${index + 1} relationship was not retained`);
    }
  }
}

async function addCompanionRow(page: Page, previousCount: number): Promise<void> {
  const buttons = await visibleEnabledLocators(page, ds160TravelCompanionRepeaterSelectors.addAnother);
  if (!buttons[0]) throw new Error("CEAC Add Another travel companion control was not found");
  await buttons[0].click({ timeout: 5_000 });
  await waitForAspNetPostback(page, 8_000);
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const rows = await visibleEnabledLocators(page, ds160TravelCompanionRepeaterSelectors.surname);
    if (rows.length > previousCount) return;
    await page.waitForTimeout(100);
  }
  throw new Error("CEAC Add Another did not create a new travel companion row");
}

/** Fill the conditional/repeatable Travel Companions page without overwriting rows. */
export async function fillTravelCompanionsPage(
  page: Page,
  answers: Record<string, string>,
  profile: Record<string, unknown> = {},
): Promise<void> {
  const plan = buildTravelCompanionsPlan(answers as Record<string, unknown>, profile);
  await clickBooleanRadio(page, ds160TravelCompanionsMappings.has_companions.selector, plan.hasCompanions, "travel companions");
  if (!plan.hasCompanions) return;

  await clickBooleanRadio(page, ds160TravelCompanionsMappings.companion_group_travel.selector, Boolean(plan.groupTravel), "group travel");
  if (plan.groupTravel) {
    const groupNames = await visibleEnabledLocators(page, ds160TravelCompanionsMappings.companion_group_name.selector);
    if (!groupNames[0]) throw new Error("CEAC group name field was not found");
    await groupNames[0].fill(plan.groupName!);
    if ((await groupNames[0].inputValue()).trim() !== plan.groupName) {
      throw new Error("CEAC group name was not retained");
    }
    return;
  }

  const existingRows = await visibleEnabledLocators(page, ds160TravelCompanionRepeaterSelectors.surname);
  if (existingRows.length > plan.companions.length) {
    throw new Error(`CEAC has ${existingRows.length} companion rows but VIZA only has ${plan.companions.length}; refusing to leave stale people`);
  }
  if (existingRows.length === 0) {
    await addCompanionRow(page, 0);
  }
  for (let index = 0; index < plan.companions.length; index += 1) {
    const rows = await visibleEnabledLocators(page, ds160TravelCompanionRepeaterSelectors.surname);
    if (rows.length <= index) await addCompanionRow(page, rows.length);
    await fillCompanionRow(page, index, plan.companions[index]);
  }
  await assertCompanionRowsRetained(page, plan.companions);
}

async function fillPageFields(
  page: Page,
  mappings: Record<string, FormFieldMapping>,
  answers: Record<string, string>,
  profile: Record<string, unknown>,
): Promise<void> {
  const debug = process.env.CEAC_FILL_DEBUG === "1";

  // Warm-up wait: CEAC sections rendered inside an ASP.NET FormView
  // (e.g. passport) sometimes take an extra postback cycle to bind their
  // fields. detectPage matches on the H2 heading + URL — those settle
  // before the FormView's contents do. Without a wait here, every field
  // selector returns count=0 and silently skips, leaving the page submit
  // empty and CEAC rejecting on validation. Wait up to 10s for any one
  // mapping selector to resolve to a visible match before proceeding.
  const allSelectors = Object.values(mappings)
    .flatMap((m) => m.selector.split(",").map((s) => s.trim()))
    .filter((s) => s.length > 0);
  if (allSelectors.length > 0) {
    const combinedSelector = allSelectors.join(", ");
    try {
      await page
        .locator(combinedSelector)
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });
    } catch {
      // If nothing ever appears, fall through — fillPageFields will warn
      // per field and the orchestrator's downstream Next click will still
      // surface a CEAC validation error if values are required.
      if (debug) console.log(`[fill] warm-up wait timed out — no mapping selector became visible`);
    }
    // Give CEAC's MSAJAX one more tick to finish binding any companion
    // controls (e.g. date dropdowns siblings of a parent select).
    await waitForAspNetPostback(page, 3_000);
  }

  for (const [fieldName, mapping] of Object.entries(mappings)) {
    const value = answers[fieldName]
      ?? (profile[fieldName] as string | undefined)
      ?? null;

    if (!value) continue;

    const selectors = mapping.selector.split(",").map((s) => s.trim());
    let filled = false;
    let lastErr: unknown = null;
    // True when at least one selector branch matched DOM nodes but every
    // match was either hidden or non-editable — i.e., the field exists
    // on the page but doesn't apply to this applicant (e.g., the social
    // media identifier when "NONE" is the chosen platform). We suppress
    // the missing-field warning in that case.
    let skippedAsInapplicable = false;

    for (const selector of selectors) {
      try {
        const all = page.locator(selector);
        let count = await all.count();
        if (count === 0) {
          await all.first().waitFor({ state: "attached", timeout: 2_500 }).catch(() => undefined);
          count = await all.count();
        }
        if (count === 0) continue;
        // Pick the first VISIBLE match. CEAC repeaters (e.g. dtlSocial)
        // sometimes leave a hidden template row in the DOM that matches
        // our selector but isn't fillable — skipping silently here
        // keeps the warning-noise floor low without changing behavior
        // for the common case where the matched element is the only
        // one and is visible.
        let el: ReturnType<typeof page.locator> | null = null;
        for (let i = 0; i < count; i += 1) {
          const candidate = all.nth(i);
          if (mapping.type === "checkbox" || mapping.type === "radio") {
            el = candidate;
            break;
          }
          if (mapping.type === "select") {
            const enabled = await candidate.isEnabled().catch(() => false);
            if (!enabled) continue;
            el = candidate;
            break;
          }
          const visible = await candidate.isVisible().catch(() => false);
          if (!visible) continue;
          // For text fills, also require the element to be editable:
          // CEAC disables fields like social_media_identifier when its
          // sibling dropdown is set to "NONE", and we don't want to burn
          // the 5s actionability timeout on those.
          if (mapping.type === "text") {
            const editable = await candidate.isEditable().catch(() => false);
            if (!editable) continue;
          }
          el = candidate;
          break;
        }
        if (!el && mapping.type === "text") {
          // Some CEAC controls are rendered below the initial viewport or
          // inside tables that confuse actionability checks. As a fallback,
          // use the first enabled text input and assign through DOM events.
          for (let i = 0; i < count; i += 1) {
            const candidate = all.nth(i);
            const enabled = await candidate.isEnabled().catch(() => false);
            if (!enabled) continue;
            el = candidate;
            break;
          }
        }
        if (!el) {
          skippedAsInapplicable = true;
          continue;
        }
        if (debug) console.log(`[fill] ${fieldName} (${mapping.type}) → matched selector "${selector}", trying value="${value}"`);

        if (mapping.type === "radio") {
          // Radio: selector targets the RadioButtonList base. Append
          // [value="<val>"] so we target only the option with the
          // matching value. (The outer loop already split the selector
          // by comma so `selector` here is a single branch.)
          const specific = `${selector}[value="${value}"]`;
          const radio = page.locator(specific).first();
          const radioCount = await radio.count();
          if (radioCount > 0) {
            if (RADIO_FIELDS_REQUIRING_CLICK.has(fieldName)) {
              await radio.click({ timeout: 5_000 });
            } else {
              await radio.evaluate((node) => {
                const input = node as HTMLInputElement;
                input.checked = true;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
              });
            }
          } else {
            continue; // No matching radio option
          }
        } else if (mapping.type === "select") {
          await selectCeacOption(el, value);
        } else if (mapping.type === "checkbox") {
          // Checkbox: interpret the value as a truthy/falsy flag. "Y",
          // "true", "1", "yes" → check; everything else → uncheck.
          const shouldCheck = /^(Y|1|true|yes)$/i.test(value);
          await el.evaluate((node, checked) => {
            const input = node as HTMLInputElement;
            input.checked = Boolean(checked);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.checked = Boolean(checked);
          }, shouldCheck);
        } else {
          try {
            await el.fill(value, { timeout: 5_000 });
          } catch {
            await forceTextValue(el, value);
          }
        }

        // Many CEAC controls (radios, AutoPostBack selects, NA
        // checkboxes) fire an MSAJAX UpdatePanel postback that reveals
        // or enables dependent fields. Wait for it to settle before we
        // try the next mapping — otherwise subsequent fills target a
        // transient DOM and silently miss.
        await waitForAspNetPostback(page, 8_000);
        if (mapping.type === "checkbox") {
          await page.waitForTimeout(750);
        }

        filled = true;
        break;
      } catch (err) {
        lastErr = err;
        if (debug) console.log(`[fill]   selector "${selector}" threw: ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
      }
    }

    if (!filled && !skippedAsInapplicable) {
      const hint = lastErr instanceof Error ? ` — last err: ${lastErr.message.slice(0, 100)}` : "";
      console.warn(`[orchestrator] Could not fill "${mapping.label}" on current page${hint}`);
    }
  }

  await reinforceChoiceFields(page, mappings, answers, profile, debug);
}

async function reinforceChoiceFields(
  page: Page,
  mappings: Record<string, FormFieldMapping>,
  answers: Record<string, string>,
  profile: Record<string, unknown>,
  debug: boolean,
): Promise<void> {
  for (const [fieldName, mapping] of Object.entries(mappings)) {
    if (mapping.type !== "checkbox" && mapping.type !== "radio") continue;
    const value = answers[fieldName]
      ?? (profile[fieldName] as string | undefined)
      ?? null;
    if (!value) continue;

    const selectors = mapping.selector.split(",").map((s) => s.trim());
    for (const selector of selectors) {
      try {
        if (mapping.type === "checkbox") {
          const shouldCheck = /^(Y|1|true|yes)$/i.test(value);
          const candidate = page.locator(selector).first();
          if ((await candidate.count()) === 0) continue;
          await candidate.evaluate((node, checked) => {
            const input = node as HTMLInputElement;
            input.checked = Boolean(checked);
          }, shouldCheck);
          if (debug) console.log(`[fill] ${fieldName} final checkbox state=${shouldCheck ? "checked" : "unchecked"}`);
          break;
        }

        const candidate = page.locator(`${selector}[value="${value}"]`).first();
        if ((await candidate.count()) === 0) continue;
        await candidate.evaluate((node) => {
          const input = node as HTMLInputElement;
          input.checked = true;
        });
        if (debug) console.log(`[fill] ${fieldName} final radio value="${value}"`);
        break;
      } catch {
        // Final reinforcement is best effort. The primary fill path above
        // still reports missing fields and CEAC validation remains the
        // source of truth.
      }
    }
  }
}

/**
 * Return a broad set of expected next pages based on the current page.
 * The DS-160 flow is mostly linear but some pages are conditional, so we
 * accept multiple possible destinations rather than one rigid target.
 */
function getExpectedNextPages(current: CeacPageId | "unknown"): CeacPageId[] {
  // Ordered DS-160 page progression (simplified — conditional pages may be skipped)
  const pageOrder: CeacPageId[] = [
    "start",
    "personal_information_1",
    "personal_information_2",
    "travel_information",
    "travel_companions",
    "previous_us_travel",
    "address_and_phone",
    "passport",
    "us_contact",
    "family_relatives",
    "family_spouse",
    "work_education_present",
    "work_education_previous",
    "work_education_additional",
    "security_background_1",
    "security_background_2",
    "security_background_3",
    "security_background_4",
    "security_background_5",
    "upload_photo",
    "confirm_photo",
    "review",
    "sign_and_submit",
  ];

  const currentIdx = pageOrder.indexOf(current as CeacPageId);

  if (currentIdx === -1 || currentIdx >= pageOrder.length - 1) {
    // Unknown page or at the end — accept any page after personal_information_1
    return pageOrder.slice(1);
  }

  // Review is a chain of sub-pages (Personal → Travel → … → Spouse) all
  // detected as `review` by URL. Accept staying on review until we reach
  // sign_and_submit.
  if (current === "review") {
    return ["review", "sign_and_submit"];
  }

  // Accept the next 3 pages (to handle skipped conditional pages)
  return pageOrder.slice(currentIdx + 1, currentIdx + 4);
}
