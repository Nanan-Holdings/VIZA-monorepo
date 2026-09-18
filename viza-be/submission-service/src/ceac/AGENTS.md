# CEAC DS-160 Automation Guide

Scope: this file applies to `viza-be/submission-service/src/ceac/**`.

## Purpose

This module owns the CEAC DS-160 runtime path: session bootstrap, CAPTCHA/start
gate handling, page detection, navigation, field filling, checkpointing,
diagnostics, `.dat` capture, CAPTCHA solving, and one-shot final submission.

## User Override

- 如果碰到captcha，则用TWOCAPTCHA API 通过这个测试。
- 我不想要用户做任何额外的事，自动提交会帮他们搞定所有的填写表单的事。
- Continue validating DS-160 changes with real Playwright runs when applicant
  data and service credentials are available. Iterate until the CEAC run reaches
  a confirmed submitted state, or pause and tell the user the precise external
  action/data needed.
- While Playwright is filling CEAC, compare official CEAC fields, validation,
  photo requirements, CAPTCHA/e-signature controls, and confirmation evidence
  with the VIZA frontend form and stored `visa_application_answers`. If the
  frontend contract is too broad, missing, or incompatible, update it and the
  normalization layer instead of silently inventing values in CEAC code.
- Stop automatic retries when the remaining task cannot be completed by the
  agent, such as missing truthful applicant data, a portal outage, unavailable
  2Captcha, a payment/finality step requiring applicant control, or an official
  page that requires user/operator intervention. Report the next manual step.
- After a successful CEAC live submission, record the verification method and
  ensure the frontend confirmation tab can show Chinese success UI with CEAC
  Application ID, confirmation number/reference, submitted timestamp,
  retrieval/status URL, and any stored proof artifact available.
- Before marking the CEAC flow verified, run the user-facing browser path:
  click the frontend submit/retry button, confirm the worker picks up the queue
  and the UI progresses, then preserve official trace/screenshot and DB result
  evidence. If the browser-click test is blocked, report the exact reason.

## Key Flow

1. `session.ts` creates a standard Playwright browser/session for compliant
   live assisted runs. `start-page-navigation.ts` owns the lightweight CEAC
   start-page navigation wait, and `start-page-location.ts` may select the
   CEAC location dropdown and dismiss the location modal.
2. `start-page-captcha.ts` solves the initial image CAPTCHA through 2Captcha.
   It preserves the applicant-selected post across retries and returns the
   resolved post for session recovery; never substitute a default embassy.
3. `pages.ts` detects the current DS-160 page.
4. `orchestrator.ts` fills mapped pages, uploads the applicant photo, and
   advances through final submission when supplied with signature data.
   `field-contract.ts` traces mappings to seed conditions and excludes stale
   inactive answers. Before bootstrap it also rejects recognizable input
   prompts in active answers, including optional fields, effective English
   aliases, and repeated rows. Report field names without answer values; a
   nonempty value or a passing prompt check does not establish factual truth.
   `repeat-groups.ts` preserves persisted row indexes;
   `repeat-browser-adapter.ts` discovers current DOM row scopes and Add/Remove
   controls, then re-resolves the same row before each field and after
   controller postbacks, rejecting changed row counts or identities. Final
   read-back also re-resolves every row. Static selector
   declarations are not evidence of official parity.
   `previous-travel-branch.ts` recognizes the observed four-question previous
   travel page without an ESTA question. Only a saved negative ESTA answer may
   be inactive, after the full page and absence of both controls and question
   text are verified. Visible questions, affirmative answers, incomplete pages,
   and unrelated missing controls retain strict filling and read-back checks.
   `review-verification.ts` captures the same application's visible official
   review values and screenshots into the private run directory. The
   orchestrator compares them against values read back from filled controls;
   missing, changed, ambiguous or unsupported review identities block final
   signing. Personal Information 1 and Passport must have been verified in the
   current run. A config flag alone is never a passed review comparison.
5. `final-submit.ts` owns the irreversible CEAC Sign and Submit action and
   final CAPTCHA solving.
   `signature-fields.ts` requires saved preparer Yes/No and conditional details
   before bootstrap; matches unique associated official field labels, scopes
   explicit NA choices to their own field, selects country before address
   fields, and verifies all values after postbacks. Never infer the preparer
   declaration or third-party details. Public form screenshots are historical
   label evidence, not proof of the current live DOM.
6. `final-submission-guard.ts` persists the per-authorization final-click
   fence through ownership-checked Supabase RPCs and reads the same table
   before bootstrap. Automatic retries must reuse the same authorization; an
   explicit resubmission must use a new one.
   A captured-application resume is narrower: it is enabled only by the
   server-only exact `DS160_RESUME_CAPTURED_JOB_ID` queue-job match, requires
   all three encrypted checkpoint fields to agree with the application row,
   requires no application-level final-fence attempt, and must verify the
   retrieved DOM's same Application ID before orchestration. Otherwise route
   to `action_required`; never create a new CEAC draft or repeat final click.
7. `photo-document.ts` selects the frontend-uploaded DS-160 photo document for
   the worker. Only when no application photo row exists may its owner-scoped
   metadata loader select the newest explicitly usable Universal Profile
   photo. Rejected or unavailable application uploads must not silently fall
   back to a profile photo. Download only the selected file.
8. `checkpoints.ts`, `artifacts.ts`, and `diagnostics.ts` preserve recovery
   metadata and screenshots.
   Public bootstrap failures retain a screenshot plus visible page/control
   metadata before closing the browser; never dump hidden input values,
   cookies or credentials into these diagnostics.
   `recovery-failure.ts` retains the latest captured-resume error instead of a
   stale queue reason, redacting known answers/secrets and excluding raw context.
   `recovered-application.ts` waits for an explicitly recoverable form page
   after Retrieve navigation, then verifies the captured official Application
   ID. Its browser regression in `__tests__/recovered-application.spec.ts`
   must reject transient/terminal surfaces and mismatched IDs.
   Captured resumes rewind through an observed official Personal Information 1
   link before refilling, so changes to earlier answers are not omitted when
   CEAC restores the draft at a later page.
9. `stop-at-sign.ts` is legacy; CEAC automation should continue through final
   sign/submit for one-shot submission.
10. `result.ts` returns typed success/failure/handoff payloads.
11. `proof-artifacts.ts` must only accept the submitted application's official
   confirmation surface after `resume-application.ts` retrieval. Do not treat
    the new-application security question page, recovery form, or generic
    "confirmation page" wording as proof; require the official Print
    Confirmation / Print Application / Email Confirmation controls before
    storing PDFs.
12. `start-location.ts` validates the applicant-selected China CEAC post code.
    Missing or unsupported posts must stop the run; never silently default a
    real application to another embassy or consulate.

## Validation

Run from `viza-be/submission-service`:

```powershell
npm run type-check
```

Then follow:

- `viza-be/submission-service/docs/ceac-smoke-test.md`
- `docs/prd-ds160-ceac-runtime-validation.md`

## Related Files

- `viza-be/submission-service/src/index.ts`
- `viza-be/submission-service/src/ds160-form-mappings.ts`
- `viza-be/submission-service/src/ds160-coverage-audit.ts`
- `viza-be/submission-service/src/ds160-completeness-verify.ts`
- `viza-be/submission-service/src/ceac/final-submit.ts`
- `viza-be/submission-service/src/ceac/__tests__/final-submit.spec.ts`
- `viza-be/submission-service/src/ceac/signature-fields.ts`
- `viza-be/submission-service/src/ceac/__tests__/signature-fields.spec.ts`
- `viza-be/submission-service/src/ceac/final-submission-guard.ts`
- `viza-be/submission-service/src/ceac/captured-resume.ts`
- `viza-be/submission-service/src/ceac/__tests__/captured-resume.spec.ts`
- `viza-be/submission-service/src/ceac/__tests__/final-submission-guard.spec.ts`
- `viza-be/submission-service/src/ceac/__tests__/orchestrator-final-submit.spec.ts`
- `viza-be/submission-service/src/ceac/__tests__/field-fill.spec.ts`
- `viza-be/submission-service/src/ceac/__tests__/pages.spec.ts`
- `viza-be/submission-service/src/ceac/photo-document.ts`
- `viza-be/submission-service/src/ceac/__tests__/photo-document.spec.ts`
- `viza-be/submission-service/src/ceac/proof-artifacts.ts`
- `viza-be/submission-service/src/ceac/__tests__/proof-artifacts.spec.ts`
- `viza-be/submission-service/src/ceac/__tests__/confirm-application.spec.ts`
- `viza-be/submission-service/src/ceac/__tests__/resume-application.spec.ts`
- `viza-be/submission-service/src/ceac/__tests__/session.spec.ts`
- `viza-be/submission-service/docs/ceac-smoke-test.md`
