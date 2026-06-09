# Travel Frontend Logic Agent Guide

Scope: this file applies to `viza-fe/internal-website/lib/travel/**`.

## Purpose

This module owns the deterministic frontend Travel AI state machine, request
payload shaping, travel chat types, backend proxy helper, and country/city
location data.

## Key Flows

- `planner.ts`: source of truth for structured Travel state, required field
  order, form payload messages, itinerary parsing, and backend payloads.
- `chat-types.ts`: Travel chat message, quick reply, and card types.
- `backend.ts`: safe JSON proxy helper for Next route handlers.
- `itinerary-fallback.ts`: server-only itinerary generation fallback pipeline
  that tries the Python Travel Service first, then Google Places enrichment,
  then an OpenAI text-only itinerary fallback with structured errors.
- `destination-resolver.ts`: destination normalization, local fallback index,
  fuzzy/alias/ambiguous resolution, lazy card payload generation, and trip hint
  extraction for Travel AI route handlers.
- `destination-contracts.ts`: dropdown city product contract, curated local
  cover/attraction/image quality data, localization helpers, and local-first
  destination payload shaping.
- `googlePlacesEnrichmentService.ts`: server-only Google Places destination
  enrichment, safe photo placeholder handling, and best-effort local DB cache.
- `google-places.ts`: shared Google Places attraction card schema,
  normalization, filtering, scoring, and fallback image handling for the
  server-only Places API routes and Travel UI.
- `travel-errors.ts`: shared normalized Travel pipeline error shape and debug
  logging helpers.
- `locations.ts`: curated country/city data and aliases.
- `locations-provider.ts`: async options provider and cache layer.

## Ownership Boundaries

- Do not infer required trip fields with hidden AI logic. Required flow order
  belongs in `planner.ts`.
- UI rendering belongs in `components/client/travel/**` and
  `app/client/travel-chat/**`.
- Python itinerary/flight/hotel generation belongs in `viza-be/travel-service`.
- Next route handler proxy behavior belongs in `app/api/travel/**`.
- Google Places and OpenAI itinerary fallbacks in this folder are server-only;
  never import them from client components.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/client/travel-chat` after planner changes. Verify the next missing
field order and generated `/api/travel/*` payloads.

## Related Files

- `viza-fe/internal-website/components/client/travel/AGENTS.md`
- `viza-fe/internal-website/app/client/travel-chat/travel-chat-client.tsx`
- `viza-fe/internal-website/app/api/travel/*`
- `viza-be/travel-service/main.py`
- `docs/travel-agent-development-guide.md`
