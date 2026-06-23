# Documentation Agent Guide

Scope: this file applies to `docs/**`.

SGAC architecture and official-form boundaries are documented in
`docs/sgac/README.md`.

## Purpose

`docs` contains product requirements, developer guides, schema playbooks, gap
reports, and workflow documentation for VIZA.

## Key Documents

- `client-portal-prd.md`: client portal product requirements.
- `prd-backend-data-schema.md`: backend data model requirements.
- `application/DG.md`: application form developer guide.
- `application/UG.md`: application form user guide.
- `viza-ai-chat-development-guide.md`: VIZA AI chat guide.
- `travel-agent-development-guide.md`: Travel AI guide.
- `TRAVEL_AGENT_QA.md`: Travel Agent QA findings, smoke prompts,
  destination-index runbook, and known limitations.
- `internal-automation/**`: VIZA website automation lifecycle, module plans,
  payment/consent/document/packet/status boundaries, and process assignment
  notes.
- `pitch/**`: pitch-deck-ready product/module summaries and bilingual investor
  narrative material.
- `visa-schema-playbook.md`: adding/maintaining country visa schemas.
- `SUPABASE_AGENT_SETUP.md`: remote Supabase setup, migration, verification,
  and troubleshooting workflow for agents.
- `AGENT_COMPLETION_CHECKLIST.md`: evidence checklist for database-backed and
  persistence-related completion claims.
- `superpowers/plans/*`: implementation plans written before staged feature
  work; keep them aligned with the current module guides and product scope.
- `prd-ds160-ceac-runtime-validation.md`: CEAC automation requirements.
- `us-appointment-assistant-portal-mapping.md`: U.S. B1/B2 appointment
  assistant provider mapping, China gated assisted-live scope, dry-run fallback,
  and compliance boundaries.
- `uk-visa-scope.md`, `uk-visa-gap-report.md`: UK form scope and gaps.
- `schengen-visa-scope.md`, `schengen-visa-gap-report.md`: Schengen form
  scope and gaps.
- `_templates/*`: templates for future visa scope/gap docs.

## Ownership Boundaries

- Keep docs truthful about current implementation status.
- Do not claim official-source parity unless source artifacts and schema
  coverage support it.
- When code adds/moves/deletes important files, update the affected module
  `AGENTS.md` as well as docs that function as source maps.
- Keep user guides user-facing and developer guides implementation-facing.
- Keep internal automation docs explicit that official portal submission runners
  are out of scope unless a later task reopens them.

## Validation

Docs-only changes do not need type-checks. For docs that describe code paths,
spot-check referenced files with `rg --files` or direct reads before finalizing.

## Related Files

- `AGENTS.md`
- `prd.json`
- `progress.txt`
- `viza-fe/README.md`
- `viza-be/README.md`
- `knowledge-base/visa-rag-seeds/README.md`
- `docs/internal-automation/AGENTS.md`
