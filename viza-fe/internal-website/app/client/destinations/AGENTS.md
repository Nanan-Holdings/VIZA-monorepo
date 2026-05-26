# Client Destinations Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/destinations/**`.

## Purpose

Destination pages let applicants browse visa application cards after choosing a
region from the client home dashboard.

## Key Flows

- `schengen/page.tsx`: dedicated Schengen main-destination picker.
- `[region]/page.tsx`: generic regional picker for North America, South
  America, Middle East, Africa, non-Schengen Europe, Southeast Asia, East Asia,
  South Asia, and Oceania.

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
