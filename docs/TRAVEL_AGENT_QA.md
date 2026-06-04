# Travel Agent QA And Hardening Report

Date: 2026-06-04

## Architecture Summary

- Entry route: `viza-fe/internal-website/app/client/travel-chat/page.tsx`
- Main client: `viza-fe/internal-website/app/client/travel-chat/travel-chat-client.tsx`
- Travel state machine: `viza-fe/internal-website/lib/travel/planner.ts`
- Natural-language proxy: `viza-fe/internal-website/app/api/travel/chat/route.ts`
- Itinerary generation proxy: `viza-fe/internal-website/app/api/travel/itinerary/route.ts`
- Revision proxy: `viza-fe/internal-website/app/api/travel/itinerary/revise/route.ts`
- Python travel service: `viza-be/travel-service/main.py`, `agent.py`, `itinerary.py`
- Destination resolver added: `viza-fe/internal-website/lib/travel/destination-resolver.ts`
- Destination index migration added: `viza-be/agent-backend/drizzle/0088_travel_destination_index.sql`

## Card Inventory

- Destination cards: `travel-chat-client.tsx`, message part `destination_cards`
- Planner form card: `components/client/travel/travel-planner-form.tsx`
- Final itinerary experience: `components/client/travel/travel-itinerary-experience.tsx`
- Legacy itinerary panel/export: `components/client/travel/travel-itinerary-panel.tsx`
- Route map card/map surface: `components/client/travel/trip-route-map.tsx`
- Rendered itinerary sections include cover, route nodes, editable table, city sections, day cards, attraction rows, restaurant rows, flight cards, hotel cards, resource loading/error cards, full-map dialog, and share/export controls.
- New lazy destination card schema covers: destination_overview, top_attractions, food_and_restaurants, transport, hotel_area, budget, weather_season, packing_preparation, visa_document, local_tips, safety_warning, itinerary_day, map_route, alternative_plan, booking_cta, save_itinerary.

## Map Files

- `components/client/travel/trip-route-map.tsx`: Google Maps rendering, markers, route polyline, fallback placeholder.
- `app/client/travel-chat/travel-chat-client.tsx`: map targets, geocode cache, city suggestions, selected marker/card target.
- `components/client/travel/travel-attraction-knowledge.ts`: curated attraction coordinates/images.
- `components/client/travel/travel-itinerary-experience.tsx`: final itinerary full-map dialog and map/card selection.

## Memory And Session Files

- Before fix: localStorage only in `travel-chat-client.tsx`.
- Added: `app/api/travel/sessions/route.ts` for authenticated server archive persistence.
- Added DB target: `travel_itinerary_sessions`.
- Archive now stores sessions plus map state locally and attempts remote save after hydration.

## Destination Data Flow

- Before fix: small Python hardcoded RAG list plus frontend curated city/image/coordinate lists.
- Added: SQL schema for large global destination index, aliases, lazy cards, unresolved review queue.
- Added: GeoNames destination importer, GeoNames alias importer, cached Wikidata enrichment, popularity recalculation scripts.
- Added: Next routes for search, resolve, lazy cards.
- Frontend still does not fetch the whole destination table; search requires `q` length >= 2 unless `featured=true`.

## Manual QA Results

| Area | Result | Evidence |
| --- | --- | --- |
| Initial route load | Pass | `/client/travel-chat` loads authenticated UI without console errors. |
| Default map candidates | Fixed | Initial map no longer exposes default Tokyo/Singapore/etc markers before any destination card exists. |
| Tokyo prompt before fixes | Fail | Returned inspiration cards and lost 3-day/budget/food/photo hints after card click. |
| Tromso prompt after fixes | Pass | UI returned Tromso-only card and no stale Tokyo card. |
| Destination card click | Pass | Tromso selected, progress 20%, city suggestions hidden after selection. |
| Refresh persistence | Pass for local fallback | Reload restored Tromso conversation and 20% progress. Screenshot: `test-results/travel-qa-tromso-refresh-persist.png`. |
| Ambiguous Georgia API | Pass | `/api/travel/destinations/resolve` asks clarification. |
| Typo Singapore API | Pass | `/api/travel/destinations/search?q=Singaproe` resolves Singapore fallback. |
| Lazy card coverage | Pass in unit/API schema | Resolver generates all required lazy card types for selected/temp destination. |
| DB migration | Blocked in this environment | `npm run db:migrate` failed DNS lookup for configured Supabase host. |

## Bugs Fixed

- Default map suggestions no longer render on first load.
- Resolver handles aliases, typos, multilingual names, ambiguity, multi-city mentions, and temporary fallback destinations.
- Chat proxy now filters stale backend default destination cards when resolver has a stronger destination match.
- Card-click flow preserves parsed travel days, per-city days, travelers, budget, and preference notes.
- Refresh persistence now rehydrates local archive; server archive route added for DB-backed persistence when migration is applied.
- Lazy card generation endpoint added; cards are created only for selected destination.

## Remaining Limitations

- The Python travel service still has a tiny built-in RAG list; the Next resolver protects the UI boundary, but Python should later read from the same DB index.
- Direct full itinerary generation from a complete free-text prompt still goes through destination confirmation and deterministic required fields.
- Budget/weather/packing/visa/tips/safety cards are generated as lazy destination-card records, but the final itinerary UI does not yet render each as a first-class visual component.
- Server-side persistence could not be fully verified because the DB migration could not run against Supabase from this environment.
- Browser plugin Chinese text entry was blocked by missing virtual clipboard; Chinese prompts were tested through API and ASCII prompts through UI keypresses.

## How To Seed Global Destinations

1. Apply migrations from `viza-be/agent-backend`: `npm run db:migrate`.
2. Download GeoNames dumps locally, for example `allCountries.txt`.
3. Import destinations:
   `npm run travel:import-geonames-destinations -- --file D:\data\geonames\allCountries.txt --batch-size 2000`
4. Import aliases:
   `npm run travel:import-geonames-aliases -- --file D:\data\geonames\allCountries.txt --batch-size 2000`
5. Optional cached Wikidata enrichment:
   `npm run travel:enrich-wikidata -- --file D:\data\travel\wikidata-destinations.jsonl`
6. Recalculate scores:
   `npm run travel:recalculate-popularity -- --batch-size 1000`

## How To Test

- Search: `GET /api/travel/destinations/search?q=Singaproe&limit=5`
- Featured only: `GET /api/travel/destinations/search?featured=true&limit=10`
- Ambiguity: `POST /api/travel/destinations/resolve` with `{ "rawText": "Plan a trip to Georgia." }`
- Missing fallback: resolve `"Plan a trip to Blue Lantern Bay."`
- Lazy cards: `POST /api/travel/destinations/cards` with `{ "destinationText": "Tromso" }`
- UI smoke: open `/client/travel-chat`, send `Plan a trip to Tromso 3 days medium budget food photos`, click `加入计划：Tromso`, refresh.

## Checks

- `viza-fe/internal-website`: `npm run type-check` passed.
- `viza-fe/internal-website`: resolver unit test passed, 5 tests.
- Changed frontend files lint passed.
- `viza-be/agent-backend`: `npm run type-check` passed.
- Changed backend files lint passed.
- Full frontend lint still fails on pre-existing unrelated repo issues such as restricted service-role imports under `app/client/**`, missing `@next/next/no-img-element` rule definitions, and an OCR hook rule violation.
