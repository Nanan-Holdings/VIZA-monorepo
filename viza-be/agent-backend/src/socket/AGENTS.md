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
   chunks, emits optional application redirect blocks, and streams OpenAI tokens.
   `chat-turn-bootstrap.ts` must keep recent messages and persisted memory in a
   single request-scoped database snapshot. Its normal path must persist the
   visible user message and load that snapshot in one parameterized statement,
   using the inserted row's `RETURNING` data in the history window; retain the
   legacy save/read sequence only as an availability fallback. Never move chat
   content into a process-shared cache.
4. Assistant output and its redacted run diagnostic are persisted atomically by
   `chat-turn-completion.ts` in one parameterized database statement. It keeps
   exact session/role/content idempotency, records diagnostics even when the
   assistant output is empty, and falls back to the legacy independent writes
   only when the combined statement fails. Chat content must remain
   request-scoped.
   Application redirect blocks are emitted in their original order and then
   persisted by `application-block-persistence.ts` in one batch per turn;
   retain one-block writes only as the availability fallback.
   Structured conversation memory must skip optimistic writes when every
   semantic field is unchanged (ignoring only `updatedAt`). Legacy/empty
   memory must still write once, and revision-conflict rebases must repeat the
   same semantic check before retrying.
5. The frontend listens for `token`, `response_complete`, `error`,
   `application_block`, and diagnostic `app_log` events.
6. `chat-concurrency.ts` bounds active AI turns and queued requests per backend
   replica so an upstream slowdown cannot exhaust every socket worker. Its
   bounded aggregate counters and wait-time samples contain no request identity
   or message content and feed the secret-protected capacity snapshot.
7. `socket-scaling.ts` keeps the in-memory adapter and polling fallback for the
   default single replica. Explicit multi-replica mode must initialize the
   shared Redis adapter before `/visa` is registered, use WebSocket-only
   transports, expose only aggregate adapter readiness, and fail startup when
   its private TLS configuration is absent or unavailable.
8. `socket-scaling.integration.test.ts` is the opt-in real-Redis gate. Backend
   CI supplies a disposable loopback Redis service and proves that a room
   broadcast crosses two independent Socket.IO server instances over WebSocket.
   The test must skip locally when its dedicated loopback URL is absent and
   must refuse remote Redis targets.

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
  namespace. It includes 1200+ product QA assertions, a 54 service country by
  21 high-frequency question matrix, 14 long-conversation memory branches,
  mixed Schengen/non-Schengen flows, and service-country-to-RAG-seed coverage.
- Persist visible user/assistant messages idempotently. The frontend also has a
  Supabase-side `ensureSessionMessage()` fallback, so Socket.IO persistence must
  check for an existing exact session/role/content row in the same parameterized
  database statement used to insert it.
- Never log `SOCKET_IO_REDIS_URL`, Redis errors that may echo that URL, chat
  payloads, or channel contents. Production shared-adapter connections must use
  `rediss://`; plaintext is limited to a local development loopback.
- Do not enable more than one backend replica until both backend and frontend
  multi-replica flags match and the shared adapter passes `/ready`.
- In explicit multi-replica mode, runtime adapter loss must also make `/health`
  non-2xx so the Render health check stops routing to the degraded instance.
  Preserve the legacy HTTP 200 health contract for the default single replica.

## Validation

Run from `viza-be/agent-backend`:

```powershell
npm run type-check
npm run test:visa-agent-evals
```

Also smoke `/client/chat` with the frontend when possible.

The real-Redis test is opt-in outside CI:

```powershell
$env:SOCKET_IO_REDIS_INTEGRATION_URL = 'redis://127.0.0.1:6379'
npm run test:socket-scaling-integration
```

## Related Files

- `viza-be/agent-backend/src/index.ts`
- `viza-be/agent-backend/src/agent/index.ts`
- `viza-be/agent-backend/src/services/visa-knowledge.service.ts`
- `viza-be/agent-backend/src/services/visa-conversation-state.service.ts`
- `viza-be/agent-backend/src/socket/chat-concurrency.ts`
- `viza-be/agent-backend/src/socket/application-block-persistence.ts`
- `viza-be/agent-backend/src/socket/chat-turn-completion.ts`
- `viza-be/agent-backend/src/socket/visible-chat-message.ts`
- `viza-be/agent-backend/src/socket/socket-scaling.ts`
- `viza-be/agent-backend/src/socket/socket-scaling.integration.test.ts`
- `viza-be/agent-backend/src/socket/visa-product-recommendations.test.ts`
- `viza-be/agent-backend/src/config/visa-destination-registry.ts`
- `viza-be/agent-backend/scripts/run-visa-agent-evals.ts`
- `viza-fe/internal-website/app/client/chat/AGENTS.md`
- `viza-fe/internal-website/components/client/companion/block-message.tsx`
- `viza-fe/internal-website/types/agent-test.ts`
