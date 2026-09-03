# Form Assistant Shared Policy Guide

Scope: this file applies to `lib/form-assistant/**`.

## Responsibilities

- `server-context.ts` must load the owned application and its applicant profile
  through one PostgREST embedded relationship query on current schemas. Keep a
  fail-closed compatibility fallback for old local schemas, and never cache
  application or applicant ownership data.
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
  localized schema labels and exact options. Do not mechanically prepend
  “What is your” to terse official labels; count and quantity fields must ask
  explicitly what is being counted and say when `0` is a valid none answer.
- Shared semantic explanations must be destination-neutral. Common schema
  aliases such as `country_of_citizenship`, `current_nationality`,
  `purpose_of_visit`, and `arrival_airport` reuse one meaning without naming a
  different country. Prefer reviewed `validation_rules.helper_en/helper_zh`
  when a country schema supplies more specific guidance.
- Use `isFormAssistantConfirmationField` in both orchestration and UI mapping
  so legal declarations render as inline confirmation controls without
  converting ordinary required boolean fields into declarations.
- Confirmation actions are idempotent across stale tabs: if the exact declared
  field is already true, return the current missing-field state without writing
  duplicate chat messages or rejecting the old checkbox action.
- Treat option-backed fields as chat questions, not visible form controls.
  Clarifications must ask the applicant to reply in their own words and must
  not tell them to select, click, or find an option. Resolve unique reviewed
  aliases and unique short label terms deterministically to the exact stored
  option value. When an answer identifies a shared entity but matches several
  official variants, acknowledge what was identified and ask only for the
  missing discriminator (for example, the NAIA terminal). A still-unmatched
  answer must receive useful chat guidance, not the identical field question
  again.
- Model turns use a semantic decision contract, not labels and option strings
  alone. Send the current field's reviewed meaning, guidance, answer policy,
  allowlisted official contract metadata, and relevant answers from any schema
  step. Related-answer selection must prefer explicit schema relationships,
  groups, dependencies, and shared semantic context without dumping the whole
  application into the prompt.
- Classify model turns as `answer`, `clarification`, `related_answer`,
  `correction`, or `unclear`. When no patch is safe, preserve a useful targeted
  model follow-up instead of replacing it with generic “official value” copy.
  A related fact must not be treated as proof of a legal or customs conclusion;
  for example, baggage count does not establish that baggage contents require
  declaration.
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
- `SG_ARRIVAL_CARD` and `JP_VISIT_JAPAN_WEB` intentionally have no applicant
  document requirements. VJW must bypass Document Center's conservative
  generic fallback so the assistant never invents passport/photo/itinerary/
  funds uploads for this arrival declaration.
- `review-issues.ts` maps validator output to schema-ordered field repair
  navigation. Keep it country-agnostic, preserve repeat-instance keys, and let
  hard errors take precedence over warnings for the same answer.
- `validation-refresh.ts` guards automatic post-edit revalidation. A response
  may update the assistant and form only when both its request id and answer
  revision still match the latest snapshot.
- `submission-readonly.ts` is the shared success-evidence gate for every form
  assistant. Successful applications keep their saved conversation readable,
  while all answer, confirmation, document, validation, and voice mutations
  remain locked. Arrival cards and automated online products must retain their
  stricter official evidence requirements.
- Render assistant progress from the current merged form draft, not a previous
  assistant API response. Remote-search official selects are controlled by
  their product option endpoint and must not be rejected against a partial
  static fallback list.
- Canonicalize saved/profile option labels to the schema's exact value before
  calculating missing fields, and re-read application answers immediately
  before choosing every next question so concurrent manual edits always win.
- Knowledge sources and prompts must remain bound to the owned application's
  exact `country + visaType`. Never return the SGAC ICA fallback source for a
  different Singapore product or another country.
- `knowledge.ts` may cache only public release/document/chunk metadata, keyed
  by exact release plus normalized country and visa type. Active-release
  success may be reused for at most five seconds; public content may be reused
  for 60 seconds only while that gate remains active. Keep both layers bounded,
  single-flight, negative/failure-retryable, and free of applicant, session,
  answer, message, credential, or payment data.
- `server-context.ts` shares the bounded `visa_form_fields` metadata cache with
  the main form loader, keyed by resolved schema visa type and limited to a
  60-second freshness window. Cache only non-empty public rows; failures and
  empty reads must remain retryable, and each caller must rebuild deep-cloned
  step objects so mutations cannot leak between requests.
- After ownership is established, `server-context.ts` starts application
  answers, applicant profile, and reusable-profile answer reads together.
  Preserve application-answer precedence and the legacy missing-`source`
  fallback; never cache these applicant-scoped values.
- Networks that require an outbound HTTPS proxy may set
  `OPENAI_FORM_ASSISTANT_PROXY_URL` (or `HTTPS_PROXY`). Keep the request origin
  on official `api.openai.com` so TLS verification remains intact.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npx vitest run lib/form-assistant/document-extraction-policy.test.ts
npx vitest run lib/form-assistant/bootstrap.test.ts
npx vitest run lib/form-assistant/constants.test.ts
npx vitest run lib/form-assistant/knowledge.test.ts
npx vitest run lib/form-assistant/review-issues.test.ts
npx vitest run lib/form-assistant/service.test.ts
npm run qa:audit-schema-ui -- --summary --assistant
npm run type-check
```
