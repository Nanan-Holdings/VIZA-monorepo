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
- `tools/flights.py`: RapidAPI flight search with fallback behavior.
- `tools/hotels.py`: RapidAPI hotel search with fallback behavior.
- `export_doc.py`, `export_pdf.py`, `export_summary.py`: document export.
- `rag/retriever.py`: travel RAG helper.
- `requirements.txt`: Python dependencies.
- `.env.example`: OpenAI and RapidAPI environment template.

## Ownership Boundaries

- Keep HTTP route payloads compatible with frontend `lib/travel/planner.ts` and
  `/api/travel/*` proxies.
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
