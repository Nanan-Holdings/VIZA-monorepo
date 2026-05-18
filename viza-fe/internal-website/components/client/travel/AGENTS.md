# Travel Agent Integration Rules (VIZA Monorepo)

Scope: this file applies to `viza-fe/internal-website/components/client/travel/**`.

## Goal

Keep Travel AI UI deterministic and production-safe while preserving current business flow:

1. Multi-step structured collection (country -> cities -> departure date -> travel days -> travelers -> budget -> origin/return confirmation -> order -> flights -> hotels -> final note)
2. Map-assisted selection is only a prefill helper, never a logic bypass
3. All backend calls go through `app/api/travel/*` proxy routes

## Source Of Truth

Before changing Travel behavior, read:

1. `docs/travel-agent-development-guide.md`
2. `viza-fe/internal-website/lib/travel/planner.ts`
3. `viza-fe/internal-website/app/client/travel-chat/travel-chat-client.tsx`

If guidance conflicts, prefer deterministic flow in `planner.ts`.

## Key Files

- `travel-planner-form.tsx`: step form UI and structured payload emission
- `travel-itinerary-panel.tsx`: itinerary render/export
- `trip-route-map.tsx`: map route, markers, hover preview, map-to-form handoff

## Guardrails

1. Do not skip required steps by directly mutating later-stage fields.
2. Do not add hidden AI inference for form fields.
3. Keep map interactions reversible and idempotent.
4. Keep markers readable under zoom/responsive changes.
5. Avoid introducing dependencies unless strictly necessary.
6. Whenever you create a new important file for the Travel AI module, update this AGENTS.md with a short note describing what file was created and why it matters.

## Important Files Added During Iterations

- Add new entries here whenever a new important Travel AI file is created. Include the path and a one-line purpose.
- `travel-itinerary-data.ts`: shared itinerary extraction/export payload helpers for final itinerary views.
- `travel-itinerary-experience.tsx`: right-side final itinerary card, detail dialog, and full dynamic map experience.
- `travel-itinerary-share-renderer.tsx`: public share-page renderer for standalone itinery cards, tables, and downloads.
- `app/api/travel/ip-location/route.ts`: resolves the user's approximate IP city for the origin/return confirmation step.

## Validation Checklist (for every travel UI change)

1. `cd viza-fe/internal-website && npm run type-check`
2. Manually verify `/client/travel-chat`:
   - map renders
   - marker image loads
   - zoom/pan behavior is stable
   - step question order remains correct
3. If map behavior changes, run Playwright visual self-test script and keep screenshots in `test-results/`.

## UX Rules

1. Chinese copy should be friendly and actionable.
2. Keep top-level status visible and non-overlapping with map interaction.
3. Do not let map marker overlays block core form operations.
4. When adding or changing travel imagery, ensure each image directly matches its title and description; do not use unrelated city-gallery, random, or placeholder images for item-level cards.
