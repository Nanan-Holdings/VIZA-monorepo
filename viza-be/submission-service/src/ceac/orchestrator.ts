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
            await recordSectionCheckpoint(page, {
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
              `[orchestrator] Photo upload did not complete (${reason}) — falling back to handoff_ready`,
            );
            // Fall through to the handoff_ready stop below
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
          await certifySignAndSubmitPage(page, path.join(outputDir, "sign-certify-dom.json"));
          await advance(page, {
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
        throw new Error("Unexpectedly reached confirmation page — submission should not have occurred");
      }

      // Fill fields if we have mappings for this page
      const mappings = currentPageId !== "unknown"
        ? PAGE_FILL_MAP[currentPageId]
        : undefined;

      if (mappings) {
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

async function certifySignAndSubmitPage(page: Page, diagnosticPath?: string): Promise<void> {
  if (diagnosticPath) await dumpSignCertifyDom(page, diagnosticPath);
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const checkbox = checkboxes.nth(i);
    const visible = await checkbox.isVisible().catch(() => false);
    if (!visible) continue;
    const checked = await checkbox.isChecked().catch(() => false);
    if (!checked) {
      await checkbox.check({ force: true, timeout: 5_000 }).catch(async () => {
        await checkbox.click({ force: true, timeout: 5_000 });
      });
    }
  }

  await page.evaluate(() => {
    const radioOrCheckboxes = Array.from(
      document.querySelectorAll('input[type="checkbox"], input[type="radio"]'),
    ) as HTMLInputElement[];
    for (const input of radioOrCheckboxes) {
      if (!input.checked) input.checked = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }

    for (const el of Array.from(document.querySelectorAll('input[type="checkbox"]'))) {
      const input = el as HTMLInputElement;
      if (!input.checked) input.checked = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  }).catch(() => undefined);

  await page.evaluate(() => {
    const maybeValidNavigation = (window as unknown as { ValidNavigation?: () => unknown }).ValidNavigation;
    if (typeof maybeValidNavigation === "function") maybeValidNavigation();
  }).catch(() => undefined);

  const next = page
    .locator('input[type="submit"].next, input[type="submit"][value^="Next:"], input[id*="UpdateButton"]')
    .first();
  await next.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
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
]);

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
