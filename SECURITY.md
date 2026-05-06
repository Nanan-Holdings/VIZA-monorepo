# Security policy and audit log

> Last reviewed: 2026-05-06 (SECRETS-004)

This document tracks the security posture of the VIZA monorepo —
specifically how we store and rotate credentials, how we audit the repo
for accidental disclosure, and any historical findings worth recording
for posterity.

## Where secrets live

| Secret type | Storage | Read path |
|---|---|---|
| Per-applicant portal credentials (UK / EG / IT / future country accounts) | `applicant_secret` table, AES-256-GCM ciphertext | `applicantVault.get` / `.require` (agent-backend, submission-service) |
| Supabase service-role keys, IMAP password, 2captcha key, Resend API key | Process env (`.env.local` or Cloud Run env vars) | Read once at boot, never persisted |
| Encryption key (`SUBMISSION_RESULT_SECRET_KEY`) | Process env / KMS | Used by `secret-cipher.ts` to derive the AES key |

`.env.example` files in this repo MUST contain placeholders only — never
real credentials. Pre-commit gitleaks (see below) and the manual quarterly
audit both check for leakage.

## How rotation works (SECRETS-003)

```
echo -n "new-value" | npx tsx viza-be/agent-backend/scripts/rotate-applicant-secret.ts <applicant_id> <key>
```

The rotation funnels through `setApplicantSecret`, which writes the new
ciphertext AND appends a `secret_access_log` row tagged
`actor=scripts/rotate-applicant-secret.ts`. The old plaintext is never
echoed back. Admins can review the per-applicant audit at
`/admin/users/[id]/secret-access`.

## Pre-commit hook (SECRETS-004)

Repo-tracked at `scripts/git-hooks/pre-commit`. Install once per
clone with `./scripts/install-git-hooks.sh`.

The hook:

1. Runs `gitleaks protect --staged --config .gitleaks.toml --redact` if
   `gitleaks` is on `$PATH`.
2. Falls back to a regex sweep covering Supabase JWTs, Resend live keys,
   2captcha 32-char hex keys, and `*_PASSWORD/_SECRET/_TOKEN/_API_KEY`
   assignments with non-empty RHS values.

Bypassing the hook with `git commit --no-verify` is reserved for
maintainer-approved emergencies. Document any bypass in the commit body
so it surfaces in code review.

## Repository audit (2026-05-06)

State of the repo at the time of this entry:

- All `.env.example` files in the tree (`viza-fe/internal-website/.env.example`,
  `viza-be/submission-service/.env.example`) contain placeholders only.
  Verified 2026-05-06 during SECRETS-004 implementation.
- Per-applicant portal credentials are stored in `applicant_secret` and
  read exclusively through the vault helpers (SECRETS-001, SECRETS-002).
- All vault reads/writes append to `secret_access_log` (SECRETS-003).

**No historical leak postmortems on file at this time.** If a leak is
discovered later, append an entry to the section below following the
template — do not edit prior entries.

### Postmortem template

```
### YYYY-MM-DD — short title

- **Discovered by:** name / process (e.g. quarterly audit, gitleaks CI)
- **Affected secret(s):** category, NOT the value
- **Window of exposure:** first commit → revocation timestamp
- **Blast radius:** systems that accepted the leaked credential
- **Rotation evidence:** PR / commit hash for the rotation
- **Follow-up actions:** detection rules added, hooks tightened, etc.
```

## Reporting a vulnerability

Email `edward.zehua.zhang@gmail.com` with `[VIZA-SECURITY]` in the
subject. Do not file public issues for vulnerabilities until a fix has
shipped.
