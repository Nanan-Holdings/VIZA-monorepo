# Client Home Components Agent Guide

Scope: this file applies to `viza-fe/internal-website/components/client/home/**`.

## Purpose

These components render the authenticated client home dashboard: the exact
active visa package, universal information progress, quick actions, destination
browsing, application status cards, and recent activity.

## Dashboard Cards And Activity

- `ActiveVisaCard.tsx` makes the exact localized visa package name the primary
  home-card fact and links to that application's next step.
- `UniversalInfoCard.tsx` shows reusable profile readiness without repeating a
  field inventory or decorative icons.
- `ApplicationTimelineSection.tsx` keeps to-dos and completed lifecycle tasks
  visible as separate groups for the exact active application. Each task uses
  the established recent-activity card treatment with its own editorial image,
  status or completion time, and an action chevron when the row is clickable.
  Omit the completed group when it has no tasks, and visually mute upcoming
  tasks that have not started.
- `ApplicationTimelineSection.test.tsx` protects the two-group, multi-panel
  structure so it cannot regress to a one-at-a-time tab view.

## Destination Browsing

- `PopularDestinationsSection.tsx` shows exactly three featured country entries
  first, then region cards. Search should query all selectable destinations,
  while countries with multiple schemas resolve to one country entry.
- `DestinationRegionPageClient.tsx` renders the regional destination lists used
  by `/client/destinations/[region]`. Broader region pages show Indonesia,
  Vietnam, and the Philippines once and route into their dedicated category
  pages; those country pages keep the individual application schemas separate.
- Destination metadata and region membership belong in `lib/visa-destinations.ts`.
- Render destination flags through `DestinationFlag.tsx`; it converts regional
  indicator emoji metadata into `react-circle-flags` icons so country displays
  remain consistent even when the operating system lacks a flag glyph.

## Guardrails

- Keep homepage content aligned to the shared `max-w-[1090px]` rhythm.
- Featured destinations must also remain present in their detailed region page.
- Region cards are entry points only; country cards should still call
  `selectUserVisaDestination()` before opening `/client/application`.
