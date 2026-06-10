# Supabase Agent Setup

This guide is the source of truth for agent work that touches VIZA Supabase
schema, migrations, storage, persistence, or database-backed QA. Do not claim a
database task is complete until the remote database has been verified.

## Project

- Supabase project ref: `oyjxdzsoejraedqghndi`
- Frontend Supabase URL: `https://oyjxdzsoejraedqghndi.supabase.co`
- Codex MCP server URL:
  `https://mcp.supabase.com/mcp?project_ref=oyjxdzsoejraedqghndi`
- Supabase CLI migrations directory:
  `viza-fe/internal-website/supabase/migrations`
- Targeted VIZA SQL bundle:
  `viza-fe/internal-website/supabase/manual/viza_required_schema.sql`

## Required Environment Variables

Set these only in local/private environment files or your shell. Never paste
secret values into chat, logs, docs, screenshots, or commits.

- `DATABASE_URL`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Frontend-only variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AGENT_BACKEND_URL`
- `NEXT_PUBLIC_APP_URL`

Backend-only variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `GOOGLE_TRANSLATE_API_KEY`
- `STRIPE_SECRET_KEY`
- `AIRWALLEX_API_KEY`
- `ALIPAY_PRIVATE_KEY`
- `SUBMISSION_RESULT_SECRET_KEY`

The frontend `.env.local` must contain only browser-safe values. Service role
keys, database URLs, payment secrets, OpenAI keys, Airwallex keys, Alipay
private keys, and translation API keys belong in backend env files such as
`viza-be/agent-backend/.env`, `viza-be/submission-service/.env`, or the runtime
environment for the relevant service.

## Connection Rules

- Use the hosted Supabase project, not local Supabase, unless a task explicitly
  asks for local testing.
- Do not use `127.0.0.1:54321` or `127.0.0.1:54322` for remote schema checks.
- Prefer the Supabase Session pooler `DATABASE_URL` for agent-driven migration
  and verification from IPv4-only environments. Supabase documents session mode
  as the Shared Pooler path on port `5432`, while transaction mode usually uses
  port `6543`.
- A direct `db.<project-ref>.supabase.co` database URL is also remote, but can
  be blocked on networks without IPv6 support unless the project has the IPv4
  add-on.
- Never print `DATABASE_URL`, service role keys, database passwords, API keys,
  private keys, or payment secrets. Confirm only whether they are present and
  non-empty.

## Codex MCP Setup

Run these from a terminal with the Codex CLI available:

```powershell
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=oyjxdzsoejraedqghndi"
codex mcp login supabase
codex mcp list
```

In the Codex app, run `/mcp` after login to confirm `supabase` is enabled and
authenticated. Restart Codex if newly installed skills or MCP tools are not
visible in the current session.

Optional Supabase agent skills:

```powershell
npx skills add supabase/agent-skills
```

## Inspect Before Changing

From the repository root:

```powershell
npm run doctor:env
```

This reports env files, BOMs, frontend secret variable names, and local-vs-remote
Supabase hints without printing values.

Current local findings on 2026-06-10:

- Frontend `viza-fe/internal-website/.env.local` points to
  `https://oyjxdzsoejraedqghndi.supabase.co`.
- Agent backend `viza-be/agent-backend/.env` points to
  `https://oyjxdzsoejraedqghndi.supabase.co`.
- Submission service `viza-be/submission-service/.env` points to
  `https://oyjxdzsoejraedqghndi.supabase.co`.
- Travel service env has no Supabase URL.
- The recognized Supabase CLI migration directory is
  `viza-fe/internal-website/supabase/migrations`.
- Existing backend Drizzle VIZA source migrations include
  `0090_applicant_profile_bilingual_fields.sql`,
  `0093_ds160_live_assisted_controls.sql`,
  `0095_france_live_assisted_controls.sql`, and
  `0013_fv_accounts_and_prefill_columns.sql`.
- The frontend `.env.local` and `.env.example` currently contain backend secret
  variable names and must be treated as unsafe until cleaned.
- If any value has previously been committed or shared, rotate it.

## Dry-Run Supabase CLI Migrations

Use the frontend Supabase directory. Pass the remote database URL explicitly:

```powershell
cd viza-fe\internal-website
npx supabase db push --db-url "$env:DATABASE_URL" --dry-run --debug
```

Supabase tracks applied migrations in
`supabase_migrations.schema_migrations`. A dry-run shows which migration files
would be applied, but it is not a substitute for schema verification.

## Apply Supabase CLI Migrations

Only run this after confirming the migration list is VIZA-safe:

```powershell
cd viza-fe\internal-website
npx supabase db push --db-url "$env:DATABASE_URL" --debug
```

Do not push unrelated legacy medical, lab, prescription, or vector migrations
when the task only requires VIZA schema.

## Targeted VIZA Migration

For the current VIZA-required schema only:

```powershell
cd viza-fe\internal-website
npm run db:migrate:viza
```

By default this prints a migration plan and does not mutate the database. To
apply the selected VIZA SQL files only:

```powershell
cd viza-fe\internal-website
npm run db:migrate:viza -- --apply
```

The migrator runs `db:verify` after a successful apply.

## Manual SQL Editor Path

If `supabase db push` or direct Postgres access is blocked:

1. Open the Supabase dashboard for project `oyjxdzsoejraedqghndi`.
2. Open SQL Editor.
3. Review `viza-fe/internal-website/supabase/manual/viza_required_schema.sql`.
4. Paste and run the SQL in one execution.
5. Run `npm run db:verify` after the SQL finishes.

The SQL bundle is idempotent: it uses `CREATE TABLE IF NOT EXISTS`,
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS`.
It does not drop data and does not require unrelated pgvector migrations.

## Verify Schema

From the internal website:

```powershell
cd viza-fe\internal-website
npm run db:verify
```

The verifier:

- connects with `DATABASE_URL`
- blocks local Supabase unless `ALLOW_LOCAL_SUPABASE=true`
- prints database name, current user, server version, and redacted project
  sanity
- checks Universal Profile bilingual columns
- checks live-assisted `submission_queue` columns
- checks France live-assisted tables and `fv_accounts`
- checks DS-160 live-assisted tables
- checks the `application-documents` storage bucket when the storage schema is
  queryable
- exits with code `1` when required schema is missing

For DB tasks, include before/after verifier output in the final report.

## Troubleshooting

- Missing `.supabase` profile: use `--db-url "$env:DATABASE_URL"` instead of
  relying on linked local project state.
- UTF-8 BOM in env files: run `npm run doctor:env`; remove BOMs with
  `powershell -ExecutionPolicy Bypass -File scripts/doctor-env.ps1 -FixBom`.
- Password authentication failed: verify the remote database password and URL
  encoding in `DATABASE_URL`; do not paste the password into chat.
- Pooler timeout: use the Session pooler string from the Supabase dashboard
  Connect panel, confirm outbound access to the host and port, and retry once.
- Migration directory not found: run Supabase CLI commands from
  `viza-fe/internal-website`.
- `db push` says up to date but schema is missing: run `npm run db:verify`.
  If required schema is missing, apply the targeted VIZA migration or paste the
  manual SQL bundle.
- `type "extensions.vector" does not exist`: do not enable pgvector for
  VIZA-required migrations unless the task explicitly touches vector search.
- Service points local while frontend points remote: update backend/service env
  to the same remote project before QA.

## Completion Rule

Agents must not claim completion for database-related tasks without remote DB
verification. If verification is blocked, say exactly which credential, network
path, SQL Editor action, or user session is needed.
