# CEAC DS-160 Automation Guide

Scope: this file applies to `viza-be/submission-service/src/ceac/**`.

## Purpose

This module owns the CEAC DS-160 runtime path: session bootstrap, CAPTCHA/start
gate handling, page detection, navigation, field filling, checkpointing,
diagnostics, `.dat` capture, and safe stop-at-sign handoff.

## Key Flow

1. `session.ts` creates a standard Playwright browser/session for compliant
   live assisted runs. `start-page-location.ts` may select the CEAC location
   dropdown and dismiss the location modal, but CAPTCHA remains a manual
   applicant checkpoint.
2. `start-page-captcha.ts` remains a legacy diagnostic helper only; do not use
   CAPTCHA-solving APIs in the live assisted DS-160 flow.
3. `pages.ts` detects the current DS-160 page.
4. `orchestrator.ts` fills mapped pages and advances through the form.
5. `checkpoints.ts`, `artifacts.ts`, and `diagnostics.ts` preserve recovery
   metadata and screenshots.
6. `stop-at-sign.ts` stops before final sign/submit.
7. `result.ts` returns typed success/failure/handoff payloads.

## Non-Negotiable Guardrails

- Never fill the passport signature field.
- Never solve the final sign/submit CAPTCHA.
- Never use CAPTCHA-solving APIs for live assisted CEAC.
- Never use stealth plugins, proxy rotation, fingerprint spoofing, or
  bot-evasion tactics for live assisted CEAC.
- Never click final "Sign and Submit Application".
- Preserve application ID, last checkpoint, screenshots, and `.dat` artifacts
  on failure where available.
- Treat anti-bot/manual intervention gates as blocked operator states, not
  ordinary retryable failures.

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
- `viza-be/submission-service/docs/ceac-smoke-test.md`
