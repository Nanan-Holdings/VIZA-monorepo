# VIZA Application User Guide

This guide describes the current user-facing visa application module.

## Entry Points

- Home destination cards: users choose a destination or visa form from `/client/home`.
- VIZA AI redirect: the chat assistant can send users to `/client/application?country=...&visaType=...`.
- Existing applications: opening `/client/application` without query params redirects to the latest started application when one exists.

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

For text fields, the user can type in either side. The other language side updates automatically where the product has a deterministic mapping or translation helper. Official names, passport names, dates, and country names should still be checked by the user before submitting.

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

