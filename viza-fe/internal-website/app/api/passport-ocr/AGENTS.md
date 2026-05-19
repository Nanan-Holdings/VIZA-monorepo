# Passport OCR API Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/passport-ocr/**`.

## Purpose

This module owns passport OCR extraction for uploaded passport documents. It
extracts candidate fields only; applicants must confirm extracted data before
it updates profile or application answers.

## Key Responsibilities

- Load passport document files from Supabase Storage using server-side access.
- Call the configured OCR provider only from the server.
- Store extraction attempts in `ocr_extractions`.
- Return structured candidate fields: full name, passport number, date of
  birth, nationality, issuing country, issue date, and expiry date.
- Provide a confirm action that writes accepted data to `applicant_profiles`
  and `visa_application_answers`.

## Guardrails

- Do not write OCR output directly into applicant profile without confirmation.
- Do not log passport images, MRZ contents, or extracted PII.
- Do not send documents to a provider unless the environment is explicitly
  configured for it.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```
