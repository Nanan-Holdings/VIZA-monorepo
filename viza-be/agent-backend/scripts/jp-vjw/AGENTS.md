# Japan Visit Japan Web Schema Package

Scope: `scripts/jp-vjw/**`.

- Keep Visit Japan Web separate from Japan visa/eVISA intake. This package
  covers online immigration and customs arrival procedures only.
- `form-fields.ts` is the canonical DB-driven VIZA intake for
  `JP_VISIT_JAPAN_WEB`. Visible controls must match the reviewed current
  Visit Japan Web controls; legacy answer keys remain hidden/computed only.
- `official-master.snapshot.json` is a manually reviewed, versioned snapshot
  of the official VJW Angular bundle masters. Never refresh it directly in
  production. Run `generate-official-master-snapshot.ts` against a downloaded
  official bundle, review the diff, then publish a migration.
- `official-master.ts` converts the reviewed snapshot to bilingual schema
  options without changing official stored codes/values.
- `option-translations.zh.json` is the reviewed Simplified Chinese display
  layer for official airlines, prefectures, municipalities, and embarkation
  points. Its keys must remain exact VJW codes/English values; changing a
  Chinese label must never change the value sent to the official portal.
- Applicant documents belong in package requirements and
  `application_documents`, never as file-path answers.
- `official-airports.ts` is retained as a Japan Customs reference snapshot,
  but airport is not a current VJW intake control and must stay hidden.
- `generate-schema-migration.ts` emits the byte-identical backend/frontend
  data migration after the canonical field definitions pass tests.
- Current first-phase scope is a Chinese ordinary-passport tourist with no
  affirmative customs detail branch. Do not invent fields for airport,
  passport type, or a second declaration checkbox when the official flow does
  not ask them.
- `seed-form-fields.ts` replaces this product's rows idempotently and the
  top-level compatibility entry must remain available.

Validation:

```powershell
npx vitest run scripts/jp-vjw/form-fields.test.ts
```
