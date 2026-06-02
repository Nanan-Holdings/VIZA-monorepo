# Agent Backend Tests Guide

Scope: this file applies to `viza-be/agent-backend/tests/**`.

## Purpose

This directory holds shared Vitest test setup and future backend test helpers.

## Key Files

- `setup.ts`: global Vitest setup loaded by `vitest.config.ts`.

## Rules

- Keep global setup minimal. Prefer per-test mocks unless a mock is genuinely
  needed across the whole backend test suite.
- When adding or moving shared test helpers, update this file and the relevant
  package guide.

## Validation

Run from `viza-be/agent-backend`:

```powershell
npm run test
npm run test:visa-agent-evals
```
