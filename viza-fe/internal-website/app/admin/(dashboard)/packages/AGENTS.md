# Admin Package Coverage Agent Guide

Scope: this file applies to
`viza-fe/internal-website/app/admin/(dashboard)/packages/**`.

## Purpose

This module owns the read-only package coverage matrix: what each country/visa
package supports inside VIZA's website automation loop.

## Key Responsibilities

- Render `/admin/packages` with all active `visa_packages`.
- Surface coverage flags for schema, document checklist, packet generation,
  external submission handoff, result ingest, and status UI.
- Read `visa_packages.metadata.coverage` and related schema/document metadata
  in a structured way. This module has no fee, payment, checkout, or points
  purchase actions.
- Show which package has document requirements configured.
- Help client destination cards avoid over-promising unsupported capabilities.
- Keep the admin-facing coverage UI copy bound to the global interface language
  (`NEXT_LOCALE`) for English/Chinese switching.

## Navigation

`/admin/packages` is the Catalogue > Coverage destination. Products and
marketing publication are separate admin surfaces. This matrix describes
operational readiness and is not a package pricing or purchase flow; the
client Points Center lives at `/client/settings/points`.

## Data Sources

- `visa_packages`
- `document_requirements`
- `visa_form_fields`

## Guardrails

- Do not imply official portal automation exists unless another service has
  explicitly written that coverage into package metadata.
- Do not place country-specific application form schema here; schemas belong in
  backend seed scripts and `visa_form_fields`.
- Do not add payment, fee collection, subscription, or points-purchase behavior
  to the coverage matrix.
- Do not edit public marketing copy from this module.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/admin/packages`.

## Related Files

- `page.tsx`: admin package coverage matrix for active visa packages.
