# Travel Service Agent Guide

Scope: this file applies to `viza-be/travel-service/**`.

## Purpose

The travel service is a Python FastAPI backend for Travel AI. It generates and
revises itineraries, handles travel chat responses, searches flight/hotel
options, and exports Word/PDF travel plans.

## Key Files

- `main.py`: FastAPI app, request models, route handlers, payload
  normalization, flight leg and hotel stay construction.
- `agent.py`: Travel chat response generation.
- `itinerary.py`: itinerary generation and revision logic.
- `tools/flights.py`: SerpApi-first flight search with Booking.com fallback behavior.
- `tools/serpapi.py`: Secret-safe SerpApi Google Flights/Hotels adapter; hotel
  list results are enriched through property details so application autofill
  receives verified addresses and telephone numbers when the provider has them.
- `tests/test_serpapi.py`: SerpApi normalization and secret-safety regressions.
- `tests/test_flights.py`: provider/fallback contract regressions.
- `tests/test_hotels.py`: hotel provider/fallback truthfulness regressions.
- `tests/test_itinerary_sanitization.py`: long-plan completeness regressions.
- `tests/test_export_summary.py`: current-itinerary export and no-placeholder regressions.
- `tools/hotels.py`: SerpApi-first hotel search with Booking.com fallback behavior.
- `tools/http_client.py`: Shared bounded async HTTP client and provider request semaphore.
- `tools/generate_verified_qa_travel_facts.py`: Explicitly unbooked local-QA
  itinerary fact generator backed by live flight and hotel searches.
- `export_doc.py`, `export_pdf.py`, `export_summary.py`: document export.
- `rag/retriever.py`: travel RAG helper.
- `requirements.txt`: Python dependencies.
- `.env.example`: OpenAI, SerpApi, and RapidAPI environment template.

## Ownership Boundaries

- Keep HTTP route payloads compatible with frontend `lib/travel/planner.ts` and
  `/api/travel/*` proxies.
- Follow the root authorization-continuity rule: requests to integrate, test,
  configure, or obtain provider credentials authorize their normal in-scope
  setup and validation steps without intermediate confirmation prompts.
- Travel chat natural-language user messages must be interpreted through the
  OpenAI API before local RAG/default fallbacks are used. Local RAG should
  provide context and deterministic fallback only; it must not override an
  explicit destination from the user.
- Fallback behavior should remain deterministic and user-safe when external
  APIs or OpenAI are unavailable.
- Do not put frontend UI state here.
- Do not put visa application RAG/Socket.IO logic here; that belongs in
  `agent-backend`.

## Validation

Start locally:

```powershell
cd viza-be\travel-service
.\.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Smoke:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/generate -ContentType 'application/json' -Body '{"country":"Japan","cities":["Tokyo"],"travelers":1,"budget":1000,"travel_days":2}'
```

Also smoke `/client/travel-chat` through the frontend when UI compatibility is
affected.

## Related Files

- `viza-fe/internal-website/app/api/travel/AGENTS.md`
- `viza-fe/internal-website/lib/travel/AGENTS.md`
- `viza-fe/internal-website/components/client/travel/AGENTS.md`
- `docs/travel-agent-development-guide.md`
