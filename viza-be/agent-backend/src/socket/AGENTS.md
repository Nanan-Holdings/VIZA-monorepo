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
- `viza-fe/internal-website/app/client/chat/AGENTS.md`
- `viza-fe/internal-website/types/agent-test.ts`
