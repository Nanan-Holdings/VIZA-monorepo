# VIZA subprocessor list

> **STATUS: draft — pending counsel review.** Reflects the platform's
> actual code as of the most recent commit. Update with every
> subprocessor change; the Privacy Policy and DPA reference this list
> as the source of truth.

**Last updated:** 2026-05-07.

## Active subprocessors

| Vendor | Service used | Categories of PII processed | Region(s) | DPA / SCC reference |
|---|---|---|---|---|
| Supabase | Postgres database, Auth, Storage | All applicant PII at rest | Asia-Pacific (Singapore) primary | Supabase DPA + SCC Module 2 |
| Cloudflare | Email Routing, R2 (inbound .eml storage), Workers, DNS, CDN | Inbound mail bodies, alias map, request IPs (transient) | Global edge | Cloudflare DPA + SCC Module 2 |
| Stripe | Card processing, Stripe Checkout | Payment metadata (charge id, card last-4, customer id) | US + EU | Stripe DPA |
| Anthropic | Claude API for the AI Companion | Form answers + chat transcripts (no passport scans, no photos) | US | Anthropic Commercial Terms + DPA |
| 2captcha | Image-CAPTCHA solving on government portals | CAPTCHA images only (no applicant PII rendered into them) | EU / global | 2captcha terms (limited DPA — counsel TODO) |
| Resend | Outbound transactional email (failure alerts to ops, account notifications to applicants) | Email address + message body | EU + US | Resend DPA |

## Government portals (data recipients, not subprocessors)

By the nature of the service, the destination country's government
visa portal is a recipient — not a processor — of applicant data.
Submission to a government portal is performed only after the
per-application authorisation in LEGAL-002 is recorded. Current
portals integrated:

- US Department of State (CEAC DS-160)
- UK Visas & Immigration (`apply-uk-visa.service.gov.uk`)
- France-Visas (`france-visas.gouv.fr`)
- VFS Global (multiple corridors: ZA, IT, IN, ...)
- Vietnam Immigration (`evisa.xuatnhapcanh.gov.vn`)
- Egypt e-Visa (`visa2egypt.gov.eg`)
- Plus the per-country portals enumerated in `viza-be/agent-backend/drizzle/00xx_*_package.sql`.

The full live list at any time can be queried from `visa_packages`.

## Adding a subprocessor

Process when adding a new vendor that processes Customer PII:

1. Open a tracking PR that updates this file.
2. If the vendor is added under an active B2B engagement, give 30
   days' notice per DPA §7 before the subprocessor goes live.
3. Confirm a DPA / SCC is signed and filed in the legal Drive folder
   before merging.
4. Update Privacy Policy §5 if the vendor changes the user-facing
   summary.

## Removed subprocessors

_None recorded yet._
