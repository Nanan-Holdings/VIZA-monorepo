# DS-160 B1/B2 functional audit — 2026-09-28

Scope: the current VIZA B1/B2 application journey, including the form assistant,
manual form, persistence, review, document gates, and submission/status contracts.
The trigger was an SSN question repeating after the applicant answered `无`.
No applicant answers or successfully submitted applications were changed by this
audit. Browser mutations used synthetic data with external network writes blocked.

## Findings and repairs

| Finding | Repair and regression boundary |
| --- | --- |
| Short negative text did not deterministically select the official NA branch. | Schema-gated parsing accepts `无`, `没有`, `不适用`, and corresponding English responses; a successful save explicitly confirms the chosen branch and advances. |
| Ordinary number/date validation rejected legal sentinel answers, while some ordinary text fields accepted illegal sentinels. | Shared sentinel rules across assistant proposals, completion, final validation, field rendering, and review. Only fields exposing that official choice accept it. |
| Existing empty answer rows followed the insert path and could hit a unique-key conflict. | Compare-and-swap updates fill the empty row without overwriting a concurrent manual answer. |
| Repeated answer keys such as `field__2` were not resolved to their base schema field. | Resolve the schema and row-local controllers; give the model a scoped field key and persist to the current row, preserving the first row. |
| Historical assistant messages could contradict answers already changed manually. | Restore the current server question and reconcile manual drafts on the existing debounce cadence, preserving relevant server explanations and document gates. |
| A stale illegal NA answer could disable an input with no checkbox to clear it. | Unsupported sentinel values remain editable and incomplete; legal branches retain their clearable checkbox. |
| Save errors could repeat a question without explaining the failure. | Explain the failed save and request retry; never acknowledge or advance an answer that was not written. |
| Review could show stale translated values or date-format warnings for a sentinel. | Canonical sentinel answers take precedence over translated mirrors and use localized review labels. |
| Spouse/partner address has an ordinary `do_not_know` enum, distinct from a checkbox sentinel. | Exact declared options follow enum validation; deterministic option answers bypass vague-answer rejection. Both enum fields are covered, including rejection of undeclared NA values. |

## Evidence inventory

The public schema was read from production on the audit date: 337 rows, of which
331 are active and six are compatibility-only. The detailed branch inventory,
fixture, tests, and prior official-control evidence are linked in
[the branch audit](../../viza-be/submission-service/docs/ds160-b1-b2-branch-audit-2026-09-28.md).

The branch inventory contains 81 active conditional expressions and 53 fields
with an official NA/unknown choice. Its 22 groups comprise 20 repeatable groups
and two single-row explanations. The historical `specific_travel_plans` repeat
group is absent from the current schema.

| Functional area | Evidence used |
| --- | --- |
| Assistant parsing, next question, correction, provider failure, idempotency | Real service tests and actual turn-route integration tests with an isolated persistence boundary. |
| Empty rows and concurrent manual edits | Compare-and-swap service regressions; the browser's failure injection confirms no success acknowledgment or progress advance. |
| Manual entry, NA/unknown, country/state choices, conditional sections | Dynamic form tests, live-metadata branch tests, and browser interaction with the actual page and components. |
| Repeated rows | Row-specific service/model tests, completion tests, review tests, and the live repeat inventory. |
| Save-before-submit, refresh, manual/assistant synchronization | Page orchestration, form-draft tests, and browser reload of synthetic answers. |
| Review and official-value editing | Bilingual review localization tests, including stale translated mirrors and unknown dates. |
| Photos/documents, voice transcription, undo | Existing photo-contract/action tests, document policy tests, transcription-route tests, undo-route tests, and assistant component tests. These do not constitute a real microphone or real personal-document upload test. |
| Submission/status/artifact/ownership | API, reconciliation, evidence, cancellation, and read-only tests. Official runner regressions also cover resume, final fences, security-to-photo navigation, and recovery. |

## Browser method and limits

The isolated browser harness runs the actual long-form page, dynamic form,
review component, and assistant service. It loads the current public schema and
uses synthetic answers. Persistence, document services, and the external queue
are isolated test boundaries; no live CEAC application was created or submitted.

Browser evidence includes normal NA answers, unknown dates, illegal NA values,
failed saving, retry, and refreshing saved answers. Local harness diagnostics
are stored outside the repository and contain synthetic data only.
The browser also completed manual correction of an illegal employer NA value,
entered final review, and reached the submitted/confirmation controls through
the isolated queue boundary. This was a simulated submission, not a new CEAC
submission. The browser console showed no errors for that completed journey.

Passing local branch coverage is not proof that every cross-product of answers
has been accepted by CEAC's servers. Earlier official control snapshots and the
September 22 navigation proof remain dated evidence. No new all-branches official
submission claim is made, and physical microphone capture remains untested in
this audit.

## Verification record

- Runner: 134 tests passed, no failures or skips.
- Initial frontend sweep: 49 suites, 800 tests; two failures were investigated.
  The state-selector test used an obsolete `combobox` locator after the existing
  control became a dialog-trigger button; its corrected accessibility locator
  passed. The save-orchestration case hit its five-second timeout under full
  parallel load; both suites passed with two workers and a 15-second limit.
- Final main frontend sweep: 50 suites / 828 tests passed with two workers.
- Additional contract and final changed-file recheck: 8 suites / 107 tests passed
  (includes two suites already counted in the main sweep). This adds official
  proof, U.S.-contact, form-utils, bilingual, and schema/UI contract checks.
- Assistant service after save-failure feedback: 281 tests passed.
- Final enum-boundary sweep: 7 suites / 382 tests passed, including 282 service
  tests. A delayed input-otp selection callback was drained during test teardown
  to avoid a jsdom teardown race. The browser showed the spouse-address
  `不知道` option selected, no field warning, and 100% required-field completion.
- `npm run type-check`: passed. `npm run lint`: zero errors, 57 existing warnings.
- `git diff --check`: passed.
- Upload preflight: 1,975 files; no environment files, MCP config, local browser
  evidence, build caches, or backend services in the Vercel upload list.
- Release identity verified using `/v2/user`: `nananviza2016-8879`, organization
  email `nanan.viza2016@gmail.com`; project `viza-internal`, team
  `viza-gmail-s-projects`.
- The first release build was canceled before promotion when the enum boundary
  was found; it was not used as the accepted production release.
