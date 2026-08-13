# Client Destinations Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/destinations/**`.

## Purpose

Destination pages let applicants browse visa application cards after choosing a
region from the client home dashboard.

## Key Flows

- `page.tsx`: redirect only. The change-country index merged into
  `/client/status`, which now lists every application and the destination
  browser on one page. Do not rebuild an index here.
- `schengen/page.tsx`: dedicated Schengen main-destination picker. Keep its
  search field and country cards visually aligned with the `/client/status`
  Add Destination section.
- `[region]/page.tsx`: generic regional picker for North America, South
  America, Middle East, Africa, non-Schengen Europe, Southeast Asia, East Asia,
  South Asia, and Oceania.
- Philippines mirrors Indonesia's country-category entry: the home group opens
  `/client/destinations/philippines`, where arrival and departure eTravel
  packages remain separate selectable cards.

## Ownership Boundaries

- Destination data and grouping lives in `lib/visa-destinations.ts`.
- Shared regional page UI lives in
  `components/client/home/DestinationRegionPageClient.tsx`.
- Selecting a country should continue to use `selectUserVisaDestination()`.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npx eslint app/client/destinations components/client/home lib/visa-destinations.ts
```

Smoke `/client/home` plus at least one region route such as
`/client/destinations/north-america`.
