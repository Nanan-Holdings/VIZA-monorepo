# Travel Agent App Rules (standalone prototype)

Scope: applies to `travel-agent/travel-agent-chatbot/**`.

## Intent

This app is a prototype reference for the Travel AI experience now integrated into VIZA monorepo.
When developing here, keep behavior aligned with:

- `docs/travel-agent-development-guide.md`
- `viza-fe/internal-website/lib/travel/planner.ts` (deterministic flow source of truth)

## Priorities

1. Preserve multi-step travel planning flow (country/cities/days/order/...).
2. Keep map markers readable, non-overlapping, and responsive to zoom/pan.
3. Avoid hidden inference: user choices must be explicit and reversible.

## Map/UX Rules

1. Marker visuals must load real image content (no broken placeholders).
2. Marker size should adapt by viewport + zoom level.
3. Marker layout should avoid overlap with bounded offsets.
4. Hover/preview cards must not block core map interactions.

## Safety Rules

1. Do not commit real API keys.
2. Keep `.env.example` complete when adding new env vars.
3. Do not change backend contract shape without updating frontend callers.

## Validation

1. Run type checks/tests for touched package.
2. Run Playwright map self-test before finalizing map behavior changes.
3. Save evidence screenshots into `test-results/`.

