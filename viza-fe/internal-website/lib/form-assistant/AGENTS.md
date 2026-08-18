# Form Assistant Shared Policy Guide

Scope: this file applies to `lib/form-assistant/**`.

## Responsibilities

- `bootstrap.ts` decides whether a first-time supported form visit must create
  an application-scoped draft before the assistant can render. It must reuse
  existing drafts and require a non-empty DB-driven form schema.
- `service.ts` asks exactly one current field question per turn. It may still
  extract multiple facts when an applicant volunteers them, but it must not
  render bulk missing-field prompts or reuse legacy multi-question prompts.
- Short affirmative/negative replies such as `有`、`没有`、`yes` and `no`
  must resolve deterministically against the single current yes/no field before
  model extraction, so a concise answer always advances the conversation.
- Unambiguous relative or localized dates such as `明天`, `tomorrow`, and
  `8月7号` must be normalized against the product time zone before model
  extraction. Localized option labels may map to reviewed exact option values;
  ambiguous dates or options must still be confirmed.
- Ask the current field in concise, supportive language that explains the
  expected answer with a useful example or reviewed choices when appropriate.
  SGAC-specific copy must only be used for SGAC; other products use their own
  localized schema labels and exact options.
- Hierarchical official options may use unique comma-delimited segments as
  natural-language aliases (for example `长沙` for
  `CHINA, HUNAN, CHANGSHA`). Apply a value only when the full option set has
  exactly one match, and rank message-relevant options before any model
  manifest limit instead of relying on the first database rows.
- Keep document extraction policies pure and deterministic. They may classify
  document types and allowlisted field categories, but must not read storage,
  call an AI provider, or persist applicant answers.
- Unknown document types and field names are denied by default.
- Product document requirements must come from reviewed product configuration;
  the assistant must never invent requirements from a model response.
- `SG_ARRIVAL_CARD` intentionally has no document requirements.
- `review-issues.ts` maps validator output to schema-ordered field repair
  navigation. Keep it country-agnostic, preserve repeat-instance keys, and let
  hard errors take precedence over warnings for the same answer.
- `validation-refresh.ts` guards automatic post-edit revalidation. A response
  may update the assistant and form only when both its request id and answer
  revision still match the latest snapshot.
- Knowledge sources and prompts must remain bound to the owned application's
  exact `country + visaType`. Never return the SGAC ICA fallback source for a
  different Singapore product or another country.
- Networks that require an outbound HTTPS proxy may set
  `OPENAI_FORM_ASSISTANT_PROXY_URL` (or `HTTPS_PROXY`). Keep the request origin
  on official `api.openai.com` so TLS verification remains intact.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npx vitest run lib/form-assistant/document-extraction-policy.test.ts
npx vitest run lib/form-assistant/bootstrap.test.ts
npx vitest run lib/form-assistant/constants.test.ts
npx vitest run lib/form-assistant/review-issues.test.ts
npx vitest run lib/form-assistant/service.test.ts
npm run type-check
```
