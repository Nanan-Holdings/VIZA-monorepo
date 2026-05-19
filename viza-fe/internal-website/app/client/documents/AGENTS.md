# Client Document Center Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/documents/**`.

## Purpose

This module owns the applicant document checklist center. It replaces the old
status-page usage of `/client/documents` with a true document workspace driven
by visa package requirements.

## Key Responsibilities

- Render checklist rows from `document_requirements` or
  `visa_packages.metadata.document_checklist`.
- Use a conservative fallback checklist only when package-specific requirements
  are missing.
- Persist uploads to Supabase Storage bucket `application-documents`.
- Upsert `application_documents` by `(application_id, document_type)`.
- Show upload, missing, approved/validated, rejected, and needs-replacement
  states.
- Offer passport OCR from uploaded passport documents, but keep extracted data
  user-confirmed before writing profile/application answers.
- Allow Travel AI outputs to satisfy the `travel_itinerary` requirement.

## Data Sources

- `applications`
- `visa_packages`
- `document_requirements`
- `application_documents`
- `ocr_extractions`
- `visa_application_answers`

## Guardrails

- Do not hardcode all document rules in the route file. Use package metadata or
  `document_requirements`.
- Do not mark a document approved automatically unless the rule is explicitly
  deterministic. The default upload state is `uploaded`.
- Do not put full application status timelines here; link to `/client/status`.
- Do not touch `viza-be/submission-service` or official portal automation.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/client/documents`. Verify unauthenticated users redirect to
`/client/login`.
