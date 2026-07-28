# Client Home Components Agent Guide

Scope: this file applies to `viza-fe/internal-website/components/client/home/**`.

## Purpose

These components render the authenticated client home dashboard: plan entry,
universal information progress, quick actions, destination browsing, application
status cards, and recent activity.

## Destination Browsing

- `PopularDestinationsSection.tsx` shows exactly three featured country entries
  first, then region cards. Search should query all selectable destinations,
  while countries with multiple schemas resolve to one country entry.
- `DestinationRegionPageClient.tsx` renders the regional destination lists used
  by `/client/destinations/[region]`. Broader region pages show Indonesia,
  Vietnam, and the Philippines once and route into their dedicated category
  pages; those country pages keep the individual application schemas separate.
- Destination metadata and region membership belong in `lib/visa-destinations.ts`.

## Guardrails

- Keep homepage content aligned to the shared `max-w-[1090px]` rhythm.
- Featured destinations must also remain present in their detailed region page.
- Region cards are entry points only; country cards should still call
  `selectUserVisaDestination()` before opening `/client/application`.
