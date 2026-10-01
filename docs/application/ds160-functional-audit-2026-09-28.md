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

Release commit `4ecf47f9` was authored with the verified VIZA organization
identity. A build-only remote Fly build compiled successfully and pushed
`registry.fly.io/viza-prod-submission-legacy:ds160-4ecf47f9edd6196bf22d1cb03020b91bc6e935ef`
with immutable digest
`sha256:a49ae1de144f5e4e707023bb7e5e2973b93739b64ff23f17f209e647f1fb1a1b`.
This did not restart or update the production machine. The 07:08 retry's first
attempt reproduced the same stale home-state failure at 07:19:11 and its
second bounded attempt began at 07:19:19. Installation of the prepared image
still requires an idle worker and fresh safe-deployment checks.

Post-success comparison preparation confirmed that the runner saves encrypted
input snapshots, verified field/control observations, official Review JSON and
screenshots, expectations and a review diff before final signing. These can
establish the registered active mappings and Review-rule coverage. They cannot
alone establish every printed application field: the repository currently has
no field-by-field Print Application PDF parser. After a verified success,
retrieve `applicationPdfStoragePath` or use the authenticated DS-160 proof
recovery endpoint to capture Print Application without signing again. Report
matched, differing and uncovered fields separately; a Confirmation PDF is not
a replacement for that comparison.

At 07:39:20 UTC the third old-image retry ended on the same home-state error;
the application-wide final-attempt count remained zero. The worker stopped
automatically when idle. With no pending/processing queue jobs, it was briefly
started for two fresh `/deploy-ready` checks, both reporting zero active work
and no protected sessions, then stopped again. The prepared immutable image
was installed on the same retained machine with `--skip-start`. Read-back
hashes confirmed identical environment, guest and service configuration;
only the image changed. Direct U.S. Browserbase, concurrency one, two shared
CPUs, 4 GiB memory and the 120-second idle exit remain unchanged. A cold-start
smoke of the new image returned `/health` OK and `/deploy-ready` safe with zero
active work. The previous failed row's lease expires at 07:53:56 UTC; no
manual lease clearing or premature official retry was performed.

The authenticated production page still displayed an old submitting state
until an intentional refresh. After loading, it showed 127/127 required items
complete and an enabled Submit entry. No answers were edited and no submit
was clicked while the old lease remained. By 07:49 UTC the repaired worker
had automatically returned to the stopped state after its cold-start smoke,
confirming idle cost cleanup. Live validation of the repaired address sequence
and final official submission remain pending the next guarded retry.

After the old lease naturally expired, the exact application had no active
sibling and zero final-attempt records. The latest encrypted input snapshot's
hash and scope were verified in memory; all 380 saved rows still matched the
database exactly. At 07:57:33 UTC the actual production Submit button created
the next guarded recovery queue, superseding the failed row. The repaired
worker began run `ds160-live-mumdvzlh-ihhrwf` at 07:57:43. The UI showed the
submitting state and the database confirmed processing; this is evidence of
dispatch and worker pickup, not final official success. No answer or recovery
identity was changed, and no new official draft was requested.

Live repaired-run verification: `ds160-live-mumdvzlh-ihhrwf` entered
Address and Phone at 08:07:30 UTC and advanced to Passport at 08:11:18.
The former home-state NA failure did not recur; this is the first live proof
that the repaired ordering passed the affected page. The same queue remained
processing with a renewed lease and zero final-attempt records. Submission
and the full post-submission comparison are still pending.

At 08:14:16 UTC the same repaired run reached U.S. Contact. Its attempt stopped
at 08:14:34 with a 5-second `setChecked` timeout on the organization-unknown
control. The sanitized Playwright trace recorded a completed click and a
re-resolved unchecked checkbox. The hash-verified private official screenshot
likewise showed the organization checkbox clear and its text input enabled,
with no final-signature attempt. This is a postback/action acknowledgement
timeout after the intended checkbox change, distinct from the earlier disabled
address input bug. The existing bounded retry recovered the same draft in a
second run at 08:16:14; no active lease or answers were changed manually.
Any timeout reconciliation must first run the existing gate-aware postback
wait and read back the exact unchecked control; it must not repeat the click
or ignore an official gate, a still-checked/missing control or another error.

The second attempt reproduced the same organization-unknown click timeout at
08:30:52 UTC, before any final attempt, and the bounded third attempt started
at 08:30:56. The prepared repair catches only Playwright `TimeoutError`, then
uses the existing gate-aware postback wait and exact unchecked readback without
clicking again. Gate errors, non-timeout failures and still-checked controls
continue to stop filling. The final field-fill, ASP.NET and repeated-row suites
passed 51/51; type-check and diff whitespace checks passed. Coverage includes
a fully intercepted six-second document POST in real Chromium and a separate
deterministic acknowledgement-timeout case, including single-click assertions.
The slower-postback fixture deliberately accepts either prompt acknowledgement
or Playwright timeout, since that browser timing varies; both must wait for and
verify the same replaced official controls. No real portal traffic is generated
by these fixtures. This repair is not yet installed into the active worker.

The organization-authenticated build-only release completed for commit
`0e114970c6d0c35fc6372c4be2e2d12c3e992a64`, producing immutable image digest
`sha256:7a839d0277f13b1e7c6439436587fe517759f5c1847132ab46ca8df3bbdf7d0c`.
It is prepared for installation after the current bounded attempt finishes;
building did not restart or update the running worker. At 08:40 UTC the exact
queue was still processing with a renewed lease, no active sibling and no
final-attempt record. The monitor retains the pending image and requires fresh
deployment-readiness checks, unchanged runtime configuration and normal
same-draft recovery before using it. Final submission and official field parity
remain unverified.

The third attempt advanced through U.S. Contact to Family Relatives at
08:48:50 UTC, Present Work/Education at 08:50:05 and Previous Work/Education
at 08:52:58. No final-attempt record existed. Do not interrupt this live
attempt solely to install the prepared timeout-reconciliation image.

Production UI observation at 08:53 UTC reproduced a contradictory status:
the same card showed an active submitting indicator and a cloud-browser
startup-failure/retry message while the exact queue remained processing with
a renewed lease. The queue still retained the previous attempt's timeout
payload and run identifier. This UI is not evidence of terminal failure or
official success; active-attempt status must take precedence over stale result
details, and ordinary form-action timeouts must not be labelled as browser
startup failures. A frontend repair and browser regression are in progress.

This attempt passed all five Security pages and began photo upload at
09:07:59 UTC. At 09:09:41 the official photo service was on its upload error
page rather than returning to CEAC; the bounded 90-second photo wait failed.
The queue became terminal failed at 09:09:45, with zero final-attempt records
and its lease safely released. The photo failure is a new, distinct issue;
neither a successful field-fill sequence nor that error page proves submission.

The worker then idled to stopped. With no pending or processing queues, it was
briefly started and checked safe twice, stopped, and updated to the prepared
`0e114970` image without changing environment, guest or services (all three
configuration hashes matched). Cold-start smoke at 09:15 UTC returned health
OK and deploy-ready safe, with no active work or protected browser sessions.
The checkbox-timeout repair is now installed. No official retry was requested
while the new photo failure evidence is being investigated.

The frontend status repair now suppresses stale parent results only for an
active DS-160 attempt; existing partial-result behavior for other countries is
preserved. Shared error copy distinguishes browser startup, form interaction,
connection loss and an unfinished official photo service. Raw Playwright
diagnostics are not displayed. Final validation passed 63/63 result-card and
polling tests, type-check, and lint with no errors. Two Vietnam regressions
found during review were fixed by narrowing the active-result rule to DS-160;
they were not baseline failures. A temporary baseline worktree junction
cleanup damaged local frontend dependencies; these were restored from the
unchanged lockfile before the final passing checks. Production was unaffected.

The production frontend releases `2567974c` and `88e9a442` are now ready on
the application domain. A second correction allows only the exact known,
localized safe error messages through the failure card; appended private
diagnostics still fall back to generic copy. Its 41 result/failure-card tests,
type-check and changed-file lint passed. An authenticated production browser
check verified the terminal failure title and photo-service explanation,
without the old submitting indicator or cloud-startup error. The same card
was checked at a 390-pixel mobile viewport without horizontal overflow;
the viewport was then reset. No submit/retry button was clicked in this smoke.

The current private official evidence contains only a photo-error screenshot;
its encrypted bundle, per-file hash and application/run scope were verified.
There is no pre-sign review, official review diff or confirmation for this
attempt. Submission and field-by-field official parity remain unverified.
The Identix error-page handler now distinguishes this provider error from a
photo-content rejection and preserves its type through orchestration, stopping
before review/sign without another upload. Query data is removed from the
new error and upload DOM diagnostic. This runner change is not yet deployed.

A separate read-only check found that the currently selected reusable profile
photo is a 643-by-849 JPEG, below the file-size limit but not square. The local
DS-160 byte validator rejects that geometry. This does not establish the cause
of the official error page: historical input snapshots do not retain the
selected photo hash, so equality with the bytes used by the failed attempt
cannot be proven. Photo selection and preflight coverage are being investigated
before any same-draft recovery. No photo or applicant answer was modified.

The selection investigation found no application-level photo and exactly one
usable owner-scoped profile candidate; there is no alternate compliant photo.
The worker selected the historical profile upload correctly but checked only
that a photo existed. It did not apply the frontend upload/reuse byte checks.
The repaired worker validates the selected downloaded bytes before opening CEAC
and writes a non-retryable photo-validation failure with a stable reason,
preserving captured recovery data. The profile-fallback/file-validator tests
passed 2/2 and retry-classification tests passed 14/14, with type-check passing.
The pre-browser order and persistence code were reviewed; there is no live
worker/database integration test of this new failure branch yet.

Frontend release `a9af00d9` maps known photo-preflight reasons to localized
remediation without raw paths or diagnostics. Its 49 contract/result-card tests,
type-check and lint passed; production deployment is ready and the authenticated
route smoke still shows the correct terminal photo-service error without a
stale active indicator or JavaScript errors. The current historical failure
was not overwritten just to demonstrate the new preflight message.

Independent upload-protocol review confirmed that the selectors match dated
official control metadata, but found two popup-path bugs: the original page's
URL wait delays a popup handoff, and a broad CEAC photo-path predicate can treat
the unchanged Upload Photo page as acceptance. Neither is proven to have caused
this actual error. The repaired popup/confirmation predicates now require the
exact official Confirm Photo path, watch the context during
handoff without the stale original-page navigation wait, and identify direct
handoff service errors. The six upload browser fixtures passed, including
multipart bytes/name/button-coordinate checks and popup rejection/confirmation
with the original Upload Photo page unchanged. The two photo-preflight and
fourteen retry tests passed, as did the focused parent-orchestration test and
service type-check. These tests intercept portal requests; they do not establish
live official acceptance. No further official attempt will run with the
currently invalid photo. The dedicated preflight failure uses
`photo_validation_failed`, preserves captured checkpoint fields and updates
the displayed application error instead of incorrectly routing to final-sign
recovery.

Release `5916e02657511c6ee6e02b499d8bde214e6b9130` produced runner image
`sha256:b619c868526c13ab1d022d72d78fd48d44882a091c30f7a5bb1d5edf0e729b58`.
It was installed on the existing worker after two fresh safe readiness checks
with no active work or protected sessions. Environment, guest and services
hashes matched before and after the image-only update. Cold-start health and
readiness passed at 10:14 UTC. No official retry or applicant-data change was
performed. Monitoring is paused pending a compliant applicant photo; the
same captured draft and all final-signature guards must be retained on resume.
The worker automatically reached `stopped` after its idle grace, verified at
10:16 UTC; no billable browser session or active worker was retained.

## 2026-09-29 — DS-160 crop/compression workflow

The applicant requested in-form square JPEG processing under the 240 KiB
limit. The active document-center file entry now opens the existing crop tool
for non-square, oversized-dimension or oversized-byte photos. Its confirmed
output is validated again before the existing application-scoped upload action.
Cancellation and application switching invalidate stale crop callbacks; original
profile files are not overwritten. The shared legacy uploader enables the
strict rules only for DS-160. Encoding failure no longer falls back to uploading
the original bytes.

The processor uses only crop/resize and JPEG encoding: 600×600 output, an adaptive
quality search below 240 KiB, no upscaling from a crop smaller than 600 pixels,
and no non-square stretching. Output bytes must pass the shared validator.
A real local Chromium fixture encoded a high-detail synthetic image to 237,830
bytes at 600×600; the shared byte validator passed. The current applicant image
was also processed locally to a 47,105-byte technical preview. Visual inspection
showed that its framing is too close for a square crop to retain the full head
and official head-size proportions. That preview has not replaced the saved
photo or been submitted. A source image with more surrounding space is needed;
file conformance alone must not be represented as official photo acceptance.

The 31 focused processing/contract/document-action/document-center tests passed,
as did frontend type-check and lint (zero errors, 57 existing warnings).
Production release and authenticated route smoke are recorded below after
completion. No CEAC retry or final-signature attempt was initiated by these tests.

Release `05e67fe224cf6b57922517cb5a581de5ad41f361` is READY on the
production `app.viza.it.com` alias (deployment
`dpl_8MEyPApZF86noqEttZDnbHCfqqeu`). The exact organization CLI identity,
release author and linked project were verified; the dry upload manifest
contained no private photos, environment files, build caches or backend files.
The authenticated production route loaded successfully. Selecting the original
non-square photo opened the crop dialog; increasing zoom to 1.2 and applying
produced the localized source-resolution error without uploading. Cancel
returned to the form and there were no captured JavaScript errors. A scoped
readback confirmed zero application photo rows, active queues and final-sign
attempts after the smoke. No live positive upload was performed because this
source photo cannot satisfy the full-head framing requirement. The same draft
is retained, monitoring remains paused for a wider original, and the worker
remains stopped. The technical preview exists only outside the repository.

## 2026-09-29 — Additional portrait candidates

The applicant provided three additional local images. The white-background,
no-eyeglasses portrait is the best of these candidates for further processing.
Its source is 4264×5168; the existing crop/encode helper produced a local
600×600 JPEG of 55,988 bytes, with byte-level validation passing. No generative
edits, face changes or background replacement were used. The derivative remains
a technical preview outside the repository and has not been uploaded.

The source's embedded capture timestamp predates the official six-month window.
The applicant has been asked to confirm the actual capture date because camera
metadata alone does not conclusively establish it. The maximum-width square
preview also leaves the head larger than the official composition range on
visual inspection. File compliance is not full photo compliance. The same CEAC
draft is retained; there is no new retry, official signature or submission proof.
## 2026-09-29 — Applicant-selected photo saved for the existing draft

After reviewing the processed white-background portrait and the previously
reported capture-date/composition limitations, the applicant explicitly directed
using that image and continuing submission. This authorization does not establish
that the image satisfies the official recency or composition requirements.

The existing production application’s visible replacement-photo control uploaded
the selected derivative through the normal application-scoped upload flow. The
UI displayed the new filename, 55 KB and uploaded status. A private storage
readback verified the exact selected file: 600×600 JPEG, 55,988 bytes; SHA-256
matched the approved derivative. The runner’s photo resolver selected this
application document instead of the older reusable profile photo. No face or
background modification was performed, and the original profile photo was not
overwritten.

Before resuming, the previous queue was terminal, with no active lease, no final
submission attempt and 380 stored answer rows. The existing CEAC draft remained
captured. Successful storage and technical validation are not official photo
acceptance or submission confirmation; the resumed-run outcome is recorded below.

The actual production Submit button initiated an ordinary retry at 12:29:47 UTC.
Before that click, the existing retry planner returned captured-checkpoint
resume; the prior encrypted input snapshot passed its ciphertext SHA-256 check
and matched all 380 current answer rows with zero value/count differences.
The worker cold-started and began attempt 1 at 12:29:58; the queue entered
processing with one active lease and no final fence. The applicant monitor was
resumed for this run. No official confirmation was available at this checkpoint.

At 12:31:45 UTC the worker verified retrieval of the same captured CEAC draft;
personal-information filling began at 12:31:46. Photo processing on the official
portal, Review comparison and final confirmation remain pending.

## 2026-09-29 — Current-run latency investigation

The applicant asked why the submission still had not completed. At 12:48 UTC,
the current run was still on its first attempt, with one actively renewed lease
and no final-submission fence. Current logs contained no timeout or out-of-memory
markers; this does not exclude an unlogged slow operation. The actual retained
worker configuration has both Browserbase TTL and DS-160 live duration set to
3600 seconds, with the existing 2 shared CPUs / 4 GiB allocation.

Observed phase intervals include navigation, form operations and verification;
they are not isolated measurements of CEAC server response time:

| Phase | Observed duration before next phase |
| --- | --- |
| Bootstrap and verified same-draft retrieval | 107 seconds |
| Personal Information 1 | 151 seconds |
| Personal Information 2 | 71 seconds |
| Travel Information | 187 seconds |
| Travel Companions | 25 seconds |
| Previous U.S. Travel | 54 seconds |
| Address and Phone | 205 seconds |
| Passport | 165 seconds |
| U.S. Contact | 105 seconds |

The run reached Family Relatives at 12:47:49 UTC after passing the previously
failing address and contact pages. Historical checkbox-order/postback failures
and the later Identix service error were distinct causes of earlier terminal
attempts; each ordinary recovery refills the same draft and repeats verification.
Those historical attempts must not be confused with a retry loop in this run.
No active session was interrupted, no answer was changed and no image was
redeployed for the latency investigation. Official photo acceptance, Review
verification and final confirmation still remained pending at this checkpoint.
A read-only code audit found serial remote-browser work in the current filling
path: per-field locator/state checks, writes, postback settlement and immediate
read-back, followed by the full-page verification that captures official-review
expectations. The generic field path also waits for postback after plain inputs
and adds 750 ms after checkboxes. These waits and repeated remote calls add
latency; the current logs do not isolate their share from CEAC server time or
cross-region CDP latency. A future timing change must preserve field/branch
read-back, request-error/gate detection and review expectations. No proven new
failure in the active run justified interrupting it to release such changes.
## 2026-09-29 — Incremental CEAC filling algorithm

The applicant explicitly requested a faster submission algorithm. The candidate
now compares each eligible live control with the requested value and writes only
when different. Already-correct controls do not generate extra input/change
events or controller postbacks. Changed controls retain ordinary postback waits
and fresh read-back; the complete page/repeat verification and official-review
comparison are preserved. Independent Playwright visibility/enabled/editability
reads run concurrently, a duplicate locator count was removed, and value/display
text/review identity are read together. Selects resolve an exact official value
or unique exact label before selecting, avoiding speculative selection timeouts;
ambiguous labels cannot qualify as an unchanged field.

A real local Chromium fixture with 15 already-correct text/select/radio/checkbox
controls took 9,408 ms on the previous implementation and 1,331–1,438 ms on the
candidate. Every field was still verified; input/change events decreased from
14 to zero. This synthetic replay measurement is not a whole-application or
production latency guarantee. The 72 field-fill, repeat-row, ASP.NET, official
review and final-submit browser/pure regressions passed, as did type checking.
They include later controllers overwriting skipped values, explicit clears,
length limits, duplicate selectors/options, slow NA postbacks and final fences.
The default ASP.NET idle/postback waits were deliberately retained because
plain inputs may have delegated or delayed event handlers.

The active production run was not interrupted or redeployed during this work.
It passed photo upload and reached the official Confirm Photo surface at
13:05:58 UTC, then Review at 13:06:01. At 13:09:12, pre-sign review verification
stopped on five unresolved fields. No final signature occurred. The queue's
normal bounded retry started another attempt; official evidence investigation
is required before any new deployment or operator-triggered retry. Photo upload
success does not resolve the independent review-comparison blocker.

The hash-verified private evidence contained 149 review expectations: 144
matched and five required investigation. Four were missing exact rules for
secondary-phone NA, contact-email NA, and employer/school address continuations.
The new rules keep the exact official page, section, repeat record and adjacent
row constraints. Replaying the original evidence with the candidate matches
148 fields; the one remaining duties mismatch stays blocked because that old
capture has no DOM-layout evidence. The stored, derived and filled duties values
are identical. Its official review screenshot shows a mid-word line break at
the sole added whitespace position. The new capture records unwrapped DOM text
only when the visible value cell contains text and visible BR elements alone.
Only duties may use this representation, with normal strict text comparison;
real spaces, punctuation and content are never stripped to manufacture a match.
Fresh official capture is still required to validate this fix in production.

The generic Error from Review previously caused a full automatic retry even
though replaying unchanged input cannot repair mapping/comparison errors. Typed
review failures now stop that loop, preserve the same draft/evidence and expose
an input-review checkpoint. Existing final-fence recovery remains authoritative.
The combined 98 field/repeat/postback/review/retry/final-submit tests passed;
type checking and compilation passed. A further warm-up regression verifies
that an already visible mapped field is used even when a hidden template is
first in DOM order, avoiding the previous unnecessary ten-second timeout.
The default postback/gate waits and all final review guards remain unchanged.

Release candidate `ad791d1437de8d02708131439569e3e2b02aae5c` was built and
pushed using the verified VIZA organization identity, without replacing the
active worker. Prepared immutable image:
`registry.fly.io/viza-prod-submission-legacy:ds160-ad791d14@sha256:f8b9c22eb716057a6deac202ed958cb275e6bdbc7cdae88a9f2a47151aba8b47`.
Installation is pending the current run and all provider work ending, followed
by two fresh safe deploy-readiness checks. The active worker still uses the
previous image. No submitted-state or production performance claim is made by
this build-only release. Follow-up must retain machine configuration, install
only the image, verify cold-start health/readiness and idle shutdown, and then
resume the same draft only if no final fence or active lease exists.

The subsequent read-only coverage audit of the hash-verified input/review bundle
found 380 unique saved-answer keys, including 80 Chinese/English pairs (160
keys), and 416 derived CEAC keys. All 149 review expectations have derived
sources: 104 directly saved fields and 45 split-date/alias/NA/composite fields.
The contract recognises 155 saved fields, with 148 active in this application
and seven gated off by its actual branch answers. This run has no second
repeat records, so it cannot prove repeat-branch coverage. Seven official review
pages contain 127 rows (five blank-label continuations); the rules cover 13
composite groups with 37 expectation fields, plus 112 scalar expectations.
Current Location and the empty social-presence/identifier rows have no direct
expectation. Consular post, preparer assistance and the social-media branch
must therefore receive additional final-PDF/signature-page verification.
Neither 149 matched expectations nor 380 saved keys establishes complete
official parity by itself. This audit did not modify application facts.

## 2026-09-29 — Review failure recovery and image-only rollout

At 14:26:06 UTC, the third attempt of the previous `d57` queue ended in a
failed state after the official Review comparison reported the same five
issues. Its lease was null and its final fence remained zero. At 14:26:40 and
14:27:05 UTC, two independent readiness checks reported `safe`, zero active
work, and zero provider sessions. The submission and runner queues had no
pending or running jobs; the database's machine capacity slot belonged to the
idle worker and was not a job.

Between 14:27 and 14:28 UTC, the original machine was stopped and updated with
the prepared `ad791d14` image only. The immutable image digest was
`sha256:f8b9c22eb716057a6deac202ed958cb275e6bdbc7cdae88a9f2a47151aba8b47`.
The `nonImageConfigHash` was unchanged before and after the update:
`f9280f447f53b0935e07313f7ac1f25deec8669da1080d3ac71c72e1e259ec3f`.
At 14:28:55 UTC, cold health was OK, readiness was safe, and provider sessions
were zero. The machine shut down through the normal idle timeout at 14:30:54
UTC, and the stopped state was confirmed at 14:31:25 UTC.

At 14:31:55 UTC, the exact production Submit action created queue
`c78db6e9-099f-4e6e-a3da-bedc7c809c49`. Attempt 1, run
`ds160-live-mumrz75t-giaywq`, started at 14:32:07 UTC. It superseded `d57`
and used the same captured CEAC checkpoint. Official retrieval of that draft
was verified at 14:33:47 UTC. Before starting, the 380
database rows and the encrypted input snapshot matched without differences,
and the approved photo hash matched again. At 14:20 UTC, the Fly/Vercel
organization identity and release commit author were verified exactly.

At the time of the rollout record, this resumed run had not reached a new
official Review, signature, or confirmation. Later results follow below. This
record contains no applicant answers, document numbers, recovery secrets,
credentials, or private URLs.

## 2026-09-29 — Accelerated live Review passed; pre-sign storage failure

The first accelerated attempt reached official Review at 14:58:01 UTC.
Personal Information 1 to Review took 24 minutes 14 seconds, versus 33 minutes
3 seconds for the preceding old-image attempt, approximately 27% less. This
is a measured segment comparison, not an end-to-end submission guarantee.

The encrypted official evidence and its 17 embedded files passed SHA-256
verification. The live official comparison matched all 149 expectations with
zero issues, including the repaired address/NA mappings and the narrowly
captured duties text. The consular post also matched the official location
catalog. A separate input-snapshot comparison still matched all 380 saved rows
and duplicate counts. The coverage limits recorded above remain: the result
does not prove inactive branches or fields outside those expectations, and
the final application PDF is still required for further comparison.

At 15:01:31 UTC, the run stopped before reserving the final-submission fence:
the private pre-sign evidence upload received a database connection timeout.
The terminal official-evidence upload succeeded, but no signature or official
confirmation had occurred. The second automatic attempt started at 15:01:49
and stopped at 15:05:36 after a completed-draft Continue Form click timed out
while Playwright awaited scheduled navigation. Its hash-verified diagnostic
identified Personal Information 2 after the click; that alone does not prove
the server accepted the postback. The third attempt started at 15:05:42 and
was still processing at 15:27 UTC, with no final fence or sibling execution.

Two local fixes are being prepared without disturbing that active attempt:
bounded same-ciphertext audit upload reconciliation, and post-click settlement
for the completed-draft continuation. Upload recovery must verify identical
private bytes, retain queue ownership checks, and stop on a differing object,
authorization failure, or exhausted storage budget. It must never sign before
the required evidence is persisted. The audit retry exhaustion must not restart
the entire official form automatically. Release and live verification of these
additional fixes are pending.

The production status UI was also found to display a prior attempt's paused
message while the same queue was actively retrying. The initial-props repair
was released as `1a000c51`; a real production refresh demonstrated that the
polling snapshot could still contain the stale error. A follow-up fix and
fresh production smoke are required before claiming this UI issue resolved.

## 2026-09-29 — Terminal official HTTP 403 and prepared recovery fixes

The third accelerated attempt finished Security 5 at 15:33:00 UTC and entered
Review at 15:33:15. At 15:36:18 the official form response returned HTTP 403.
The queue settled as `ds160_blocked / portal_action_required`, its lease was
released, and the application-wide final fence count remained zero. No
official signature or submission confirmation exists. The failure is an
official access rejection, not evidence that the applicant's answers or photo
were rejected. Its precise server-side cause is not available from HTTP 403.

The latest encrypted input and official evidence, including all 15 embedded
files, passed SHA verification. Seven Review snapshots survived, but the run
stopped before producing its expectations/diff files. The earlier first
attempt's 149/149 result must not be relabeled as this attempt's completed
Review verification. The latest 380 stored rows still match the input snapshot
without differences. No final application or confirmation PDF is available.

At 15:37 UTC, provider pending/running counts were both zero and deployment
readiness was safe with no active work or protected sessions. At 15:40 UTC,
the machine was automatically stopped, with provider sessions still zero.
No new official session or retry was started after the 403.

The recovery patch passed 53 focused audit/storage, retry/final-fence,
navigation and ASP.NET tests, plus service type-check/build. Browser fixtures
cover a continuation delayed beyond five seconds, 403, an unchanged page,
pre-dispatch timeout and foreign-origin redirect. The SDK transport was also
verified against real local HTTP requests, including abort and lost-response
reconciliation. A synthetic encrypted private-storage smoke uploaded and
hash-verified a 22,031-byte object in approximately two seconds, then removed
that test object. It did not alter applicant records or contact CEAC.

The follow-up frontend repair `fa277da2` was deployed to production after 69
focused tests, type-check/lint and a local Chromium active-snapshot fixture.
A real production refresh now correctly shows the terminal paused/HTTP 403
state without a submitting spinner. The corrected active state is covered by
the fixture; it cannot be re-proven in production after this run has ended
without starting another official job, which was deliberately not done.

## 2026-09-29 — Recovery patch deployed after terminal cleanup

Release `b3ed9a59f3884230ac57cb69f1e1a2b5233e6a19` was built and pushed as
`registry.fly.io/viza-prod-submission-legacy:ds160-b3ed9a59` with immutable
digest `sha256:9c2d56ad3a25790dd0b8ac4b154df5627a3b05b8a31515283ca5a163b69a44d8`.
The organization Fly identity and commit author were verified. Before the
readiness-only cold start, all submission/runner active counts and pool
claimable/scheduled/running counts were zero. Fresh readiness observations at
15:43:45 and 15:44:12 UTC were both safe with zero active work, zero protected
sessions and zero provider sessions.

The original machine was stopped and updated only to that image. At 15:45:02
UTC, the stopped machine reported the expected immutable image. All environment,
guest and service hashes remained identical; the non-image configuration hash
remained `f9280f447f53b0935e07313f7ac1f25deec8669da1080d3ac71c72e1e259ec3f`.
The fresh image's cold readiness passed at 15:45:31 UTC, `/health` returned
`ok`, and provider sessions were zero. No official retry was enqueued by these
release checks. The heartbeat was paused for the explicit terminal HTTP 403;
restored official access is required before continuing the same draft.

At 15:48:25 UTC, the new image's machine had automatically returned to
`stopped`; provider pending/running session counts were both zero. The exact
application queue remained blocked with an empty lease and zero final-submission
fences. This verifies terminal resource cleanup, not submission success.

## 2026-09-29 — Five-minute target and browser-control latency

The user requested a five-minute submission target and asked whether detailed
checks could be deferred to the final Review. A fresh machine listing confirmed
the production worker is in `sin`; the configured Browserbase browser remains
in `us-east-1`. This introduces cross-region control traffic that a local
worker/browser pair does not have. Its exact RTT was not measured in this audit,
so geographic separation is not a measured attribution of all elapsed time.

Code inspection identified repeated per-field count/visibility/value reads,
repeated row rediscovery and per-validator visibility reads during navigation.
CEAC keeps inactive validators in the DOM; checking each hidden validator with
a separate remote command adds control latency even when the portal responds
quickly. The implementation now batches read-only native page observations,
navigation validator text and independent page/gate/presence probes. An exact
all-fields-match snapshot can finish a recovered page without replaying input
events. A mismatch, ambiguity or unsupported selector keeps the existing
sequential filler. Final row/page checks still occur after mutations, and the
official Review comparison, persistence prerequisite and signature fence are
unchanged. Field/repeat/read-back phase timings are now logged without values.

Five minutes is an acceptance target, not an established live result. The
previous official HTTP 403 remains a separate terminal blocker; these local
performance changes do not establish restored portal access or authorize
claiming an official submission. A synthetic CDP latency fixture can measure
control-plane savings but cannot measure CEAC server latency, CAPTCHA solving,
photo processing, final Review navigation or confirmation receipt.

The completed local Chromium/CDP fixture added 200 ms synthetic round-trip
delay (100 ms in each WebSocket direction). It used only invented form values
and no official portal, applicant data, database or hosted browser sessions.

| Fixture | Previous implementation | Batched implementation |
| --- | --- | --- |
| 15 recovered, matching fields; no added RTT | 683 CDP commands; 3.318 s | 14 commands; 1.110 s |
| Same fields; 200 ms RTT | Did not finish within the 60 s case budget | 5.191 s; 15/15 verified; no input/change events |
| One changed text field; 200 ms RTT | Did not finish within the 60 s case budget | 38.461 s; 15/15 verified; exactly one input/change event |
| 80 hidden validators and two visible messages; 200 ms RTT | 21.819 s; 87 commands | 3.192 s; 8 commands; same two messages |

Durations include fixture browser connection/setup; protocol counts start after
setup. The timed-out baseline cases are not completed timings or correctness
passes. The recovered matching-field command count fell by approximately 98%,
but the changed-field fallback remains substantially slower. These synthetic
results cannot be multiplied into a guaranteed five-minute official run.

The combined targeted suite exercised 115 tests: 114 passed, with one ASP.NET
pending-POST fixture cancelled by its 10-second timeout under concurrent
browser load. That fixture and the entire ASP.NET/snapshot subset passed on a
sequential rerun (16/16), including a checkbox with a matching value incorrectly
mapped as text. Type-check and build passed. Regression coverage includes later
postbacks overwriting earlier fields, hidden/disabled/readonly controls, radio
No, ambiguous choices, unsupported native/ARIA semantics, official gate errors,
Review comparison and the final-submission fence.

Release `9f0931c2a7735b3bffbf6124c2c4d88a8be18644` was built and pushed as
`registry.fly.io/viza-prod-submission-legacy:ds160-9f0931c2@sha256:aa08ceec981b1cca971178a4683cbcda69b9290ff72c8bf2fa5e8a27dd1df485`.
The organization Fly identity and release author were verified. Before the
readiness-only start, both global active queue counts were zero and the target
application had zero final-submission fences. Fresh readiness observations at
16:41:07 and 16:41:22 UTC were safe with no active work or protected/provider
sessions. The original machine was then stopped and updated to the immutable
image without changing environment, guest or service configuration. At
16:42:06 UTC it reported the new image, stopped state and zero provider sessions;
the complete non-image configuration hash remained
`f9280f447f53b0935e07313f7ac1f25deec8669da1080d3ac71c72e1e259ec3f`.

The subsequent command to start the new image and read health/readiness was
rejected by the tool approval policy with `blocked by policy` before execution.
No policy bypass was attempted. The post-install cold-start smoke is therefore
**not verified** for this image; the machine remains stopped. Earlier cold-start
and automatic-idle evidence applies to the prior image only. No official job
or new signature was triggered for this performance release, and the HTTP 403
submission blocker and unverified five-minute end-to-end target remain open.

## 2026-09-29 — Production cold-start acceptance completed

Following the user's renewed deployment/acceptance request, the installed image
was re-read at 17:46:09 UTC and matched release `9f0931c2` and its immutable
`sha256:aa08ceec981b1cca971178a4683cbcda69b9290ff72c8bf2fa5e8a27dd1df485`
digest. It did not need rebuilding or replacement. The release author and Fly
account matched the VIZA organization. Before startup, both global active queue
counts and the application's final-submission fence count were zero; the exact
target queue remained `ds160_blocked`.

The explicit machine start succeeded. At 17:47:01 UTC, the new image returned
HTTP 200 with `/health` status `ok`; `/deploy-ready` reported safe, zero active
work and no protected sessions. A separate `/ready` request returned `ready`,
`dbReachable=true` and `workerStarted=true`. Provider pending/running counts
remained zero and all non-image configuration hashes were unchanged.

A synthetic Chromium smoke ran the deployed compiled modules inside that
machine, with all browser network requests aborted. It verified 15/15 recovered
fields without a write (815 ms for fill/read-back), corrected one stale field
with exactly one write and verified 15/15 again, read exactly two visible
validation messages among 80 hidden validators, and rejected a checkbox mapped
as text. The remote program printed its passing assertions; the Windows Fly SSH
client then exited with `The handle is invalid`. This client transport error is
retained here rather than represented as a clean command exit. Independent
health/readiness and machine-state observations succeeded.

At 17:49:10 UTC the machine had automatically returned to `stopped`, with zero
provider sessions and the same installed image/configuration. This completes
the previously blocked production cold-start/idle acceptance. No official
retry or signature was triggered. It does not resolve the prior CEAC HTTP 403,
prove an official five-minute run, or provide submission/confirmation evidence.

## 2026-09-29 — Explicit retry succeeded; failed-result retry entry repaired

The user explicitly requested a manual restart. Before that restart the target
application had no active queue, lease or final-submission fence. The ordinary
authenticated production retry endpoint accepted the request and resumed the
same captured CEAC application. No new VIZA or CEAC draft was created.

The worker started at 17:54:11 UTC, reached Confirm Photo/Review at 18:03:07,
and persisted `ds160_submitted` at 18:06:40. The final-submission fence is
`confirmed`; the application result is `submitted`, and its official
confirmation PDF was downloaded and verified as a PDF (312,760 bytes).
This was one attempt, approximately 12 minutes 29 seconds from worker start
to persisted result. The five-minute end-to-end target is **not met**.

The current run's encrypted input and official evidence hashes and all 16
embedded-file hashes verified. Seven official Review snapshots passed all
149 comparison expectations with no issues. The input snapshot's 380 rows
equal the current 380 saved rows, including duplicate counts. A separate
official Review location check also matched. These checks are distinct:
380 saved rows include bilingual aliases and do not imply 380 independently
verified official fields. Full Print Application PDF evidence was not yet
available at this observation; the social-media branch marker and preparer
assistance remain explicitly uncovered by the structured Review evidence.

At 18:07:34, the worker reported safe readiness, zero active work and no
protected sessions; the browser provider had zero pending/running sessions.
Automatic machine idle shutdown is checked separately after the idle window.

The UI dead end was independent of the backend retry capability. The result
card only exposed ordinary retry when its text classifier identified a CEAC
form-validation error. Other `portal_action_required` results with no pending
manual task instead displayed a disabled Continue action. The repaired card
exposes an explicit Retry submission action after a successful, current-job
manual-actions read confirms no task remains. Form validation retains its
correction wording. Pending CAPTCHA tasks, retrieval identity failures and
unknown/malformed manual-action responses retain their existing safeguards.
Retry still uses the parent save/validation barrier and the ordinary guarded
same-draft retry API; failed requests re-enable the button, and pending
requests disable it to prevent duplicate clicks. Backend final-submission
guards remain authoritative, so this successful application cannot be signed
again through that entry.

The focused result-card suite passed 22 tests. Frontend type-check passed;
repository ESLint completed with zero errors and 57 existing warnings.
The local browser acceptance mounted the actual `GenericResultCard` and
`SubmissionStatusStep` with synthetic network responses. HTTP 403 and timeout
cases both displayed the ordinary Retry submission action, restored it after
the first rejected request, and entered the running component after a second
successful request. Pending CAPTCHA exposed only its manual continuation;
manual-actions HTTP 503 exposed no retry and kept Continue disabled. The
initial fixture incorrectly used the pre-existing final-recovery branch; it
was corrected to `portal_action_required` before these acceptance results were
recorded. The temporary browser tab and local server were then closed.

Release `a155e93c126d1b212e34f71ebc01acdf94eb80fc` was deployed through the
verified VIZA organization account to `viza-internal`. Vercel deployment
`dpl_4iSgnEhsnkhqXq5b7FmNpYV2fTru` is READY/production and aliased to
`app.viza.it.com`; its API metadata reports the exact release commit. The
upload dry run contained no environment files, private applicant documents or
local browser evidence. Reloading the authenticated production page still
showed confirmation-PDF download and the next appointment step, with no
running indicator or Retry submission button. No additional real submission
was triggered to test this successful record.

At 18:10:18 UTC the submission machine was automatically stopped, provider
pending/running counts were zero, and the image/configuration hashes remained
unchanged. This verifies submission cleanup before the separate proof request.

A single authorized Print Application recovery request then queued a
proof-only job. Its first attempt stopped before CAPTCHA solving because the
proof retrieval flow had not selected the saved consular post. This failure
does not change the successful submission or its confirmed final fence. The
missing proof location handoff is being repaired separately; no signature or
new application is needed to retrieve proof.

The proof bootstrap now loads saved answers without CEAC derivation, resolves
the saved consular post through the existing location catalog, and supplies
`startLocationCode` to the retrieve-only session. Missing/invalid saved posts
produce `ds160_proof_consular_post_required` and a terminal proof failure
instead of repeated CAPTCHA attempts against a blank location. No form answer
or final-signature path is changed. Eleven focused location/CAPTCHA tests and
the submission-service type-check passed. This source fix is not yet a live
proof-recovery acceptance: the old pending proof job and its lease must finish
before the prepared worker can be installed safely.

Release `fffb3ef9` passed the service build and was built/pushed without
deployment as
`registry.fly.io/viza-prod-submission-legacy:ds160-proof-fffb3ef9@sha256:fc31a91735cfd4a89d5020244034496a55d52414b80b15fbe967c4569ad8da21`.
The verified organization identity was used. The production machine still
runs `9f0931c2`; no active or leased proof task was interrupted. The prepared
image needs no rebuild before the next safe release window.

At 18:38 UTC the proof job was still pending with one attempt, but its
18:31:34 lease had expired. There were no other pending/running legacy jobs,
no queued/running shared-pool jobs, and no provider sessions or active worker
work. The earlier expectation of automatic retry after lease expiry was
incorrect: the legacy worker drains only at startup or an authenticated wake.
The immediate drain after failure exits while the old lease remains valid;
expiry alone schedules no later drain. Deployment readiness reports
in-process activity separately from database pending/lease state. The machine
was later observed stopped at 18:42; a pending database row alone is not proof
that a process remains running.

The existing claim RPC includes proof-pending jobs, so a repaired worker can
claim this same job after startup without changing the queue or re-enqueuing.
However, the current monitoring instruction additionally requires zero
pending jobs before deployment. An explicit exception was requested to install
the prepared image on the idle, lease-free worker while preserving this one
proof job. No deployment, queue mutation or additional portal attempt was
performed while awaiting that decision. The submitted application and
confirmed final-submission fence remain unchanged.

The user then explicitly approved installing the prepared fix on the idle
worker while preserving the expired pending proof job. At 18:39 readiness was
safe, active work/provider sessions were zero; at 18:42 the machine was
already stopped. The fresh global queue check contained only that original
proof job with an expired lease, no active shared-pool runner jobs, and the
final-submission fence remained confirmed. The organization identity and
release author were reverified. The prepared `fffb3ef9` image was installed
without starting the old version. Environment, guest, services and the full
non-image configuration hashes matched the pre-release values.

At 18:44:42 the new worker's startup drain claimed the original proof queue;
no new queue or signature was created. Health and database readiness passed.
At 18:46:05 the proof job finished `done` / `proof_artifacts_ready`, and the
provider had zero running/pending sessions with deployment readiness safe.
However, the application record still lacked Print Application PDF: a done
proof job is not evidence that every requested proof artifact exists. The
remaining two field-evidence gaps therefore stay open. The user separately
reported confirmation-email failure and requested an official English
confirmation PDF; those are being diagnosed without resubmitting the form.

At 18:49 the machine was automatically stopped again with zero provider
sessions, completing the fixed proof worker's cleanup check. The existing
confirmation PDF is valid and two pages long, but its extracted static
content is Chinese. The capture implementation prints the current CEAC page
directly; it does not explicitly select the English official print view.
Retrieving an English version must use CEAC's own controls and preserve the
existing artifact. Translating or editing a rendered PDF would not provide
the requested official original. The new proof run has insufficient
control-level diagnostics to attribute the absent application PDF to a
disabled button, missing selector, or unhandled print/download behavior.

### English confirmation and final proof coverage, 2026-09-29

After all proof leases expired, a single retrieve-only inspection of the same
submitted official application observed CEAC's language selector at `zh-CN`.
Selecting its `en-US` option and waiting for the official postback produced
the English confirmation view. The enabled Print Confirmation control invoked
same-page printing; the Print Application control was explicitly disabled.
No submission, signature, answer change, new application or disabled-control
bypass was performed.

The official English print view was captured as a two-page PDF (149,307 bytes,
SHA-256 `745746d05ef643ef3f63de0ddf049f7ae71da7aab20281268b257f340e5072fe`).
The official application identity matched in memory. Text extraction verified
English static labels and no Chinese characters, and the rendered first page
was visually checked. Private-storage download matched the capture hash. An
owner/version/submitted-status/final-fence guarded update changed only the
proof artifact references and language metadata, preserving the original
Chinese confirmation artifact. Both authenticated production confirmation and
email-confirmation download endpoints returned HTTP 200 with the identical
English PDF hash. No email was sent by this acceptance test.

The inspection session was released; at 19:15 the provider reported zero
pending/running sessions and the worker machine remained automatically stopped.
The disabled official Print Application control prevents completing the two
remaining structured-evidence checks (`has_social_media` and
`ds160_preparer_assistance`) through that print path. The substantiated result
remains 149 official Review expectations matched, zero differences, 380 saved
input rows unchanged, with those two coverage gaps explicitly open. Neither
the English confirmation nor the local input comparison proves full official
field or branch coverage.

The email screenshot was a separate delivery failure: the provider rejected
the configured sender domain as unverified. Production has a sender under the
expected domain, but its sensitive production key cannot be read back; a local
key's domain list cannot establish which account production uses. No key was
substituted, DNS changed, or email sent. Frontend commit `a2fb4dbd` replaces
provider/configuration text with localized email-specific errors while keeping
the submitted state and PDF download available. Its 18 focused tests,
type-check, lint (zero errors; existing warnings) and component browser smoke
passed. Production release verification is recorded separately below.

The frontend release `a2fb4dbd0c1a93e31e9a68115a2a57b9294e6f21` is now
production READY with `app.viza.it.com` assigned. The Vercel API verified the
exact commit, project and organization author. After release, authenticated
confirmation and email-confirmation downloads again returned the English
artifact hash. A refreshed production browser retained the submitted state
and confirmation download button; clicking download completed without an
error. The actual Resend domain verification remains an account-configuration
issue and is not claimed repaired by the UI change.

Permanent English confirmation capture is implemented in service commit
`c56db45ee90752f3c158374ab2b1fc615a97193c`. Both normal submitted-result capture
and proof-only recovery select CEAC's English option, settle the postback,
verify the same official identity, invoke Print Confirmation once, and
recheck language/identity/gates. A preparation failure after confirmed
submission skips new PDF capture/upload while preserving the submitted
result; no error/challenge page becomes a proof artifact. Ten Chromium fixture
tests, service type-check and build passed.

After fresh global checks found zero pending/processing jobs, valid leases
or shared runner jobs, with the final fence still confirmed, the idle worker
was briefly started for two fresh safe deployment-readiness observations.
Both had zero active work and provider sessions. The machine was stopped and
updated only to the prepared image digest
`sha256:112967e404baf90edf269bd13b6f5b7091b42ad98636c6202eb6a43529b515e5`.
Environment, guest, services and non-image configuration hashes were unchanged.
At 19:31 the new image passed cold-start health and database/worker readiness;
deployment readiness was safe with zero active work/provider sessions.
No live submission or extra official retrieval was used to test this release.

The user subsequently asked whether official email is automatic and said
VIZA need not send if it is not. The State Department DS-160 FAQ describes
selecting the optional Email Confirmation action, consistent with the live
confirmation controls; email is not required as submission-success evidence.
Neither CEAC nor VIZA email was triggered by this audit. Whether to remove
VIZA's manual email entry remains an optional user preference; no further
Resend configuration work or outbound email is being performed.

At 19:33:43 the English-capture worker was automatically stopped, with zero
pending/running provider sessions and unchanged non-image configuration.
The submission/proof monitor is paused: success and the available Review
evidence are verified, the English confirmation is delivered, and the two
remaining evidence gaps have no permitted automated Print Application path.
No further automatic official requests are scheduled.

### User-requested official email attempt, 2026-09-29

After the prior proof work, the user explicitly requested CEAC's own Email
Confirmation action to the account mailbox. A retrieve-only session verified
the same submitted application and English confirmation. Opening the official
email page exposed its saved recipient; that address matched the authenticated
application owner's account exactly. The additional-recipient choice was set
to No and read back before one send attempt at 19:44:26 UTC.

The send click timed out without a success receipt. Read-only observation did
not recover an acknowledgement before the session ended; provider logs offered
no subsequent receipt and replay was unavailable. A local one-attempt record
is marked `unknown`, so no second send was attempted. This does not establish
either successful delivery or definite non-delivery. No VIZA/Resend email,
new application or signature was performed. The owner session was released;
at 19:47 the provider had zero active sessions and the worker remained stopped.
The existing submitted result and verified English PDF remain unchanged.

### Official email user-flow implementation, 2026-09-29

The user reported non-receipt and explicitly requested a working official email
flow. The new proof-only worker verifies the submitted application, account
recipient digest, CEAC recipient, and Additional Email No before reserving one
durable dispatch. A timeout after reservation settles as unknown, with encrypted
official evidence; only a new explicit user request can authorize another send.
No application result, answer, photograph, or final-submission fence is changed.

Worker release `61967109` was installed image-only on the existing idle machine.
The image digest is
`sha256:1c5ae29305d7283aa8ded0d36672b13bc3ef475eebf8d3a10572c02f6be54aa1`.
Two pre-update readiness checks were safe, with no queue work or provider sessions.
Environment, guest, services, and complete non-image configuration hashes were
unchanged. Cold-start health/readiness passed and idle shutdown was observed.

Migration 0206 adds atomic email/download enqueue, exact-claim start and
settlement, and a one-shot email-send reservation. Production transaction-only
acceptance ran under service_role and rolled back all fixture rows: duplicate
requests reused one job, wrong owner/digest/claim epoch were rejected, a second
reservation returned no row, pre-send failure and post-reservation unknown stayed
distinct, explicit retry worked, latest terminal state was reused, and concurrent
download/email requests could not supersede one another. Submitted result and
confirmed final fence were unchanged. All five RPCs deny anon/authenticated
execution and permit service_role only.

Local worker/browser fixtures passed 14 tests, including a slow/ambiguous final
click, foreign-page and generic-text false receipts, pre-existing receipt,
recipient mismatch, ownership loss, and provider cleanup failure. Backend
migration tests passed six checks; gated local-database integration tests were
skipped, with the separate production rollback acceptance above supplying actual
RPC execution evidence. Backend type-check passed and lint had zero errors with
one pre-existing warning. A production email receipt is still required before
claiming that the new mail flow has succeeded.

Frontend release `d54d7531d1b9c4239e77b299f2b57bd38c971909` is READY at
`app.viza.it.com` (deployment `dpl_BxmTLUEm8hu341QfzaxZcohjJHig`). The organization
CLI identity, project/team, commit author, deployment metadata, and dry upload
manifest were checked. The route now uses official CEAC jobs instead of Resend,
accepts only the authenticated account mailbox, restores status with GET-only
polling, distinguishes failed/unknown/sent, and exposes only explicit retry.
An expired processing lease is no longer displayed as permanently sending.
Twenty-three focused frontend tests and type-check passed; frontend lint had
zero errors and 57 existing warnings. A local component browser fixture covered
failure/retry without a real email side effect.

Production acceptance used the actual Send to account email button once.
Refresh restored its processing status and disabled the send controls while
leaving confirmation download enabled. The official-email worker retrieved the
same submitted confirmation at 21:16:36 UTC and reserved dispatch at 21:16:52.
Both authenticated PDF download variants returned HTTP 200, 149,307 bytes, valid
PDF headers, and the already-verified English original SHA-256. Receipt and
terminal cleanup acceptance remain pending at this point in the record.

The official send did not return a receipt. At 21:18:38 UTC the encrypted,
SHA-verified final evidence was CEAC `/GenNIV/Common/AppError.aspx`, headed
Application Error, stating that an unexpected error occurred while processing
the previous request. The one final click timed out; the worker observed this
official error page and settled `unknown` at 21:18:40 rather than retrying or
claiming delivery. This establishes an official service error after dispatch,
not confirmed email delivery. No second send, resubmission, or proxy change was
performed. The production card showed the unknown-result warning and enabled
explicit retry, with PDF download still available. The restored polling path
also exposed a stale processing message above that warning; a final UI patch
clears this message on terminal failure/unknown and avoids duplicate retry
controls when the email panel is open.

The queue lease was cleared, active siblings were zero, the application remained
submitted, and the single confirmed final-submission fence was unchanged.
At 21:21:25 the worker was automatically stopped and provider sessions were zero.
The official mail service is the remaining blocker to live success acceptance;
the available English confirmation PDF remains the verified submission proof.

The final UI patch `5ce9c29c169ae00695c8a665ee73b965571aed9d` is READY on
the production alias, verified against deployment
`dpl_9EyzkTf1W1cukd2jjjgFgGAQPfEs`. Ten component tests (including the restored
sending-to-unknown transition) and frontend type-check passed. A fresh production
browser reload showed the unknown-result warning, no stale processing message,
exactly one enabled account-email retry button, and an enabled PDF download.
No retry was clicked. A scoped database read confirmed no newer queue, zero
active siblings, a released lease, the unchanged submitted application, and one
confirmed final-submission fence. Live official email delivery remains unverified
because of the recorded CEAC Application Error; this UI acceptance is not a
successful-delivery claim.

### User-authorized continuing official-email retry, 2026-09-30 local time

The user explicitly requested continued email retries until success. The existing
`ds-160` heartbeat was reactivated with a 30-minute interval, one email-only
attempt per interval, and a stop condition requiring an official send receipt.
It must not retry an active job, repeat an existing dispatch reservation, sign
the application again, or enqueue while current queue state cannot be read.

At 22:06-22:12 UTC on 2026-09-29 the production database intermittently rejected
connections (`57P03`, hot standby disabled) and then timed out. One scoped read
returned submitted / zero active siblings / one confirmed final fence, but
subsequent queue reads and a bounded 20-second Data API read timed out. An
authenticated production request failed and the applicant route rendered its
shell with empty main content. The management plane still reported
ACTIVE_HEALTHY, which did not establish data-plane health. No new email request
was created during these checks. The existing worker remained stopped, provider
sessions were zero, and its configuration hashes matched the verified release.
No database restart, proxy change, new official draft, or signature was attempted.

A read-only review of the email helper found no missing visible required field
or incorrect control sequence in the captured official form. The previous CEAC
Application Error still does not establish either successful delivery or definite
non-delivery. The continuing workflow first waits for readable authenticated
queue state before using the normal email-only retry path.

At the 22:42 UTC follow-up, the exact queue query still timed out. No email job
was enqueued; the worker remained stopped with zero provider sessions and the
same configuration hashes. A separate read-only operations audit found the
resilience health endpoint reporting 503 / circuit open: Auth and PostgREST
probes timed out at 22:01:36 while an invalid-key control returned 401 promptly.
The resilience worker had already requested one database restart successfully
at 22:01:37-38, with subsequent probes still unhealthy. No manual restart or
watchdog configuration change was made. The email monitor retains its 30-minute
backoff and requires a fresh successful queue read before any send attempt.

At 01:11 UTC on 2026-09-30, the resilience probe recovered to HTTP 200 / circuit
closed. A fresh scoped database query verified the submitted result, one
confirmed submission fence, zero active siblings, and the previous terminal
unknown email job with no lease. The existing worker was stopped with zero
provider sessions. One authenticated production email-only retry returned 202;
no application-submit endpoint was called. The new worker run began at 01:13:50,
verified the same official confirmation at 01:15:25, and reserved its sole email
dispatch at 01:15:42.

The retry again returned no official receipt. SHA-verified encrypted evidence
captured at 01:17:27 showed `/GenNIV/Common/AppError.aspx` with the official
Application Error message. The helper recorded one attempted send, a timed-out
click, and a bounded 120-second observation; the job settled unknown with its
lease cleared. At 01:18, provider sessions and active work were zero and readiness
was safe. This is another observed CEAC processing error, not delivery evidence.
The monitor retains the user-authorized 30-minute email-only retry interval.
At 01:20:07 UTC the worker had automatically stopped; provider sessions remained
zero and all recorded non-image configuration hashes were unchanged. A final
scoped read retained submitted / one confirmed fence / zero active siblings.

The 01:41 UTC monitor read a terminal unknown email job with no lease, zero
active siblings, and the unchanged submitted result. After more than 30 minutes
from the prior queue creation, one authenticated email-only POST created the
next queue at 01:46:51. The run started at 01:47:03, verified the same official
confirmation at 01:48:38, and reserved its sole dispatch at 01:48:54. SHA-verified
evidence at 01:50:40 again captured the official Application Error page; the job
settled unknown at 01:50:42, released its lease, and retained zero active siblings,
submitted state, and one confirmed submission fence. No repeated click, new draft,
signature, proxy change, or deployment occurred.

A local operations helper outside the repository now supports subsequent
explicitly authorized retries with an exact prior queue UUID and its fresh
database creation timestamp, a 30-minute minimum age, account and latest-state
checks, and a UUID-scoped exclusive local attempt record. Its syntax check and
network-free mocks passed: one email POST on success, no POST replay on timeout,
and rejection before sending for stale identity, an active job, an existing
attempt record, or insufficient backoff. The helper was not executed against
production during its tests; this round used the separately reviewed one-shot
authenticated request.
At 01:53:11 UTC the worker had automatically stopped with zero provider sessions
and unchanged non-image configuration hashes. The 30-minute monitor remains active.

The 02:41 UTC monitor again verified healthy service state, the exact terminal
unknown email job, no lease or active sibling, the submitted application and its
confirmed fence, and a stopped worker with zero provider sessions. One
authenticated email-only retry created a queue at 02:42:17 after the required
backoff. Its run began at 02:42:26, verified the same official confirmation at
02:44:01, and reserved its sole dispatch at 02:44:21. SHA-verified evidence at
02:46:07 again showed the official Application Error page without a success
receipt. At 02:46:08 the job settled unknown with its lease released, zero active
siblings, and the original submitted result and confirmed fence intact. At
02:46:31 provider sessions and active work were zero, readiness was safe, and
the machine was awaiting its normal idle stop. No application submission,
signature, answer edit, new draft, proxy change, or deployment occurred.
At 02:48:23 UTC the machine had automatically stopped, with zero provider
sessions and unchanged non-image configuration hashes. The next monitor must
check the latest queue again and preserve the minimum 30-minute retry interval.

The 03:11 UTC monitor found healthy services, the same terminal unknown email
job, no active lease or sibling, and the submitted application with one confirmed
fence. After the prior queue reached 30 minutes of age, a second fresh scoped
read verified eligibility. One authenticated email-only request created a queue
at 03:12:47; its run began at 03:12:57, verified the same official confirmation at
03:14:29, and reserved its sole dispatch at 03:14:45. SHA-verified evidence at
03:16:31 again showed the official Application Error page without a success
receipt. The job settled unknown at 03:16:33, released its lease, and left zero
active siblings and the submitted result and confirmed fence unchanged. No
submission, signature, draft creation, answer edit, deployment, or route change
occurred. The retry interval remains at least 30 minutes from queue creation.
At 03:19:15 UTC the worker had automatically stopped with zero provider sessions
and unchanged configuration hashes; no idle machine was left running.

The 03:41 UTC monitor verified healthy services, a stopped worker with no
provider sessions, and the latest terminal unknown email job. After the
30-minute interval elapsed, a fresh scoped read again confirmed no lease,
active sibling, or sent email, with the original submitted result and confirmed
fence intact. One authenticated email-only request created a queue at 03:44:07.
The run started at 03:44:20, verified the same official confirmation at 03:45:53,
and reserved its sole dispatch at 03:46:10. SHA-verified evidence captured at
03:47:55 again showed the official Application Error page without a receipt.
The job settled unknown at 03:47:58, released its lease, and retained zero active
siblings, submitted state, and one confirmed submission fence. No submission,
signature, draft creation, data edit, route change, or deployment occurred.
At 03:49:19 UTC provider sessions and active work were zero and readiness was
safe. At 03:50:33 the worker had automatically stopped, with provider sessions
still zero and all recorded configuration hashes unchanged.

The 04:41 UTC monitor confirmed healthy services, the latest terminal unknown
email job, elapsed backoff, no lease or active sibling, zero sent emails, and
the unchanged submitted result with one confirmed fence. A stopped worker and
zero provider sessions were verified before one authenticated email-only retry
created a queue at 04:42:20. The run started at 04:42:29, verified the same
official confirmation at 04:45:03, and reserved its sole dispatch at 04:45:21.
SHA-verified evidence at 04:47:06 again showed the official Application Error
page without a success receipt. The job settled unknown at 04:47:08, released
its lease, and retained zero active siblings and the submitted result. At
04:47:59 provider sessions and active work were zero and readiness was safe.
No signature, application submission, draft creation, data change, route change,
or deployment occurred; the 30-minute minimum retry interval remains in force.
At 04:49:50 UTC the worker had automatically stopped with zero provider sessions
and unchanged configuration hashes.

The 05:11 UTC monitor verified healthy service state, a stopped worker with zero
provider sessions, and the exact terminal unknown email job. After backoff
elapsed, a fresh read confirmed no lease, active sibling, or sent email and the
unchanged submitted result with one confirmed fence. One authenticated email-only
request created a queue at 05:13:04; the run began at 05:13:13, verified the same
official confirmation at 05:14:51, and reserved its sole dispatch at 05:15:09.
The job settled unknown at 05:16:59, released its lease, and left zero active
siblings and the submission result unchanged.

This attempt has a different evidence limitation: its audit snapshot was not
saved (`auditUnavailable: true`, no audit reference). Persisted diagnostics
record a single attempted send, a timed-out click, 120,020 ms elapsed, the path
`/GenNIV/common/email.aspx`, no receipt hash, and no ownership loss. These
diagnostics do not establish an Application Error page or successful delivery;
the previous attempts' SHA-verified pages must not be substituted. At 05:20:10
the worker had automatically stopped with zero provider sessions and unchanged
configuration hashes. The existing 30-minute retry rule remains in force, and
no signature, submission, draft creation, data change, or deployment occurred.

The 06:11 UTC monitor verified healthy service state, the exact terminal unknown
email job, elapsed backoff, no lease or active sibling, zero sent emails, and
the unchanged submitted result with one confirmed fence. A stopped worker and
zero provider sessions were verified before one authenticated email-only retry
created a queue at 06:12:22. The run began at 06:12:31, verified the same official
confirmation at 06:14:03, and reserved its sole dispatch at 06:14:19.

Encrypted evidence was successfully saved and SHA-verified for this run. At
06:16:05 it showed the official Application Error page without a success receipt.
The job settled unknown at 06:16:07 with its lease released, no active siblings,
and the submitted result and confirmed fence unchanged. At 06:16:40 provider
sessions and active work were zero and readiness was safe. This observation is
specific to this run and does not fill the previous run's missing audit snapshot.
No submission, signature, draft creation, data edit, deployment, or route change
occurred; the minimum 30-minute email-only retry interval remains unchanged.
At 06:18:39 UTC the worker had automatically stopped, provider sessions remained
zero, and the recorded configuration hashes were unchanged.

### 2026-09-30 requested email-failure debugging

Fresh reads at 09:42–09:53 UTC again confirmed the application is submitted,
with one confirmed final-submission fence, no active sibling or lease, and the
same terminal unknown email job. This is a failure to obtain an official email
receipt, not a failed DS-160 application submission. The latest saved official
evidence was SHA-verified and displays Application Error; it does not establish
whether the recipient's mailbox received anything.

Code and retained evidence exposed two diagnostic defects. First, the first-64
network-event cap filled with CEAC assets before the final dispatch, hiding its
POST/response. Only opening the email page and the Additional Email postback
were present; those 200 responses cannot prove the final send succeeded.
Second, a screenshot capture exception discarded previously captured text,
and a broad catch concealed whether capture, encryption or storage failed.

The repair keeps bounded, sanitized network evidence with priority for the
final dispatch and independent text/screenshot persistence. Partial capture is
explicit; public failures contain only stage names and typed storage codes.
An audit reference still requires acknowledged encrypted storage, and no
diagnostic result substitutes for an official success receipt. Recipient,
Additional Email No, ownership and single-dispatch checks are preserved.
No code defect causing the official Application Error itself has yet been
proven. The status remains unknown and no further application signature occurs.

At 09:51 UTC the resilience health endpoint returned 503 with a cached
unhealthy Auth/PostgREST probe (four-second timeouts); management SQL remained
readable. The sole machine was stopped, provider sessions were zero, and all
non-image configuration hashes were unchanged. Live email acceptance must wait
for a healthy data plane; a readable management query alone is insufficient.

The combined 30 email/browser/audit-storage regressions pass, including a
delayed final POST returning HTTP 500 amid noisy assets, recipient mismatch,
403 gates, one-click fencing, partial captures and unacknowledged storage.
Type checking and compilation also pass. At 10:01 UTC the next fresh resilience
probe returned HTTP 200 with successful Auth and PostgREST checks. The code is
ready for an idle-window deployment and one authorized email-only acceptance;
these local fixtures do not establish successful live email delivery.

Release `99b7050b` was built and pushed as immutable digest
`sha256:a8cc892807e160e957391389931e9d564cd67de4bb9683af6fc49426f9ae861a`.
The VIZA organization identity and commit author were verified. All queue work
was idle, provider sessions were zero, and two fresh readiness checks were safe
before the original machine was stopped and only its image was replaced.
At 10:05:43 the environment, guest, services and complete non-image config
hashes matched the pre-release values. At 10:06:25 the new image returned healthy,
ready with reachable DB and started worker, and safe deployment readiness.

After re-reading the latest terminal email, no active lease/sibling or prior
sent receipt, and the unchanged submitted application/final fence, one ordinary
authenticated email-only request returned HTTP 202. The task was created at
10:06:49 and began at 10:06:55, retrieving the same official confirmation.
The earlier retry's local one-shot fence is retained. This request performs no
application submission or signature; live email acceptance is still pending.

This acceptance did not reach the email dispatch. At 10:08:27 the worker logged
`ownership_lost_no_replay`, before any official-confirmation-verified or
dispatch-reserved phase. Three subsequent exact management queries failed with
connection timeouts. The last readable row was processing with a lease ending
10:21:56; its current persisted state cannot be inferred while DB reads fail.
The heartbeat's fail-closed renewal path stops and closes the browser when it
cannot establish continued ownership. The timing and simultaneous DB failures
are consistent with renewal failure, but the old heartbeat does not retain a
specific RPC failure reason, so a more precise database root cause is unproven.

Provider sessions were zero. Fresh readiness checks at 10:12:25 and afterward
reported safe, no active work and no protected sessions. Automatic idle exit
could not be accepted during the database outage because its authoritative DB
work check fails closed. After repeated safe runtime checks the idle machine
was stopped for cost cleanup, leaving the database queue/lease untouched. No
new request, lease clearing, resend, endpoint change or application signature
followed the lost ownership. The latest cached resilience health was still 200;
that earlier probe must not override fresh connection failures.

At 10:17:47 the original machine was confirmed stopped with zero provider
sessions and unchanged non-image configuration. The stop completed through the
normal shutdown path; no force kill or database lock mutation was used.

The recovery audit confirms an expired lease alone does not make a
`ds160_proof_processing` row claimable. The old owner deliberately skips
settlement after ownership loss. Existing stale maintenance or the guarded
explicit-retry transaction must first retire that row; direct machine restart
is not evidence of resumed delivery. Recovery must re-read the exact row and
reservation before using an existing path, and cannot run while DB ownership
is unobservable. This is distinct from the earlier official Application Error.

Further inspection found a critical legacy cleanup hazard: the checked-in
`mark_stale_submission_queue_batch` definition from migration 0138 overwrites
`applications.submission_result` and its result status for every timed-out row,
including proof-only work. Its staleness predicate does not check for a valid
lease. The later 0151 dynamic patch only extends country cases and does not
add proof isolation. The production function definition could not be read
during the ongoing connection timeout, so production exposure and whether any
application data was affected remain unverified.

Do not start the worker merely to run generic stale cleanup for this email.
The heartbeat now performs read-only checks until the effective function can
be verified and proof-only protection installed. A new migration and isolated
SQL regression are being prepared; no production schema or applicant data has
been changed for this cleanup finding. Official submitted evidence/final fence
must remain authoritative, and any needed data restoration would require a
separate evidence-based recovery rather than another DS-160 signature.

At 10:31 UTC a fresh resilience probe confirmed HTTP 503/circuit open:
both Auth and PostgREST timed out at approximately four seconds. The earlier
cached healthy probe is no longer relevant. No production migration or
queue mutation is attempted while the data plane is unavailable. The machine
was independently rechecked stopped with zero provider sessions at 10:30:36.

The existing proof GET status reader already maps expired processing leases
to failed before dispatch, or unknown after a recorded send reservation. Its
explicit authenticated retry RPC can retire that prior row and create the
next email-only request atomically. Therefore proof rows can safely remain
outside generic stale maintenance; no new automatic send or lease-clearing
path is needed. Recovery still requires fresh readable ownership/state and
the installed proof-isolation migration before waking this worker.

The proposed 0207 migration was executed against an isolated PGlite PostgreSQL
fixture using synthetic rows. The old 0138 function reproduced the proof-only
overwrite of a submitted application result. With 0207, queued and sending
proof rows and their complete application result remained unchanged; an active
lease was protected; ordinary and Korea stale tasks retained their existing
terminal behavior. Fresh-heartbeat exclusion, bounded batches, repeated
migration/sweep execution, and unchanged service-role-only function ACLs also
passed. This is local SQL execution evidence, not production verification.
No repository package dependency was added. Production application state and
the effective function definition still require a fresh successful read.

The checked-in `stale-queue-maintenance.fixture.sql` repeats these behavioral
assertions and refuses an existing application database; its complete rollback
was verified in PGlite 0.5.8. The release mirror test, backend type check and
lint pass (one existing Sentry lint warning). The separate marked-local-DB
integration test, including the existing 0206 queued/sending retry transaction,
is retained but was skipped because no eligible full-schema local PostgreSQL
server was available. No production test or successful email delivery is
claimed. Migration 0207 and its timestamped frontend mirror remain unapplied
while the production data plane is unhealthy; the worker remains stopped.

Independent review identified an additional legacy recovery shape: proof
status with the original `ceac_live` provider. The migration now excludes both
the proof provider and every `ds160_proof_*` status. The SQL fixture includes
this legacy row and verifies its submitted result is preserved as well.

### 2026-09-30 recovery after the database outage

At 11:23 UTC the newer resilience probe was healthy and exact database reads
resumed. The application result still read submitted with one confirmed final
fence. The interrupted email was processing with an expired lease, queued
email payload and no send reservation; there were no other active queues or
valid leases, and the worker/provider were stopped/zero. No result restoration
was necessary.

The effective production maintenance body matched the reviewed 0138+0151
predecessor after whitespace normalization, with no additional behavior to
overwrite. Hash-verified migration 0207 was applied once at 11:25 UTC as
production migration `20260930112547`. Readback verified both proof exclusions,
the valid-lease guard, both application-update guards, invoker semantics and
unchanged service-only execution permissions. The submitted result and final
fence remained intact. No production maintenance function was invoked as a
test, and no applicant answer, photo or submission state was manually changed.

One ordinary authenticated email-only retry returned HTTP 202 at 11:27 UTC.
The existing retry transaction retired the interrupted row as
`ds160_email_lease_expired_before_send`, cleared its old lease, and created a
new email task. The new worker began at 11:27:21 retrieving the same submitted
confirmation. This verifies the existing recovery path on the real queue;
it is not an email success receipt or another application submission.

The run verified the same official confirmation at 11:28:54 and reserved its
single send at 11:29:10. At 11:30:56 the new diagnostics retained SHA-verified
official evidence and the previously missing final network chain: the email
POST received a 302 after approximately 90 ms, followed by a GET of CEAC's
`Complete_Done.aspx` that waited approximately 100 seconds before redirecting
to `AppError.aspx`. The official page explicitly displayed Application Error.
This locates the observed failure after dispatch in CEAC's completion flow;
it does not identify an internal SMTP/database cause or prove whether a mail
was actually delivered. No success receipt was observed.

At 11:30:58 the task settled unknown with its lease cleared. Readback confirmed
no active sibling, the application result still submitted, and one confirmed
final-submission fence. At 11:32:19 runtime readiness was safe with zero active
work and zero provider sessions; automatic machine idle shutdown is checked
separately. No second email or application signature was attempted this round.

At 11:33:40 automatic idle shutdown was verified: the sole machine was stopped,
provider sessions were zero, and all non-image configuration hashes matched.

### 2026-09-30 submission-to-email flow regression

The explicit submitted-application URL reproduced an incorrect failure card:
the authenticated submission-status API returned `stalled` while its own
result remained `submitted`. The database application and confirmed final
fence were intact. Two read-side defects combined: `submitted` was missing
from terminal application-status mapping, and the query limited to the newest
queue before excluding proof/email rows, hiding the real submission queue.

The status route now recognizes persisted submitted results and excludes both
proof providers and proof statuses in the database before LIMIT, retaining
legacy NULL providers/statuses. A production read-only query with those exact
filters returned the original successful submission queue. This changes no
application data and never enqueues work. Terminal-result and authenticated
GET regressions plus existing proof/result-card tests passed: 71 tests; frontend
type check passed, with lint reporting zero errors and 57 existing warnings.

The authenticated confirmation download returned 149,307 bytes with a valid
PDF header and the exact hash of the previously validated English official
PDF. The separate email endpoint returned unknown for the latest dispatch.
No official email success receipt is claimed. Production UI acceptance and
release verification follow separately.

Production release `f6b30ef1` was verified READY with the production alias and
matching Git commit. The authenticated status API now returns completed and
the original submitted queue. The real browser showed confirmation PDF and
appointment next steps; its download button returned the same validated
English PDF hash. The next authorized browser email request created exactly
one proof job at 12:16:48 UTC. It ended with `ds160_email_retrieval_failed`
before reserving a send, with no official audit artifact. This is not the
previous run's SHA-verified Application Error and does not prove an email was
dispatched. The application remained submitted with one confirmed fence, no
active sibling, and the provider/machine were zero/stopped at 12:21:53 UTC.

### 2026-09-30 automatic email product flow

The applicant clarified that no email-send button should be needed. The new
flow starts an official confirmation-email job after a new DS-160 submission
has been verified and its browser released. It uses the account recipient,
the existing proof queue and durable one-shot dispatch fence. A persisted
source intent and stable request ID make enqueue recovery idempotent; a page
refresh only reads status. Email failure remains separate from official
submission success and the downloadable English confirmation.

The result card removes email-send, recipient selection and retry buttons;
it retains the PDF download and displays queued/sending/sent/failed/unknown
email states in the chosen language. A sent receipt describes what CEAC
reported and does not assert inbox delivery. Old submitted applications are
not mass-enrolled or re-signed by this release. The current applicant's
separate authorized recovery monitor remains scoped to their existing email
task. Validation and release evidence for this change are recorded below.

Validation: 48 submission-service tests passed serially, including nine
automatic-handoff cases, 17 email-worker cases, lease handling and Chromium
one-shot-send fixtures. The first parallel run had one timing-sensitive
100 ms postback fixture fail while the compiler was running; the isolated
serial run passed all 48. Service type-check/build passed. Frontend validation
passed 10 result-card tests, three catalog-alignment tests, 61 status/proof
tests, three proof-route tests and type-check. Full lint had zero errors and
57 existing warnings. No additional official submit or send was used for these
tests. Production release acceptance is recorded separately below.

Release `c433e325af9c082825f80311e9fef4fb58810604` was authored with the
verified VIZA identity. The worker image
`ds160-auto-email-c433e325@sha256:27b20c7c463a78344ed3f6c6fffde0cdd565f96edb0dc78d0558bcc12da24086`
was installed on the existing legacy machine only after global queues were
idle, provider sessions were zero and two fresh readiness checks were safe.
The non-image configuration hash remained
`f9280f447f53b0935e07313f7ac1f25deec8669da1080d3ac71c72e1e259ec3f`.
Cold-start health/ready/deploy-ready passed with DB reachable and zero work.
Readback showed no automatic backfill, no new current-application job, and the
original submitted result unchanged. Final idle and frontend acceptance follow.

At 12:55:47 UTC the new worker had automatically stopped, with zero provider
sessions and the same configuration hashes. Frontend deployment
`dpl_BnP2CSpBDSv1sUrCaUPSh8kMdrQ4` was READY on `app.viza.it.com`, with the
exact `c433e325` release commit. The authenticated production browser then
showed zero email-send/recipient/retry buttons, an enabled confirmation-PDF
download and a separate honest automatic-email failure state for the existing
email job. Submission-status remained completed on the original submitted
queue. The real download button again returned the verified English official
PDF (149,307 bytes; SHA256
`745746d05ef643ef3f63de0ddf049f7ae71da7aab20281268b257f340e5072fe`).
Page refresh and GET checks created no new job. A cropped screenshot attempt
timed out; the production acceptance is supported by the DOM, authenticated
API responses and downloaded-file hash, not a screenshot claim.

The new automatic handoff was validated with local lifecycle/Chromium fixtures
and production cold-start checks. It was deliberately not exercised by signing
this already-submitted application again. The current application's official
email still has no verified success receipt; its separately authorized monitor
continues recovery without changing the submitted result.

### 2026-09-30 13:00 UTC authorized email-only retry

Fresh service health, exact submitted result/confirmed fence, terminal prior
email, expired cooldown and zero queue/provider activity were verified before
one authenticated recovery request. The new job reached the same official
confirmation at 13:02:06 UTC and reserved a single send at 13:02:23. Its
encrypted official evidence passed SHA verification: email POST returned 302
after about 75 ms, then Complete_Done returned 302 after about 100 seconds to
the official Application Error page. No success receipt was present. The
result settled unknown at 13:04:11, cleared its lease, and preserved submitted
application/confirmed fence with zero active sibling. This run's evidence is
distinct from the prior retrieval failure without an artifact. It cannot
establish an SMTP cause or actual mailbox delivery. Provider/readiness were
zero/safe at 13:05:11. At 13:07:10 the machine was automatically stopped,
provider sessions remained zero and all configuration hashes were unchanged.

### 2026-09-30 13:30 UTC authorized email-only retry

After the 30-minute interval and a fresh terminal/lease/identity check, one
authenticated request created an email-only recovery job. The same official
confirmation was verified at 13:32:41 and a single send reserved at 13:32:57.
This run's encrypted official evidence passed SHA verification: POST email
returned 302 after 89 ms, then Complete_Done returned 302 after approximately
100 seconds to the official Application Error page. No success receipt was
present. The task settled unknown at 13:34:53, released its lease and left the
application submitted with one confirmed fence and zero active sibling.
Provider sessions were zero and readiness safe at 13:35:28. No application
submission/signature, answer/photo change or route change occurred.
At 13:37:13 the machine was automatically stopped, with provider sessions zero
and all non-image configuration hashes unchanged.

### 2026-09-30 14:01 UTC authorized email-only retry

Fresh health, queue/fence/lease checks and the full 30-minute interval preceded
one authenticated email-only request. The same official confirmation was
verified at 14:03:15 and one send reserved at 14:03:31. This run's encrypted
official evidence passed SHA verification: email POST returned 302 after
149 ms, then Complete_Done redirected after approximately 100 seconds to the
official Application Error page. No success receipt was found. At 14:05:19 the
job settled unknown and cleared its lease; application success, the confirmed
fence and zero active siblings were independently read back. Provider sessions
were zero and readiness safe at 14:06:18. No re-signing, application creation,
answer/photo edits or connection-route changes occurred.
At 14:07:56 the machine was automatically stopped; provider sessions remained
zero and all non-image configuration hashes matched the deployed baseline.

### 2026-09-30 14:31 UTC user-requested manual email retry and diagnosis

The user explicitly requested a manual start and debugging. Fresh service,
database, lease, confirmed-fence and provider checks passed, and the full
30-minute interval elapsed before one authenticated email-only request. No
application resubmission or signature was attempted. The official confirmation
was verified at 14:34:22 UTC and a single dispatch reserved at 14:34:40.

This run's encrypted evidence passed SHA verification. The email POST returned
302 after 87 ms; the subsequent Complete_Done GET took 100,130 ms before
redirecting to AppError, whose body reported Application Error. No official
success receipt was present. The job settled unknown at 14:36:27 and released
its lease. Independent code review found one final button click, no manual
redirect, request abort or second dispatch, and observation-only waits after
dispatch. The local 30-second navigation/click timeout explains the diagnostic
flag but does not mean the POST was absent. The server's error response does
not identify an SMTP cause or establish actual inbox delivery.

At 14:37:34 provider activity was zero and readiness safe. At 14:38:47 the
machine was automatically stopped with unchanged configuration hashes. A
fresh authenticated production flow read returned the original submission as
completed/submitted, the new email job as unknown with the correct bound
recipient, and the English confirmation PDF as ready. The downloaded PDF was
149,307 bytes and matched the previously verified English-file SHA. These GET
checks created no new email job. The authorized monitor retains its 30-minute
backoff and cannot replay this turn's consumed prior-job fence.

The first local redirect-chain fixture was not safely isolated: Chromium's
follow-up GET bypassed the Playwright route handler and reached the public
official completion page, which returned 403. No applicant credentials or
real email dispatch were involved in that synthetic fixture, and its result
is not evidence about this production job. That fixture was removed. The
confirmation-email suite now explicitly sets its browser context offline,
including redirected traffic. A new real-Chromium regression verifies that a
302 whose destination cannot complete preserves the POST evidence, invokes
one send fence and one final POST, and reports unconfirmed rather than sent.
All 10 focused browser tests and the service type-check passed. This covers unavailable redirect
handling; it does not claim to reproduce the complete 100-second official
AppError chain or fix the external official email service.

### 2026-09-30 15:22 UTC explicitly authorized new DS-160

The user explicitly confirmed creating and submitting one additional real
DS-160 to validate automatic official email after submission. The old email
monitor was deleted; the previous successful application remains intact.
The production "apply again and fill form" action created one separate draft.
Its 380 saved answers matched the previously confirmed source as a multiset,
with zero differences, and all official identity/recovery/result fields,
queue history and final-signature fences were empty.

The new-application route does not copy application documents. The approved
600-square JPEG (55,988 bytes) was therefore uploaded to the new application
through the normal authenticated `/api/document-upload` endpoint. Private
Storage readback matched the approved SHA256 exactly; profile documents were
unchanged. The production form initially displayed 127/127 required answers,
but subsequent browser operations repeatedly stalled. No successful browser
upload or submit click is claimed. The authenticated completeness endpoint
independently returned questionnaire/document/overall complete and zero
missing items. Read-only retry planning returned `fresh` with reason
`no_prior_official_application`.

After fresh health, zero global active/leased work, stopped machine and zero
provider-session checks, one authenticated request to the same protected
submission endpoint returned HTTP 200 at 15:22 UTC and woke the worker.
The new queue was created at 15:22:42 and its official run started at 15:22:51.
The first readback was processing, with a renewing lease, no active sibling
and zero final fences. A local single-use request fence prevents replay of
the API helper. No manual email request has been made for this new draft.
Official submission, review parity and the automatic mail handoff/receipt
remain to be verified from this new run's evidence.

At 15:24:08 the run reached Personal Information 1. At 15:25:36 the page
readback verified 13 fields. The persisted official identity was independently
confirmed present and different from the previous successful application;
only that boolean comparison was exposed. The new queue remained processing
on its first attempt, with no final signature fence. A new monitor now tracks
this application exclusively; its reused display ID does not restore the old
application's deleted retry prompt.

At 15:32:41 address/phone passed; passport passed at 15:34:14 and U.S.
Contact began at 15:34:26. This remains the first run with no retry. The
separate frontend read-only audit found whole-form rendering hotspots but no
evidence of an infinite React initialization loop; the browser debugger
connection failure is not an official-run failure. No live worker or frontend
deployment was changed during this run.

### 2026-09-30 15:50 UTC new-run photo service failure

The first new-application run completed all five Security and Background
pages, then entered photo upload at 15:50:10. The failed run's encrypted
official-evidence bundle and its single embedded screenshot both passed SHA
verification. The official screenshot displays a generic request-processing
error; the persisted error identifies Identix. This is evidence of an official
photo-service failure, not evidence that the image failed photo requirements.
No Review/signature/confirmation was reached and the final-fence table remained
empty. The bundle did not contain a photo DOM JSON or network trace, so the
underlying server cause cannot be established from this capture.

The existing worker automatically began a second attempt at 15:50:26 and
resumed the same captured official application. At 15:51:53 it reached
Personal Information 1. Fresh reads showed processing, attempts=1, a valid
renewing lease, zero active siblings and zero final fences. No operator retry,
new draft, answer/photo change, deployment or route change was performed.
The active attempt is preserved while its result is observed.

At 15:59:08 the second attempt reached photo upload and failed at 15:59:20
with the same Identix classification. Its own encrypted evidence and embedded
screenshot passed SHA checks; the screenshot again shows the generic official
request-processing error. No photo-content rejection or HTTP 403 was evidenced.
The existing bounded worker started attempt three at 15:59:24, resuming the
same draft; at 16:01 the queue remained processing with attempts=2, a valid
lease, no active sibling and no final fence. No additional manual enqueue was
issued. Automatic email has not been reached.

A read-only retry-classification audit confirmed that Identix service errors
are currently bounded transient failures. It also found that the untyped
PhotoRejectedError conflates explicit content rejection with timeout/handoff
failures; those cases need separate classification in a later scoped fix.
The 29 existing focused photo/orchestrator/retry fixtures passed. No code or
runtime configuration changed during the active official attempt.

### 2026-09-30 16:12 UTC new submission confirmed and automatic email started

Attempt three passed photo upload and Confirm Photo at 16:08:48, then reached
official Review. The official submission timestamp is 16:12:07 UTC. The new
application and queue are submitted with one confirmed final fence, and its
official identity is different from the old application's identity. The old
application independently remains submitted. No further signature is permitted
for either confirmed application.

For this successful third run, both encrypted input/official artifacts and all
16 embedded files passed SHA verification. Seven official Review snapshots
yielded 149 matched expectations and zero issues, including a replay against
the current comparison code. The 380-row input snapshot exactly matches the
current 380 saved answers. The official confirmation PDF downloaded with a
valid PDF header (149,537 bytes). The separate location comparison also passed.
These checks do not establish exhaustive 380-field official parity: social
media branch state and preparer-assistance still lack structured official
evidence, and a complete Print Application PDF is not stored.

The source result initially recorded `automaticEmail.waiting_for_cleanup`.
After browser/claim cleanup, its lease was null and the intent became `queued`,
linked to one new `official_ceac_email` task created at 16:12:49. The new task
was picked up automatically for confirmation retrieval. No operator email
POST was issued for this application. This verifies the production automatic
handoff; official email sending/receipt remains a separate pending acceptance.

### 2026-09-30 16:19 UTC automatic email acceptance result and cleanup

The new application's automatic email task verified the same official
confirmation at 16:14:23 and reserved its single dispatch at 16:14:39. Its
nested email request ID equals the successful source submission queue ID,
confirming the automatic handoff. No manual email request or additional
signature was issued. The authenticated proof GET also confirmed that the
recipient matches the current authenticated account.

This new email run's encrypted official evidence passed SHA verification and
captured the official Application Error page at 16:16:25. The send-phase
document trace contains one POST to email.aspx, a 302 response after 88 ms,
then a GET to Complete_Done.aspx which returned 302 after 100,123 ms to
AppError.aspx (HTTP 200). No explicit email-success receipt was present.
The task therefore correctly terminated as email_confirmation_unknown at
16:16:27, rather than claiming delivery. The diagnostics receiptEvidenceHash
also hashes non-success observations; its presence alone is not proof of
successful sending. These are this new run's observations, independently of
the older application's similar failures. The server's internal cause and
actual inbox delivery remain unknown.

Independent authenticated read-only acceptance returned submission completed,
result submitted, and confirmation proof ready. The downloaded confirmation
PDF is 149,537 bytes, SHA256
e23b0b9e0f3f24b659dd12679ea2d76bb8d5720d8ba0b8de1ae35ee5b63922a8.
PDF parsing found two pages with English confirmation content and no CJK text.
It is an official English confirmation PDF, not an email receipt or a complete
Print Application field audit. The two structured coverage gaps above remain.

Fresh final state retained the submitted application and one confirmed final
fence, with zero active application jobs and no email lease. At 16:19 the
provider had zero pending/running sessions and the machine had automatically
stopped; all non-image configuration hashes were unchanged. The monitored
submission and automatic-trigger checks passed, while official email success
remains blocked by the observed CEAC completion-page error. This monitor is
ended at that external terminal result; no further application creation,
signature, manual resend loop or deployment is used to mask the failed email
acceptance. A later email-only retry can use the existing submitted application
after the official service recovers, without another DS-160 submission.

### 2026-09-30 21:27 UTC user-authorized email recovery resumed

The user explicitly asked to resume. Fresh health and database reads confirmed
the new application remains submitted with one confirmed final fence, the
previous automatic email is terminal unknown, no sent task exists, and there
are no active jobs or leases. The provider had zero sessions and the machine
was stopped with unchanged configuration. More than thirty minutes had elapsed.

A separately scoped copy of the single-use authenticated email retry helper
retains the existing account check, exact latest-job check, wx request fence,
and no-replay behavior. Only its application ID and local fence prefix differ
from the reviewed helper; the old-application helper was not executed. One
email-only POST returned HTTP 202 and created a task at 21:27:22 UTC. The
worker started at 21:27:44 and readback confirmed confirmation retrieval with
a valid lease. The submitted result and confirmed fence remain intact. No
formal application submission, draft creation, answer or photo change occurred.

The user-authorized recovery monitor has been restored at thirty-minute
intervals. Active work is only observed; another email attempt requires a
terminal result, released lease/provider session, fresh state verification,
and the minimum interval. Sending success remains unverified for this attempt.

### 2026-09-30 21:58 UTC bounded email-only recovery

The 21:27 recovery attempt verified the official confirmation at 21:29:16,
reserved dispatch at 21:29:32, and terminated unknown at 21:31:25. Its own
encrypted evidence passed SHA verification and again showed the official
Application Error page, with no explicit sending-success marker or new 403
signal. Fresh reads at 21:56 confirmed lease cleared, no active sibling,
no sent task, application submitted and one confirmed fence. Health was
healthy; the machine was stopped with zero provider sessions and unchanged
configuration.

After a second fresh read confirmed the thirty-minute interval, one normal
authenticated email-only request returned HTTP 202 and created a task at
21:58:03. The worker started at 21:58:27; its first readback showed confirmation
retrieval with a valid lease. The prior request fence is consumed and is not
replayed. This is an explicitly authorized recovery attempt, distinct from
the successful automatic handoff already verified at 16:12. No formal DS-160
submission, answer/photo change, deployment or route change was performed.

The 21:58 task verified the same official confirmation at 21:59:58 and
reserved its single send at 22:00:14. Its own encrypted evidence passed SHA
verification, capturing Application Error at 22:02:00 without a success
receipt. The bounded send document trace shows POST email.aspx returning
302 after 73 ms and Complete_Done.aspx returning 302 after 100,130 ms to
AppError.aspx (HTTP 200). The task terminated unknown at 22:02:03 with its
lease cleared. These observations do not establish the official server's
internal failure cause or actual inbox delivery. No second request was made
in this monitor turn. At 22:03 provider sessions and runtime active work were
zero; the normal idle lifecycle was allowed to stop the machine.
At 22:05:18, the machine was verified automatically stopped with zero provider
sessions and unchanged non-image configuration. The application still showed
submitted with one confirmed final fence and no active work. The restored
monitor retains the existing thirty-minute backoff and does not treat this
unchanged external error as a new sending-success result.

### 2026-10-01 00:07 Europe/Berlin: user-directed single-attempt debugging

The user replaced scheduled retries with a single attempt followed by diagnosis,
an evidence-backed correction and revalidation. The thirty-minute monitor was
deleted. A debug-only helper preserves normal account authentication, exact
terminal-job/recipient checks, wx prior-request fencing and one POST; only its
minimum-age rule and local fence namespace differ from the reviewed recovery
helper. Offline mocks verified single dispatch and refusal/no replay for active,
sent, mismatched, existing-fence and timed-out requests. Neither prior helper
nor any consumed fence was overwritten or replayed.

Fresh checks showed the target still submitted with one confirmed final fence,
no active job/lease, healthy database service and stopped machine/provider zero.
One email-only POST returned 202 and created the debug task at 22:11:37 UTC.
The run verified the same official confirmation at 22:13:33 and reserved one
dispatch at 22:13:48. Its encrypted final evidence passed SHA verification and
captured the official Application Error page at 22:15:34, without a sending
success receipt. This run's POST email.aspx received 302 after 78 ms; its
Complete_Done.aspx GET received 302 after 100,127 ms to AppError.aspx (200).
The preserved result is unknown, not sent. No additional request followed this
failure while diagnosis continued.

The target recipient domain independently has an MX record; that establishes
DNS mail routing only, not mailbox validity or actual delivery. At 22:17:57
UTC the machine had automatically stopped, provider sessions were zero and
configuration was unchanged. The application remains submitted with one
confirmed fence and no active job. No new DS-160, signature, answer/photo
change or production deployment was performed in this debug attempt.

The scoped correction tracks the main-frame document request across the final
click and waits under a 180-second overall bound, retaining the 30-second click
budget and one dispatch. Same-page/AJAX receipts retain their bounded settlement
path. An additional ownership assertion after the durable reservation callback
prevents a newly lost claim from clicking. HTTP failure bodies cannot become a
sent result merely by containing receipt-like text. Independent review identified
the ownership boundary; the correction preserves the existing send fence.

The worker now captures visible pre-send text and pixels in memory after the
verified recipient/No state and before reservation, then rechecks ownership.
The existing final encrypted artifact contains both captures. Final-page closure
or capture failure retains available pre-send evidence; public queue metadata
contains only artifact references and failure-stage flags. No new plaintext
artifact, recipient value, credential or request body is logged.

Validation: 15 offline Chromium confirmation-email tests and 31 proof-email/audit
regressions passed, as did service type-check, build and diff checks. The slow
navigation fixture covers a delayed document POST response; it does not claim
to reproduce the official 100-second redirect chain. The separate offline 302
fixture remains unknown and one-shot. These client-side and evidence fixes do
not prove the official email service is repaired. Production revalidation follows
only after the idle deployment gates and preserved-configuration checks.

Release `8a6d67be` was authored by the verified VIZA identity. A build-only push
produced image `ds160-email-8a6d67be` with immutable digest
`sha256:b0dae92c2b2f9c0649a774852721cc26637e65e43dfe1f3ad93b209e254a4fbf`.
Global submission/runner active counts were zero; two fresh readiness checks
at 22:44 UTC were safe with provider zero. The original machine was stopped
and updated image-only. Environment, guest, services and full non-image hashes
were unchanged. At 22:46 UTC cold-start health, database reachability, worker
startup and deployment readiness passed. Frontend and database schema were not
deployed or altered.

Fresh target state still showed submitted, one confirmed final fence, no active
sibling or lease, and no sent email result. The normal authenticated debug helper
issued exactly one post-fix email request at 22:46:55 UTC (HTTP 202); its new
worker began at 22:46:58. No timed retry was restored and no application
submission endpoint was invoked. The request's final outcome remains subject
to current-run official evidence verification.

Post-fix acceptance: the same official confirmation was verified at 22:48:32;
the pre-send capture completed at 22:48:47 and one dispatch was reserved at
22:48:49. The current encrypted artifact passed SHA verification. Both pre-send
text and screenshot are present with no capture failure, the bound recipient
matches the account digest, and the pre-send text has no Application Error.
No raw recipient or applicant values were emitted. The captured form passed
the sender's visible recipient, exact enabled control and Additional Email No
readback guards before reaching reservation.

The current-run document trace contains one email.aspx POST, returning 302 in
82 ms. Complete_Done.aspx then returned 302 after 100,599 ms to AppError.aspx
(200). The new waiter remained active through that final document. The final
capture at 22:51:04 contains Application Error and no explicit sent receipt;
the full sender observation took 152,901 ms. The result is still unknown and
the exact claim was released. Thus early client waiting is no longer a viable
explanation for this observed completion-page error. The trace does not expose
the official server's internal mail/SMTP cause or prove inbox delivery, and no
unsupported client change or further send is justified by this result.

Authenticated read-only acceptance returned completed submission, ready English
confirmation PDF (149,537 bytes, unchanged SHA), and unknown email with the
bound account recipient. Fresh raw application status and result remain
submitted, with the original 16:12:07 update timestamp and one confirmed final
fence; active target work and sent-email counts are zero. The read-only refresh
created no additional email job. Runtime and provider active work were zero at
22:51 and again 22:53. The scheduled monitor remains deleted.
At 22:54:20 the normal idle lifecycle had stopped the machine. Provider sessions
were zero and every non-image configuration hash remained unchanged.

Status-read nuance: the submission-status response also contains a secondary
`applicationStatus: action_required`. Read-only source tracing found this is a
timestamp-based API derivation when the successful source queue was updated by
automatic-email intent/dispatch after the application result timestamp. It is
not the raw application status or an email-worker application mutation. Primary
status remains completed, the source queue remains ds160_submitted and the raw
application/result remain submitted. This derived-label inconsistency was not
changed in the scoped worker release and must not be mistaken for a failed
DS-160 or used to authorize another submission.

### 2026-10-01: continued email diagnosis and submitted-status correction

The same post-fix email evidence was inspected further without another send.
The Additional Email No selection produced a document POST to email.aspx with
HTTP 200 in 112 ms. The final email POST began 11.36 seconds after that response.
This rules out a missing or overlapping No postback for this observed run.
The private pre-send text describes an additional recipient, matches the bound
account digest, and contains no visible form-error keywords. No raw form text,
recipient, hidden field value, request body or screenshot was published.

Read-only code review found one native final click, no injected form submission
or navigation, and a language-change postback followed by confirmation identity
verification. Fifteen offline sender tests passed again. These checks do not
reveal the official server's internal cause of the subsequent Complete_Done
timeout/AppError. No unsupported workaround, new official request, or timed
retry was introduced during this investigation.

The secondary applicationStatus derivation has a scoped correction: a stored
submitted DS-160 result with a successful ceac_live/ds160_submitted queue stays
submitted when automatic-email metadata makes the queue timestamp newer.
Actual submission failure, active retry, manual action and missing-result cases
retain their previous precedence. This corrects an API label; it does not mark
email as sent, rewrite application data, or change the official-email runner.
Production verification is recorded below after release.

Release acceptance: 46 focused route tests, frontend type-check and local
production build passed. Full lint had zero errors and 57 existing warnings.
The organization CLI account, exact linked project/team/root and release author
were verified. The dry upload manifest excluded credentials, local evidence,
build caches and backend services. Frontend-only release `1a36a1d6` produced
deployment `dpl_2ptEnJ7tnVq3nQFW9rtM61F47mqV`; its READY state and exact commit
were verified before promotion. The alias API independently confirmed
app.viza.it.com points to that deployment (the deployment's own alias list
did not include the custom domain).

Authenticated production GET now returns status completed and applicationStatus
submitted. Confirmation proof is ready; the English PDF remains 149,537 bytes
with SHA e23b0b9e0f3f24b659dd12679ea2d76bb8d5720d8ba0b8de1ae35ee5b63922a8.
The separate email GET remains unknown and the recipient matches the account.
Real Chrome refresh shows submitted confirmation and the PDF control alongside
the email-unknown notice, with no submit or email-send/retry button. No new
official request was made for acceptance. Fresh database checks retain one
confirmed final fence, zero active jobs and zero sent-email results. At 00:21
UTC the worker was still stopped, provider zero, with unchanged configuration;
this release did not deploy or wake the worker. The official email completion
error remains unresolved and must not be described as a completed send flow.

### 2026-10-01: private email-form state diagnosis

The next investigation is scoped to a remaining evidence gap: the pre-send
artifact had visible text and pixels but no native/ASP.NET validity or control
group/form relationship metadata. The diagnostic addition reads exact email
controls, check state, enabled/type/presence flags, same-group/form booleans,
native validity, ASP.NET boolean validation state, and hidden-state presence
without recording hidden values. It does not trigger validation, dispatch DOM
events, modify controls, or change sending behavior. Form metadata is optional
and confined to the encrypted private artifact, never the public queue payload.
Only the exact official email page and safe action pathname are eligible.

Fresh pre-release checks retain the existing submitted application/result and
one confirmed final fence. There are no active target/global queues, runner
slots or provider sessions. The production machine is stopped with unchanged
configuration. The previous email remains unknown with no sent result. This
diagnostic addition is not evidence that the CEAC mail service has been fixed;
validation, release and the next controlled attempt are recorded below.

Validation: all 32 worker/private-audit storage tests passed, including real
offline Chromium metadata capture, missing ASP.NET state, same-origin and
foreign action redaction, navigation-race rejection and zero validation/form
events. Service type-check and build passed. The unchanged sender suite had
14 passing cases and one pre-send recipient/deadline failure under parallel
local browser load; that short-deadline late-receipt case passed on its isolated
rerun. The initial diagnostic evaluator issues were repaired and the complete
modified worker suite rerun before release. No fixture made a live CEAC request.

Release `09c0fe4d` was built and pushed without changing the running worker,
then installed as immutable image
`ds160-email-09c0fe4d@sha256:2b8ea2981ddead64efc1de9d8bc9ea98980723c474eb22a1ae5a0569f1a718a5`.
Organization Fly identity and release author were verified. Global job queues
were empty; two fresh deployment checks reported safe/activeWork zero with no
protected/provider sessions. The only infrastructure slot belonged to the idle
machine started for readiness and was released by its normal stop before the
image-only update. Environment, guest, services and full non-image configuration
hashes remained unchanged. At 20:32 UTC cold-start health was ok, database-ready
and worker-started were true, and deployment readiness remained safe with no
provider sessions. The stored application/result remained submitted with one
confirmed final fence and zero sent email results before the controlled retry.

At 20:32:46 UTC the ordinary authenticated email-only recovery API accepted
one request (HTTP 202). The new job began at 20:32:55 and entered confirmation
retrieval; no DS-160 submission, signature, answer/photo change,
draft creation, recipient substitution or timed retry was performed. The local
prior-job attempt fence remains consumed and will not be deleted or replayed.

Current-run outcome: the same official confirmation was verified at 20:34:34.
The pre-send private capture at 20:34:49 passed ciphertext SHA verification and
contains body, screenshot and form metadata with no capture failures. The bound
recipient digest matched. Exact No/Yes/send control counts were one each; No was
checked and Yes unchecked, all enabled, and the send control was a submit input.
Radio group and form relationships matched. The single form used POST to the
exact official email path. All ten eligible native controls were valid;
Page_IsValid was true and the one ASP.NET validator was true. VIEWSTATE was
present/nonempty. EVENTVALIDATION was absent; no server-required-state conclusion
or token injection is justified by that observation. No hidden values, control
names/values or applicant data were emitted. Raw public payload readback confirms
formMetadata is absent; it remains inside the encrypted private artifact only.

One dispatch was reserved at 20:34:52. The email POST returned 302 in 73 ms.
The following Complete_Done GET returned 302 after 100,112 ms to AppError (200).
The final 20:37:05 SHA-verified capture contains Application Error and no explicit
sent receipt. Sender elapsed time was 151,208 ms. At 20:37:09 the job settled
unknown with lease cleared, no active sibling and zero sent results. Exactly
one new job exists for this controlled attempt. The latest run's evidence, not
an earlier error screenshot, supports these observations.

The diagnostic evidence further excludes invalid native/ASP.NET form state,
wrong No selection and wrong button/form association for this attempt. The
blocking response is the official completion page after the accepted POST;
the server's internal mail result remains unavailable. Its approximately
100-second duration matches the [documented default .NET SMTP timeout](https://learn.microsoft.com/en-us/dotnet/api/system.net.mail.smtpclient.timeout?view=netframework-4.8.1),
but this is only a possible explanation: CEAC implementation/configuration and
SMTP logs have not been obtained, so an SMTP cause is not established. The
[official FAQ](https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/forms/ds-160-online-nonimmigrant-visa-application/ds-160-faqs.html)
describes a Thank You page after Email Confirmation; that successful completion
was not observed here. No further unsupported client patch or blind retry was
performed. Actual inbox delivery was queried separately and is not inferred.

Authenticated production GET acceptance still returns completed/submitted,
ready English confirmation proof, unknown email and an account-matching recipient.
The two-page PDF remains 149,537 bytes with the unchanged SHA and no CJK text.
The application/result remain submitted and the final fence remains confirmed.
At 20:39:55 the normal idle lifecycle had stopped the worker; provider sessions
were zero and all non-image configuration hashes were unchanged. No scheduled
monitor was recreated.

### 2026-10-01: user-specified recipient reconfirmation

The user reported no inbox receipt and explicitly requested another send to
their bound account address. Readback of the previous job's recipient digest
matches that requested address; the previous attempt did not target another
recipient. Fresh database checks retain submitted/result submitted, one
confirmed final fence, no sent result, no active work/lease and provider zero
with the machine stopped. No sender or infrastructure configuration changed.
One ordinary authenticated email-only request was accepted at 20:45:34 UTC
(HTTP 202). The new worker run began at 20:45:58, and the new queue's recipient
digest again matches the user's requested address. It reserved one dispatch
at 20:47:48; no parallel sibling or second request was created. Final receipt
and cleanup acceptance are recorded after settlement below.

This new run verified the official confirmation at 20:47:30. Its private
pre-send and final artifact passed ciphertext SHA verification; body,
screenshot and redacted form metadata were present with no capture failure.
The requested account recipient was visible, No/Yes/group/form/send states
matched and all ten native controls plus the ASP.NET validator were valid.
The one final email POST returned 302 in 87 ms; Complete_Done returned 302
after 100,119 ms to AppError (200). The 20:50:02 final capture contains
Application Error, no explicit sent marker and no receipt hash. This is new-run
evidence, not reuse of the preceding attempt's artifact. At 20:50:05 it settled
unknown with the claim released. Application/result remain submitted, the one
confirmed final fence remains, and active target work is zero. At 20:51:22 the
provider was zero and worker readiness was safe/activeWork zero while awaiting
normal idle exit. No code, sender configuration, proxy or endpoint was changed.
At 20:53:24 the machine had automatically stopped and provider sessions were
zero. Fresh readback confirms exactly one new job for this user request, no
active target work and zero sent results; all configuration hashes are unchanged.
