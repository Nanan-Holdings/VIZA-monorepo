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
  ds160PreviousUsTravelMappings,
  ds160PassportMappings,
  ds160ContactMappings,
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
import { detectPage, isOfficialDs160ConfirmationPage, type CeacPageId } from "./pages";
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
import { CeacError, serializeError, UnexpectedPageError } from "./errors";
import type { CeacSession } from "./session";
import { rebuildSessionForResume } from "./session";
import { tryCaptureScreenshot } from "./diagnostics";
import {
  fillRetrieveApplicationForm,
  type RecoveryCredentials,
} from "./resume-application";
import { assertCeacPostbackHealthy, installCeacPostbackMonitor, waitForAspNetPostback } from "./aspnet";
import {
  handleUploadPhotoPage,
  PhotoRejectedError,
  type PhotoFile,
} from "./upload-photo";
import { signAndSubmitApplication } from "./final-submit";
import { prepareConfirmationContinuation, waitForDs160SubmissionConfirmation } from "./confirmation-navigation";
import type { Ds160FinalSubmissionGuard } from "./final-submission-guard";
import { solveImageCaptcha } from "../captcha";
import { CEAC_APPLICATION_ID_PATTERN } from "./selectors";
import { DS160_EXTENDED_MAPPING_GROUPS } from "../ds160-extended-mappings";
import { assertDs160RequiredAnswers, createDs160BranchPolicy, ds160MappingRepeatGroup, ds160RepeatAnswers } from "./field-contract";
import { fillDs160RepeatGroups } from "./repeat-browser-adapter";
import { resolvePreviousTravelMappings } from "./previous-travel-branch";
import { captureOfficialReviewPage, verifyOfficialReview, type ReviewExpectation, type ReviewSnapshot } from "./review-verification";
import { applyExplicitPreparerAnswer, fillVerifiedPassportSignature, type Ds160PreparerAnswers } from "./signature-fields";
import { reconnectVerifiedCeacPage, RECOVERABLE_DS160_PAGE_IDS } from "./recovered-application";

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

for (const group of DS160_EXTENDED_MAPPING_GROUPS) {
  const existing = PAGE_FILL_MAP[group.page];
  PAGE_FILL_MAP[group.page] = { ...existing, ...group.mappings, ...existing };
}

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

/**
 * A mapped field was present and visible, but CEAC did not accept or retain
 * the answer. Keep this error free of answer values so applicant data cannot
 * leak through logs or exception text while still making the run fail closed.
 */
class FieldFillError extends Error {
  constructor(fieldName: string, label: string) {
    super(`CEAC field "${label}" (${fieldName}) could not be filled or verified.`);
    this.name = "FieldFillError";
  }
}

class FieldLengthError extends FieldFillError {
  constructor(fieldName: string, label: string, maxLength: number) {
    super(fieldName, label);
    this.name = "FieldLengthError";
    this.message = `CEAC field "${label}" (${fieldName}) exceeds the official maximum length of ${maxLength} characters.`;
  }
}

interface FamilyParentUnknownBranch {
  parent: "father" | "mother";
  surnameField: string;
  givenNamesField: string;
  nameUnknownFields: readonly string[];
  hiddenFields: readonly string[];
  inUsQuestion: string;
}

const FAMILY_PARENT_UNKNOWN_BRANCHES: readonly FamilyParentUnknownBranch[] = [
  {
    parent: "father",
    surnameField: "father_surname",
    givenNamesField: "father_given_names",
    nameUnknownFields: ["father_surname_unknown", "father_given_names_unknown"],
    hiddenFields: ["father_dob_day", "father_dob_month", "father_dob_year", "father_dob_unknown", "father_in_us"],
    inUsQuestion: "Is your father in the U.S.?",
  },
  {
    parent: "mother",
    surnameField: "mother_surname",
    givenNamesField: "mother_given_names",
    nameUnknownFields: ["mother_surname_unknown", "mother_given_names_unknown"],
    hiddenFields: ["mother_dob_day", "mother_dob_month", "mother_dob_year", "mother_dob_unknown", "mother_in_us"],
    inUsQuestion: "Is your mother in the U.S.?",
  },
];

function isDoNotKnow(value: string | undefined): boolean {
  return value?.trim().replace(/\s+/g, "_").toUpperCase() === "DO_NOT_KNOW";
}

async function visibleMatches(page: Page, selector: string): Promise<Locator[]> {
  const all = page.locator(selector);
  const matches: Locator[] = [];
  for (let index = 0; index < await all.count(); index += 1) {
    const candidate = all.nth(index);
    if (await candidate.isVisible().catch(() => false)) matches.push(candidate);
  }
  return matches;
}

/**
 * Assert the official family page applied CEAC's both-name-unknown branch.
 * The name checkboxes are required evidence; dependent controls may be
 * absent or hidden, but a visible contradiction is always a hard failure.
 */
export async function assertFamilyUnknownParentBranches(
  page: Page,
  values: Readonly<Record<string, string>>,
): Promise<void> {
  const activeBranches = FAMILY_PARENT_UNKNOWN_BRANCHES.filter((branch) =>
    isDoNotKnow(values[branch.surnameField]) && isDoNotKnow(values[branch.givenNamesField]),
  );
  if (activeBranches.length === 0) return;

  await waitForAspNetPostback(page, 8_000);
  if ((await detectPage(page)).id !== "family_relatives") {
    throw new Error("CEAC family branch assertion requires the verified Family Information: Relatives page.");
  }

  for (const branch of activeBranches) {
    for (const fieldName of branch.nameUnknownFields) {
      const mapping = ds160FamilyRelativesMappings[fieldName];
      if (!mapping) throw new Error(`Missing CEAC family unknown-checkbox mapping for ${fieldName}.`);
      const candidates: Locator[] = [];
      for (const selector of mapping.selector.split(",").map((item) => item.trim()).filter(Boolean)) {
        candidates.push(...await visibleMatches(page, selector));
      }
      if (candidates.length !== 1) {
        throw new Error(`CEAC ${branch.parent} name-unknown checkbox is not uniquely visible.`);
      }
      if (!(await candidates[0].isChecked().catch(() => false))) {
        throw new Error(`CEAC ${branch.parent} name-unknown checkbox was not checked.`);
      }
    }

    for (const fieldName of branch.hiddenFields) {
      const mapping = ds160FamilyRelativesMappings[fieldName];
      if (!mapping) throw new Error(`Missing CEAC family branch mapping for ${fieldName}.`);
      for (const selector of mapping.selector.split(",").map((item) => item.trim()).filter(Boolean)) {
        if ((await visibleMatches(page, selector)).length > 0) {
          throw new Error(`CEAC ${branch.parent} dependent family control remained visible.`);
        }
      }
    }

    if ((await visibleMatches(page, `text=${branch.inUsQuestion}`)).length > 0) {
      throw new Error(`CEAC ${branch.parent} in-US question remained visible.`);
    }
  }
}

export interface OrchestrateOptions {
  /** Answers from visa_application_answers keyed by field_name. */
  answers: Record<string, string>;
  /** Original saved values used for branch conditions before CEAC encoding. */
  branchAnswers?: Record<string, string>;
  /** Applicant profile for fallback field values. */
  profile: Record<string, unknown>;
  /** Recovery tracker to accumulate checkpoints and Application ID. */
  tracker: RecoveryTracker;
  /** Run identifier for structured logging. */
  runId?: string;
  /** Directory for .dat and screenshot artifacts. */
  outputDir?: string;
  /** Stop before recovery or official actions when the caller loses its job lease. */
  assertActive?: () => void;
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
    savedPreparerAssistance?: string;
    savedPreparerDetails?: Ds160PreparerAnswers;
    maxCaptchaAttempts?: number;
    finalSubmissionGuard?: Ds160FinalSubmissionGuard;
    confirmationTimeoutMs?: number;
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
  const { answers, profile, tracker, runId } = options;
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
  const reviewExpectations = new Map<string, ReviewExpectation>();
  const reviewSnapshots: ReviewSnapshot[] = [];

  try {
    if (options.branchAnswers) assertDs160RequiredAnswers(options.branchAnswers);
    // Fill-and-advance loop: detect current page, fill if we have mappings,
    // advance to the next page. Stop when we reach a terminal page.
    while (transitions < MAX_PAGE_TRANSITIONS) {
      options.assertActive?.();
      if (session.browser?.isConnected?.() === false && options.recoveryCredentials && resumeAttempts < maxResumeAttempts) {
        if (await reconnectVerifiedCeacPage(session, options.recoveryCredentials.applicationId, RECOVERABLE_DS160_PAGE_IDS)) {
          resumeAttempts++;
          console.log("[orchestrator] Reconnected the same verified CEAC draft before page detection");
        }
      }
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
        options.assertActive?.();
        await rebuildSessionForResume(session);
        options.assertActive?.();
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
        options.assertActive?.();
        await rebuildSessionForResume(session);
        options.assertActive?.();
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
        if (options.finalSubmit?.passportNumber) {
          const expected = [...reviewExpectations.values()];
          const diff = verifyOfficialReview(expected, reviewSnapshots);
          if (!sectionsFilled.includes("personal_information_1") || !sectionsFilled.includes("passport")) {
            diff.status = "unverified";
            diff.issues.push({ fieldName: "identity", reason: "identity_pages_not_verified_in_this_run" });
          }
          fs.writeFileSync(path.join(outputDir, "official-review-expectations.json"), JSON.stringify(expected, null, 2));
          fs.writeFileSync(path.join(outputDir, "official-review-diff.json"), JSON.stringify(diff, null, 2));
          if (diff.status !== "passed") {
            throw new Error(`DS-160 official review comparison ${diff.status}: ${diff.issues.length} field(s) require verification before signing.`);
          }
          await recordSectionCheckpoint(page, {
            ...checkpointOpts,
            details: { section: "official_review", reviewDiffStatus: "passed", matchedFields: diff.matched },
          });
        }
        if (!datArtifact) {
          try { datArtifact = await captureDatArtifact(page, { outputDir }); } catch { /* best effort */ }
        }
        const signIdentity = await detectSignAndSubmit(page);
        if (signIdentity) {
          if (options.finalSubmit?.passportNumber) {
            options.assertActive?.();
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
          options.assertActive?.();
          const finalSignaturePage = await certifySignAndSubmitPage(page, {
            passportNumber: options.finalSubmit.passportNumber,
            savedPreparerAssistance: options.finalSubmit.savedPreparerAssistance,
            savedPreparerDetails: options.finalSubmit.savedPreparerDetails,
            diagnosticPath: path.join(outputDir, "sign-certify-dom.json"),
            finalSubmissionGuard: options.finalSubmit.finalSubmissionGuard,
            expectedApplicationId: tracker.snapshot().applicationId,
            confirmationTimeoutMs: options.finalSubmit.confirmationTimeoutMs,
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

      if (mappings) {
        console.log(`[orchestrator] Filling page: ${currentPageId}`);
        const branch = createDs160BranchPolicy(options.branchAnswers ?? answers);
        const observeVerified = (field: Omit<ReviewExpectation, "section">) => {
          const expected = { ...field, section: currentPageId };
          reviewExpectations.set(`${currentPageId}:${field.controlId}:${field.fieldName}`, expected);
        };
        let nonRepeatMappings = Object.fromEntries(Object.entries(mappings).filter(([key]) =>
          !ds160MappingRepeatGroup(key) && branch.isMappingActive(key)));
        if (currentPageId === "previous_us_travel") {
          nonRepeatMappings = await resolvePreviousTravelMappings(page, nonRepeatMappings, branch.values);
        }
        try {
          await fillPageFields(page, nonRepeatMappings, answers, profile, { requireMappedAnswers: true });
          await fillDs160RepeatGroups({
          page, pageId: currentPageId, answers: ds160RepeatAnswers(branch.values, answers), mappings,
          fillRow: async row => fillPageFields(page, row.mappings, row.answers, {}, {
            scope: row.scope, resolveScope: row.resolveScope, requireMappedAnswers: true,
          }),
          verifyRow: async row => verifyPageFieldValues(row.scope ?? page, row.mappings, row.answers, {}, {
            requireMappedAnswers: true, observeVerified,
          }),
          });
          await verifyPageFieldValues(page, nonRepeatMappings, answers, profile, { requireMappedAnswers: true, observeVerified });
        } catch (fillError) {
          options.assertActive?.();
          if (currentPageId !== "unknown" && options.recoveryCredentials && resumeAttempts < maxResumeAttempts &&
            await reconnectVerifiedCeacPage(session, options.recoveryCredentials.applicationId, [currentPageId])) {
            resumeAttempts++;
            console.log(`[orchestrator] Reconnected the same CEAC page; repeating verified fill for ${currentPageId}`);
            continue;
          }
          throw fillError;
        }
        if (currentPageId === "family_relatives") {
          await assertFamilyUnknownParentBranches(page, branch.values);
        }
        sectionsFilled.push(currentPageId);
      } else {
        if (currentPageId !== "review") {
          throw new UnexpectedPageError("CEAC page has no verified filling path; automatic navigation stopped.", {
            detected: currentPageId,
          });
        }
        const applicationId = tracker.snapshot().applicationId;
        if (!applicationId) throw new Error("Official review cannot be verified without the captured application identity.");
        reviewSnapshots.push(await captureOfficialReviewPage(page, applicationId, outputDir, reviewSnapshots.length));
        sectionsSkipped.push(currentPageId);
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
        } catch (err) {
          assertCeacPostbackHealthy(page);
          // An unavailable optional backup must not prevent normal Next
          // navigation. Preserve portal gates, identity errors and failed
          // postbacks instead of treating them as download failures.
          if (err instanceof CeacError && !(
            err.code === "NAVIGATION_FAILED" &&
            err.context.details?.action === "save_to_file" &&
            err.context.details?.phase !== "aspnet_postback"
          )) throw err;
          console.warn(`[orchestrator] .dat capture failed at ${currentPageId} — continuing`);
        }
        // Settlement failures are never optional, even if capture failed.
        await waitForAspNetPostback(page, 8_000);
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
        options.assertActive?.();
        if (currentPageId !== "unknown" && options.recoveryCredentials && resumeAttempts < maxResumeAttempts &&
          await reconnectVerifiedCeacPage(session, options.recoveryCredentials.applicationId, [currentPageId, ...nextPageCandidates])) {
          resumeAttempts++;
          console.log("[orchestrator] Reconnected and verified the official page after navigation");
          continue;
        }
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
    console.warn(`[orchestrator] Failure transportConnected=${session.browser?.isConnected?.()} pageClosed=${session.page?.isClosed?.()}`);
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
    if (!normalizedTarget) throw firstError;
    const match = await el.evaluate((select, target) => {
      if (!(select instanceof HTMLSelectElement)) return null;
      const options = Array.from(select.options).filter((option) => !option.disabled);
      const exactMatches = options.filter((option) => {
        if (option.disabled) return false;
        const optionValue = option.value.trim().toLowerCase();
        const optionText = option.text.trim().toLowerCase();
        return optionValue === target || optionText === target;
      });
      if (exactMatches.length === 1) {
        return { kind: "match" as const, value: exactMatches[0].value };
      }
      if (exactMatches.length > 1) return { kind: "ambiguous" as const };

      return { kind: "none" as const };
    }, normalizedTarget).catch(() => null);

    if (!match || match.kind !== "match") throw firstError;
    try {
      await el.selectOption(match.value, { timeout: 5_000 });
      return;
    } catch {
      await el.evaluate((node, nextValue) => {
        const select = node as HTMLSelectElement;
        select.value = nextValue;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }, match.value);
    }
  }
}

const SIGN_CERTIFY_SUBMIT_SELECTOR = [
  'input[type="submit"][value*="Sign and Submit" i]',
  'input[type="button"][value*="Sign and Submit" i]',
  'button:has-text("Sign and Submit")',
  'input[id*="Sign"][type="submit"]',
].join(", ");

async function certifySignAndSubmitPage(
  page: Page,
  options: {
    passportNumber: string;
    savedPreparerAssistance?: string;
    savedPreparerDetails?: Ds160PreparerAnswers;
    diagnosticPath?: string;
    finalSubmissionGuard?: Ds160FinalSubmissionGuard;
    expectedApplicationId?: string | null;
    confirmationTimeoutMs?: number;
  },
): Promise<Page> {
  if (options.diagnosticPath) await dumpSignCertifyDom(page, options.diagnosticPath);
  await applyExplicitPreparerAnswer(page, options.savedPreparerAssistance, options.savedPreparerDetails);
  await fillVerifiedPassportSignature(page, options.passportNumber);
  await solveSignCertifyCaptcha(page);

  const signButton = page.locator(SIGN_CERTIFY_SUBMIT_SELECTOR).first();
  const hasSignButton = (await signButton.count().catch(() => 0)) > 0;
  const continuation = hasSignButton ? await prepareConfirmationContinuation(page) : null;
  let guardReserved = false;
  let guardOutcomeAttempted = false;
  if (hasSignButton) {
    if (!options.finalSubmissionGuard) {
      throw new Error("Persistent DS-160 final submission guard is required before the final click.");
    }
    const reservation = await options.finalSubmissionGuard.begin();
    if (reservation.kind !== "acquired") {
      throw new Error(
        `DS-160 final submission is already ${reservation.kind.replace("already_", "")}; recover the existing CEAC attempt before retrying.`,
      );
    }
    guardReserved = true;
  }

  try {
    const activePage = await clickSignCertifySubmit(page);

    await activePage.evaluate(() => {
      const maybeValidNavigation = (window as unknown as { ValidNavigation?: () => unknown }).ValidNavigation;
      if (typeof maybeValidNavigation === "function") maybeValidNavigation();
      const maybeValidatorUpdate = (window as unknown as { ValidatorUpdateIsValid?: () => unknown }).ValidatorUpdateIsValid;
      if (typeof maybeValidatorUpdate === "function") maybeValidatorUpdate();
    }).catch(() => undefined);

    const expectedApplicationId = options.expectedApplicationId?.trim().toUpperCase() ?? null;
    const confirmationTimeoutMs = options.confirmationTimeoutMs ?? 45_000;
    if (!Number.isFinite(confirmationTimeoutMs) || confirmationTimeoutMs <= 0) {
      throw new Error("confirmationTimeoutMs must be a positive number.");
    }
    const officialConfirmation = expectedApplicationId
      ? await waitForDs160SubmissionConfirmation(activePage, expectedApplicationId, confirmationTimeoutMs, continuation)
      : false;
    if (officialConfirmation) {
      const bodyText = await activePage.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
      const applicationId = extractApplicationId(bodyText);
      if (!applicationId || applicationId.toUpperCase() !== expectedApplicationId) {
        throw new Error("CEAC confirmation did not contain the expected Application ID.");
      }
      if (!options.finalSubmissionGuard || !guardReserved) {
        throw new Error("CEAC confirmation was reached without a guarded final submission attempt.");
      }
      guardOutcomeAttempted = true;
      await options.finalSubmissionGuard.markConfirmed({
        officialApplicationId: applicationId,
        confirmationNumber: extractConfirmationNumber(bodyText),
        confirmationPageUrl: activePage.url(),
      });
      return activePage;
    }

    if (guardReserved && options.finalSubmissionGuard) {
      guardOutcomeAttempted = true;
      await options.finalSubmissionGuard.markUnknown("confirmation_unknown").catch(() => undefined);
      throw new Error("CEAC final submission click did not reach a verified confirmation page.");
    }

    const afterSubmit = await detectPage(activePage);
    if (afterSubmit.id === "confirmation") {
      throw new Error("CEAC confirmation was reached without a guarded final submission attempt.");
    }

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
    );
    return activePage;
  } catch (error) {
    if (guardReserved && options.finalSubmissionGuard && !guardOutcomeAttempted) {
      guardOutcomeAttempted = true;
      await options.finalSubmissionGuard.markUnknown("confirmation_unknown").catch(() => undefined);
    }
    throw error;
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
  const signButton = page.locator(SIGN_CERTIFY_SUBMIT_SELECTOR).first();
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
  const confirmationNumber = extractConfirmationNumber(bodyText);
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

async function findVisibleField(
  page: Page | Locator,
  selector: string,
  mapping: FormFieldMapping,
): Promise<Locator | null> {
  const all = page.locator(selector);
  const count = await all.count();
  let match: Locator | null = null;
  for (let i = 0; i < count; i += 1) {
    const candidate = all.nth(i);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    if (!(await candidate.isEnabled().catch(() => false))) continue;
    if (
      (mapping.type === "text" || mapping.type === "date") &&
      !(await candidate.isEditable().catch(() => false))
    ) {
      continue;
    }
    if (mapping.type === "radio") return candidate;
    if (match) throw new Error("mapped field selector is ambiguous within its row");
    match = candidate;
  }
  return match;
}

async function findVisibleRadio(
  page: Page | Locator,
  selector: string,
  value: string,
): Promise<Locator | null> {
  const options = page.locator(`${selector}[value="${value}"]`);
  const count = await options.count();
  let match: Locator | null = null;
  for (let i = 0; i < count; i += 1) {
    const candidate = options.nth(i);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    if (!(await candidate.isEnabled().catch(() => false))) continue;
    if (match) throw new Error("radio selector is ambiguous within its row");
    match = candidate;
  }
  return match;
}

async function verifyFilledField(
  page: Page | Locator,
  selector: string,
  mapping: FormFieldMapping,
  value: string,
): Promise<void> {
  if (mapping.type === "radio") {
    const radio = await findVisibleRadio(page, selector, value);
    if (!radio || !(await radio.isChecked().catch(() => false))) {
      throw new Error("radio selection could not be verified");
    }
    return;
  }

  const field = await findVisibleField(page, selector, mapping);
  if (!field) throw new Error("field could not be located after fill");

  if (mapping.type === "checkbox") {
    const shouldCheck = /^(Y|1|true|yes)$/i.test(value);
    if ((await field.isChecked().catch(() => !shouldCheck)) !== shouldCheck) {
      throw new Error("checkbox state could not be verified");
    }
    return;
  }

  if (mapping.type === "select") {
    const selectedValue = await field.inputValue().catch(() => "");
    const selectedText =
      (await field.locator("option:checked").first().textContent().catch(() => ""))?.trim() ?? "";
    const normalizedTarget = value.trim().toLowerCase();
    const normalizedValue = selectedValue.trim().toLowerCase();
    const normalizedText = selectedText.toLowerCase();
    if (
      !selectedValue ||
      (normalizedValue !== normalizedTarget &&
        normalizedText !== normalizedTarget)
    ) {
      throw new Error("select value could not be verified");
    }
    return;
  }

  const actualValue = await field.inputValue().catch(async () =>
    field.evaluate((node) => String((node as HTMLInputElement | HTMLTextAreaElement).value ?? "")),
  );
  if (actualValue !== value) throw new Error("text value could not be verified");
}

export interface FillPageFieldsOptions {
  /** Scope repeated controls to one observed official row. */
  scope?: Locator;
  /** Keep the same repeated row, but rediscover its conditional controls. */
  resolveScope?: () => Promise<Locator>;
  /** Evaluate against the applicant's selected branch before touching DOM. */
  isFieldActive?: (fieldName: string) => boolean;
  /** An active supplied answer must have a visible, verifiable control. */
  requireMappedAnswers?: boolean;
}

export async function fillPageFields(
  page: Page,
  mappings: Record<string, FormFieldMapping>,
  answers: Record<string, string>,
  profile: Record<string, unknown>,
  options: FillPageFieldsOptions = {},
): Promise<void> {
  const debug = process.env.CEAC_FILL_DEBUG === "1";
  installCeacPostbackMonitor(page);
  assertCeacPostbackHealthy(page);
  let scope = options.scope ?? page;
  mappings = Object.fromEntries(Object.entries(mappings).filter(([key]) =>
    options.isFieldActive?.(key) !== false));

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
      await scope
        .locator(combinedSelector)
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });
    } catch {
      // If nothing ever appears, fall through — the per-field visibility
      // check below preserves conditional skips while visible failures become
      // hard errors instead of being carried into the Next click.
      if (debug) console.log(`[fill] warm-up wait timed out — no mapping selector became visible`);
    }
    // Give CEAC's MSAJAX one more tick to finish binding any companion
    // controls (e.g. date dropdowns siblings of a parent select).
    await waitForAspNetPostback(page, 3_000);
  }

  for (const [fieldName, mapping] of Object.entries(mappings)) {
    assertCeacPostbackHealthy(page);
    const value = answers[fieldName]
      ?? (profile[fieldName] as string | undefined)
      ?? null;

    // An explicitly cleared text answer must clear the retrieved draft too.
    // Missing answers and empty choice values do not authorize a replacement.
    if (value === null || (value === "" &&
      (answers[fieldName] !== "" || (mapping.type !== "text" && mapping.type !== "date")))) continue;

    if (options.resolveScope) scope = await options.resolveScope();

    const selectors = mapping.selector.split(",").map((s) => s.trim());
    let filled = false;
    // A selector can match a hidden template or a disabled conditional field.
    // Those are legitimate skips; a visible field is different and must fail
    // closed if its value cannot be applied and verified.
    let sawVisibleCandidate = false;

    for (const selector of selectors) {
      try {
        const all = scope.locator(selector);
        const count = await all.count();
        if (count === 0) continue;
        const el = await findVisibleField(scope, selector, mapping);
        if (!el) continue;
        sawVisibleCandidate = true;
        if (debug) console.log(`[fill] ${fieldName} (${mapping.type}) → matched selector "${selector}"`);

        if (mapping.type === "radio") {
          // Radio: selector targets the RadioButtonList base. Append
          // [value="<val>"] so we target only the option with the
          // matching value. (The outer loop already split the selector
          // by comma so `selector` here is a single branch.)
          const radio = await findVisibleRadio(scope, selector, value);
          if (!radio) {
            throw new Error("radio option is unavailable");
          }
          await radio.check({ timeout: 5_000 });
        } else if (mapping.type === "select") {
          await selectCeacOption(el, value);
        } else if (mapping.type === "checkbox") {
          // Checkbox: interpret the value as a truthy/falsy flag. "Y",
          // "true", "1", "yes" → check; everything else → uncheck.
          const shouldCheck = /^(Y|1|true|yes)$/i.test(value);
          await el.setChecked(shouldCheck, { timeout: 5_000 });
        } else {
          const maxLength = await el.evaluate(node =>
            (node as HTMLInputElement | HTMLTextAreaElement).maxLength);
          if (Number.isInteger(maxLength) && maxLength >= 0 && value.length > maxLength) {
            throw new FieldLengthError(fieldName, mapping.label, maxLength);
          }
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

        if (options.resolveScope) scope = await options.resolveScope();
        await verifyFilledField(scope, selector, mapping, value);

        filled = true;
        break;
      } catch (err) {
        assertCeacPostbackHealthy(page);
        if (err instanceof FieldLengthError || err instanceof CeacError) throw err;
        if (debug) console.log(`[fill] ${fieldName} (${mapping.type}) selector branch failed`);
      }
    }

    if (!filled && (sawVisibleCandidate || (options.requireMappedAnswers && value !== ""))) {
      assertCeacPostbackHealthy(page);
      throw new FieldFillError(fieldName, mapping.label);
    }
  }

  if (options.resolveScope) scope = await options.resolveScope();
  await verifyPageFieldValues(scope, mappings, answers, profile, {
    requireMappedAnswers: options.requireMappedAnswers,
    choicesOnly: !options.requireMappedAnswers,
  });
}

/** Re-read after all postbacks, including those caused by later repeat rows. */
export async function verifyPageFieldValues(
  page: Page | Locator,
  mappings: Record<string, FormFieldMapping>,
  answers: Record<string, string>,
  profile: Record<string, unknown>,
  options: {
    requireMappedAnswers?: boolean;
    choicesOnly?: boolean;
    observeVerified?: (field: Omit<ReviewExpectation, "section">) => void;
  } = {},
): Promise<void> {
  const activePage = "mainFrame" in page ? page : page.page();
  for (const [fieldName, mapping] of Object.entries(mappings)) {
    assertCeacPostbackHealthy(activePage);
    if (options.choicesOnly && mapping.type !== "checkbox" && mapping.type !== "radio") continue;
    const value = answers[fieldName]
      ?? (profile[fieldName] as string | undefined)
      ?? null;
    if (value === null || (value === "" &&
      (answers[fieldName] !== "" || (mapping.type !== "text" && mapping.type !== "date")))) continue;

    const selectors = mapping.selector.split(",").map((s) => s.trim());
    let sawVisibleCandidate = false;
    let verified = false;
    for (const selector of selectors) {
      try {
        const candidate = await findVisibleField(page, selector, mapping);
        if (!candidate) continue;
        sawVisibleCandidate = true;
        await verifyFilledField(page, selector, mapping, value);
        if (options.observeVerified) {
          const control = mapping.type === "radio"
            ? await findVisibleRadio(page, selector, value)
            : candidate;
          if (!control) throw new Error("Verified control disappeared before review snapshot");
          const controlId = await control.getAttribute("id") ?? await control.getAttribute("name") ?? "";
          if (!controlId) throw new Error("Verified control has no stable review identity");
          const displayValue = mapping.type === "select"
            ? (await control.locator("option:checked").innerText()).trim()
            : mapping.type === "radio" || mapping.type === "checkbox"
              ? /^(Y|1|true|yes)$/i.test(value) ? "Yes" : "No"
              : await control.inputValue();
          options.observeVerified({
            fieldName, controlId, value: displayValue,
            ...(value === "" ? { allowEmptyValue: true } : {}),
          });
        }
        verified = true;
        break;
      } catch {
        assertCeacPostbackHealthy(activePage);
        // Try the next selector alias; a visible field is reported below if
        // none of the aliases can be verified.
      }
    }
    if ((sawVisibleCandidate || (options.requireMappedAnswers && value !== "")) && !verified) {
      assertCeacPostbackHealthy(activePage);
      throw new FieldFillError(fieldName, mapping.label);
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
