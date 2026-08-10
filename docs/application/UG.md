# VIZA Application User Guide

This guide describes the current user-facing visa application module.

## Opening The Local Website

For local testing, start the VIZA frontend from the internal website directory:

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo
.\scripts\start-viza-dev.ps1
```

The script opens the login page and writes service logs to `.dev-logs`. To stop
the services started by the script:

```powershell
.\scripts\start-viza-dev.ps1 -Stop
```

Manual frontend-only startup is:

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-fe\internal-website
npm run dev
```

Open the URL printed by the terminal, usually:

```text
http://localhost:3000/client/login
```

After logging in, open:

```text
http://localhost:3000/client/home
```

If the browser shows a black Next.js `404 This page could not be found` page at
`/client/home`, the most likely cause is that `localhost:3000` is running an old
server or a different project. Stop the terminal with `Ctrl+C`, restart from
`viza-fe/internal-website`, and reload the page. If port `3000` is occupied,
start on another port:

```powershell
npm run dev -- -p 3001
```

Then open:

```text
http://localhost:3001/client/login
```

## Entry Points

- Home destination cards: users choose a destination or visa form from `/client/home`.
- VIZA AI redirect: the chat assistant can send users to `/client/application?country=...&visaType=...`.
- Existing applications: opening `/client/application` without query params redirects to the latest started application when one exists.
- Status center: users can open `/client/status` to see payment, consent,
  documents, packet generation, external handoff, submitted/result states, and
  downloads.
- Document center: users can open `/client/documents` to see required and
  optional materials, upload status, OCR/photo checks, missing items, and
  re-upload actions.
- Checkout: users can open `/client/checkout` to pay the VIZA agency fee through
  Stripe Checkout.
- Billing: users can open `/client/billing` to download receipts, request an
  invoice, and see refund status.
- Consent: users can open `/client/consent` to accept ToS, Privacy, agency
  authorisation, and complete e-signing.
- Settings: users can open `/client/settings` for profile, billing settings,
  and privacy/data-rights requests.

Staff users use the admin portal:

- `/admin/login`: staff login.
- `/admin/applications`: monitoring queue.
- `/admin/applications/[id]`: application watch detail.
- `/admin/packages`: country/package coverage matrix.
- `/admin/billing`: payment, invoice, and refund support.

## Application List And Progress

Users can work on multiple visa applications at the same time. Each application is tied to:

- destination country
- visa type
- current step/progress
- uploaded files and saved answers

The home page application cards show progress so users can see which applications are not started, in progress, waiting for upload/review, or submitted.

## Filling A Form

Forms show one entry column in the selected interface language. In Chinese
mode, questions, placeholders, options, and editable values are Chinese only.
The corresponding English or official value is generated and stored in the
background, then shown beside the Chinese value on the final **核对信息** step.

For text fields, Chinese edits update the English or official value where the
product has a deterministic mapping or translation helper. In English mode,
edits preserve any stored Chinese value. Official names, passport names, dates,
and country names should still be checked on final review before submitting.

Select, radio, date, country, and upload controls keep one canonical answer
shared across both display languages.

## Keyboard Shortcuts

Text inputs keep normal browser/system shortcuts:

- Windows: `Ctrl+C`, `Ctrl+V`, `Ctrl+X`, `Ctrl+A`, `Ctrl+Z`
- Mac: `Cmd+C`, `Cmd+V`, `Cmd+X`, `Cmd+A`, `Cmd+Z`

For non-text form controls, the form also supports:

- Windows undo: `Ctrl+Z`
- Windows redo: `Ctrl+Y` or `Ctrl+Shift+Z`
- Mac undo: `Cmd+Z`
- Mac redo: `Cmd+Shift+Z`

## Field AI Help

Each field can show an explicit `问 AI` button. Clicking it opens field-specific guidance:

- what the field means
- example answers
- important official warnings
- format hints
- sources when RAG retrieved official knowledge

The AI help should not open just because a user focuses or clicks a field.

## Form-filling assistant and voice input

The Singapore SG Arrival Card form includes a Form-filling assistant at the
top of the page. You can answer its questions, use the microphone, or continue
typing directly into the bilingual form in any order. Before each question the
assistant checks the answers already saved on this application, so it does not
ask again for information that is already available.

Stopping a recording creates editable text in the message box. Review names,
dates, passport numbers and flight numbers, then send the text yourself. The
recording is not saved to your account or chat history. If microphone access or
transcription is unavailable, ordinary text input and the form continue to
work.

Fields filled by the assistant are highlighted and remain editable. A manual
edit becomes the authoritative answer. When the required answers are complete,
run the final check. Errors must be fixed; warnings can be reviewed and kept.
Confirmation opens the existing read-only Review step and does not submit the
SG Arrival Card to ICA.

## Photo Upload

The photo upload step should show country-specific photo guidance when available. It should not use one country's rules for every application. Users upload the required photo, then continue to review.

## Review

The final Review Application step is read-only. It summarizes completed answers,
shows paired Chinese/English or official values for final checking, and lists
empty or missing fields at the bottom. Confirmation and submission controls are
part of this same step. If something is wrong or missing, use the edit action to
return to the relevant form step.

## Submission Status

After submission, Review Application switches to the application status and
confirmation result. Failed or stalled submissions keep the read-only review
summary visible above the retry status so applicants can verify saved answers
before submitting again. The current module prepares and records application
progress; final external government submission may still depend on backend
automation coverage for that country.

## Website Automation Status

The VIZA website automation loop prepares and tracks the case inside VIZA:

- agency fee payment
- consent and e-signature
- form answers
- document checklist and upload state
- passport OCR confirmation
- photo compliance state
- application packet generation
- external submission handoff state
- submitted, approved, rejected, and result delivery states

Official government portal submission is outside this website module. When an
external submission owner updates VIZA, the customer status center shows the
safe customer-facing status, official reference, result files, and next steps.
