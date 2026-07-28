# Vendor cost monitoring (OBS-003)

## Contract

Each vendor implements the `CostAdapter` interface in `adapters.ts`:

```ts
interface CostAdapter {
  vendor: string;
  fetchDaily(days: number): Promise<DailySpend[]>; // amountCents in USD
}
```

`aggregateLastWeeks()` calls every adapter in parallel, splits the 14-day series into "this week" + "prior week", and produces a `wowDelta` per vendor. Failure in one adapter doesn't break the dashboard — it returns a zero series for that vendor.

## /admin/costs UI

Renders one row per vendor with the weekly spend + WoW delta + a sparkline of the 7-day daily series. PagerDuty alert fires when **total WoW > +20% for 7 days running** — wire that into the existing canary-pager scaffolding by polling `aggregateLastWeeks()` from a new pg_cron entry.

## Adapter implementations (deferred)

Real adapters are env-gated. Wire each when its vendor lands:

| Vendor          | Source                                                  | Auth                                |
| --------------- | ------------------------------------------------------- | ----------------------------------- |
| Bright Data     | `https://api.brightdata.com/usage/zones`                | `BRIGHTDATA_API_TOKEN`              |
| Anthropic       | `https://api.anthropic.com/v1/admin/usage_report`       | `ANTHROPIC_ADMIN_API_KEY`           |
| AWS             | Cost Explorer SDK (`GetCostAndUsage`)                   | IAM user with `ce:Get*`             |
| Twilio          | `https://api.twilio.com/2010-04-01/Accounts/{sid}/Usage/Records.json` | Twilio basic auth   |
| Resend          | Resend doesn't expose usage today — derive from sent counts × cost-per-email or skip. | n/a |
| Stripe Identity | Stripe Reporting API (`reporting_run` of type `connected_account_balance_change_from_activity`) | `STRIPE_REPORTING_API_KEY` |

Drop the implementation under `lib/costs/<vendor>.ts`, register in `ALL_ADAPTERS`, add the env var to `docs/operations/env-vars.md`.

## Privacy

Cost adapters use vendor-owned aggregates only — never per-applicant attribution. Cost data is admin-only RLS-equivalent (admin/staff routes).
