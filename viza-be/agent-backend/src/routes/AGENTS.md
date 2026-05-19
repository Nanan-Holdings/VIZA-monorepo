# Agent Backend Routes Guide

Scope: this file applies to `viza-be/agent-backend/src/routes/**`.

## Purpose

Routes expose REST APIs consumed by the frontend, cron jobs, Telegram webhooks,
and internal admin flows.

## Key Routes

- `field-guidance.routes.ts`: `POST /api/field-guidance`.
- `validate-application.ts`: `POST /api/validate-application`.
- `translation.routes.ts`: translation generation/read/update under
  `/api/applications/:id/...`.
- `application-answers.routes.ts`: application answer persistence helpers.
- `profile-prefill.routes.ts`: profile prefill APIs.
- `user-packages.routes.ts`: package/destination APIs.
- `chat-save-block.routes.ts`: chat block persistence.
- `admin-reminders.routes.ts`: admin reminder APIs.
- `cron.routes.ts`: cron/status endpoints where mounted.
- `telegram-webhook.ts`: Telegram approval webhook.

## Ownership Boundaries

- Validate request bodies with TypeScript narrowing or schema validation before
  using values.
- Keep route responses typed and JSON-friendly.
- Use shared services for RAG/conversation logic instead of duplicating in
  routes.
- Keep Socket.IO event handling in `src/socket/**`, not REST routes.
- Do not log PII or secrets.

## Validation

Run from `viza-be/agent-backend`:

```powershell
npm run type-check
npm run lint
```

For field guidance changes:

```powershell
npm run test:field-guidance-copilot
```

Smoke the changed endpoint with a small request or through the frontend route
that consumes it.

## Related Files

- `viza-be/agent-backend/src/app.ts`
- `viza-be/agent-backend/src/services/*`
- `viza-be/agent-backend/src/db/supabase-client.ts`
- `viza-be/agent-backend/src/utils/logger.ts`
- `viza-fe/internal-website/components/field-guidance-panel.tsx`
- `viza-fe/internal-website/components/application-steps/dynamic-review-step.tsx`
