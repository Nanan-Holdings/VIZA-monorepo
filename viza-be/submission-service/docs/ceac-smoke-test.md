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

## Programmatic use

```typescript
import { probeCeacStartPage } from "./ceac";

const result = await probeCeacStartPage({ headless: true });

if (result.outcome === "start_page") {
  console.log("Ready to run CEAC worker");
} else {
  console.log(`Not ready: ${result.summary}`);
}
```
