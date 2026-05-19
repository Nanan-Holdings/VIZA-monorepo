# Admin Package Coverage Agent Guide

Scope: this file applies to
`viza-fe/internal-website/app/admin/(dashboard)/packages/**`.

## Purpose

This module owns the package coverage matrix: what each country/visa package
supports inside VIZA's website automation loop.

## Key Responsibilities

- Render `/admin/packages` with all active `visa_packages`.
- Surface coverage flags for schema, documents, payment, packet, external
  submission handoff, and result delivery.
- Edit or display `visa_packages.metadata.coverage` and
  `visa_packages.metadata.government_fee` in a structured way.
- Show which package has document requirements configured.
- Help client destination cards avoid over-promising unsupported capabilities.

## Data Sources

- `visa_packages`
- `document_requirements`
- `visa_form_fields`

## Guardrails

- Do not imply official portal automation exists unless another service has
  explicitly written that coverage into package metadata.
- Do not place country-specific application form schema here; schemas belong in
  backend seed scripts and `visa_form_fields`.
- Do not edit public marketing copy from this module.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/admin/packages`.
