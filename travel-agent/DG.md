# Travel Agent – Developer Guide (DG)

This document is the quickest way for any AI/engineer to understand the repository and start editing safely.

## 1) Monorepo Structure

Root: `D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\travel-agent`

- `backend/`  
  FastAPI backend (itinerary generation, save/share, export endpoints, API integrations).
- `tools/`  
  Python helpers for flight/hotel external API calls.
- `travel-ui/`  
  Older Next.js form-based UI (map + timeline version).
- `travel-agent-chatbot/`  
  Current Vercel chatbot-style frontend (active UI layer).
- `agent/`  
  Agent orchestration-related Python code.

If request is about chatbot UX, default target is `travel-agent-chatbot/`.

## 2) Active Runtime (Current Main App)

### Frontend (active)
- Folder: `travel-agent-chatbot/`
- Stack: Next.js App Router + AI SDK UI
- Key chat UI files:
  - `components/chat/shell.tsx` (chat page composition)
  - `components/chat/messages.tsx` (main scroll container)
  - `components/chat/travel-planner-form.tsx` (guided structured input card)
  - `components/chat/travel-itinerary-panel.tsx` (itinerary + map + download buttons)

### Backend APIs used by chatbot frontend
- Next API routes (BFF layer) under:
  - `travel-agent-chatbot/app/(chat)/api/travel/*`
- FastAPI core logic remains in:
  - `backend/`
  - `tools/flights.py`
  - `tools/hotels.py`

## 3) Travel Flow (Chatbot)

State is reconstructed from user structured messages, then step-by-step prompts are rendered:

1. country/countries  
2. cities  
3. city_days  
4. travelers  
5. budget  
6. origin  
7. return  
8. travel_order  
9. flight_selection  
10. hotel_selection  
11. itinerary panel + export

State + parser definitions:
- `travel-agent-chatbot/lib/travel/planner.ts`

## 4) Country/City Data Source

Main provider:
- `travel-agent-chatbot/lib/travel/locations-provider.ts`

Curated famous-city list + CN labels:
- `travel-agent-chatbot/lib/travel/locations.ts`

Routes:
- `GET /api/travel/locations/countries`
- `POST /api/travel/locations/cities`

Design:
- Countries: global list from `mledoze/countries` with Chinese translation when available.
- Cities: curated famous-city subset (EN/ZH), fallback to capital if no curated set.
- Both country and city selectors support `其他（自定义）`.

## 5) Scroll Ownership (Important)

Single source of truth for chat-page vertical scrolling:
- `components/chat/messages.tsx`  
  `div.touch-pan-y.overflow-y-auto`

Travel cards **must** live inside this same container, otherwise they feel detached and won’t scroll with history.

Current composition is done in:
- `components/chat/shell.tsx` via `auxiliaryContent` prop into `Messages`.

## 6) Export Feature

Frontend download UI:
- `components/chat/travel-itinerary-panel.tsx`

Next API routes:
- `/api/travel/download-word`
- `/api/travel/download-pdf`

Python generation logic:
- `export_doc.py`
- `export_pdf.py`

## 7) Environment Notes (WSL)

- Next 16 requires Node `>=20.9.0`.
- Use WSL Node 20 for `travel-agent-chatbot`.
- If weird module/wasm errors appear, reinstall deps in the same environment where app runs.
- Port conflicts are common (`EADDRINUSE`): check and kill existing process before restart.

## 8) Safe Edit Checklist

When changing travel chat UX:
1. Keep structured payload contracts unchanged unless intentional.
2. Do not move travel cards outside `Messages` scroll container.
3. Verify dropdown search works for both EN and ZH.
4. Verify custom “其他” path still passes validation.
5. Re-test `/api/travel/locations/*` routes after data-layer changes.

## 9) Quick Pointers

- Chat container: `components/chat/messages.tsx`
- Guided form card: `components/chat/travel-planner-form.tsx`
- Itinerary card: `components/chat/travel-itinerary-panel.tsx`
- Chat composition: `components/chat/shell.tsx`
- State machine/parser: `lib/travel/planner.ts`
- Location provider: `lib/travel/locations-provider.ts`

