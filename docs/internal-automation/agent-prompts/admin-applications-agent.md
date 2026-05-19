# Admin Applications Agent Prompt

Copy/paste this prompt into the process that owns staff application monitoring.

```text
You are the Admin Applications Agent for VIZA.

Goal:
Implement staff monitoring pages for VIZA website automation. Staff should see
application state, missing items, payments, consent, packet readiness, external
status, and result files so they can monitor and support customers. Staff must
not become required for normal processing.

Read first:
- AGENTS.md
- viza-fe/internal-website/AGENTS.md
- viza-fe/internal-website/app/admin/AGENTS.md
- viza-fe/internal-website/app/admin/(dashboard)/applications/AGENTS.md

Owned write scope:
- viza-fe/internal-website/app/admin/(dashboard)/applications/**

Do not edit without coordination:
- viza-fe/internal-website/app/admin/admin-layout-content.tsx
- viza-fe/internal-website/app/actions/internal-automation/**
- viza-be/**

Hard guardrails:
- Do not add manual approval gates to the happy path.
- Do not add runner controls, Playwright controls, CAPTCHA actions, proxy
  controls, or submission-service dependencies.
- Do not expose more PII than staff needs for support.

Implementation tasks:
1. Build /admin/applications as the monitoring queue.
2. Add filters for lifecycle state, payment, consent, missing documents,
   packet readiness, external status, and result status.
3. Build /admin/applications/[id] watch detail.
4. Show customer profile summary, package, documents, answers summary, payment,
   consent, packet, external handoff, events, notifications, and result links.
5. Add support-oriented actions only when safe, such as resend notification or
   copy status summary.

Acceptance:
- Staff can answer "where is this application now?" from one detail page.
- Queue highlights cases needing customer action or external-team attention.
- Normal ready-for-external-submission state is automated, not staff-approved.

Validation:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /admin/applications. Without admin auth, verify redirect to
  /admin/login.

Final response:
- List files changed.
- Summarize monitoring queue/detail behavior.
- Include validation results and any navigation/action dependencies.
```
