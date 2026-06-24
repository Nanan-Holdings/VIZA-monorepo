# SGAC Seed Module

Scope: Singapore `SG_ARRIVAL_CARD` form schema only.

- `form-fields.ts` is the official ICA field inventory used by the DB seed.
- `official-options.ts` owns SGAC official-option lists exposed in VIZA; fields
  backed by ICA autocomplete, such as Hotel Name, must not fall back to free text.
- `option-labels.ts` owns SGAC-only Chinese display labels for official ICA
  dropdown values. Keep ICA `value`/English labels unchanged for submission.
- `option-translations.zh.json` stores Google Translate zh-CN display labels
  for SGAC official dropdown values. Regenerate it with
  `npx tsx scripts/sgac/translate-options-with-google.ts` when official option
  lists change; never write API keys into this directory.
- `seed-form-fields.ts` replaces all SGAC rows idempotently.
- Keep non-official notices and VIZA workflow acknowledgements out of the applicant form.
- Keep `scripts/seed-sg-arrival-card-form-fields.ts` as the compatible command entry point.
