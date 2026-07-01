# Agent Backend Services Guide

Scope: this file applies to `viza-be/agent-backend/src/services/**`.

## Purpose

Services contain reusable backend business logic for RAG retrieval, structured
conversation state, and other cross-route behavior.

## Key Services

- `visa-knowledge.service.ts`: embeddings, Supabase RPC retrieval,
  document-type targeting, fallback retrieval, and knowledge context formatting.
- `visa-conversation-state.service.ts`: extracts, merges, persists, and
  summarizes VIZA conversation route state.
- `internal-automation/**`: lifecycle status mapping, external status
  normalization, packet handoff payload shaping, and notification payload
  helpers for website-owned automation.
- `official-fee/**`: official visa fee quote/consent/payment-intent framework,
  dry-run/manual providers, precondition gates, redaction, and reconciliation.
- `us-appointment/**`: U.S. B1/B2 appointment dry-run state machine,
  provider-detection metadata, manual checkpoints, slot/status models,
  redaction, and audit helpers.
- `korea-appointment/**`: Korea C-3-9 KVAC appointment service shell for
  slot observation, explicit user slot selection, and dry-run booking
  confirmation against the shared `appointment_*` data model.

## Ownership Boundaries

- Keep retrieval grounded in `visa_documents` and `visa_chunks`.
- Use `src/config/visa-destination-registry.ts` for supported country aliases,
  Schengen membership, and default visitor visa types.
- Do not hardcode one-off routing logic in Socket.IO handlers when it belongs in
  a reusable service or registry.
- Hidden state marker rows in `visa_chat_messages` must not become visible to
  users or LLM context.
- Keep official portal runner logic out of services unless the user explicitly
  reopens `submission-service` scope.
- Official-fee services may model browser/virtual-card providers as interfaces,
  but must not move real portal payment automation or sensitive card handling
  into `agent-backend`.

## Validation

Run from `viza-be/agent-backend`:

```powershell
npm run type-check
npm run test:visa-agent-evals
npm run test:field-guidance-copilot
```

If RAG document selection changes, also test at least one country-specific and
one Schengen multi-country prompt.

## Related Files

- `viza-be/agent-backend/src/config/visa-destination-registry.ts`
- `viza-be/agent-backend/src/socket/visa-namespace.ts`
- `viza-be/agent-backend/src/services/internal-automation/AGENTS.md`
- `viza-be/agent-backend/src/services/us-appointment/AGENTS.md`
- `viza-be/agent-backend/src/services/korea-appointment/*`
- `viza-be/agent-backend/src/routes/field-guidance.routes.ts`
- `viza-be/agent-backend/drizzle/0012_match_visa_chunks.sql`
- `knowledge-base/visa-rag-seeds/README.md`
