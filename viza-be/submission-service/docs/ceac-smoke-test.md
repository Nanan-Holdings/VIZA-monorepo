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
  "postSolvePageId": "start",
  "probedAt": "2026-04-23T12:00:00.000Z",
  "summary": "CAPTCHA solved. Post-solve page: start. Heading: ..."
}
```

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
