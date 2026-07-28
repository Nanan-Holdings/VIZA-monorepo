# Client Support Center Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/support/**`.

## Purpose

This module owns the applicant-facing customer support center. It is separate
from `/client/chat`, which remains the VIZA AI visa/travel assistant surface.

## Key Responsibilities

- Route `/client/support` to a help-center style support bot.
- Route `/client/support/requests` to the applicant's support request history
  instead of expanding that history inline on the help center.
- Let applicants pick common support topics such as refunds, billing,
  application status, documents/OCR, account access, or human support.
- Provide safe self-service links into `/client/status`, `/client/documents`,
  `/client/billing`, and `/client/settings`.
- Provide a human-support handoff option and support email when self-service is
  not enough.

## Guardrails

- Do not collect detailed visa application answers here. Send applicants to
  `/client/application` for application form fields.
- Do not merge this route back into `/client/chat`; support is customer service,
  not the visa AI assistant.
- Do not expose internal staff notes, provider errors, secrets, or external
  automation details.
- Keep all visible copy in `messages/en.json` and `messages/zh.json`.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/client/support`. Without an authenticated session, verify the normal
client-session redirect or loading path.
