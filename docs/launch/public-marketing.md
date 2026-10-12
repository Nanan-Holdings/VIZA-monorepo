# Public marketing launch: pricing page + signup live

> Last reviewed: 2026-09-09.

Opens public signup with pricing, marketing site, and SLA promises after at least one MVP gate is closed.

## Pre-requisites

- [ ] At least one MVP gate (LAUNCH-001..005) is revalidated all-green against
  current production evidence; historical checkmarks are not sufficient.
- [ ] Pricing page renders counsel/ops-approved package numbers and SLAs
  (`viza-fe/internal-website/app/pricing/page.tsx`). Current values are seeded
  estimates/placeholders.
- [ ] Signup and checkout consent surfaces are approved together with the
  Terms, Privacy, Cookies, Subprocessors, and Refund Policy versions recorded
  in `docs/legal/review-log.md`.
- [x] Customer-support inbox staffed with documented response targets (CS-001 SLA: first-response < 4 h business hours).
- [ ] Marketing copy and pricing claims are reviewed for consumer-protection
  compliance in each launch jurisdiction (US, FR, AU, VN, UK).

## Day-of-launch checklist

- [ ] DNS `viza.it.com` points to the production `marketing-website` Vercel
  project and `app.viza.it.com` points to `internal-website`.
- [ ] The canonical agent-backend production origin returns dependency-ready
  HTTP 200 from `/ready` (not the marketing/portal domains).
- [ ] Stripe live-mode webhook signature secret rotated to fresh key.
- [ ] Sentry / log-drain releases tagged `v1.0.0`.
- [ ] Status page (`https://viza.it.com/status`) shows fresh, evidence-backed
  observations for every published product and core VIZA service.
- [ ] Consumer-protection disclosures footer rendered on pricing page (refund policy, processing time disclaimers).
- [ ] Public RSS / atom for company blog (SEO bootstrap).

## Post-launch monitoring

- **First 24 h**: 1-min Sentry retention + on-call paging on `error_rate > 1%`.
- **First 7 days**: daily KPI digest to founders (signups, paid conversions, avg time-to-submit, support volume).
- **First 30 days**: weekly cohort retention + NPS survey on delivered applications.

## Linked from

- [docs/launch/](.) — sibling launch gates.
- [docs/operations/](../operations/) — on-call + alerting docs.
