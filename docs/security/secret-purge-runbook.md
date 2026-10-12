# Secret Purge Runbook

Artifact for **SEC-002**. Procedure for removing a secret/env file that was
accidentally committed — both from the working tree (untrack) and, if it ever
reached a commit, from history (rewrite).

Cross-references:
- [`secret-inventory.md`](./secret-inventory.md) — current tracking audit (SEC-001)
- [`secret-rotation-runbook.md`](./secret-rotation-runbook.md) — rotate the exposed keys (SEC-003)

> **Deliverable of this story** = this committed runbook + any working-tree
> untracking. A remote history rewrite (force-push) is an operator action, NOT
> performed by the coding agent — it requires coordination and a backup.

## Current state (2026-06-04)

Audit shows **no real env/secret file is tracked** (only `.env.example`
templates). The brief reported `agent-backend/.env.local` and
`submission-service/.env` were once committed with real keys; they are now
gitignored and absent from the index. This runbook is therefore defensive +
documents the history-rewrite for any historical commits that still contain them.

Re-confirm before acting:

```bash
git ls-files | grep -E '\.env'                                          # expect only *.env.example
git ls-files | grep -iE 'service-account|\.p12$|\.pfx$|\.key$|\.pem$'    # expect empty
```

## Active incident (2026-08-29) — `internal-website/.env.local.bak`

A pre-launch audit found a **second** leaked file that this runbook did not
previously cover: `viza-fe/internal-website/.env.local.bak`. It is **not**
tracked and **not** on disk (now covered by the `.env*.bak` ignore rule), but it
remains in **git history** in these commits:

```
25a4c6a7  Add supabase MCP
79ab783c  Add supabase MCP
acc8491f  Update general info
4cf11bd4  Update general info
```

Secrets present in that blob (rotate ALL of these per
[`secret-rotation-runbook.md`](./secret-rotation-runbook.md) BEFORE the rewrite):

- `STRIPE_SECRET_KEY` — **live** `sk_live…` key (money movement / refunds)
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses all RLS on the production DB
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_API_KEY`, `PASSPORT_OCR_OPENAI_API_KEY`
- `AIRWALLEX_API_KEY`, `AIRWALLEX_CLIENT_ID`
- `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`
- `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Rewrite command for this file (see Step 3 for the full procedure and backup):

```bash
git filter-repo --path viza-fe/internal-website/.env.local.bak --invert-paths
```

Verify afterwards:

```bash
git log --all --full-history -- viza-fe/internal-website/.env.local.bak   # expect empty
```

> Status: rotation + history rewrite are **operator actions, still pending** as
> of 2026-08-29 (a coding agent does not rotate dashboard keys or force-push a
> rewritten history — see the note at the top of this file). Multiple local dev
> sessions were active at discovery time; do NOT rewrite history until they are
> committed/pushed and the branch is frozen, or their work will be orphaned.

### Containment update — 2026-09-04

The 2026-08-29 history rewrite + force-push did **not** end the exposure. GitHub
pins pre-rewrite commits behind `refs/pull/*`, so all four commits above still
resolved by SHA on a **public** repo. Verified that day by unauthenticated
`curl` against `raw.githubusercontent.com`: **HTTP 200**, full blob served to
anonymous callers. Public since 2026-04-25; blob committed 2026-06-10 —
roughly **3 months** of anonymous availability.

**Action taken (2026-09-04):** repository visibility set to **private**
(`gh repo edit --visibility private`). Fork count was 0, so no fork network kept
the objects reachable. Re-verified anonymously with cache-busting:

```
25a4c6a7  api=404  raw=404
79ab783c  api=404  raw=404
acc8491f  api=404  raw=404
4cf11bd4  api=404  raw=404
```

(An initial re-test returned 200 from a `raw.githubusercontent.com` Varnish edge
cache — `x-cache: HIT`, `max-age=300`. It is cache, not an access path; it
expires within 5 minutes. Always cache-bust when verifying.)

**This is containment, not remediation.** Going private does not delete the
objects, does not reach anyone who already cloned or scraped the repo, and
reverses instantly if the repo is ever made public again. Every key in the blob
must still be treated as compromised and rotated.

**Aggravating factor:** GitHub secret scanning is **disabled** on this repo
(`GET /secret-scanning/alerts` → 404 "Secret scanning is disabled"). No partner
alert was ever raised, so Stripe never auto-revoked the leaked `sk_live_` key —
it should be assumed live and valid until manually rolled.

**Two secrets missing from the 2026-08-29 rotation list**, confirmed present in
the blob: `PASSPORT_OCR_OPENAI_API_KEY` (a second `sk-proj-` key, distinct from
`OPENAI_API_KEY`) and `AIRWALLEX_CLIENT_ID` (Airwallex auth is client_id + api_key
as a pair — rotating only the key is insufficient).

**Severity corrections from blob inspection** (prefixes only, values not read):
`STRIPE_SECRET_KEY` is `sk_live_` → live money movement, rotate first.
`ALIPAY_GATEWAY_URL` is `openapi.alipay.com` → **production** Alipay, so
`ALIPAY_PRIVATE_KEY` is a production signing key. `AIRWALLEX_ENV=demo` /
`api-demo.airwallex.com` → demo tenant, lower severity, still rotate.
`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `..._PUBLISHABLE_KEY` are public by design and
need no rotation.

Full-history sweep for other secret-bearing paths found none:
`viza-fe/internal-website/.env.local.bak` is the only file that ever carried real
credentials. All other `secret`/`credential`-named paths are source, tests, docs,
or migrations.

## Step 1 — Untrack a currently-tracked secret (working tree)

If the audit above lists a real secret file, untrack it (keeps the local copy,
removes it from the index):

```bash
git rm --cached viza-be/agent-backend/.env.local
git rm --cached viza-be/submission-service/.env
# confirm it is now ignored (no output from):
git ls-files | grep -E '\.env(\.local)?$'
git commit -m "chore(security): untrack committed secret files"
```

The exhaustive patterns in root `.gitignore` (SEC-001) prevent re-adding them.

## Step 2 — Rotate the exposed credentials FIRST

A history rewrite does NOT un-leak a secret — anyone with a clone or a cached
GitHub view may still have it. **Rotate every key that appeared in the file
before or in parallel with the rewrite**, per
[`secret-rotation-runbook.md`](./secret-rotation-runbook.md). Keys most likely
present in those files: `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`,
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`,
`TWOCAPTCHA_API_KEY`, `SUBMISSION_RESULT_SECRET_KEY`.

## Step 3 — History rewrite (operator action — commands only)

Pick ONE tool. **Back up the repo first** (`git clone --mirror` to a safe path).

### Option A — git filter-repo (recommended)

```bash
# install: pipx install git-filter-repo
git filter-repo \
  --path viza-be/agent-backend/.env.local \
  --path viza-be/submission-service/.env \
  --invert-paths
```

### Option B — BFG Repo-Cleaner

```bash
bfg --delete-files '.env.local' --delete-files '.env'
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

## Step 4 — Coordinate the force-push (operator only)

```bash
# 1. Freeze the branch (announce in #oncall; pause CI).
# 2. Force-push the rewritten history:
git push --force-with-lease origin --all
git push --force-with-lease origin --tags
# 3. Every collaborator MUST re-clone (rebasing onto rewritten history corrupts).
# 4. Invalidate cached views: contact GitHub Support to purge any cached
#    blobs / open PRs referencing the old commits.
```

## Step 5 — Verify

```bash
git log --all --full-history -- viza-be/agent-backend/.env.local   # expect empty
git log --all --full-history -- viza-be/submission-service/.env     # expect empty
gitleaks detect --config .gitleaks.toml --redact --no-banner        # expect no findings
```

Record the purge in [`secret-rotation.md`](./secret-rotation.md)'s rotation log.
