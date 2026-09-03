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
