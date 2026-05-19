# Agent Backend Internal Automation Services Guide

Scope: this file applies to
`viza-be/agent-backend/src/services/internal-automation/**`.

## Purpose

This module owns reusable backend business logic for the VIZA website
automation loop: packet handoff shaping, lifecycle status mapping, notification
payload construction, and external status normalization.

## Key Responsibilities

- Keep status normalization pure and unit-testable.
- Build packet handoff payloads from database rows without including secrets.
- Provide shared allowlists for external status values.
- Keep notification payloads JSON-friendly.
- Keep services independent from Express request/response objects.

## Guardrails

- Do not place database connection setup here; use existing DB/Supabase helpers.
- Do not import frontend code.
- Do not include official portal automation logic.
- Do not log raw PII.

## Validation

Run from `viza-be/agent-backend`:

```powershell
npm run type-check
npm run lint
npm run test
```
