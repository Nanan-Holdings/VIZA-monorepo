# Travel API Proxy Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/travel/**`.

## Purpose

These Next.js route handlers are the frontend server boundary for Travel AI.
They proxy browser requests to `viza-be/travel-service` and keep the Python
service URL off the client.

## Key Flows

- `itinerary/route.ts`: generate itinerary.
- `itinerary/revise/route.ts`: revise an existing itinerary.
- `chat/route.ts`: Travel chat response endpoint.
- `flights/route.ts`: flight option search.
- `hotels/route.ts`: hotel option search.
- `geocode/route.ts`: server-side Google Geocoding API lookup for city,
  attraction, and map marker coordinates.
- `download-word/route.ts` and `download-pdf/route.ts`: document export proxy.
- `locations/countries/route.ts` and `locations/cities/route.ts`: location
  options.
- `ip-location/route.ts`: approximate origin city helper.

## Ownership Boundaries

- Use `lib/travel/backend.ts` for backend URL and JSON forwarding.
- Do not duplicate itinerary generation in Next route handlers. External lookup
  proxying is allowed here when it protects API keys from client-side itinerary
  UI code.
- Validate payload shape lightly at the boundary; keep business state rules in
  `lib/travel/planner.ts`.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

With `travel-service` running, smoke the changed route through
`/client/travel-chat` or by posting to `/api/travel/<route>`.

## Related Files

- `viza-fe/internal-website/lib/travel/backend.ts`
- `viza-fe/internal-website/lib/travel/planner.ts`
- `viza-fe/internal-website/app/api/travel/geocode/route.ts`
- `viza-be/travel-service/main.py`
- `docs/travel-agent-development-guide.md`
