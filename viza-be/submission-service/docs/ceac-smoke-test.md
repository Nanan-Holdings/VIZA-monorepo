# CEAC Smoke Test

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
