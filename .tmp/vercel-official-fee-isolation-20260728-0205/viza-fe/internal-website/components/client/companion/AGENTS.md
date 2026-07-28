# Companion Chat Components Agent Guide

Scope: this file applies to `viza-fe/internal-website/components/client/companion/**`.

## Purpose

This module contains shared chat UI used by VIZA AI and related client chat
surfaces: input composer, message rendering, session/history sidebars,
connection state, block rendering, and scroll controls.

## Key Flows

- `chat-input.tsx`: composer and send interaction.
- `chat-message.tsx`: user/assistant message rendering and plain-text handling.
- `block-message.tsx`: application redirect/action payload rendering.
- `session-sidebar.tsx` and `continuous-sidebar.tsx`: chat/session navigation.
- `connection-status.tsx`: socket status display.
- `thinking-indicator.tsx`, `scroll-to-bottom-fab.tsx`, date/history boundary
  components: conversation affordances.

## Ownership Boundaries

- Treat these as shared components. Check imports before changing props.
- Do not add visa routing, RAG, or session persistence logic here; those belong
  in `app/client/chat/chat-client.tsx`, server actions, or backend code.
- VIZA AI assistant content should render as plain text by default. Do not add
  Markdown rendering for normal assistant responses.
- Application blocks should guide users to `/client/application` instead of
  collecting form fields inline.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run test -- components/client/companion/__tests__ --run
```

Smoke `/client/chat` after visual or interaction changes.

## Related Files

- `viza-fe/internal-website/app/client/chat/AGENTS.md`
- `viza-fe/internal-website/app/client/chat/chat-client.tsx`
- `viza-fe/internal-website/app/actions/companion-sessions.ts`
- `viza-fe/internal-website/types/agent-test.ts`
- `viza-be/agent-backend/src/socket/visa-namespace.ts`
