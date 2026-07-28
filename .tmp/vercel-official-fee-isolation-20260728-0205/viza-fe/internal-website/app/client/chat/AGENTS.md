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
- `components/client/companion/block-message.tsx`: renders application redirect CTA payloads. It must not render inline application form fields in VIZA chat.

## Guardrails

1. Do not bypass `page.tsx` auth/session setup when adding chat state.
2. Keep the Socket.IO namespace as `/visa` and event names aligned with `types/agent-test.ts`.
3. Do not hardcode AI answers in the frontend; assistant text should come from persisted history or streamed backend output.
4. Keep Travel AI changes inside the Travel module unless the chat tab integration itself changes.
5. Keep `/client/chat` on the light visual palette. Do not move the `VIZA AI / Travel AI` tab controls when changing the process/session panel.
6. The VIZA process/session panel defaults to collapsed. On desktop, opening it should render a floating left panel that does not move the centered AI output or the `VIZA AI / Travel AI` tab controls; on mobile, it opens as a drawer.
7. Treat `components/client/companion/**` as shared UI. Check other imports before changing props or styles.
8. Preserve queued-message behavior while an assistant response is streaming.
9. Keep application redirect blocks type-safe. VIZA chat should redirect to `/client/application` for form filling instead of collecting fields inline.
10. Avoid new dependencies unless the existing Next.js, Socket.IO, Tailwind, and shadcn/ui stack cannot reasonably cover the change.
11. Whenever you create a new important file for this chat/RAG area, update both `docs/viza-ai-chat-development-guide.md` and this `AGENTS.md` so other agents can find and understand it.
12. After each implementation step touching this chat/RAG area, run the relevant type-check plus a Playwright smoke check before continuing.
13. Do not disable the VIZA chat input merely because Socket.IO is `connecting`, `disconnected`, or `error`; `handleSendMessage()` intentionally queues messages until the socket reconnects. Disable the input only for local UI states such as loading a different session.
14. Keep process management visible and simple: one labeled `New chat` entry in the process panel, plus per-session rename and delete controls. Do not add duplicate unlabeled plus buttons.
15. Session titles are currently persisted as hidden `visa_chat_messages` records with `role='system'` and content prefix `__viza_session_title__:`. Filter these markers out of user-visible history, search/recent history, and LLM chat context.
16. Preserve conversation context for compact follow-ups. `visa_chat_message` should include recent visible user/assistant history from the frontend, and the backend should use that client history when database history is missing or shorter. Short replies like `中国护照，中国，7天，法国，意大利` or `2，5` must be interpreted against the previous assistant question instead of treated as standalone prompts.
17. VIZA AI user-facing answers must be plain text by default. Keep the no-Markdown rule in `BASE_SYSTEM_PROMPT`, the robustness harness, and `ChatMessage`; do not add Markdown headings, tables, bold markers, bullet markers, code fences, raw JSON, or raw XML unless the user explicitly asks. `ChatMessage` should render common Markdown markers as plain text for VIZA answers.
18. Do not collect application form fields inside VIZA chat. When the user wants to apply, VIZA should provide a rough overview of route, requirements, timing/fees caveats, then show an application redirect CTA. Detailed field collection belongs in `/client/application`.
19. Keep VIZA process switching durable. The active process is stored in `sessionStorage["viza_chat_session_id"]`; switching must call `getSessionMessages(sessionId, userId)`, queued offline messages must carry their target `sessionId`, and rename must expose an obvious Save / Cancel action before reporting the feature complete. User and assistant messages must be persisted through `ensureSessionMessage()` as a Supabase-side fallback, because Socket.IO responses can succeed even when agent-backend DB persistence is unavailable. Persisted `role='block'` rows must be loaded from `block_data` and rendered with `BlockMessage`; never degrade application redirect CTAs into plain assistant text.
20. VIZA AI's main response language must follow the selected interface locale from the language selector, not the user's latest message language. `chat-client.tsx` sends `locale` on `visa_chat_message`; keep that contract aligned with `viza-be/agent-backend/src/socket/visa-namespace.ts` and `viza-be/agent-backend/src/agent/index.ts`.
21. Mixed Schengen + non-Schengen itineraries must preserve separate routes. For example, France + Iceland + UK should choose the correct Schengen main destination from Schengen day counts while still reminding the user that the UK needs a separate visitor visa/application link.

## Session Model

`/client/chat` uses `visa_chat_sessions.id` as the Socket.IO `session_id` and as the parent for `visa_chat_messages.session_id`. One applicant may have multiple VIZA conversation processes. The page loads recent non-empty sessions with `getUserSessions()`, switches messages with `getSessionMessages()`, and creates a new `visa_chat_sessions` row with `createSession()` when the user sends the first message in a new chat. Treat `user_chat_sessions` as legacy/unused for this route unless a future migration explicitly removes or repurposes it.

New empty VIZA chats render a localized assistant greeting from `messages/*/chat.newChatGreeting`. This is display-only and must not be written to `visa_chat_messages`; the first persisted message should still be the user's first real prompt.

Session rename uses hidden system marker rows instead of a `visa_chat_sessions.title` column. `getUserSessions()` turns the latest marker into `Session.title`; `getSessionMessages()` and history helpers must keep those markers hidden.

## Validation Checklist

For frontend-only changes:

1. `cd viza-fe/internal-website && npm run type-check`
2. If message rendering changes, run `npm run test -- components/client/companion/__tests__/chat-message.test.tsx --run`
3. Manually verify `/client/chat`:
   - unauthenticated users redirect to login
   - `VIZA AI` tab connects and sends a message
   - streamed tokens become one finalized assistant message
   - the VIZA session panel can start a new chat and switch back to an older chat
   - the last selected VIZA process survives a page refresh
   - process rename persists after Save and exits cleanly on Cancel
   - the input remains editable while disconnected and queues messages for reconnect
   - `Travel AI` tab still renders the embedded planner

For backend Socket.IO or agent changes:

1. `cd viza-be/agent-backend && npm run type-check`
2. Verify the frontend still connects to `NEXT_PUBLIC_AGENT_BACKEND_URL/visa`.
3. Confirm `token`, `response_complete`, `error`, and `application_block` event payloads still match `viza-fe/internal-website/types/agent-test.ts`.
4. Confirm locale-driven responses: when UI locale is Chinese and the user sends English text, the Socket payload includes `locale: "zh"` and the backend prompt requires Simplified Chinese.
5. Confirm mixed itinerary handoff: France 4 days + Iceland 5 days + UK 6 days should produce Iceland Schengen as the Schengen form route and keep the UK separate route visible.
6. Run a Playwright smoke check against `/client/chat`; if no authenticated test session is available, verify the unauthenticated login redirect and backend `/health`.

## Current RAG Routing Scope

The `/visa` namespace routes RAG only for destinations that are covered by the application form/product surface. Schengen coverage follows the EU Schengen short-stay form and includes Austria, Belgium, Bulgaria, Croatia, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Iceland, Italy, Latvia, Liechtenstein, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Romania, Slovakia, Slovenia, Spain, Sweden, and Switzerland. Non-Schengen service coverage includes Australia, Cambodia, Canada, Egypt, Hong Kong, India, Indonesia, Japan, Laos, Macau, Malaysia, Maldives, New Zealand, Philippines, Russia, Singapore, South Africa, South Korea, Sri Lanka, Thailand, Turkey, UAE, UK, US, and Vietnam. If a user asks about a recognized destination outside this service set, the assistant should say VIZA has not opened service for that country/region yet instead of providing detailed RAG guidance or a form link. Do not reintroduce a default-to-Indonesia fallback. If a user mentions multiple supported countries, or asks a generic Schengen question, let retrieval search across the relevant Schengen knowledge instead of using a stale application country unless that context is itself a supported Schengen country.

RAG routing now uses structured conversation state first, then the latest user message plus recent user-only chat context. This is intentional: a compact follow-up like "中国，新加坡，不知道，会去别的国家" may be answering the previous numbered questions, so retrieval must still remember the earlier main destination (for example Switzerland) while treating "Singapore" as residence/apply-from, not as a destination. Application `visa_type` fallback is only valid when compatible with the resolved country.

Compact answer repair runs after history is assembled and before `buildSystemPrompt()`. Keep `buildCompactAnswerInterpretation()` in the backend when changing prompt flow: it maps numbered answers and numeric day splits back to the last assistant question, so a user can answer `2，5` after a France/Italy day-split question without the assistant resetting the intake.

Session-level state is persisted as hidden `visa_chat_messages` rows with `role='system'` and content prefix `__viza_conversation_state__:`. Filter these markers out anywhere user-visible or LLM-visible. The state owns route slots such as destination countries, main destination, nationality, residence/apply-from, purpose, stay length, Schengen day split, first entry country, recommended visa type, missing slots, and confidence.

## Important Files Added During Iterations

- `docs/viza-ai-chat-development-guide.md`: complete DG for the `/client/chat` page, frontend state, backend Socket.IO flow, and current completion status.
- `viza-be/agent-backend/src/services/visa-knowledge.service.ts`: RAG retrieval helper for `visa_chunks`, including OpenAI embeddings, Supabase RPC vector lookup, filtered fallback, and context formatting.
- `viza-be/agent-backend/src/config/visa-destination-registry.ts`: 56-country product registry for aliases, Schengen membership, default visitor visa types, RAG document types, and form-intake schema keys.
- `viza-be/agent-backend/src/services/visa-conversation-state.service.ts`: structured state extraction/merge/persistence for VIZA sessions.
- `viza-be/agent-backend/drizzle/0012_match_visa_chunks.sql`: Supabase RPC for pgvector similarity search over `visa_chunks`, used by the RAG retrieval service.
- `knowledge-base/visa-rag-seeds/countries/*.json`: independent country-level RAG seeds. Each file owns one country's visitor/tourism visa knowledge and should evolve with that country's future form-filling workflow.
- `knowledge-base/visa-rag-seeds/README.md`: source-of-truth rules for country seed structure and ingestion commands.
- `viza-be/agent-backend/scripts/ingest-country-visa-rag.ts`: generic ingestion script that writes one or more country seeds to `visa_documents` and `visa_chunks`; run all countries with `npm run ingest:all-visa-rag` or one country with `npm run ingest:country-visa-rag -- --country japan`.
- `viza-be/agent-backend/scripts/run-visa-agent-evals.ts`: deterministic robustness harness. Run with `npm run test:visa-agent-evals` or `npm run test:visa-agent-robustness` after routing, prompt, state, or RAG changes. Current suite covers 60 prompt evals plus 38 branch assertions for intent, RAG document type mapping, country routing, visa type fallback, state merge, compact interpretation, plain-text output guardrails, and no-inline-form prompt guardrails.

- Taiwan is supported only for `TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT`: mainland Chinese passport holders resident in Singapore applying for tourism. Chat must state this scope and redirect to `/client/application?country=taiwan&visaType=TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT`, never collect its fields inline.

Each country seed should have exactly one `documentType="form_requirements"` document. These chunks are the RAG bridge for industrial form-filling agents: official application channel, fields to collect before filling, supporting document uploads, and review/submission guardrails.

Application blocks in VIZA chat should use `blockType="application_redirect"` and a `redirectUrl` to `/client/application?country=...&visaType=...`. Legacy `trip_basics`, `traveller_identity`, and `visa_route_specific` payloads may still exist in old histories, but `BlockMessage` should render them as redirect CTAs rather than inline forms.

The application page supports multiple concurrent application progresses. When a redirect includes `country` and `visaType`, `/client/application` must load or create the matching `applications` row by `applicant_id + country + visa_type`; do not fall back to the latest application or a single active package for that redirected flow.
