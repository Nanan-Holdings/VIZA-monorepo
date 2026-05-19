# Internal Automation Agent Prompt Index

Use these prompt pages when assigning separate Codex processes to VIZA website
automation modules. Each prompt is designed to keep write ownership clear, make
the agent read the nearest `AGENTS.md`, and prevent accidental work on official
portal runners.

For manual distribution, use `COPY_PASTE_PROMPTS.md`. It has one labeled
copy/paste block per agent.

## Universal Assignment Rule

Before sending any prompt, add the exact branch/process name and any local
priority you want. Keep each process to its owned paths unless two agents agree
on a handoff.

All agents must preserve this scope:

- Build only the VIZA website automation loop: payment, consent, forms,
  documents, OCR, packet generation, status, notifications, monitoring, and
  external status ingest.
- Do not touch `viza-be/submission-service`.
- Do not add Playwright official submission runners, CAPTCHA solving, proxy
  rotation, browser fingerprinting, or runner artifacts.
- Do not make staff approval a happy-path requirement. Staff monitors and
  supports.

## Prompt Pages

| Agent | Prompt Page | Primary Write Scope |
| --- | --- | --- |
| All Agents Distribution Sheet | `COPY_PASTE_PROMPTS.md` | One labeled copy/paste block per agent |
| Client Status Agent | `client-status-agent.md` | `viza-fe/internal-website/app/client/status/**` |
| Client Documents Agent | `client-documents-agent.md` | `viza-fe/internal-website/app/client/documents/**` |
| Client Checkout Agent | `client-checkout-agent.md` | `viza-fe/internal-website/app/client/checkout/**` |
| Client Billing Agent | `client-billing-agent.md` | `viza-fe/internal-website/app/client/billing/**` |
| Client Consent Agent | `client-consent-agent.md` | `viza-fe/internal-website/app/client/consent/**` |
| Client Privacy Settings Agent | `client-privacy-settings-agent.md` | `viza-fe/internal-website/app/client/settings/**` |
| Admin Applications Agent | `admin-applications-agent.md` | `viza-fe/internal-website/app/admin/(dashboard)/applications/**` |
| Admin Packages Agent | `admin-packages-agent.md` | `viza-fe/internal-website/app/admin/(dashboard)/packages/**` |
| Admin Billing Agent | `admin-billing-agent.md` | `viza-fe/internal-website/app/admin/(dashboard)/billing/**` |
| Internal Automation Actions Agent | `internal-automation-actions-agent.md` | `viza-fe/internal-website/app/actions/internal-automation/**` |
| Stripe API Agent | `stripe-api-agent.md` | `viza-fe/internal-website/app/api/stripe/**` |
| External Submission API Agent | `external-submission-api-agent.md` | `viza-fe/internal-website/app/api/external-submission/**` |
| Passport OCR API Agent | `passport-ocr-api-agent.md` | `viza-fe/internal-website/app/api/passport-ocr/**` |
| Backend Internal Routes Agent | `backend-internal-routes-agent.md` | `viza-be/agent-backend/src/routes/internal-automation/**` |
| Backend Internal Services Agent | `backend-internal-services-agent.md` | `viza-be/agent-backend/src/services/internal-automation/**` |
| Backend DB Agent | `backend-db-agent.md` | `viza-be/agent-backend/drizzle/**`, `viza-be/agent-backend/src/db/schema.ts` |

## Suggested Parallel Batches

Batch 1 foundation:

- Backend DB Agent
- Backend Internal Services Agent
- Internal Automation Actions Agent
- Stripe API Agent
- Passport OCR API Agent

Batch 2 customer surfaces:

- Client Checkout Agent
- Client Consent Agent
- Client Documents Agent
- Client Status Agent
- Client Billing Agent

Batch 3 operations and integrations:

- Admin Applications Agent
- Admin Packages Agent
- Admin Billing Agent
- External Submission API Agent
- Backend Internal Routes Agent
- Client Privacy Settings Agent
