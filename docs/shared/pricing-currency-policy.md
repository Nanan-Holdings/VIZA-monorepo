# Pricing & Currency Display Policy

Artifact for **MKT-006**. How pricing flows from the portal source of truth to
the marketing site, and how currencies are displayed.

## Source of truth

`viza-fe/internal-website/lib/pricing.ts` (`PACKAGE_PRICING`) is canonical. It
stores, per `(country, visaType)`:
- `agencyFeeCents` — VIZA agency fee, **USD** minor units (flat USD 99 today).
- `govtFeeCents` — pass-through government fee, in the **portal's collection
  currency** (`currency`: USD/GBP/AUD/CAD/…).
- `govtFeeChannel` — `viza_passthrough` (VIZA collects via Stripe) or
  `portal_direct` (legacy migration value; applicant-facing flows must still
  move to VIZA-managed virtual-card payment).

## Marketing mirror

`viza-fe/marketing-website/lib/pricing.ts` mirrors the launch-country subset
(keyed by `visaType`). The two packages don't share a node_modules workspace, so
the mirror is **kept in sync by hand on pricing changes**. A true shared package
(monorepo workspace, e.g. `@viza/pricing`) is the follow-up to remove the
mirror; until then the portal file is authoritative and the mirror is for
display only (it never drives a charge).

## Currency display policy (→ SGD)

Marketing displays a single **SGD** "from" total per package:

```
totalSGD = ceil( agencyUSD × FX[USD→SGD]  +  govtFee × FX[govtCurrency→SGD] )
```

- FX is a **static, ops-maintained table** in `marketing-website/lib/pricing.ts`
  (`FX_TO_SGD`) — no live FX at render time, so prices are stable and cacheable.
- Rounded **up** to a whole SGD (conservative display).
- The figure is indicative ("from SGD N"); the authoritative charge is computed
  by the portal at checkout in the collection currency.

Update FX rates in `FX_TO_SGD` quarterly (or when a rate moves materially) and
re-verify the marketing card/template figures.
