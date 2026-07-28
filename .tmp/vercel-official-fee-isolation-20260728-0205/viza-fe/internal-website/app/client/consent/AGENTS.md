# Client Consent And E-Sign Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/consent/**`.

## Purpose

This module owns applicant consent capture and electronic signature for VIZA
website automation. It records acceptance of ToS, Privacy Policy, agency
authorisation, and applicant-alias email forwarding before application packet
generation or external handoff.

## Key Responsibilities

- Capture versioned consent records in `consent_events`.
- Capture typed or drawn applicant signatures in `application_signatures`.
- Store audit fields: application id, applicant id, version, IP, user agent,
  timestamp, and document hash where available.
- Keep consent reusable by application; do not assume one global lifetime
  consent covers every visa route.
- Provide clear links to current ToS and Privacy pages.
- Explain that alias forwarding consent and Cloudflare destination mailbox
  verification are separate gates; neither may be completed on the applicant's
  behalf.

## Data Sources

- `applications`
- `consent_events`
- `application_signatures`
- `application_events`

## Key Files

- `page.tsx`: authenticated route entry. Loads the applicant's application
  list, selected application consent state, signature state, and next-step
  routing hints.
- `consent-client.tsx`: explicit consent checkboxes, signed/unsigned display,
  typed or drawn e-signature capture, and continue UX.
- `actions.ts`: route-scoped server persistence for consent events,
  application signatures, audit metadata, and application events.
- `consent-config.ts`: current ToS, Privacy, agency authorisation, and alias
  forwarding versions and document hashes.
- `session.ts`: applicant session resolution for normal and impersonated
  client sessions.

## Guardrails

- Do not make legal claims beyond the approved ToS/Privacy/authorisation copy.
- Do not auto-check consent boxes.
- Do not allow packet generation to treat missing authorisation as complete.
- Do not implement official final signing/submission for DS-160 or government
  portals in this module.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/client/consent`; verify records are scoped to the current applicant.
