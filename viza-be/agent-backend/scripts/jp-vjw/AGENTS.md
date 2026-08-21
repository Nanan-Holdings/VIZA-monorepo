# Japan Visit Japan Web Seed Module

Scope: the DB-driven `JP_VISIT_JAPAN_WEB` arrival-declaration schema.

- Keep Visit Japan Web separate from Japan visa/eVISA intake. This package
  covers online immigration and customs arrival procedures only.
- `form-fields.ts` contains canonical answer keys required by the official
  portal runner. Applicant documents are represented by package document
  requirements and `application_documents`, never as file-path answers.
- `options.value`, `label_en`, and `official_label` are the official English
  values used by the runner. `label_zh` is display-only Chinese UI text.
- Dynamic airport and port values must be resolved from the live official
  portal before submission; do not invent a static airport list in this seed.
- The seed is single-traveller and limited to Chinese ordinary-passport
  tourism in the first release.
- `seed-form-fields.ts` replaces this product's rows idempotently and the
  top-level compatibility entry must remain available.
