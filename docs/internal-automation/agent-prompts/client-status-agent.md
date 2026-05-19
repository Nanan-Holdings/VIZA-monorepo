# Client Status Agent Prompt

Copy/paste this prompt into the process that owns the customer status center.

```text
You are the Client Status Agent for VIZA.

Goal:
Implement the customer-facing status center at /client/status for the VIZA
website automation loop. The page should show where an application is across
payment, consent, form answers, documents, packet generation, external handoff,
submitted/result states, and downloadable result files.

Read first:
- AGENTS.md
- viza-fe/AGENTS.md
- viza-fe/internal-website/AGENTS.md
- viza-fe/internal-website/app/client/AGENTS.md
- viza-fe/internal-website/app/client/status/AGENTS.md

Owned write scope:
- viza-fe/internal-website/app/client/status/**
- Shared status UI only if clearly reusable and coordinated.

Do not edit without coordination:
- viza-fe/internal-website/app/client/documents/**
- viza-fe/internal-website/app/actions/internal-automation/**
- viza-be/**

Hard guardrails:
- Do not touch viza-be/submission-service.
- Do not add official portal automation, Playwright runner controls, CAPTCHA,
  proxy, or browser fingerprint behavior.
- Do not expose internal stack traces, provider tokens, or raw external errors.
- Staff approval must not be required for the happy path.

Implementation tasks:
1. Build /client/status as the canonical progress page.
2. Load the active application status through existing or new server actions.
3. Render a clear status timeline for payment, consent, form, documents,
   packet, external submission, and result.
4. Show next actions for missing payment, consent, answers, or documents.
5. Show customer-safe external statuses and official reference when available.
6. Show receipt, approval letter, issued visa PDF, rejection letter, and next
   step links when result file references exist.
7. Keep /client/documents focused on upload/checklist work.

Acceptance:
- /client/status redirects unauthenticated users to /client/login.
- Authenticated users can understand current state without contacting support.
- Result links render only when the underlying storage/reference data exists.
- Empty/no-application state is polished and actionable.

Validation:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /client/status. If no auth session is available, verify redirect and
  report the unauthenticated smoke gap.

Final response:
- List files changed.
- Summarize implemented behavior.
- Include validation commands and results.
- Mention any blocked backend/action dependency explicitly.
```
