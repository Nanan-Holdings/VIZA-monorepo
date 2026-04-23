# CEAC Smoke Test

Repeatable diagnostic for verifying CEAC DS-160 start-page access from the
current machine. Reports whether CEAC is reachable, anti-bot gated, or
otherwise blocked.

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
| `start_page` | 0 | CEAC start page loaded. Runtime is ready. |
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
