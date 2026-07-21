# SGAC Seed Module

Scope: Singapore `SG_ARRIVAL_CARD` form schema only.

- `form-fields.ts` is the official ICA field inventory used by the DB seed.
- `official-options.ts` owns SGAC official-option lists exposed in VIZA; fields
  backed by ICA autocomplete, such as Hotel Name, must not fall back to free text.
- `option-labels.ts` owns SGAC-only Chinese display labels for official ICA
  dropdown values. Keep ICA `value`/English labels unchanged for submission.
- `option-translations.zh.json` stores the reviewed zh-CN display snapshot for
  SGAC official dropdown values. Hotel keys must match the deduplicated ICA
  hotel list exactly; official English values remain unchanged for submission.
- Regenerate and web-review all hotel labels with
  `SGAC_TRANSLATION_WEB=1 npx tsx scripts/sgac/generate-hotel-translations.ts`.
  Verified property/group overrides in that script take precedence over model
  output. The Google script is only a fallback for newly added non-hotel options.
  Never write API keys into this directory.
- `seed-form-fields.ts` replaces all SGAC rows idempotently.
- Keep non-official notices and VIZA workflow acknowledgements out of the applicant form.
- Keep `scripts/seed-sg-arrival-card-form-fields.ts` as the compatible command entry point.
