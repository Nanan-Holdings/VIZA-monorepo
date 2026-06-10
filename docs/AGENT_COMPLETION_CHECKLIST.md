# Agent Completion Checklist

Use this checklist before reporting completion for any VIZA task involving:

- database schema
- save failures
- migrations
- live assisted submission
- Universal Profile
- payment records
- OCR saved fields
- document upload persistence

## Required Evidence

1. Code changes or a clear statement that no code change was needed.
2. Migration applied, targeted SQL prepared, or an explicit blocker.
3. Remote DB before/after verification from `npm run db:verify` or an equivalent
   redacted SQL check.
4. Browser or Chrome QA when UI is involved.
5. Network request evidence when save or submit behavior is involved.
6. A clear final result:
   - `completed`
   - `blocked`
   - `needs user credential`
   - `needs SQL Editor action`

## Database Work Rule

Do not claim a database task is complete just because TypeScript, server actions,
or migration files changed. The active remote Supabase database used by the
frontend must be checked.

For VIZA local development, the expected remote project is:

- project ref: `oyjxdzsoejraedqghndi`
- URL: `https://oyjxdzsoejraedqghndi.supabase.co`
- migration directory: `viza-fe/internal-website/supabase/migrations`

## Minimum DB Report

Include these items in the final response when DB work is in scope:

- Supabase project checked
- env files inspected
- services pointing to local vs remote
- migration path used
- schema verifier result
- missing tables or columns, if any
- whether a targeted migration or manual SQL bundle is available
- blockers and exact next action
- secret variable names that should be rotated, if any

Never include secret values.
