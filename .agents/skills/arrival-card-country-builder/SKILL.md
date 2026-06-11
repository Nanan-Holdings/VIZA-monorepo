---
name: arrival-card-country-builder
description: Use when adding or reviewing VIZA country digital arrival-card workflows such as SG Arrival Card, Malaysia MDAC, Thailand TDAC, or similar pre-arrival traveller declarations. Covers official-source research, keeping arrival-card packages separate from visa packages, DB-driven schema seeds, preview routes, RAG updates, and QA guardrails.
---

# Arrival Card Country Builder

Use this skill to add a country-specific digital arrival-card workflow to VIZA.

## Core Rule

Arrival cards are not visas. Keep them separate from eVisa, visit visa, pass,
payment, and official-site automation workflows.

## Workflow

1. **Verify official sources**
   - Use the government or immigration source as the field/timing baseline.
   - Capture whether the form is free, when it must be submitted, who is exempt,
     and whether health/customs declarations are included.
   - Record uncertainty instead of inventing requirements.

2. **Choose package identity**
   - Use one dedicated `visa_type` per arrival card:
     `SG_ARRIVAL_CARD`, `MY_MDAC_ARRIVAL_CARD`, `TH_TDAC_ARRIVAL_CARD`.
   - Do not reuse existing visa packages such as `SG_VISITOR_VISA`,
     `MY_TOURIST_E_VISA`, or `TH_TOURIST_E_VISA`.
   - Add an idempotent `visa_packages` migration with clear out-of-scope text.

3. **Build the DB-driven form seed**
   - Add `scripts/seed-<country>-arrival-card-form-fields.ts`.
   - Use `toBilingualSeedRow()` and explicit `validation_rules.label_zh` for
     country-specific or declaration fields.
   - Keep v1 single-traveller unless the user explicitly asks for group
     submission.
   - Include acknowledgement fields for official timing, free/official channel
     reminders, and final manual submission.

4. **Add an isolated preview entry**
   - Add a `/client/arrival-cards/<country>` route that opens the matching
     `/client/application/long-form?country=...&visaType=...` flow.
   - Do not alter the main destination catalog until the user approves the
     preview workflow.

5. **Update AI and docs surfaces**
   - Update country RAG seeds when user-facing AI routing/copy changes.
   - Update nearest `AGENTS.md` files whenever adding routes, seeds, or skill
     modules.

## Guardrails

- Do not create Playwright runners for official portals from this workflow.
- Do not bypass CAPTCHA, login, MFA, payment, review, or final submit controls.
- Do not store applicant documents, credentials, screenshots, or secrets in the
  skill.
- If a country combines arrival, customs, and health declarations, keep the
  package name tied to the official product but document included subparts.

## Validation

- Frontend: `cd viza-fe/internal-website && npm run type-check && npm run lint`
- Backend: `cd viza-be/agent-backend && npm run type-check && npm run lint`
- Run focused tests for the new schema/route metadata.
- Smoke the preview route. If authenticated browser state is unavailable,
  verify the unauthenticated redirect and report the save/review gap.
