# Client Document Center Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/documents/**`.

## Purpose

This module owns the applicant document checklist logic that is embedded inside
the country-specific application forms. `/client/documents` is no longer a
standalone applicant workspace; the route redirects users back to the
application flow.

## Key Responsibilities

- Render checklist rows from `document_requirements` or
  `visa_packages.metadata.document_checklist`.
- Use a conservative fallback checklist only when package-specific requirements
  are missing.
- Persist uploads to Supabase Storage bucket `application-documents`.
- Upsert `application_documents` by `(application_id, document_type)`.
- Show upload, missing, approved/validated, rejected, and needs-replacement
  states.
- Allow Travel AI outputs to satisfy the `travel_itinerary` requirement from
  the itinerary row itself, with an in-form picker for existing English PDF
  itinerary exports.

## Current Files

- `page.tsx`: server route entry that redirects to `/client/application`.
- `actions.ts`: documents-local server actions for authorized checklist reads,
  upload record upserts, and applicant-confirmed passport OCR persistence.
- `document-center-client.tsx`: embeddable checklist UI, upload/re-upload
  controls, and the integrated Travel AI itinerary picker/upload entry.

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
- Do not put full application status timelines here; keep the embedded form
  experience focused on document completion.
- Do not touch `viza-be/submission-service` or official portal automation.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/client/application` and `/client/documents`. Verify the former reaches
the active country form and the latter redirects back to the application flow.
