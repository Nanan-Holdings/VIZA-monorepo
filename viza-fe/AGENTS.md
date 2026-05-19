# Frontend Agent Guide

Scope: this file applies to `viza-fe/**`.

## Purpose

`viza-fe` owns the VIZA web portal. The active production app is
`viza-fe/internal-website`; treat that app as the source of truth for new
frontend work.

## Key Components

- `viza-fe/README.md`: frontend overview, setup, environment, and validation.
- `viza-fe/internal-website`: Next.js 16 App Router portal.
- `viza-fe/internal-website/frontend.md`: client portal design rules.
- `viza-fe/internal-website/app`: routes, server actions, and route handlers.
- `viza-fe/internal-website/components`: UI primitives and composite
  components.
- `viza-fe/internal-website/lib`: Supabase clients, travel state, auth helpers,
  utility logic.
- `viza-fe/internal-website/messages`: next-intl copy.
- `viza-fe/internal-website/types`: frontend shared types.

## Ownership Boundaries

- Do frontend code changes inside `viza-fe/internal-website`.
- Do not add a new frontend app unless the user explicitly asks.
- Backend APIs, migrations, and RAG ingestion scripts belong under `viza-be`
  or `knowledge-base`, even when a frontend feature consumes them.
- If you add, move, or delete an important frontend file, update the nearest
  nested `AGENTS.md` and this file when the change affects the frontend map.

## Validation

Run from `viza-fe/internal-website` for frontend code changes:

```powershell
npm run type-check
npm run lint
npm run test
```

For route/UI work, also smoke test the changed route in a browser. If auth is
not available, verify the unauthenticated redirect plus the nearest accessible
route or component state.

## Related Files

- `viza-fe/README.md`
- `viza-fe/internal-website/AGENTS.md`
- `viza-fe/internal-website/package.json`
- `viza-fe/internal-website/next.config.ts`
- `viza-fe/internal-website/tailwind.config.ts`
- `viza-fe/internal-website/frontend.md`
