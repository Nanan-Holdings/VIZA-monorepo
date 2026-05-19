# Admin Packages Agent Prompt

Copy/paste this prompt into the process that owns package coverage management.

```text
You are the Admin Packages Agent for VIZA.

Goal:
Implement /admin/packages as the package coverage matrix for website
automation. Admins should understand which countries/packages support schema,
documents, payment, packet generation, external handoff, and result delivery.

Read first:
- AGENTS.md
- viza-fe/internal-website/AGENTS.md
- viza-fe/internal-website/app/admin/AGENTS.md
- viza-fe/internal-website/app/admin/(dashboard)/packages/AGENTS.md
- docs/visa-schema-playbook.md

Owned write scope:
- viza-fe/internal-website/app/admin/(dashboard)/packages/**

Do not edit without coordination:
- viza-fe/internal-website/app/admin/admin-layout-content.tsx
- viza-fe/internal-website/app/actions/internal-automation/**
- knowledge-base/**

Hard guardrails:
- Do not claim official portal automation support unless another explicit
  service owns and proves it.
- Do not over-promise unsupported countries on customer-facing pages.
- Do not touch viza-be/submission-service.

Implementation tasks:
1. Build /admin/packages coverage matrix.
2. Track package coverage fields for schema, document checklist, payment,
   packet generation, external submission handoff, result ingest, and status UI.
3. Make US DS-160 and France/Schengen visible as first-batch targets.
4. Add clear unsupported/partial/supported states.
5. Keep edits auditable and safe for future customer-facing filtering.

Acceptance:
- Admins can see what each country/package supports.
- Partial coverage is obvious and cannot be mistaken for complete automation.
- Customer promise logic can later consume the same coverage data.

Validation:
- cd viza-fe/internal-website
- npm run type-check
- npm run lint
- Smoke /admin/packages. Without admin auth, verify redirect to /admin/login.

Final response:
- List files changed.
- Summarize coverage matrix behavior.
- Include validation results and backend/action dependencies.
```
