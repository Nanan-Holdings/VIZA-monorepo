# UI Primitives Agent Guide

Scope: this file applies to `viza-fe/internal-website/components/ui/**`.

## Purpose

This directory contains shadcn-style primitives used across the frontend:
buttons, inputs, dialogs, sheets, selects, tables, calendars, tooltips, cards,
and related low-level UI building blocks.

## Ownership Boundaries

- Keep primitives generic. Feature-specific behavior belongs in route or
  feature component directories.
- Preserve shadcn conventions from `components.json` and Tailwind tokens.
- Do not hardcode business copy, Supabase calls, backend calls, or route logic
  in primitives.
- When adding a new primitive, prefer `npx shadcn@latest add <component>` and
  then adapt lightly to local conventions.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke at least one route that uses the changed primitive.

## Related Files

- `viza-fe/internal-website/components.json`
- `viza-fe/internal-website/tailwind.config.ts`
- `viza-fe/internal-website/app/globals.css`
- `viza-fe/internal-website/frontend.md`
