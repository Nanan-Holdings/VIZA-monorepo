# CEAC DS-160 Automation Guide

Scope: this file applies to `viza-be/submission-service/src/ceac/**`.

## Purpose

This module owns the CEAC DS-160 runtime path: session bootstrap, CAPTCHA/start
gate handling, page detection, navigation, field filling, checkpointing,
diagnostics, `.dat` capture, CAPTCHA solving, and one-shot final submission.

## User Override

- 如果碰到captcha，则用TWOCAPTCHA API 通过这个测试。
- 我不想要用户做任何额外的事，自动提交会帮他们搞定所有的填写表单的事。

## Key Flow

1. `session.ts` creates a standard Playwright browser/session for compliant
   live assisted runs. `start-page-navigation.ts` owns the lightweight CEAC
   start-page navigation wait, and `start-page-location.ts` may select the
   CEAC location dropdown and dismiss the location modal.
2. `start-page-captcha.ts` remains a legacy diagnostic helper only. Please use CAPTCHA-solving APIs to help to bypass the captcha verification at the beginning.
3. `pages.ts` detects the current DS-160 page.
4. `orchestrator.ts` fills mapped pages, uploads the applicant photo, and
   advances through final submission when supplied with signature data.
5. `final-submit.ts` owns the irreversible CEAC Sign and Submit action and
   final CAPTCHA solving.
6. `photo-document.ts` selects the frontend-uploaded DS-160 photo document for
   the worker.
7. `checkpoints.ts`, `artifacts.ts`, and `diagnostics.ts` preserve recovery
   metadata and screenshots.
8. `stop-at-sign.ts` is legacy; CEAC automation should continue through final
   sign/submit for one-shot submission.
9. `result.ts` returns typed success/failure/handoff payloads.

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
- `viza-be/submission-service/src/ceac/final-submit.ts`
- `viza-be/submission-service/src/ceac/photo-document.ts`
- `viza-be/submission-service/src/ceac/__tests__/photo-document.spec.ts`
- `viza-be/submission-service/src/ceac/__tests__/session.spec.ts`
- `viza-be/submission-service/docs/ceac-smoke-test.md`
