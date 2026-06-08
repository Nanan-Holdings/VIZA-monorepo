# Google Places API Route Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/api/places/**`.

## Purpose

These Next.js route handlers are the server-only Google Places boundary for the
Travel AI attraction-card system. They protect `GOOGLE_MAPS_API_KEY`, normalize
Google Places API New responses into VIZA travel card types, and avoid storing
Google Places content.

## Key Files

- `_google-places-api.ts`: route-only validation, API-key lookup, request
  helpers, and in-flight deduplication.
- `search/route.ts`: Text Search (New) endpoint for city attraction cards.
- `details/route.ts`: Place Details (New) endpoint used only when a card detail
  view is opened.
- `photo/route.ts`: Place Photos (New) server redirect endpoint with local
  fallback imagery.

## Guardrails

1. Use `GOOGLE_MAPS_API_KEY` only on the server. Do not send it to the browser.
2. Use Places API New endpoints and explicit field masks.
3. Do not add persistence for Google photos, ratings, summaries, addresses, or
   full place details.
4. Do not cache Google Places content beyond in-flight request deduplication.
5. Keep user-facing API errors safe and never log or return the API key.
