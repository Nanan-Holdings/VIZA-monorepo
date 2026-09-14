# Historical Travel Agent – Developer Guide

> Status: archived historical material. This directory is not the current VIZA
> Travel product entry point. The current product uses
> viza-fe/internal-website/app/api/travel/chat/route.ts and
> viza-be/travel-service/main.py. The LangGraph CLI described below runs only
> when a developer manually invokes the old CLI.

This document preserves the useful shape of the original Travel prototype while
marking its runtime boundary explicitly. Do not infer current product behavior,
model configuration, persistence, or tool support from this file.

## 1) Historical folder map

The historical root is
D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\travel-agent.

- backend/ was the old FastAPI backend for itinerary generation, export, and
  provider integrations.
- tools/ contained the old flight and hotel helpers.
- travel-ui/ was an older form-based UI with map and timeline views.
- travel-agent-chatbot/ was an older Vercel AI SDK chatbot frontend. It is not
  the current VIZA internal-website Travel UI.
- agent/ contains the old LangGraph experiment.
- main.py and chat.py are old CLI-oriented entry points.

The repository startup scripts point to
viza-be/travel-service, not this directory. For current routes, state, model
selection, and fallback behavior, use
docs/travel-agent-development-guide.md and the source files it cites.

## 2) Historical LangGraph experiment

The graph in agent/graph.py is a small two-node StateGraph:

- agent/state.py defines only user_input, country, cities, city_days,
  current_city, travelers, budget, and reply.
- agent/nodes.py:12-48 implements extract_info as a sequential deterministic
  slot parser. The first input becomes country, comma-separated input becomes
  cities, and digit-only inputs fill city_days, travelers, and budget.
- agent/nodes.py:51-71 implements ask_question for those slots.
- agent/graph.py:22-41 registers extract and ask, enters at extract, routes to
  ask while incomplete, routes to __end__ when complete, and loops ask back to
  extract.
- There is no configured max_steps, durable checkpoint, resume store, or
  human-confirmation gate in this graph.
- agent/nodes.py:73-80 contains call_tools, but graph.py never registers it.
  That function also reads destination and start_date fields that are absent
  from the historical TravelState. It is an abandoned interface, not proof
  that the graph had active flight/hotel tool selection.

chat.py:24-32 wraps graph.invoke(state) in a while loop for manual CLI input.
When the simple slot set is complete, the CLI continues to itinerary and Word
generation and exits. This is the only historical LangGraph invocation found
for this directory. It is not imported by the current VIZA Next route or by
viza-be/travel-service.

## 3) Historical UI and API notes

The old chatbot reconstructed state from structured user messages and rendered
guided fields in this order:

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
11. itinerary panel and export

The old parser and locations files were:

- travel-agent-chatbot/lib/travel/planner.ts
- travel-agent-chatbot/lib/travel/locations-provider.ts
- travel-agent-chatbot/lib/travel/locations.ts

The old chatbot's chat cards were expected to remain in
components/chat/messages.tsx, whose single scroll container owned history and
auxiliary Travel cards. This is retained as historical UI context only; it does
not describe the current internal-website component tree.

The old export surface was:

- travel-agent-chatbot/app/(chat)/api/travel/download-word
- travel-agent-chatbot/app/(chat)/api/travel/download-pdf
- backend/export_doc.py
- backend/export_pdf.py

The old backend and UI had no relation to the current Next session version,
message idempotency, Responses previous_response_id, or current trip-version
archive unless a later migration explicitly added such wiring. No such wiring is
present in the historical files documented here.

## 4) Current VIZA handoff

For the current product, start from these real paths:

- viza-fe/internal-website/app/client/travel-chat/page.tsx is the authenticated
  page entry.
- viza-fe/internal-website/app/client/travel-chat/travel-chat-client.tsx sends
  browser turns to POST /api/travel/chat.
- viza-fe/internal-website/app/api/travel/chat/route.ts is the current
  Responses API coordinator. It uses gpt-5.6-luna, a single structured
  Responses call per turn, no LLM tools, a 60,000 ms timeout, and one
  gpt-5.5 fallback only for a 403/404 model_not_found response.
- Its state mutations are explicit set/add/remove/unset/reset operations with
  evidence and user confirmation for pending inferred actions. It persists
  state_version and external messageId through commit_travel_agent_turn.
- viza-be/travel-service/main.py is the current Python FastAPI service. It has
  nine routes, including /generate, /revise-itinerary, /chat, health/ready,
  flight/hotel options, and Word/PDF export.
- The current Web does not call Python /chat. Python /chat is a separate
  Chat Completions interface with its own response shape and deterministic
  fallback.
- The current Next itinerary pipeline may call Python /generate, Google Places
  enrichment, and a text-only gpt-4o-mini fallback. Current revision normally
  uses the Next revision route; Python /revise-itinerary is a fallback only when
  that route has no OpenAI key.

The current source, rather than this archived document, is authoritative for
all implementation decisions.
