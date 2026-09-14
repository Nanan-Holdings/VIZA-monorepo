# VIZA Travel Service

This directory is the current Python FastAPI service used by the VIZA Travel
feature for itinerary generation, itinerary revision fallback, flight and
hotel options, and Word/PDF export. The current browser conversation entry
point is the Next.js route
`viza-fe/internal-website/app/api/travel/chat/route.ts`; it is a separate
Responses API coordinator and does not forward chat turns to this service's
`POST /chat` route.

The current browser path is:

```text
/client/travel-chat
  -> /api/travel/chat (Next Responses API coordinator)
  -> /api/travel/itinerary or /api/travel/itinerary/revise when requested
  -> this service for generation, provider options, or export
```

The Python service is started by the repository VIZA scripts from this
directory (`uvicorn main:app ...`); the old root `travel-agent/` LangGraph CLI
is historical and is not a current product entry point.

## Run locally

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-be\travel-service
if (!(Test-Path .venv)) { python -m venv .venv }
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Use `.env.example` as the configuration reference. Keep real credentials in
local environment configuration and out of source control.

## FastAPI routes

The implementation in `main.py` currently exposes nine routes:

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/health` | Liveness response; does not verify every provider. |
| `GET` | `/ready` | Initializes/checks the shared HTTP client. |
| `POST` | `/generate` | Generates a structured itinerary. |
| `POST` | `/revise-itinerary` | Revises an existing itinerary or returns an unchanged itinerary with an unavailable message. |
| `POST` | `/chat` | Standalone Python natural-language chat API; the current VIZA browser chat does not call it. |
| `POST` | `/download-word` | Generates or exports a Word document. |
| `POST` | `/download-pdf` | Generates or exports a PDF document. |
| `POST` | `/flight-options` | Searches flight options, with explicit estimated/provider-unavailable results on failure. |
| `POST` | `/hotel-options` | Searches hotel options, with deterministic provider fallback on failure. |

The route definitions are in
`D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-be\travel-service\main.py:387-612`.
The request models and payload normalization are in `main.py:87-201`.

## Generation, revision, and chat behavior

`POST /generate` wraps `generate_itinerary` in a **50 second** endpoint
deadline (`main.py:401-412`). With an OpenAI client available,
`itinerary.py:1686-1860` calls `gpt-4o-mini` with temperature `0.4` and a
client timeout of **45 seconds**. Missing configuration, timeout, exception,
empty output, or invalid output uses the deterministic `_fallback_itinerary`.
That fallback is concrete and constrained by the requested city order; it is
not a booking result.

`POST /revise-itinerary` uses the same **50 second** endpoint deadline
(`main.py:415-437`). The OpenAI revision call in `itinerary.py:1419-1589`
uses `gpt-4o-mini`, temperature `0.2`, and the **45 second** client timeout.
When the client is unavailable or the call fails, production returns the
current itinerary unchanged with `_openai_revision_unavailable`. The
deterministic `_fallback_revision` function remains in `itinerary.py:1250`
and is imported by locale tests, but `main.py` does not call it in production;
it should not be documented as the active revision fallback.

`POST /chat` is an independent Python chat interface implemented by
`agent.py:605-868`. It sends at most the last **8** messages to Chat
Completions using `gpt-4o-mini`, temperature `0.2`, and a **45 second** client
timeout. Its deterministic response modes and local retrieval fallback are
useful for direct service callers, but its response shape is not the current
Next coordinator protocol (`state_version`, `ui_action`, and pending
confirmation actions are absent). The current browser therefore does not use
this route.

## Provider boundaries and fallback values

The service does not expose provider calls as LLM function tools. Flight and
hotel searches are ordinary Python calls in `tools/flights.py` and
`tools/hotels.py`. The shared provider HTTP client has connect/read/write/pool
timeouts of `5/15/5/5` seconds and retries only an initial HTTP 429, clamping
`Retry-After` to `0.1-2` seconds (`tools/http_client.py:18-128`). It does not
retry general 5xx responses.

`main.py:48-65` limits external search concurrency to **4** and each search to
**30 seconds**. Destination lookup uses a **24 hour** cache, a **10 second**
lookup deadline, and at most **64** in-flight lookups (`tools/flights.py` and
`tools/hotels.py`). A flight provider failure produces at most **2** estimated
options, with provider-unavailable metadata; the implementation does not
invent an airline or booking offer. A hotel provider failure produces **2**
deterministic `api-default` options. These are display estimates, not confirmed
reservations.

The Next proxy default timeout is **35,000 ms**
(`viza-fe/internal-website/lib/travel/backend.ts:1-30`), while this service's
generation endpoint deadline is 50 seconds. A slow generation request can
therefore be cancelled by the proxy before the Python endpoint deadline.

## Tests

The service tests include provider fallback contracts in
`tests/test_flights.py`, locale alignment in `tests/test_locale_alignment.py`,
export safety in `tests/test_export_summary.py`, and bounded concurrency,
single-flight lookup, cancellation, and temporary-file cleanup in
`tests/test_concurrency.py`. These are source-level regression tests; this
README does not claim a load benchmark or production latency measurement.
