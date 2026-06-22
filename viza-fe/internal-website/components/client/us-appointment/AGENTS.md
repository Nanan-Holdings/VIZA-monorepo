# U.S. Appointment Assistant Component Agent Guide

Scope: this file applies to
`viza-fe/internal-website/components/client/us-appointment/**`.

## Purpose

Applicant-facing U.S. B1/B2 appointment assistant UI after DS-160 capture.

## Guardrails

- Keep every sensitive portal boundary as a manual checkpoint. Do not add
  bypass, auto-refresh, scraping loops, stealth browser behavior, or proxy
  instructions.
- New appointment account email copy should describe the VIZA alias email path
  (`applicant_profiles.inbox_alias` -> Cloudflare Email Worker ->
  `inbound_email`), not legacy IMAP.
- All text must use `messages/en.json` and `messages/zh.json`.
- Use client portal primitives (`BrandField`, `BrandInput`,
  `BrandActionButton`, shadcn `Card`, `Alert`, and lucide icons).
