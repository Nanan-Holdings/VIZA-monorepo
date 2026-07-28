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

Most current forms use a bilingual layout:

- left column: Chinese question and Chinese input
- right column: English or official question and English/official input

For text fields, the user can type in either side. Chinese-side edits can update the English or official side where the product has a deterministic mapping or translation helper. English-side edits do not overwrite the Chinese side. Official names, passport names, dates, and country names should still be checked by the user before submitting.

For select, radio, date, country, and upload controls, both sides represent the same answer. Choosing a value on either side updates the shared answer.

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

## Photo Upload

The photo upload step should show country-specific photo guidance when available. It should not use one country's rules for every application. Users upload the required photo, then continue to review.

## Review

The review step is read-only. It summarizes the answers the user already entered and shows the paired Chinese/English or official values for final checking. If something is wrong, the user should go back to the relevant form step and edit it there.

## Submission Status

After review and submission, the status step shows the application state. The current module prepares and records application progress; final external government submission may still depend on backend automation coverage for that country.

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
