# Admin Operations Library Agent Guide

Scope: this file applies to `viza-fe/internal-website/lib/admin/**`.

## Purpose

This module contains shared, server-safe admin operations policy. It must not
contain client session assumptions or official-portal automation.

## Current Modules

- `work-item-sops.ts`: canonical work-item statuses and initial SOP definitions,
  including owning team, priority, SLA target, checklist, and resolution codes.
- `catalogue.ts`: public catalogue snapshot contract and runtime validation used
  at the admin-to-marketing publication boundary.
- `__tests__/work-item-sops.test.ts`: registry completeness and uniqueness guard.

## Rules

- Work items represent exceptions or intentional follow-up; never turn the
  successful automated path into a manual approval gate.
- SOP definitions must name an owner, target time, evidence-oriented checklist,
  and explicit resolution codes.
- Keep metadata redacted. Do not put passport values, portal secrets, payment
  credentials, raw documents, or authentication tokens into work-item data.
- Mutations live in authenticated server actions under `app/actions/**` and must
  emit an audit event.

## Validation

Run from `viza-fe/internal-website`:

```bash
npm run type-check
npm run lint
```
