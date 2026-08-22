# Kenya eTA Seed Module

Scope: the DB-driven `KE_ETA` electronic travel authorisation schema.

- Keep this product separate from visas and from any Kenya arrival/customs
  declaration. V1 is the official Kenya eTA workflow for Chinese ordinary
  passport tourism.
- `form-fields.ts` contains answer values only. Passport, photo, itinerary,
  and accommodation uploads are package document requirements stored through
  `application_documents`; never put storage paths in answers.
- `options.value`, `label_en`, and `official_label` are the English values sent
  to the official portal. `label_zh` is display-only Chinese UI text.
- Standard processing is the baseline fee route. Expedited processing is
  represented as an explicit option and must be priced from current official
  portal data before submission.
- `seed-form-fields.ts` replaces this product's rows idempotently and the
  top-level compatibility entry must remain available.
