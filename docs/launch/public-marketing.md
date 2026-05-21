# Public marketing launch: pricing page + signup live

> Last reviewed: 2026-05-08.

Opens public signup with pricing, marketing site, and SLA promises after at least one MVP gate is closed.

## Pre-requisites

- [x] At least one MVP gate (LAUNCH-001..005) all-green.
- [x] Pricing page renders package list with real numbers + SLAs (`viza-fe/internal-website/app/(marketing)/pricing/page.tsx`).
- [x] Signup flow gated on LEGAL-002 consent capture.
- [x] Customer-support inbox staffed with documented response targets (CS-001 SLA: first-response < 4 h business hours).
- [x] Marketing copy reviewed for compliance with consumer-protection rules in launch jurisdictions (US, FR, AU, VN, UK).

## Day-of-launch checklist

- [ ] DNS `haggstorm.com` cutover from holding page to marketing site.
- [ ] `/api/health` returns 200 from prod cluster.
- [ ] Stripe live-mode webhook signature secret rotated to fresh key.
- [ ] Sentry / log-drain releases tagged `v1.0.0`.
- [ ] Status page (`status.haggstorm.com`) seeded with all canary checks.
- [ ] Consumer-protection disclosures footer rendered on pricing page (refund policy, processing time disclaimers).
- [ ] Public RSS / atom for company blog (SEO bootstrap).

## Post-launch monitoring

- **First 24 h**: 1-min Sentry retention + on-call paging on `error_rate > 1%`.
- **First 7 days**: daily KPI digest to founders (signups, paid conversions, avg time-to-submit, support volume).
- **First 30 days**: weekly cohort retention + NPS survey on delivered applications.

## Linked from

- [docs/launch/](.) — sibling launch gates.
- [docs/operations/](../operations/) — on-call + alerting docs.
