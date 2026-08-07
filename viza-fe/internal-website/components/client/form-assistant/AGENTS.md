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
- Render the complete persisted conversation in a bounded, keyboard-focusable
  scroll region. Follow new messages only while the applicant is near the
  bottom, and expose a jump-to-latest control after they scroll upward. Keep
  the current answer inside the assistant composer; do not render a bulk
  missing-field list or controls that jump away from the assistant. Show
  final-check controls only after required fields are complete; review
  navigation remains final-check gated.
- The parent route must optimistically append an explicitly sent user message
  before awaiting the assistant API. Roll it back on failure so the composer
  can restore the text and show a retry error.
- Keep the composer visually compact: centered, bounded in width, single-line
  at rest, and internally scrollable as longer answers grow.
- Reuse the shared VIZA Agent conversation treatment from
  `components/client/companion`: assistant replies are plain text, applicant
  replies use the navy bubble, the composer uses the 760px rounded pill with
  an upward-arrow send action, and the shared scroll-to-bottom affordance is
  used for history navigation. Voice remains an additional composer action.
- Keep the composer free of redundant keyboard-hint text and hide final-check
  controls while assistant state is loading. A successful assistant write uses
  a viewport-level, localized, value-specific notice with a real undo action;
  it automatically disappears after 10 seconds. Dismiss callbacks must carry
  the notice id so an older timer cannot hide a newer write. Do not render a
  persistent provenance summary or expose canonical field keys.
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
