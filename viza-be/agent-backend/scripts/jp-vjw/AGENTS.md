# Japan Visit Japan Web Seed Module

Scope: the DB-driven `JP_VISIT_JAPAN_WEB` arrival-declaration schema.

- Keep Visit Japan Web separate from Japan visa/eVISA intake. This package
  covers online immigration and customs arrival procedures only.
- `form-fields.ts` contains canonical answer keys required by the official
  portal runner. Applicant documents are represented by package document
  requirements and `application_documents`, never as file-path answers.
- `options.value`, `label_en`, and `official_label` are the official English
  values used by the runner. `label_zh` is display-only Chinese UI text.
- `official-airports.ts` is a versioned snapshot of the Japan Customs
  "Customs Airport" table. Preserve its exact official English values and
  Chinese display-only labels. Revalidate the selected airport against the
  current official source before live submission; never silently expand the
  list from unofficial travel data.
- The seed is single-traveller and limited to Chinese ordinary-passport
  tourism in the first release.
- `seed-form-fields.ts` replaces this product's rows idempotently and the
  top-level compatibility entry must remain available.
