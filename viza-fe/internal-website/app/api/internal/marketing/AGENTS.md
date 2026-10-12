# Internal Marketing Automation API Guide

Scope: applies to `app/api/internal/marketing/**`.

These routes are Vercel Cron entry points. Require the `CRON_SECRET` bearer
token, return minimal JSON, and keep the durable `marketing_automation_runs`
record authoritative for idempotency and failure state. Long-running LLM work
runs in `iad1` and must never publish content automatically; it creates a draft
for staff review.
The content cron runs Tuesday and Thursday at 01:00 UTC and uses the VIZA
pipeline config in `scripts/pipeline.config.json`. Reconciliation checks both
Zernio and Upload-Post job state.
