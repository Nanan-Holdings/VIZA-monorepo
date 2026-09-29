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

The user subsequently chose to preserve existing records and create a fresh
application from the current frontend data, submit it, then compare its official
fields. The copy source is the blocked application's 349 current saved answer
rows and its owner-scoped document references, not the separate September 20
successful application. A fresh application must not inherit old CEAC recovery
credentials, queue claims or final-submission authorizations. Copy verification,
new submission and post-success comparison remain pending until their actual
results are recorded below.

Read-only preflight of the current source against attempt three's encrypted
input snapshot found 349 unique raw text answers and 378 derived keys. Raw and
derived maps matched exactly, with zero added, dropped or changed raw answers.
Twelve input keys intentionally became explicit NA/unknown flags; no repeat
rows or nonempty inactive conditional answers existed in this record. This is
input integrity evidence, not an official review comparison. The source's one
application document is a passport copy; its photo is an existing same-owner
Universal Profile JPEG (95,384 bytes), selected by the normal photo resolver.
The object exists; this metadata check does not certify official photo acceptance.

The existing new-application API now accepts an explicit `restart_unsigned`
intent for an owned terminal DS-160 attempt. It rejects active or unclassified
jobs, live/ambiguous leases, final-submission fences and official success;
expired terminal leases and draft `.dat` backups do not imply submission. It
copies current answers and document references without copying CEAC recovery
material. Existing or concurrently populated drafts must match both the source
answers and documents before reuse. Twenty-four focused route tests passed;
frontend type checking and lint passed with no errors. Production creation and
the new official run are still separate verification steps.

Production release `dpl_2ejY4N2Ki5Yk9TcY26va1N9QTyPu` (commit `a84c954e`)
became READY at `app.viza.it.com`. Normal applicant authentication followed by
the explicit restart API returned HTTP 201 and new application
`ef128413-2750-4b0d-b5a8-931b6728e453`. A scoped database comparison proved
349 source and 349 target answers, with zero missing, added or changed values.
Ownership matched; the new row had no old CEAC ID, `.dat`, confirmation,
queue rows or final-submission attempts. Its application document reference
was copied. The authenticated production browser loaded the new application
without alerts, completed its readiness check and clicked the actual Submit
button at 19:20 UTC. Job `f279755a-926b-4cdb-b6fb-c9b37c3ad0d1` was created
and the stopped worker woke automatically. Run `ds160-live-mulmujt2-y0mkof`
started at 19:20:46 UTC, selected the saved BEJ post and reached start-page
CAPTCHA handling. This establishes a real new run, not official submission
success. The five-minute monitor now tracks this new application and job only.

The new worker's encrypted input snapshot independently matched both source
and new application: 349 stored rows, 349 branch-answer keys, 378 derived keys,
and identical profile fallback. No old CEAC recovery metadata appeared in the
snapshot. At 19:25 UTC the first fresh run stopped on an official form HTTP 403
while filling Personal Information 1. Its input and diagnostic artifacts were
persisted privately with no upload failure; final-signature attempt count was
zero. The worker subsequently shut down normally. An authorized normal retry
request at 19:29:56 created job `a0458847-e1f4-4046-aa55-3d35f2a8e989`, preserved
the captured CEAC identity and superseded only the prior queue row. Run
`ds160-live-muln6jti-q0zyz5` passed the start-page verification and successfully
retrieved the same official draft at 19:31:37, then resumed Personal Information
1. This recovery proves the new draft's retrieval identity was saved despite
the earlier rejected form update; it does not yet prove final submission.

Structural coverage of this new snapshot against the current 337-field DS-160
seed/contract found zero unconsumed active seed fields and zero directly
unmapped active raw DS-160 fields. The 349 raw rows include 90 bilingual aliases,
five profile-fallback fields, 15 NA/unknown control pairs, seven inactive
branch/age-gated fields, and 117 historical or other-schema keys outside the
current DS-160 seed; these categories are not an additive count of official
questions. Raw row equality must not be reported as 349 official fields matched.
The social-media helper controls and secondary-phone aliases have structural
mapping but still require this run's official DOM/review evidence before any
parity claim. No personal values were included in this coverage report.

At 19:54:43 UTC the same-draft recovery stopped at Work/Education Previous.
CEAC rejected missing institution/address/course and attendance dates. The
job settled as `ds160_blocked / portal_action_required`, its encrypted input
and official diagnostic evidence uploaded successfully, and the machine stopped
automatically. There were zero final-submission fences. The exact cause is
under investigation; historical school details from another application must
not be substituted for this run's current saved answers.

A separate semantic check of active bilingual values found one identifier
conflict between `national_id_number` and its localized companions. This is
an unresolved pre-signing issue, not proof of official parity. Further retries
must use a corrected and verified input snapshot after resolving both issues.

The identity mismatch was a UI/runtime precedence bug: entry and bilingual
review preferred historical localized copies, while the CEAC runner consumed
the canonical answer. Commit `94d3763b` classifies the DS-160 national ID as a
literal structured field. Seventy-four focused schema, input and review tests
passed; frontend type-check and lint passed (57 existing warnings, no errors).
Production release `dpl_EZeowohiqJ9EPCNQAZ748d3Qds9R` became READY. A production
browser reload of the new application verified that the old displayed mirror
was replaced and no page-load error or alert appeared. No applicant identity
value was changed by this repair. All three stored variants differ from the
number supplied earlier in this conversation, so factual confirmation remains
pending rather than silently selecting one.

The education snapshot contains `has_attended_education=no` but the historical
runner alias `has_other_education=yes`, with no school-detail answers. The
runtime therefore opened an empty school branch instead of following the
current frontend controller. A correction is in progress. The user was also
asked whether the earlier supplied school history applies to this new current-
data application. Official retries and the monitor are paused at these factual
conflicts; existing records, the current CEAC draft and final-signature fences
are preserved.

The bounded follow-up scanned all 349 snapshot rows against 22 key aliases,
71 language-pair groups, 22 date-splitting rules and 52 NA/unknown rules. It
found only the education boolean conflict and the two national-ID mirrors
described above; no other enum, date-component or NA-marker conflicts were
found. Ordinary source-language/English prose differences were excluded as
translations. This checks this application's transformations, not all possible
DS-160 answers or official branch behavior. The deployed browser also confirmed
that review contains the same current ID as entry and no longer contains the
old mirror, without exposing either value in the diagnostic output.

Commit `f5799f34` fixes the education failure in the shared derivation layer:
every present canonical source overrides its mechanical legacy alias, while
target-only historical drafts remain compatible. Filling and official read-back
now receive the same derived branch answer; no special education override or
invented school record was added. The final combined derivation, real-browser
fixture filling, provider lifecycle, session and lease suite passed 83/83,
and submission-service type-check passed.

Measured filling took 24 minutes to reach previous education, leaving several
official pages still to complete. The same release changes CEAC's validated
provider timeout from a hard-coded 1,800 seconds to a 1,800–3,600-second range,
with both legacy deployment duration settings at 3,600 seconds. Other countries'
defaults are unchanged. Image
`sha256:55042aea6551f3e43e8f1ec016e71013a2da664b4d66faafd655c7b4b5728703`
was built and applied to the stopped legacy machine. Read-back confirmed the
new image, both 3,600-second settings, concurrency 1, two shared CPUs, 4 GiB,
120-second idle exit, disabled automatic start and stopped state. No new
official attempt was launched while the factual questions remain unanswered.

An additional repeat-adapter regression run exposed a stale test-only phone
control name. Its fixture and exact-selector assertion now use the already
verified `tbxAddPhoneInfo` mapping instead of historical `APP_ADD_TEL`; no
production selector or validation was relaxed. All 15 repeat-adapter tests
passed. Together with the 74 frontend and 83 runner checks, this repair has
172 passing focused tests, plus production browser entry/review verification.
The corrected full official run and post-submission field comparison are still
pending the applicant's two factual answers.

The applicant subsequently confirmed both requested facts. The identity was
saved through the authenticated production form and read back successfully;
an owner-, status- and final-fence-guarded update synchronized its literal
companions and the confirmed prior-school history. The school's public address
and postal code were checked against its official site. Read-back found 371
answer rows, matching identity copies, both education controllers set to yes,
and the confirmed attendance dates. The production browser showed 126/126
required fields complete. No new official retry or final signature was started.

The subsequent full browser review exposed additional material conflicts
between given/native names, U.S. address geography, current occupation and
school/employer data, home-address completeness, and the earlier declared
travel history. These were not covered by the preceding mechanical alias,
enum and date-component audit. The user received one bundled factual question;
the earlier successful application's answers were not silently substituted.
The existing new CEAC draft and stopped worker remain preserved, and monitoring
remains paused pending the corrected facts. Required-field completion is not
factual verification, and no official field-parity or submission-success claim
is supported yet.

An independent read-only cross-field check of the corrected 371 stored rows
(406 derived keys, against the current 337-field contract) found no further
clear conflicts in travel-date order, passport issue/expiry dates, birth data,
nationality relationships or the inspected negative branches. This narrows
the pending factual clarification; it is not CEAC read-back evidence.

The browser also exposed a retry dead end: `portal_action_required` rendered
the manual-verification panel even though no corresponding manual action
existed. Its only continuation button was disabled because `manualAction` was
null, while the ordinary guarded retry callback was not exposed for that
state. The repair exposes the ordinary guarded retry for an evidenced CEAC
form-validation failure only after a valid manual-action response confirms no
pending task for that job. Missing/malformed responses and job changes cannot
reuse the previous empty result; real CAPTCHA tasks and final-submission
recovery retain their separate paths. No manual action or successful official
result is fabricated to unblock it.

The focused recovery-card, retry API, queue-contract and status-route suites
passed 99/99. Frontend type-check passed, and full lint had no errors (57
pre-existing warnings); the final changed-file lint likewise had no errors.
Deployment and production browser verification are recorded separately below.

Production deployment `dpl_GZH6ouj5DGD1DnJHdLCyj2RZPTKN`, release commit
`1875802a`, reached READY and was aliased to `app.viza.it.com`. The organization
CLI identity, linked project/team and release author were verified; the final
dry upload included 1,974 files and no environment, MCP, browser-evidence,
build-cache or backend files. The authenticated production application loaded
the corrected card: the correction-retry button was enabled, the obsolete
disabled manual-continue button was absent, and no nonempty alert appeared.
The button was not clicked while the factual question was pending. Post-smoke
database checks still showed two historical queue rows, zero final attempts,
and 371 answers. This verifies the repaired UI entry, not a completed official
retry or field-by-field submission comparison.

## 2026-09-29 confirmed corrections and connection recovery

The applicant answered the outstanding name and factual confirmation. An
owner-, application-status-, answer-version- and final-fence-guarded update
synchronized 120 answer rows and their localized companions; read-back found
no differences. The current draft contains 380 answer rows. Production browser
review showed 127/127 required answers complete and removed the superseded
name, address and occupation values. The intended-travel branch remains No:
knowing the intended hotel does not establish concrete flight arrangements.

The first real correction-retry click failed before queue creation because
Supabase Data API returned `PGRST002`. PostgREST logs recorded successful schema
cache loading at 06:07:36 UTC; a bounded REST read subsequently returned 200.
The direct database connection remained available. The optional GitHub
self-heal workflow was manually disabled and did not recover this incident;
neither its settings nor the database were restarted during this investigation.

The normal authenticated retry then started run
`ds160-live-muma8gf6-9zop7v` at 06:15 UTC. CEAC's public start page explicitly
returned `Sorry, you have been blocked`; no official form or final signature
was reached. Its encrypted input artifact hash was verified. All 380 stored
rows were captured, with no missing, extra or duplicate keys. Three country
display values changed after capture, but both versions derived to the same
416 effective CEAC keys. This is input consistency, not official field parity.

The legacy runner was already using Browserbase with a U.S. proxy. A bounded
local headless Chrome start-page check was also blocked. An isolated public
start-page check using the existing Browserbase U.S. region with proxy disabled
reached the real CEAC form; its provider session was closed in `finally`.
Only `CEAC_BROWSERBASE_PROXIES` was changed to `false` on the stopped production
legacy machine. Read-back confirmed unchanged image, CPU/memory and services,
concurrency one, a 3,600-second session bound and 120-second idle exit. The
checked-in deployment template still has proxy enabled; this runtime override
must be reviewed before a later deployment replaces it.

At 06:31:54 UTC the actual production Submit button created a guarded recovery
job, and run `ds160-live-mumatukc-j1q63w` started at 06:32:04. The same VIZA and
CEAC draft were retained, the previous queue row was superseded, and the
existing final-action fence remained empty. No custom queue transition or
recovery-record deletion was used. Official submission and the complete
post-submission comparison remain pending this run's evidence.

At 06:33:39 UTC the worker verified retrieval of the same captured CEAC draft;
at 06:33:40 it began Personal Information 1. The queue remained processing
with an actively renewed lease. This confirms the direct connection recovered
past the previously blocked start page, not that final submission succeeded.
The existing thread monitor was resumed for this exact queue/run and will
notify only meaningful progress, a failure, a required fact or the final
verified comparison.

## 2026-09-29 recovered-draft checkbox failure

The first two attempts of that recovery job passed Personal, Travel and
Previous U.S. Travel but failed when filling the home state/province.
The hash-verified encrypted official evidence showed that the recovered draft
still had its state and postal-code Does Not Apply checkboxes selected, which
disabled both text controls. Current stored and derived answers contained
explicit text values with the companion flags false. Filling the text before
clearing the restored checkbox state therefore failed before the normal later
checkbox mapping could run. This was an ordering bug, not missing applicant
data. The third bounded attempt stopped earlier on a CEAC postback timeout.
All three ended before a final-signature attempt.

The repair clears the uniquely mapped NA/Unknown companion before writing an
explicit current text/date value, waits for the official postback, resolves
replaced controls again, and verifies that the checkbox cleared. It does not
rewrite applicant answers or infer a replacement for missing/NA answers.
Standalone final readback still uses the original derived answer map.
The field-fill browser fixture suite passed 20/20, including stale address
checkboxes, delayed DOM replacement and absent answers; type-check passed.
Deployment/readiness configuration checks passed 7/7. The checked-in legacy
configuration now preserves the already-verified direct U.S. Browserbase route.

At 07:04 UTC the prior worker had no active work or protected browser sessions;
two deployment-readiness checks passed and the machine was stopped. A new
ordinary retry was created at 07:08:36 before the repair was released. It woke
the unchanged worker image and retrieved the same official draft at 07:10:46.
Publication is deferred while this new job owns an active lease. No active
job is interrupted or manually unlocked to deploy the fix, and no official
success or complete field parity is claimed from the local tests.

The same investigation found that ordinary failed/blocked terminal rows kept
their previous 15-minute lease even after browser shutdown because cleanup
only released pending retries. The repair preserves owner, claim timestamp
and status predicates and permits terminal release only after browser close,
renewal shutdown and a fresh application-wide retry-plan check proves zero
final attempts and no official success. Unreadable or ambiguous evidence
retains the lease. The focused lease suite passed 13/13 and type-check passed.
Guard-initialization and configuration-blocked early returns outside this main
finally path were not changed. Existing live leases are not cleared manually.

An additional 44/44 integration regressions passed across ASP.NET postback
handling, repeated-row browser filling, persisted retry planning and durable
final-submission guards. The combined focused checks therefore passed 84/84.
