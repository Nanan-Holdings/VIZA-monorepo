# CEAC Smoke Test

## 2026-09-20 bootstrap monitor boundary

- The first continuation stopped with a latched HTTP 403 while the retained
  bootstrap diagnostic showed the real CEAC start form. Provider diagnostics
  also showed security verification followed by successful start-page document
  responses. The monitor now starts after both gate and start-page identity
  checks, before location/CAPTCHA interaction. Bootstrap retains its bounded
  security-verification handling; failures after form interaction still latch.
- All 17 focused session/postback browser regressions and type checking passed,
  including an initial 403 challenge that clears into a verified start form,
  persistent gates, and form/document postback failures. This does not prove an
  official submission. The same captured draft is used for live continuation.
- The next live continuation retrieved the same draft and verified Personal 1,
  Personal 2, Travel, Companions, Previous U.S. Travel, Address/Phone and Passport.
  It stopped because an optional `.dat` backup had no Save-to-File control.
  The broad structured-error rethrow had incorrectly made that backup fatal.
  Only optional save-to-file navigation failures may now be tolerated after
  checking the latched postback monitor; settlement waits stay outside that
  catch. No final signing occurred in that run; its provider session completed.
- The five orchestration browser regressions pass, including advancing without
  a Save-to-File control and stopping on its HTTP 403 postback. The latter
  fixture downloads an attachment successfully while its form request fails,
  demonstrating that backup success cannot mask an official form failure.
- The next live run verified the original captured draft through Passport,
  U.S. Contact and Family Relatives. Optional backup absence no longer blocked
  navigation, and both parents' unknown-name hidden-control assertions passed
  against the live page. Present Work/Education selected STUDENT and CEAC
  rejected Next because Monthly Income in Local Currency (if employed) was
  blank with Does Not Apply unchecked. The active schema exposed this field
  but incorrectly marked it optional, and the applicant had no saved income
  answer. This is a missing explicit answer plus required-field contract gap,
  not a proxy failure. The same draft was retained, no final action occurred,
  the provider session completed and the stopped worker's lease was cleared.
- The monthly-income seed, checked-in runtime contract and existing production
  field now require an explicit answer while retaining Does Not Apply. The 55
  focused derivation/contract tests and submission-service type checking pass.
  A production browser reload changed completion from 92/92 (100%) to 92/93
  (99%), showed the missing monthly-income prompt and marked the field required.
  No income or NA answer was inferred or saved; continuation awaits the
  applicant's explicit answer.
- After the applicant explicitly chose no work income, the production form's
  NA checkbox saved both `monthly_salary` and its English alias as
  `DOES_NOT_APPLY`; the UI showed 93/93 required answers. The next live run
  selected CEAC's monthly-income NA checkbox and advanced to Previous
  Work/Education. That page exposed a separate mapping gap: the education
  repeater matched none of its visible controls. An identity-checked Retrieve
  probe observed `dtlPrevEduc_ctl00_tbxSchool*` fields, its date selects and
  year inputs, state/postal NA controls, and Insert/Delete controls. Captured
  metadata excludes answer values and secrets. No final action occurred;
  all completed diagnostic sessions were released.
- The education mappings now use those observed control IDs, including
  state/postal NA companions and separate day/month/year controls. All 45
  focused mapping, derivation and repeat-browser tests pass, as does type
  checking. A browser fixture verifies the observed single-row structure,
  postback re-resolution, NA controls and official length rejection. Live
  Add/Remove behavior for multiple school rows remains unverified.
- Isolated live tail validation exposed excessive remote-browser round trips
  in repeat discovery: the first school input took several minutes to reach.
  Candidate selectors and ancestor containment were queried serially and
  rediscovered repeatedly. The diagnostic provider session was explicitly
  released without a final action. This is a runtime performance finding,
  not an official submission or evidence of an invalid applicant answer.
- A separate identity-checked single-school diagnostic used the observed
  `dtlPrevEduc` container and rechecked its sole `ctl00` row before/after each
  fill. CEAC accepted the saved school record and advanced. Ordinary
  orchestration then filled and passed Work/Education Additional and all five
  Security/Background pages, reaching Photo. This diagnostic deliberately
  omitted photo/final-submit inputs and wrote no queue success. It verifies
  only the applicant's current branches; final submission remains unverified.
- Repeat discovery now batches every selector branch's read-only metadata and
  computes a common ancestor in one page evaluation, disposing temporary
  handles. Fresh row discovery, count/token guards and final read-back remain.
  All 15 repeat-browser regressions and type checking pass after the change;
  the observed-school local fixture decreased from about 35 to 18 seconds.
  This local timing is not a production latency guarantee. The same queue job
  passed captured-resume preflight with no conflicts or final-fence attempts
  and was restarted for a complete guarded submission run.
- That guarded run verified the same application through the normal education
  repeater and advanced to Additional, with the Previous Education checkpoint
  at 20:50:56 UTC. The first school input no longer waited several minutes;
  field filling and full row read-back completed in roughly three minutes.
  This is live evidence for the current single-school branch only.
- The full run reached Sign and Submit after CEAC accepted the photo, but
  correctly stopped before final signing: all 146 review expectations were
  structurally unverified. The old collector saw only generic page labels;
  real answers are idless `div.data` values inside scoped review tables. A
  separate identity-checked read-only capture preserved all seven actual
  table structures. Explicit page/group/container/label rules and composite
  comparisons now match all 146 previously read-back fields against those
  captured rows off line. This offline result alone does not prove a live
  capture or final submission. The failed worker and provider session were
  stopped/released, and its exact terminal queue lease was cleared.
- The new collector then re-read all seven live official review pages for the
  same application. All 146 read-back expectations matched with zero issues;
  this was a read-only diagnostic and performed no signing. The 22 focused
  review/capture/orchestration regressions and type checking passed. The
  original captured queue job was resumed again with final-review and
  one-shot-submit guards still enabled.
- A subsequent replay stopped at Personal Information 1 with CEAC's visible
  completed-draft prompt asking whether to return to Review or continue the
  form. Navigation only handled that prompt after Passport, so the first-page
  transition timed out. No signing occurred and the stopped worker's exact
  terminal lease was cleared. Separately, review matching now rejects a
  continuation separated by a skipped physical table row and excludes answers
  inside hidden ancestors. All 17 review regressions and type checking pass;
  the captured current review still matches 146/146. All 23 final-signature
  and persistent-guard regressions also pass.
- Navigation now handles visible completed-draft continuation on every form
  page and waits for the postback triggered by a delayed continuation click.
  Hidden controls do not add a polling delay, and only explicit continuation
  labels qualify. All 16 targeted navigation/browser tests, including the
  three modal cases, and type checking passed. The exact captured queue job
  passed preflight again and was resumed for the full guarded submission.
- That run traversed the formerly blocked first-page modal and all current
  applicant branches. At 21:53:12 UTC its fresh official review matched all
  146 fields. It stopped before the final reservation because the actual
  signature input was not recognized. A live unsigned-page capture identified
  `rblPREP_IND`, `PPTNumTbx`, `CodeTextBox`, `btnSignApp`, and an initially
  disabled `Next: Confirmation` control. The page explicitly instructs the
  applicant to continue to confirmation after signing. Both prior signing
  paths waited for direct confirmation and missed that continuation.
- Exact preparer/passport identifiers now retain unique selection and read-back
  verification. Shared confirmation navigation observes the disabled control
  before signing and permits its enabled transition once, only for the same
  official application; it never repeats the signature click. Success still
  requires official confirmation controls and the matching application ID.
  The existing signature/orchestration regressions pass 26/26 and type checking
  passes. No final action occurred in the diagnostic capture.
- Fresh live signature preparation then verified the applicant's saved No
  preparer answer, exact passport read-back, one CAPTCHA input, and disabled
  confirmation continuation, without signing. The eight new confirmation
  navigation browser tests pass, including one Next click, direct confirmation,
  duplicate/enabled controls, wrong identity/origin, disabled timeout, changed
  control identity and a latched HTTP 403. Type checking passed again with the
  new tests. The same captured queue job was resumed with no final-fence rows
  or active conflicts; official submission remains pending that live result.

## 2026-09-19 contact organization length

- Follow-up code repair installs the CEAC async form-response monitor before
  any session interaction and preserves structured failures through field,
  read-back, repeat-control and navigation fallbacks. HTTP 403/429 cannot be mistaken for missing
  fields, and an unfinished MSAJAX postback cannot count as DOM settlement.
  Pending full-document navigation is tracked and rechecked within the original
  wait budget; document failures use the same structured error boundary.
  Isolated Chromium fixtures cover an already
  received 403, a 429, a pending timeout, sanitized MSAJAX errors, normal 200
  and no-op paths, normal and delayed document navigation, a document POST
  rejection, navigator Next-button gate propagation, and stopping before a
  dependent input. The final suite passed all 227 regressions, including ten
  focused postback browser cases; type checking, build and diff checks passed.
  These fixtures reproduce failure handling;
  they do not establish live family-page parity or official submission.
  Local Chrome still showed the security-verification interstitial, so no
  further live portal attempt was started after this repair. The application
  remains action-required with no official confirmation or final-click fence.

- The next direct-route live run again verified all pages through U.S.
  Contact, then failed in Family Relatives. Provider diagnostics established
  an official `complete_family1.aspx` XHR HTTP 403 and a corresponding MSAJAX
  `PageRequestManagerServerErrorException`; the screenshot retained checked
  mother-name unknown boxes alongside unrefreshed dependent controls. The
  later missing-other-relatives error was a stale-page symptom, not evidence
  to remove that question. The exact provider session was confirmed completed,
  the stopped worker's lease cleared conditionally, and no final action was
  attempted. Hidden-control branch verification remains required; this run
  does not establish full family-page parity.

- The legacy DS-160 heartbeat now renews its owned, unexpired lease through
  migration 0195. Renewal rejection/error/timeout closes CEAC and prevents
  recovery or final signing; proof/result writes complete before terminal
  queue settlement. Eleven focused lease/orchestration regressions passed,
  following 214 passing DS-160 regressions. A rolled-back database smoke
  verified valid renewal and rejection of wrong-owner, expired, and terminal
  cases. Function execution is restricted to service_role; the security
  advisor introduced no new findings. These checks do not prove submission.
  This is lease renewal, not a completed atomic settlement refactor: existing
  application/result writes and preflight recovery mutations still need a
  shared database-clock ownership fence before relying on automatic takeover
  during in-flight writes. Bootstrap also closes after returning when ownership
  is lost before the caller receives its session. The live test remains an
  exact-job operator run and does not establish those broader failure cases.

- The direct-route continuation retrieved the same captured application and
  verified every page through U.S. Contact. It stopped on Family Relatives:
  after both father name fields were marked Do Not Know, the official page
  removed the father's DOB and U.S.-presence controls, but the runner still
  required the DOB-unknown checkbox. This is observed branch evidence, not a
  missing applicant answer. The owned provider session was confirmed closed,
  the stopped worker's lease cleared conditionally, and the final action was
  not attempted. The four existing live schema rows now have explicit
  both-names-unknown branch conditions. A production browser reload verified
  the dependent DOB/U.S.-presence questions disappear from both entry and
  review, retaining the four parent-name unknown selections. The runner's
  corresponding official-DOM assertion is required before continuation.

- Follow-up routing diagnosis confirmed the failed U.S. residential-proxy
  session had transferred 3,934,695 proxy bytes: the proxy flag was effective.
  A bounded 180-second proxy probe remained in Cloudflare verification, with
  repeated 403 document responses even after a verification-success message.
  Keeping the provider, U.S. region, and standard browser mode unchanged but
  disabling proxies reached the real CEAC location/form controls in 6 seconds.
  The exact captured-resume job is therefore continuing with an explicit
  direct-route runtime override; this does not change other runners' defaults
  or establish why the website rejected that particular proxy route.

- The next two bounded live attempts stopped at the CEAC landing page's
  Cloudflare `Performing security verification` state before any form controls
  appeared. Local Chrome independently showed the same gate. Both owned remote
  sessions were confirmed `COMPLETED`; the stopped workers' stale leases were
  cleared conditionally. Recovery dry-run still reports complete encrypted
  checkpoints, no active conflicting jobs, and zero final-submission fences.
  No official submission occurred. Live validation of the new reconnect path
  beyond bootstrap remains pending; passing regressions do not establish it.

- Later continuations exposed a separate control-connection failure:
  `transportConnected=false` and `pageClosed=true`, while the remote provider
  still held the same normal CEAC page. CEAC now uses the existing reconnectable
  Browserbase connector, re-verifying origin, application identity and an
  allowed filling/navigation page before retrying. It explicitly releases the
  remote session on all closes and has a 1,800-second TTL. Signature actions
  remain outside the retry path. The expanded regression suite passes 199
  tests, including reconnection identity/page guards and provider cleanup.

- A same-draft live continuation verified Personal 1, Personal 2, Travel,
  Travel Companions, Previous U.S. Travel, Address/Phone, and Passport.
  U.S. Contact then stopped because the 47-character organization name was
  read back from CEAC as only its first 33 characters. The official browser
  control log, together with the failure screenshot, established truncation.
- The DS-160 seed and the existing live schema field now declare
  `us_contact_organization.validation_rules.maxLength = 33`. The applicant's
  selected organization uses a meaning-preserving abbreviated official value;
  the full name remains in its source metadata and Chinese display value.
  A production browser read verified both the abbreviated English value and
  the Chinese input's `maxlength="33"`.
- The filler now checks each visible text control's observed `maxlength`
  before writing. An overlong answer raises a value-free length error without
  modifying the control; it is never silently truncated or forced past the
  official limit. All 14 field-filling browser regressions and both affected
  service type checks pass. The preceding complete DS-160 suite passed 183
  tests; these checks do not establish a completed official submission.

## 2026-09-18 captured-draft continuation

- Same-draft retrieval now waits for a recognized in-progress page before
  enforcing the captured Application ID. A live resume passed Personal 1 and
  Personal 2 with the applicant's explicit SSN Does Not Apply answer.
- The Travel run exposed two runtime bugs: intended stay was assigned to the
  repeated specific-plans branch through an indirect derivation, and a parent
  select's postback could reveal a child outside the initial narrow row scope.
  Direct saved aliases now own their branch. Repeat filling re-discovers the
  same row before each field and after postbacks, rejecting changed row counts
  or row identities. Browser fixtures cover the real filler with generated and
  anonymous wrappers, as well as separate values in multiple rows.
- The applicant subsequently confirmed accommodation is not yet determined.
  The current attempt is blocked with its encrypted recovery checkpoint
  retained and no final-click fence. No new official draft or final signature
  should be attempted until truthful accommodation/contact data is supplied.
  These page-level checks and fixtures do not establish full official parity
  or a completed submission.

## 2026-09-15 live continuation

- The applicant explicitly requested a temporary VIZA payment deferral.
  Migration `0192_ds160_local_payment_deferral.sql` allows one local DS-160
  application/queue for at most four hours, without changing unpaid financial
  records or general official-payment eligibility. The real UI Submit returned
  HTTP 200 at 09:55 UTC; UI progress and worker pickup were observed.
- Live validation corrected native-alphabet name translation, the generic
  DS-160 document fallback, and premature classification of CEAC's security
  verification interstitial. The official application reached Personal
  Information 1 at 10:41 UTC, then stopped because recovery persistence wrote
  `official_started_at` to the wrong table.
- The same session's recovery answer was recovered from protected Browserbase
  CDP diagnostics and encrypted in the existing queue. The current official ID
  and security-question text were verified on Retrieve. Continue only that
  captured application with the exact queue resume gate; never enqueue another
  draft. This is recovery evidence, not final submission or full field parity.
- Subsequent same-ID retrieval failed because Personal Information 1 had never
  been saved: supplied surname/year did not match, while empty inputs failed
  required validation. The user explicitly authorized retaining that unsigned
  draft and creating a replacement. The protected checkpoint remains stored;
  its payment deferral was revoked. Recovery persistence now runs before
  Continue, with 136/136 local DS-160 regression tests passing.
- The replacement API initially reused a pre-existing QA empty draft. The
  real-draft lookup now excludes the QA purpose without changing its safety
  marker; the exactly identified answer copy was reverted and its deferral
  revoked. A genuinely new, non-QA draft was created at 11:30 UTC with all 331
  answers equal to the authorized source and no initial official ID or queue.
- The real replacement Submit returned HTTP 200 at 12:25 UTC. At 14:12 UTC,
  all three encrypted recovery fields persisted before CEAC Continue. Personal
  Information 1 then failed City of Birth read-back because the saved answer
  was a placeholder prompt longer than the official field. Other identity
  answers also contained prompts. The worker stopped without a final signature;
  the final-submission attempt table remained empty.
- A verified passport from the same applicant's older documents replaced the
  template passport reference on this application only. Its identity/passport
  values, passport expiration choice, and saved profile birth city corrected
  82 answer rows including bilingual aliases. Protected before-state evidence and source metadata were
  retained. Remaining placeholder and conflicting answers require real data
  before another portal operation. Nonempty-answer checks and historical
  confirmation pages are not evidence of factual correctness.
- The user's subsequent placeholder request was exercised with local fixture
  and DOM tests only. The live queue remains blocked, its expired lease was
  cleared, recovery fields were retained, and the temporary payment deferral
  was revoked. No placeholder answers were signed and submitted. The preflight
  now rejects recognizable prompts in active optional/required fields, follows
  actual English alias precedence, and checks repeat-row conditions. Missing or
  placeholder input stops retries. The account diagnostic identifies six prompt
  fields without emitting their answers; 142/142 local regressions, service
  type-check, and the internal parity audit pass. Browser read-back confirms
  the corrected identity inputs on the owned VIZA form without a submit click.

Repeatable diagnostic for verifying CEAC DS-160 start-page access from the
current machine. Reports whether CEAC is reachable, anti-bot gated, or
otherwise blocked.

## 2026-09-14 verification boundary

- Local Chromium reached a CEAC WAF block. The configured Browserbase path
  reached the genuine DS-160 start page after waiting for security verification.
  An initial HTTP 403 during that verification was not the final page state.
- A start-page smoke proves landing-page access only. It does not establish
  field, option, branch, repeated-row, review, or signature parity.
- Run `npm run audit:ds160-parity` for the internal contract check and
  `npm run audit:ds160-parity -- --json` for the branch inventory. The check now
  includes form fields with no declared runtime consumer, even on inactive
  branches. See [the current gap report](ds160-field-parity-2026-09-14.md).
- Before a live test, inspect the selected application's submitted result and
  existing official confirmation. Do not enqueue another submission merely
  because its top-level workflow status is `processing`.
- Compare the official confirmation's location with the applicant's selected
  post. Stored `embassyOrConsulate` is currently sourced from answers and is
  not independent evidence of the post CEAC actually accepted.
- The selected account's historical submission was retrieved online through
  CAPTCHA and both recovery stages. Matching the Application ID and all three
  official print/email confirmation controls verified that historical result;
  it did not create a new official application.
- The current local DS-160 suite passes 128 tests, including native postback,
  repeat-row isolation, missing-control failures, exact option matching,
  unknown-page stops, active required-answer checks, explicit preparer
  declarations, verified passport inputs, and the persistent final-click guard.
  The final service, frontend, and agent-backend type-checks pass.
  Internal coverage is 336 fields, 77 conditions, and 23 repeat groups,
  with no unconsumed seed fields; official full parity remains unverified.
- The new-application browser action copied saved answers into the existing
  empty draft and reopened that same draft after its missing package link was
  repaired. After upgrading Radix Select to 2.3.7 and Slot to 1.3.3, the real
  review page remained usable and its Submit button was clicked at
  `2026-09-14T22:54:02Z`. Submission access returned HTTP 402
  (`application_payment_required`, reason `official_fee_required`, USD 185);
  no queue job or new official application was created. The receipt is kept
  in ignored `output/playwright/ds160-parity/submission-access-ui.json`.
  The browser also logged a passive-update warning during the subsequent
  checkout navigation; do not describe that navigation as an error-free
  completed payment flow.
- The local seed now includes Step 22: the explicit preparer question and ten
  Yes-branch fields. The runner requires saved data before bootstrap, selects
  country before address fields, scopes NA choices to an unambiguous field,
  and reads every value back after postbacks. On 2026-09-15 the applicant
  explicitly answered `ds160_preparer_assistance=no`; the saved 293-answer
  application passed the then-current presence check. Later inspection found
  placeholder prompts in those saved answers; that pass did not establish
  factual correctness or readiness for live submission.
  The historical 2014 official screenshot does not prove the name NA checkbox's
  current DOM scope; ambiguous/shared behavior still stops for verification.
  The additive seed has not been run against the shared database and the code
  has not been deployed. Publish schema and matching runner together so an old
  runner cannot silently ignore a newly collected Yes declaration.
- DS-160 photo loading now falls back to the same owner's reusable profile
  photo only when no application photo row exists. Explicit application rows,
  including rejected or unavailable uploads, retain precedence. The actual
  selected account passed metadata selection and an exact Storage existence
  check at `2026-09-14T23:26:59Z`; no file bytes were downloaded and no document
  rows were written. The redacted receipt is in ignored
  `output/playwright/ds160-parity/reusable-photo-verification.json`.
- At `2026-09-15T07:49:01Z`, another real UI Submit click passed the local,
  exact-application HTTP payment deferral (preflight 200), then received 500
  from retry-submission because the independent database payment trigger still
  rejected queue insertion. No queue or new official application was created.
  The per-attempt receipt is retained under ignored
  `output/playwright/ds160-parity/ui-attempt-2026-09-15T07-49-01-547Z.json`.
  A Browserbase probe at 07:52 UTC again reached the official start page with
  no gate. Neither result establishes a new official submission.

Run the local DS-160 regression suite from `viza-be/submission-service` before
repeating a live probe (PowerShell):

```powershell
$ds160Tests = @(rg --files src/ceac/__tests__ -g '*.spec.ts') + @(rg --files src/__tests__ -g '*ds160*.spec.ts')
node --import tsx --test --test-concurrency=2 @ds160Tests
npm run type-check
```

These tests exercise local DOM behavior and internal contracts. They cannot
replace the official page-by-page comparison or a confirmed live submission.

## Running the smoke test

From the repo root:

```bash
npx tsx viza-be/submission-service/src/ceac/smoke.ts
```

For headed mode (visible browser, useful for debugging gates):

```bash
npx tsx viza-be/submission-service/src/ceac/smoke.ts --headed
```

## Outcomes

| Outcome | Exit Code | Meaning |
|---------|-----------|---------|
| `start_page` | 0 | CEAC start page loaded; filling and submission remain unverified. |
| `anti_bot_gate` | 1 | Anti-bot / captcha / manual gate detected. Worker cannot proceed. |
| `blocked` | 2 | Page failed to load or identity mismatch. CEAC may be down. |

## Output format

The script emits a JSON object with these fields:

```json
{
  "outcome": "start_page | anti_bot_gate | blocked",
  "probedAt": "2026-04-18T12:00:00.000Z",
  "url": "https://ceac.state.gov/GenNIV/Default.aspx",
  "detectedPageId": "start | gated | unreachable | error | ...",
  "heading": "Apply for a Nonimmigrant Visa",
  "gate": null,
  "summary": "Human-readable summary",
  "error": null
}
```

When `outcome` is `anti_bot_gate`, the `gate` field contains:

```json
{
  "gated": true,
  "gateKind": "captcha | anti_bot_text | captcha_and_text",
  "matchedTextPatterns": ["access denied", ...],
  "matchedCaptchaSelectors": ["iframe[src*=\"recaptcha\"]", ...],
  "visibleTextSnippet": "First 500 chars of visible page text...",
  "url": "https://..."
}
```

## Interpreting blocked / manual-required outcomes

- **`anti_bot_gate`**: CEAC is serving a challenge page. This is an external
  blocker that the worker cannot bypass. Common causes: rate limiting, IP
  reputation, WAF rules. Try again later or from a different IP/machine.

- **`blocked` with `detectedPageId: "unreachable"`**: CEAC did not respond
  within the timeout. The site may be down for maintenance or unreachable
  from this network.

- **`blocked` with `detectedPageId: "<other>"`**: CEAC loaded but showed an
  unexpected page (e.g. outage notice, redirect). Check the `heading` and
  `summary` fields for details.

## CAPTCHA solve mode

To exercise the 2captcha solver against the live CEAC start page:

```bash
npx tsx viza-be/submission-service/src/ceac/smoke.ts --solve-captcha
```

With headed browser (visible):

```bash
npx tsx viza-be/submission-service/src/ceac/smoke.ts --solve-captcha --headed
```

**Prerequisites:** `TWOCAPTCHA_API_KEY` must be set in
`viza-be/submission-service/.env`. The API key is never logged or persisted.
Set `CEAC_LOCATION_CODE` explicitly to the intended post for this CLI probe;
there is no fallback embassy. Live application runners use the applicant's
saved `consular_post` and preserve it across CAPTCHA retries and recovery.

### CAPTCHA solve outcomes

| Exit Code | Meaning |
|-----------|---------|
| 0 | CAPTCHA solved — reached a post-CAPTCHA surface. |
| 1 | CAPTCHA NOT solved — solver failed, wrong answer, or no CAPTCHA found. |

### CAPTCHA solve output

```json
{
  "reachedPostCaptcha": true,
  "captchaOutcome": {
    "status": "solved",
    "solve": { "text": "...", "solveId": "12345", "durationMs": 18200 }
  },
  "postSolvePageId": "security_notice",
  "postSolveUrl": "https://ceac.state.gov/GenNIV/General/...",
  "postSolveHeading": "Privacy and Security Notice",
  "probedAt": "2026-04-23T12:00:00.000Z",
  "summary": "CAPTCHA solved. Post-solve page: security_notice. Heading: \"Privacy and Security Notice\". URL: ...",
  "error": null
}
```

The `postSolvePageId`, `postSolveUrl`, and `postSolveHeading` fields explicitly
identify the reached surface. When `reachedPostCaptcha` is true, these fields
confirm the page advanced beyond the start/CAPTCHA screen.

### Interpreting CAPTCHA solve results

- **`reachedPostCaptcha: true`**: The solver decoded the CAPTCHA and the page
  advanced past the CAPTCHA input. The `postSolvePageId` shows what page the
  browser landed on after solving.

- **`captchaOutcome.status: "wrong_answer"`**: 2captcha returned a code that
  CEAC rejected. The bad solve was reported to 2captcha for refund. Retry by
  running the script again.

- **`captchaOutcome.status: "no_captcha"`**: No CAPTCHA image was detected on
  the start page. This may mean CEAC has changed its start page layout or the
  CAPTCHA selector no longer matches.

- **`captchaOutcome.status: "failed"`**: The solver encountered an error
  (e.g. 2captcha API failure, zero balance, image capture failure). Check the
  `reason` field for details.

## Programmatic use

```typescript
import { probeCeacStartPage, probeCaptchaSolve } from "./ceac";

// Standard smoke test
const result = await probeCeacStartPage({ headless: true });

if (result.outcome === "start_page") {
  console.log("Ready to run CEAC worker");
} else {
  console.log(`Not ready: ${result.summary}`);
}

// CAPTCHA solve smoke test
const captchaResult = await probeCaptchaSolve({ headless: true });
console.log(`Reached post-CAPTCHA: ${captchaResult.reachedPostCaptcha}`);
```

## Runtime validation procedure (merged main)

Full validation of the CEAC automation pipeline on merged main involves two
checks: the smoke path and the worker path. Run them in order.

### Step 1: Smoke validation

Verifies CEAC reachability and CAPTCHA solver integration.

```bash
# 1a. Basic reachability
npx tsx viza-be/submission-service/src/ceac/smoke.ts

# 1b. CAPTCHA solver (requires TWOCAPTCHA_API_KEY in .env)
npx tsx viza-be/submission-service/src/ceac/smoke.ts --solve-captcha
```

**Expected:** Step 1a returns `outcome: "start_page"` (exit 0). Step 1b
returns `reachedPostCaptcha: true` with a `postSolvePageId` that is NOT
`"start"` or `"unknown"` (e.g. `"security_notice"`).

**If blocked:** Check `summary` for the blocker. Anti-bot gates are external
(IP/rate limit); retry from a different machine or wait.

### Step 2: Worker-path validation

Exercises the full pipeline: session bootstrap, CAPTCHA solve, page-by-page
form fill, and result persistence.

```bash
# Enqueue a DS-160 prefill job in submission_queue with status
# "ds160_prefill_pending", then start the worker:
npx tsx viza-be/submission-service/src/index.ts
```

**What to check after the run:**

1. **Queue status** — should be one of:
   - `ds160_prefilled` (handoff_ready: form filled to sign page)
   - `ds160_prefill_failed` (runtime failure after max retries)
   - `ds160_blocked` (external CEAC gate, not retryable)
   - NOT stuck at `ds160_prefill_processing`

2. **ceac_result_payload** — inspect the JSON in `submission_queue`:
   - `status`: `"handoff_ready"` or `"failed"`
   - `sectionCoverage.filled`: sections where fields were filled
   - `sectionCoverage.skipped`: sections advanced without filling
   - `captchaSolve`: array of telemetry entries (solveId, durationMs, outcome)
   - `applicationId`: CEAC-issued application ID (if reached)

3. **Classification truthfulness** — the status must match the real outcome:
   - Successful fill → `ds160_prefilled` + `handoff_ready`
   - Runtime error → `ds160_prefill_failed` + `failed` + error details
   - External gate → `ds160_blocked` + `gateContext` with matched selectors

### 2026-04-23 validation pass — observed outcomes

**Code changes made during this validation run:**

1. **US-028:** Smoke CAPTCHA diagnostics tightened — `CaptchaSmokeResult` now
   includes `postSolveUrl`, `postSolveHeading`, and `error` fields so the
   reached surface is explicit in structured output.

2. **US-029:** Session bootstrap moved inside try-catch — previously,
   `startCeacSession()` was outside the error-classification block, so
   bootstrap failures (gate, CAPTCHA exhaust) left the queue item stuck at
   `ds160_prefill_processing` with no truthful classification.

3. **US-030:** CAPTCHA solve telemetry added to `ceac_result_payload` — the
   `session.captchaSolve.telemetry` array is now persisted in all three write
   paths (success, orchestrator failure, exception).

**Next blocker / action:**

- The CEAC automation code is structurally validated on merged main. All error
  paths classify truthfully. CAPTCHA telemetry and section coverage are
  persisted.
- **Live execution** requires: (1) a `TWOCAPTCHA_API_KEY` in `.env`,
  (2) a real applicant record with `visa_application_answers` populated,
  (3) a `submission_queue` entry with `status: "ds160_prefill_pending"`.
- The first live run will confirm whether the end-to-end path reaches
  `handoff_ready` or surfaces a new runtime blocker (e.g. CEAC page layout
  change, missing answer mappings, navigation timeout).
