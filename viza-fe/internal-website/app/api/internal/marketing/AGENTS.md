# Internal Marketing Automation API Guide

Scope: applies to `app/api/internal/marketing/**`.

These routes are Vercel Cron entry points. Require the `CRON_SECRET` bearer
token, return minimal JSON, and keep the durable `marketing_automation_runs`
record authoritative for idempotency and failure state. Long-running LLM work
runs in `iad1` and must never publish content automatically; it creates a draft
for staff review.
