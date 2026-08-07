# Form Assistant Shared Policy Guide

Scope: this file applies to `lib/form-assistant/**`.

## Responsibilities

- `bootstrap.ts` decides whether a first-time supported form visit must create
  an application-scoped draft before the assistant can render. It must reuse
  existing drafts and remain restricted to the reviewed product allowlist.
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
- Keep document extraction policies pure and deterministic. They may classify
  document types and allowlisted field categories, but must not read storage,
  call an AI provider, or persist applicant answers.
- Unknown document types and field names are denied by default.
- Product document requirements must come from reviewed product configuration;
  the assistant must never invent requirements from a model response.
- `SG_ARRIVAL_CARD` intentionally has no document requirements.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npx vitest run lib/form-assistant/document-extraction-policy.test.ts
npx vitest run lib/form-assistant/bootstrap.test.ts
npx vitest run lib/form-assistant/service.test.ts
npm run type-check
```
