# Client Arrival Cards Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/arrival-cards/**`.

## Purpose

Arrival-card routes are authenticated client preview/entry points for
country-specific digital arrival-card preparation flows. They should open the
matching DB-driven `/client/application/long-form` package without changing the
main destination catalog until the country workflow has been reviewed.

## Guardrails

- Arrival cards are not visas. User-facing copy and linked routes must keep the
  arrival-card package separate from eVisa, visit visa, and pass workflows.
- Do not add official-site automation, CAPTCHA handling, payment, or final
  official submission directly from these routes. If a country later gets an
  official runner, keep it in `viza-be/submission-service` and have the form
  package call it through the submission queue/API.
- Preserve the application form's bilingual dynamic-form contract by routing to
  a dedicated `visa_form_fields` package.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke the changed arrival-card route. If no authenticated session is available,
verify the unauthenticated redirect and report the gap.
