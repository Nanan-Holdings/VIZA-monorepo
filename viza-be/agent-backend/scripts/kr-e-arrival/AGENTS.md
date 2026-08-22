# Korea e-Arrival Card Seed Module

Scope: the DB-driven `KR_E_ARRIVAL_CARD` single-traveller schema and its
versioned official option snapshots.

- Keep this package separate from `KR_C39_SHORT_TERM_VISIT` and `KR_KETA`.
- `form-fields.ts` is the canonical applicant-facing field inventory. It must
  contain only fields needed by the official Korea e-Arrival Card; eligibility
  guidance belongs to the product route and RAG, not to hidden schema fields.
- `official-options.ts` preserves the official English labels/codes used by the
  portal. `option-labels.ts` and `option-translations.zh.json` own Chinese UI
  labels only; never submit a Chinese label to the official portal.
- Country, airport, and flight data are dynamic official values. Keep their
  source endpoints and snapshot date in `official-options.snapshot.json`; the
  additional-question endpoint is `/portal/apply/srchAddItemList.do` and the
  reviewed V1 snapshot is intentionally empty. A runner must fail closed when
  the live portal returns an option/question outside the reviewed snapshot.
- Run `npm run sync:kr-e-arrival-options` for a read-only official endpoint
  validation. Only `npm run sync:kr-e-arrival-options -- --update` may replace
  the snapshot; auth failures, non-JSON responses, unknown shapes, empty core
  lists, or unsafe fields must preserve the existing file and fail closed.
- `seed-form-fields.ts` replaces this package's rows idempotently and must keep
  `scripts/seed-kr-e-arrival-card-form-fields.ts` as the compatibility entry.
- V1 is one traveller. Group e-Arrival Card support is a separate follow-up.
