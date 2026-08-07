# Form Filling Assistant Component Guide

Scope: this file applies to `viza-fe/internal-website/components/client/form-assistant/**`.

## Purpose

This module provides the reusable applicant-side form filling assistant UI. It
is intentionally route-agnostic: a parent application page supplies persisted
messages, missing-field state, validation results, and the callbacks that own
server mutations or navigation.

## Boundaries

- Keep form-assistant state rendering and browser microphone lifecycle here;
  keep application loading, API calls, field patching, persistence, and review
  navigation in the parent route or client data layer.
- Voice recordings are temporary browser data. Stop all media tracks when a
  recording is cancelled, reaches its limit, or the component unmounts. The
  component must place returned transcription into the composer only; sending
  it is always an explicit applicant action.
- Keep the 60-second and 10 MB recording limits and preserve a text-only path
  when microphone or transcription support is unavailable.
- All visible copy belongs in `messages/en.json` and `messages/zh.json` under
  `application.formAssistant`; do not add hard-coded single-language copy.
- Use the canonical client components (`BrandActionButton`, shadcn `Button`,
  `Card`, and `Textarea`) and brand tokens. Do not modify application route
  orchestration from this module.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npx vitest run components/client/form-assistant --testTimeout=15000
npx eslint components/client/form-assistant
npm run type-check
```
