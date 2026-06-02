# Visa Socket Namespace Guide

Scope: this file applies to `viza-be/agent-backend/src/socket/**`.

## Purpose

This module owns Socket.IO chat behavior for VIZA AI. The frontend connects to
namespace `/visa` and sends/receives streaming events.

## Key Flow

1. `src/index.ts` creates `io.of('/visa')`.
2. `registerVisaNamespace()` handles connection lifecycle.
3. `visa_chat_message` saves the user message, assembles history, loads
   application context, updates structured conversation state, retrieves RAG
   chunks, emits optional application redirect blocks, and streams Claude tokens.
4. Assistant output is persisted to `visa_chat_messages`.
5. The frontend listens for `token`, `response_complete`, `error`,
   `application_block`, and diagnostic `app_log` events.

## Ownership Boundaries

- Keep namespace `/visa` and event names stable unless frontend types and UI are
  updated in the same change.
- Do not collect detailed form fields inside chat. Use application redirect
  blocks to send users to `/client/application`.
- Keep compact follow-up interpretation and conversation state handling intact.
- RAG routing should not default to Indonesia or any other country without user
  or application context.
- User-facing assistant responses should stay plain text by default.
- Main response language follows the frontend interface locale sent on
  `visa_chat_message.locale`, not the user's latest message language. Keep this
  aligned with `src/agent/index.ts` and `viza-fe/internal-website/types/agent-test.ts`.
- Mixed Schengen + non-Schengen itineraries need multiple handoff routes. The
  Schengen form link should use the Schengen main destination from Schengen day
  counts, while non-Schengen destinations such as the UK remain visible as
  separate visa/application links.
- RAG routing follows the application form/product service boundary. If a
  recognized country is not in `VISA_SERVICE_COUNTRIES`, tell the user VIZA has
  not opened that country/region service yet and do not provide detailed RAG
  requirements or application links for it.
- `npm run test:visa-agent-evals` is the required regression gate for this
  namespace. It includes the 50 VIZA product QA prompts, 10 edge prompts, mixed
  Schengen/non-Schengen flows, and service-country-to-RAG-seed coverage.
- Persist visible user/assistant messages idempotently. The frontend also has a
  Supabase-side `ensureSessionMessage()` fallback, so Socket.IO persistence must
  check for an existing exact session/role/content row before inserting.

## Validation

Run from `viza-be/agent-backend`:

```powershell
npm run type-check
npm run test:visa-agent-evals
```

Also smoke `/client/chat` with the frontend when possible.

## Related Files

- `viza-be/agent-backend/src/index.ts`
- `viza-be/agent-backend/src/agent/index.ts`
- `viza-be/agent-backend/src/services/visa-knowledge.service.ts`
- `viza-be/agent-backend/src/services/visa-conversation-state.service.ts`
- `viza-be/agent-backend/src/config/visa-destination-registry.ts`
- `viza-be/agent-backend/scripts/run-visa-agent-evals.ts`
- `viza-fe/internal-website/app/client/chat/AGENTS.md`
- `viza-fe/internal-website/components/client/companion/block-message.tsx`
- `viza-fe/internal-website/types/agent-test.ts`
