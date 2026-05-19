# Internal Automation Documentation Agent Guide

Scope: this file applies to `docs/internal-automation/**`.

## Purpose

This directory owns product and engineering documentation for VIZA website
automation excluding official portal runners.

## Key Responsibilities

- Document the internal lifecycle state machine.
- Document package coverage semantics.
- Document payment, consent, document checklist, packet generation, external
  status ingest, and result delivery behavior.
- Maintain `agent-prompts/**` as copy/paste-ready process prompts for parallel
  implementation agents.
- Keep user-facing promises aligned with implemented coverage.

## Guardrails

- Do not document unsupported official portal automation as available.
- Do not include secrets, real applicant data, passport images, or production
  provider payloads.
- Keep DS-160 final signature/submission boundaries explicit.

## Validation

Docs-only changes usually do not need type-checks. When docs describe an
implemented interface, verify the referenced route/action/table name exists.

## Related Files

- `docs/internal-automation/agent-prompts/index.md`
- `AGENTS.md`
- `viza-fe/internal-website/AGENTS.md`
- `viza-be/agent-backend/AGENTS.md`
