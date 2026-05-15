# VIZA AI Chat Route Agent Rules

Scope: this file applies to `viza-fe/internal-website/app/client/chat/**`.

## Goal

Keep the full-page `/client/chat` experience stable while preserving the current VIZA AI and Travel AI split:

1. `/client/chat` is the authenticated client portal chat route.
2. The `VIZA AI` tab owns visa application assistance over Socket.IO.
3. The `Travel AI` tab embeds the Travel planner without duplicating its state machine.
4. Shared chat components under `components/client/companion/**` may also affect other chat surfaces.

## Source Of Truth

Before changing this route, read:

1. `docs/viza-ai-chat-development-guide.md`
2. `viza-fe/internal-website/app/client/chat/page.tsx`
3. `viza-fe/internal-website/app/client/chat/chat-client.tsx`
4. `viza-fe/internal-website/app/actions/companion-sessions.ts`
5. `viza-be/agent-backend/src/socket/visa-namespace.ts`
6. `viza-be/agent-backend/src/agent/index.ts`
7. `viza-be/agent-backend/src/services/visa-knowledge.service.ts`

If behavior conflicts, prefer the authenticated route and Socket.IO contract documented in the DG.

## Key Files

- `page.tsx`: server route entry; resolves the user, creates/loads the chat session, and passes latest application context.
- `chat-client.tsx`: main client UI; owns tab switching, Socket.IO connection, streaming state, scroll behavior, and embedded Travel AI.
- `components/client/companion/chat-input.tsx`: shared bottom composer used by the VIZA AI chat surface.
- `components/client/companion/chat-message.tsx`: shared message renderer for user and agent bubbles/text.
- `components/client/companion/block-message.tsx`: renders `send_application_block` tool payloads and saves them through `/api/chat/save-block`.

## Guardrails

1. Do not bypass `page.tsx` auth/session setup when adding chat state.
2. Keep the Socket.IO namespace as `/visa` and event names aligned with `types/agent-test.ts`.
3. Do not hardcode AI answers in the frontend; assistant text should come from persisted history or streamed backend output.
4. Keep Travel AI changes inside the Travel module unless the chat tab integration itself changes.
5. Treat `components/client/companion/**` as shared UI. Check other imports before changing props or styles.
6. Preserve queued-message behavior while an assistant response is streaming.
7. Keep inline application blocks type-safe and compatible with `send_application_block`.
8. Avoid new dependencies unless the existing Next.js, Socket.IO, Tailwind, and shadcn/ui stack cannot reasonably cover the change.
9. Whenever you create a new important file for this chat/RAG area, update both `docs/viza-ai-chat-development-guide.md` and this `AGENTS.md` so other agents can find and understand it.
10. After each implementation step touching this chat/RAG area, run the relevant type-check plus a Playwright smoke check before continuing.

## Session Model

`/client/chat` uses `visa_chat_sessions.id` as the Socket.IO `session_id` and as the parent for `visa_chat_messages.session_id`. Treat `user_chat_sessions` as legacy/unused for this route unless a future migration explicitly removes or repurposes it.

## Validation Checklist

For frontend-only changes:

1. `cd viza-fe/internal-website && npm run type-check`
2. Manually verify `/client/chat`:
   - unauthenticated users redirect to login
   - `VIZA AI` tab connects and sends a message
   - streamed tokens become one finalized assistant message
   - the input disables while disconnected
   - `Travel AI` tab still renders the embedded planner

For backend Socket.IO or agent changes:

1. `cd viza-be/agent-backend && npm run type-check`
2. Verify the frontend still connects to `NEXT_PUBLIC_AGENT_BACKEND_URL/visa`.
3. Confirm `token`, `response_complete`, `error`, and `application_block` event payloads still match `viza-fe/internal-website/types/agent-test.ts`.
4. Run a Playwright smoke check against `/client/chat`; if no authenticated test session is available, verify the unauthenticated login redirect and backend `/health`.

## Important Files Added During Iterations

- `docs/viza-ai-chat-development-guide.md`: complete DG for the `/client/chat` page, frontend state, backend Socket.IO flow, and current completion status.
- `viza-be/agent-backend/src/services/visa-knowledge.service.ts`: RAG retrieval helper for `visa_chunks`, including OpenAI embeddings, Supabase RPC vector lookup, filtered fallback, and context formatting.
- `viza-be/agent-backend/drizzle/0012_match_visa_chunks.sql`: Supabase RPC for pgvector similarity search over `visa_chunks`, used by the RAG retrieval service.
- `knowledge-base/indonesia-visa-rag.json`: curated official-source Indonesia visa knowledge chunks for RAG ingestion.
- `viza-be/agent-backend/scripts/ingest-indonesia-visa-rag.ts`: ingestion script that writes the Indonesia visa knowledge source to `visa_documents` and `visa_chunks`.
- `knowledge-base/us-visa-rag.json`: curated official-source U.S. B-1/B-2 visitor visa, DS-160, VWP/ESTA, wait time, and EVUS chunks for RAG ingestion.
- `viza-be/agent-backend/scripts/ingest-us-visa-rag.ts`: ingestion script that writes the U.S. visitor visa knowledge source to `visa_documents` and `visa_chunks`.
