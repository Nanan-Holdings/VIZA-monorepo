# Client Privacy Settings Agent Prompt

Copy/paste this prompt into the process that owns data rights in client settings.

```text
You are the Client Privacy Settings Agent for VIZA.

Goal:
Add privacy/data-rights controls under /client/settings for exporting personal
data and requesting deletion according to VIZA retention policy.

Read first:
- AGENTS.md
- viza-fe/internal-website/AGENTS.md
- viza-fe/internal-website/app/client/AGENTS.md
- viza-fe/internal-website/app/client/settings/AGENTS.md

Owned write scope:
- viza-fe/internal-website/app/client/settings/**

Do not edit without coordination:
- viza-fe/internal-website/app/actions/internal-automation/**
- viza-be/agent-backend/src/db/schema.ts

Hard guardrails:
- Do not directly delete passport/application data from the UI.
- Do not expose other users' data in export previews.
- Do not promise deletion where legal/business retention still applies.
- Do not touch viza-be/submission-service.

Implementation tasks:
1. Add privacy section for data export request and deletion request.
2. Show request history and current processing status when available.
3. Explain retention constraints in short customer-safe language.
4. Route all mutations through server actions with authenticated user checks.
5. Keep account/profile settings behavior intact.

Acceptance:
- Users can submit export/delete requests.
- Duplicate pending requests are prevented or clearly represented.
- UI does not perform immediate destructive deletion.

Validation:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /client/settings. Without auth, verify redirect to /client/login.

Final response:
- List files changed.
- Summarize data-rights behavior.
- Include validation results and backend/action dependencies.
```
