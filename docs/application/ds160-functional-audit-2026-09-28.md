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

## Production release verification

- Accepted release: `dpl_CGY6MotsjPMqfVocgm7REJyzuaNR`, state `READY`, production
  alias `https://app.viza.it.com`.
- The deployment API confirms release commit
  `344b0c0d27a1844e2041b7eaf350412c1a7d5482` and organization commit author
  `viza-gmail <nanan.viza2016@gmail.com>` on project
  `prj_GUFPqF0Ir6oWOsxMwX9ezfi3bJ7W`.
- A read-only Chrome check of the existing draft on the production alias loaded
  without the application-error screen or browser console errors. The assistant
  asked for the next incomplete employer field instead of repeating the already
  answered SSN question. The unsupported employer sentinel no longer counted as
  complete, and its input was enabled and not read-only.
- No live applicant answers were edited during this check, and no official
  submission was initiated or repeated.

## Follow-up: duties wording and captured-draft retries

The applicant's follow-up exposed two gaps outside the earlier NA-answer fix:

- `Briefly Describe Your Duties` was translated with an extra Chinese
  "if applicable" suffix. CEAC requires the control in the visible current
  employer/school branch, including Student; retired, homemaker, unemployed,
  and empty occupation hide that branch. Removed the misleading suffix and
  retained the required/visibility rules. The existing official browser
  evidence contains the missing-duties validation error.
- The runner treated any captured official Application ID as a possible final
  submission and allowed continuation only through an operator's exact-job
  environment override. The ordinary retry RPC creates a new queue row, so its
  empty checkpoint further obscured the previous draft's recovery information.
  A read-only check of the affected draft found a complete encrypted recovery
  checkpoint, zero final-submission attempts, and a blocked recovery state.

Normal retries now read application-wide final-attempt/success evidence and
validate the current or historical same-application encrypted checkpoint before
opening CEAC. An unsigned draft uses Retrieve and must pass the existing
official identity and page checks. Transient pre-final failures reuse this
draft within the existing attempt limit. Official input rejection and portal
gates wait for correction; missing recovery secrets, mismatched IDs, and any
final-attempt record cannot cause a fresh draft or a repeated final click.

The submission UI uses an explicit localized retry entry instead of presenting
this internal recovery state as a CAPTCHA/manual-verification task. It routes
through the parent's save-before-submit callback when available. The shared
atomic enqueue RPC still isolates applications and prevents duplicate active
jobs, as in the other supported submission flows. Confirmed successful DS-160s
retain the separate owner-authorized new-application flow, which copies answers
to a new draft and preserves the earlier result.

Read-only execution of the new retry planner against the affected draft and an
empty retry-row input returned `resume / captured_application_checkpoint`.
An earlier transient database read failure returned a recovery stop and did not
open CEAC; the subsequent independent read succeeded. No applicant answers or
official application were changed by these probes.

The cloud rollout inspection also found that the retained legacy worker had
neither DS-160 live flags nor CEAC Browserbase flags in its machine environment
or secret names. Its defaults would reject live requests before CEAC. The
legacy deployment configuration now explicitly enables the already-authorized
live-assisted flow, preserves review and final-submit guards, and uses the US
Browserbase proxy with a bounded 1,800-second session. The retained shared
2-CPU/4-GB machine, 120-second idle exit, queue routing, and zero minimum
running machines remain unchanged.

Follow-up checks: 79 frontend tests across translation, recovery card, enqueue,
page orchestration, navigation, and reconciliation passed; the existing retry
and separate new-application API suites passed 31 tests. Browser checks used
the actual application page/components with an isolated in-memory fixture:
the Student duties field had no misleading optional suffix, and the retry
entry reached the simulated queue/result without console errors. This is
synthetic browser evidence, not a new official CEAC submission.

The final read-only production replay exposed an empty-string legacy `.dat`
path. Treating that optional artifact as malformed identity falsely blocked
a valid checkpoint. A regression now preserves `resume` for that exact shape;
14 planner tests and the final 27-test guard/config/readiness set passed.

The runner image built from `26b4942d` was released to the actual DS-160
claimant, `viza-prod-submission-legacy`, retained machine `7849e2ef6ddd28`:
`sha256:5aa896d4fcbbc7696b038574b72f1a27291548ab8da1514e167e3abf2fb8c71d`.
Pre-update readiness reported no active work or protected sessions. After the
update, `/ready` confirmed database reachability and worker startup; startup
logs confirmed live mode, headless mode, and the review/final-submit flags.
Machine readback confirmed the US Browserbase proxy, concurrency one, unchanged
shared 2-CPU/4-GB sizing, and 120-second idle exit. It subsequently stopped
automatically. No additional retained machine was created.

An actual production retry click did not enqueue a job. A visible duties
input contained a not-applicable answer; the final production validator
identified Employer Name as the current blocking field. The click exposed a
UI error-lifetime bug: the parent switched the status card into its starting
view, unmounting the card whose local error state was used for failures. Parent
validation errors were hidden while the prior submission result was shown.
The page now retains the parent error outside the transient card and includes
the rejected field labels in the retry message. A full ApplicationPage browser
fixture reproduced the saved-result/loading/remount sequence: an invalid
duties sentinel produced a visible correction message with no enqueue, then
editing the synthetic duties answer and retrying saved the answers and produced
exactly one simulated submission request and a completed result. Browser
console errors were empty. The final status-card/navigation regression ran
36 tests successfully, and frontend type checking passed.

Final frontend release: `dpl_2EF4rLgaMfbuqTJtX4CwUSA3GwED`, `READY`, production
alias `https://app.viza.it.com`, code commit `6b597c3a`. The organization CLI
identity and commit author were verified, and the final upload dry-run had
1,976 files with no forbidden environment/config/cache/evidence paths.
On the actual saved application, Chrome displayed the corrected duties label,
an enabled retry button, and after the retry click the persistent localized
error `请先补齐或修正以下信息：雇主名称。` with no browser console errors. The
existing recovery result remained visible. This confirms the correction path;
it is not proof of a new official submission. The local isolated test server
was stopped after verification.

## Live retry monitoring and comparison evidence follow-up

The applicant's 17:48 UTC retry created a pending job, but did not start the
stopped legacy machine. The frontend passed `united_states` to a Fly target
resolver that did not recognize that alias, and the generic URL fallback could
select the Vietnam endpoint. DS-160 now uses an explicit legacy wake helper;
reusing a pending DS-160 job wakes that same job, while processing jobs are not
woken again. Production legacy app and URL values were verified. All 42
focused frontend tests, type checking and lint passed (no lint errors).

The existing machine was started at 17:51 UTC for the already queued run.
CEAC reached Retrieve Application, then timed out without reaching a form page.
The original screenshot existed only in a deleted temporary directory, so the
exact official validation text from that attempt is unknown. Historical errors
are not evidence of the current failure. Retrieve now reads official inline
validation after each monitored postback and reports value-free credential
categories as structured validation failures. Its 23 focused tests passed.

The failed job became pending but retained its claim lease. The immediate drain
therefore found no claimable job; no periodic drain existed to retry after lease
expiry, while the pending row prevented idle shutdown. Cleanup now closes the
browser, stops renewal, and releases only the pending DS-160 row belonging to
that exact owner and claim timestamp. Eleven lease/lifecycle tests passed.
The live machine reported no active or protected work and was stopped at
18:10 UTC while the fixes were prepared.

The worker now encrypts its exact stored answer rows, original and normalized
maps, and profile fallback before official navigation. It also encrypts and
uploads allowlisted official review snapshots, read-back expectations, review
diffs and failure screenshots before temporary cleanup. Review evidence is
required in private storage before reserving the final submission action.
Queue payload audit references include storage paths and ciphertext hashes;
upload failures retain local diagnostics and remain explicitly incomplete.
Three artifact regressions passed. The storage bucket is private. Review
artifacts are pre-sign evidence, not proof of official submission or of complete
coverage of every official field.

An additional protected local baseline contained 349 answer rows, with no answer
updated after the first run started. It was captured after startup, so it is
not asserted to be the exact first attempt's in-memory input. A post-success
comparison must use the new pre-navigation snapshot, official field evidence,
branches, repeat indexes and NA states, and explicitly report unsupported,
missing or ambiguous evidence rather than declaring unconditional parity.

Release verification: frontend `dpl_HaqFJqwYbhBgWW1SvNgDfs5RvF9a` is READY at
`https://app.viza.it.com`. Runner image built from the final working content
committed in `911fed7d` is
`sha256:eb609f95a2c391f2f39861a703c13da545e271a4e73004a06bfe65905aa32598`.
The retained machine was updated while stopped. At 18:35 UTC an actual
production browser click woke it automatically; queue readback proved that
the original job was reused, with no extra queue row. The UI displayed the
localized running state without an alert. Its progress percentage is not an
official CEAC completion measurement.

The second attempt hit a CEAC start-page timeout at 18:37:23 UTC. Encrypted
input and diagnostic artifacts were uploaded, and their paths and hashes were
persisted with `evidenceUploadFailed=false`. The corrected drain claimed the
same row automatically and began attempt three at 18:37:27 UTC, proving that
the retry lease no longer strands this runtime-failure path. No official
success has been claimed by these observations. Five-minute thread monitoring
continues the result check and the requested post-success comparison.

At 18:39 UTC attempt three reached Retrieve and CEAC explicitly rejected the
surname. Its sanitized validation list contained only `Surname does not match.`
The job became `ds160_blocked / portal_action_required`; there were zero final
submission attempt records for this application. Private audit upload succeeded.
The machine automatically stopped by 18:41 UTC. Monitoring was paused at this
terminal data/recovery blocker. The user was asked to distinguish a new
submission based on the current frontend answers from comparison of their
separate September 20 submitted application; those records must not be swapped
silently. No post-submission parity conclusion is available for this failed run.
