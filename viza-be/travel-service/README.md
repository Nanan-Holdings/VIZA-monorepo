# VIZA Travel Service

Python FastAPI service for travel itinerary generation, flight/hotel suggestions, and Word/PDF export.

## Run locally

1. Create virtual environment

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

2. Create `.env` from `.env.example` and fill keys

3. Start server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Endpoints

- `POST /generate`
- `POST /flight-options`
- `POST /hotel-options`
- `POST /download-word`
- `POST /download-pdf`
