# Paper-channel cohort launch (JP / KR / SG / HK / MO / PH-9a / CA-TRV)

> Last reviewed: 2026-05-08.

Launches paper-channel-only or auth-gated countries once DOC-004 PDF assembly is mature and staff hand-delivery process is documented.

## DOC-004 templates registered

| Country | Template key | Source file |
|---|---|---|
| JP | `jp_form_a` | `src/paper/templates/registry.ts` (Form A — Embassy of Japan) |
| KR | `kr_visa_application` | (C-3-9) |
| SG | `sg_form_14a` | (Form 14A — ICA) |
| HK | `hk_id_1003a` | (ID 1003A) |
| MO | `mo_dscv1` | (DSCV-1) |
| PH-9a | `ph_9a_application` | (Form 1, 9(a) consular) |
| CA-TRV | _stubbed_ | Pending GCKey live-QA. |

Seeded into Postgres `paper_template` via
`src/paper/templates/registry.ts → seedPaperTemplates()`. Render path
in `src/paper/renderer.ts`.

## Pre-launch checklist

- [x] DOC-004 templates exist for every paper-channel country (CA-TRV stubbed).
- [x] [Staff hand-delivery runbook](../runbooks/paper-channel.md) shipped.
- [ ] 5 internal end-to-end submissions per country.
- [ ] Application status flips to `staff-action-required` after PDF generation.
- [ ] Staff dashboard surfaces queue under `/admin/paper-channel`.

## Status transitions

```
runner_job picked → render PDF (DOC-004) →
  status='staff-action-required' →
  staff prints + submits at consulate →
  status='submitted_to_government' (manual) →
  applicant receives outcome via email/post →
  status='delivered' (manual or inbound-email parse)
```

## Linked from

- [docs/runbooks/paper-channel.md](../runbooks/paper-channel.md) — staff hand-delivery runbook.
- [docs/launch/mvp-4.md](./mvp-4.md) — sibling launch gate.
