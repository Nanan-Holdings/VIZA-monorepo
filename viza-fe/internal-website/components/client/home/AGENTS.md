# Client Home Components Agent Guide

Scope: this file applies to `viza-fe/internal-website/components/client/home/**`.

## Purpose

These components render the authenticated client home dashboard: plan entry,
universal information progress, quick actions, destination browsing, application
status cards, and recent activity.

## Destination Browsing

- `PopularDestinationsSection.tsx` shows six featured destinations first, then
  region cards. Search should query all selectable destination forms directly.
- `DestinationRegionPageClient.tsx` renders the regional destination lists used
  by `/client/destinations/[region]`.
- Destination metadata and region membership belong in `lib/visa-destinations.ts`.

## Guardrails

- Keep homepage content aligned to the shared `max-w-[1090px]` rhythm.
- Featured destinations must also remain present in their detailed region page.
- Region cards are entry points only; country cards should still call
  `selectUserVisaDestination()` before opening `/client/application`.
