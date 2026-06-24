---
name: arrival-card-country-builder
description: Use when adding, extending, debugging, or reviewing VIZA country digital arrival-card workflows such as SG Arrival Card, Malaysia MDAC, Thailand TDAC, or similar pre-arrival traveller declarations. Covers official-source research, keeping arrival-card packages separate from visa packages, DB-driven schema seeds, preview routes, submission-service official portal runners, scheduled submission windows, cancellation, PDF/artifact evidence, RAG updates, and QA guardrails.
---

# Arrival Card Country Builder

Use this skill to add or extend a country-specific digital arrival-card workflow
to VIZA. The worked production example is Singapore `SG_ARRIVAL_CARD`.

## Core Rule

Arrival cards are not visas. Keep each arrival-card package separate from eVisa,
visit visa, pass, payment, and generic visitor-intake packages. Never silently
fall back to a visa schema/RAG package when an arrival-card package is missing.

## Standard Workflow

1. **Verify official sources**
   - Use the government or immigration source as the field/timing baseline.
   - Capture whether the form is free, when it must be submitted, who is exempt,
     and whether health/customs declarations are included.
   - For dynamic dropdowns, scrape or record official option values and keep the
     official English value for runner submission. Chinese labels are display
     labels only.
   - Record uncertainty instead of inventing requirements.

2. **Choose package identity**
   - Use one dedicated `visa_type` per arrival card:
     `SG_ARRIVAL_CARD`, `MY_MDAC_ARRIVAL_CARD`, `TH_TDAC_ARRIVAL_CARD`.
   - Do not reuse existing visa packages such as `SG_VISITOR_VISA`,
     `MY_TOURIST_E_VISA`, or `TH_TOURIST_E_VISA`.
   - Add an idempotent `visa_packages` migration with clear out-of-scope text.

3. **Build the DB-driven form seed**
   - Prefer a country folder when the workflow has private option lists,
     translators, schema builders, or runner mappings:
     `viza-be/agent-backend/scripts/<ccac>/`.
   - Keep a compatibility command entry at
     `scripts/seed-<country>-arrival-card-form-fields.ts`.
   - Use `toBilingualSeedRow()` and explicit `validation_rules.label_zh` for
     country-specific or declaration fields.
   - Keep v1 single-traveller unless the user explicitly asks for group
     submission.
   - Every runner-required answer must be collected by canonical key, saved,
     reloaded, validated, and mapped into the real submission payload.
   - Do not make missing runner-required fields optional to bypass validation.
   - Add official timing/free-channel acknowledgements only when they are useful
     to the product. Do not add extra questions that the official form does not
     need.

4. **Add an isolated preview entry**
   - Add a `/client/arrival-cards/<country>` route that opens the matching
     `/client/application/long-form?country=...&visaType=...` flow.
   - Destination cards may point directly to the arrival-card package after the
     preview workflow is accepted.

5. **Wire submission behavior**
   - Add package-specific detection in `lib/submission-queue.ts`; do not route
     arrival cards through generic visa statuses.
   - Use a single primary frontend submit button. Dry-run/validation is an
     internal precheck, not a user-facing terminal action.
   - If the official arrival-card window is future-dated, save the answers and
     schedule the queue row instead of submitting too early. SGAC uses the
     ICA three-day window.
   - Add a cancel path for scheduled/pending jobs. Cancel must mark the queue
     cancelled and restore the application to a resubmittable state; do not
     interrupt already-running official portal submissions unless the runner has
     explicit cancellation support.

6. **Build the official portal runner when requested**
   - Put country-private runner code under
     `viza-be/submission-service/src/<arrival-card-code>/`.
   - Normalize answers into a typed payload and reject wrong country/visaType.
   - Match official dropdown values exactly; store Chinese display labels
     separately from official values.
   - Use the repository CAPTCHA solver only when an official CAPTCHA is present
     and the user has authorized real submission. Surface unsolved CAPTCHA and
     portal errors precisely.
   - Save official screenshots, logs, traces, and confirmation PDFs to Supabase
     Storage. Download the official PDF when the portal provides one; avoid
     printing blank browser pages as evidence.
   - Return structured results:
     `submitted`, `status`, `confirmationNumber/referenceNumber`,
     `portalResponseSummary`, `errorDetails`, and `artifacts`.

7. **Update AI and docs surfaces**
   - Update country RAG seeds when user-facing AI routing/copy changes.
   - Update nearest `AGENTS.md` files whenever adding routes, seeds, or skill
     modules.

## SGAC Production Pattern

Use SGAC as the template before building Malaysia MDAC or Thailand TDAC.

- Package: `SG_ARRIVAL_CARD`; keep separate from `SG_VISITOR_VISA`.
- Agent-backend form schema:
  - `viza-be/agent-backend/scripts/sgac/form-fields.ts`
  - `viza-be/agent-backend/scripts/sgac/official-options.ts`
  - `viza-be/agent-backend/scripts/sgac/option-labels.ts`
  - `viza-be/agent-backend/scripts/sgac/option-translations.zh.json`
  - `viza-be/agent-backend/scripts/sgac/seed-form-fields.ts`
  - `viza-be/agent-backend/scripts/seed-sg-arrival-card-form-fields.ts`
- Frontend country feature:
  - `viza-fe/internal-website/features/sgac/`
  - `viza-fe/internal-website/app/client/arrival-cards/singapore/page.tsx`
  - `viza-fe/internal-website/app/api/applications/[id]/sgac-new-application/route.ts`
  - `viza-fe/internal-website/app/api/applications/[id]/cancel-submission/route.ts`
- Submission service:
  - `viza-be/submission-service/src/sgac/normalize.ts`
  - `viza-be/submission-service/src/sgac/runner.ts`
  - `viza-be/submission-service/src/sgac/official-options.ts`
  - `viza-be/submission-service/scripts/run-sgac-smoke.ts`
- Date window:
  - `features/sgac/date-window.ts` on the frontend
  - `src/sgac/date-window.ts` in submission-service
- Key SGAC lessons:
  - Official dropdown values are contract data. Do not accept free-text where
    the official portal requires a dropdown option.
  - Chinese UI labels can be translated, but runner payloads must preserve the
    official English values.
  - Same-day arrival/departure can be valid if the official product allows it.
  - Future-window applications should queue and offer cancellation.
  - Success evidence should be the official confirmation/PDF and reference
    number, not a generic screenshot or blank printed page.

## Malaysia MDAC Target Shape

- Use `MY_MDAC_ARRIVAL_CARD`.
- Keep separate from `MY_TOURIST_E_VISA`.
- Start with a DB-driven form and isolated
  `/client/arrival-cards/malaysia` route.
- Mirror the official MDAC fields, timing window, exemptions, and dropdowns.
- Only add a real MDAC runner after the official form inventory and required
  options have been captured and tested.

## Thailand TDAC Target Shape

- Use `TH_TDAC_ARRIVAL_CARD`.
- Keep separate from `TH_TOURIST_E_VISA`.
- Start with a DB-driven form and isolated
  `/client/arrival-cards/thailand` route.
- Mirror the official TDAC manual/form fields, health declarations, travel
  method branches, accommodation branches, and timing window.
- Only add a real TDAC runner after official options and conditional branches
  are captured and tested.

## Guardrails

- Do not mix arrival-card data with visa application packages or generic RAG.
- Do not bypass CAPTCHA, login, MFA, payment, review, or official final-submit
  controls. If the user authorized real official submission, automate only the
  specific official flow and keep precise evidence.
- Do not store applicant documents, credentials, screenshots, or secrets in the
  skill.
- If a country combines arrival, customs, and health declarations, keep the
  package name tied to the official product but document included subparts.

## Validation

- Frontend: `cd viza-fe/internal-website && npm run type-check && npm run lint`
- Backend: `cd viza-be/agent-backend && npm run type-check && npm run lint`
- Submission service: `cd viza-be/submission-service && npm run type-check`
- Run focused tests for the new schema/route metadata.
- Smoke the preview route. If authenticated browser state is unavailable,
  verify the unauthenticated redirect and report the save/review gap.
- For real runners, preserve official success/failure artifacts and report
  whether final official submission was actually completed.
