# Agent Backend Services Guide

Scope: this file applies to `viza-be/agent-backend/src/services/**`.

## Purpose

Services contain reusable backend business logic for RAG retrieval, structured
conversation state, and other cross-route behavior.

## Key Services

- `visa-knowledge.service.ts`: embeddings, Supabase RPC retrieval,
  document-type targeting, fallback retrieval, and knowledge context formatting.
  It propagates the request abort signal into embedding, RPC, and REST work and
  must not start another fallback after the caller disconnects.
- `visa-conversation-state.service.ts`: extracts, merges, persists, and
  summarizes VIZA conversation route state. It may reuse a complete
  request-scoped session/message snapshot from the socket bootstrap, while an
  incomplete legacy message page must retain the wider database fallback.
  Structured memory writes use semantic deduplication that ignores only
  `updatedAt`; legacy or empty memory still writes once, and changed state
  retains optimistic revision checks.
- `visa-entry-rule.service.ts`: deterministic passport/destination eligibility
  lookup, reviewed policy fallbacks, and policy-first prompt generation.
  `visa-entry-rule-cache.ts` coalesces identical public rule lookups in a
  bounded process-local cache keyed to the exact active knowledge release.
  Successful missing-rule lookups are negative-cached for the same bounded TTL;
  database failures must remain immediately retryable.
  Applicant identity, chat text, answers, and stay length must remain outside
  the shared cache; stay limits are evaluated on a defensive per-request copy.
- `internal-automation/**`: lifecycle status mapping, external status
  normalization, packet handoff payload shaping, and notification payload
  helpers for website-owned automation.
- `official-fee/**`: official visa fee quote/consent/payment-intent framework,
  dry-run/manual providers, precondition gates, redaction, and reconciliation.
- `us-appointment/**`: U.S. B1/B2 appointment dry-run state machine,
  provider-detection metadata, manual checkpoints, slot/status models,
  redaction, and audit helpers.
- `france-appointment/**`: France Schengen TLScontact China appointment service
  over the shared `appointment_*` data model. Requires France-Visas reference
  and user consent, enforces slot/status cooldowns, allows only user-selected
  observed slots, and stores payment state as redacted metadata.
- `japan-appointment/**`: Japan VFS/JVAC Singapore preparation service over the
  shared appointment tables. It validates stored answers and documents,
  prepares a redacted alias account record, and delegates Browserbase portal
  observation to submission-service without selecting slots or paying.
- `korea-appointment/**`: Korea C-3-9 KVAC appointment service shell for
  slot observation, explicit user slot selection, and dry-run booking
  confirmation against the shared `appointment_*` data model.
- `portal-health.service.ts`: bounded synthetic portal checks, transactional
  observation persistence, and public status snapshot reads.

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
npm test -- --run src/services/visa-knowledge.service.test.ts
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
- `viza-be/agent-backend/src/services/france-appointment/*`
- `viza-be/agent-backend/src/services/korea-appointment/*`
- `viza-be/agent-backend/src/routes/field-guidance.routes.ts`
- `viza-be/agent-backend/drizzle/0012_match_visa_chunks.sql`
- `knowledge-base/visa-rag-seeds/README.md`
