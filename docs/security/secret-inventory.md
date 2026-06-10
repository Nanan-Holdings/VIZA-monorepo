# Secret Inventory & Git Tracking Audit

Artifact for **SEC-001** — proves no real secret/env file is tracked in git, and
documents the exhaustive ignore patterns that keep it that way.

Cross-references:
- Ignore rules: root [`.gitignore`](../../.gitignore) + per-workspace `.gitignore` files
- Rotation runbook: [`secret-rotation.md`](./secret-rotation.md)
- Scanning config: `.gitleaks.toml` (SEC-004/SEC-005)
- Policy: `SECURITY.md`

## Ignore coverage

The root `.gitignore` ignores the following recursively (matches root **and** every
nested workspace — `viza-be/agent-backend`, `viza-be/submission-service`,
`viza-be/email-worker`, `viza-be/travel-service`, `viza-fe/internal-website`,
`viza-fe/marketing-website`):

- `.env`, `.env.*`, `.env.local`, `.env.*.local`, `.env.{development,test,production}.local`
- `*service-account*.json`, `*serviceaccount*.json`, `*-credentials.json`, `gcp-*.json`, `firebase-adminsdk-*.json`
- `*.pem`, `*.crt`, `*.cer`, `*.key`, `*.p12`, `*.pfx`, `*.keystore`

Template files are explicitly kept via negations: `!.env.example`, `!.env*.example`, `!*.example.json`.

`viza-be/submission-service/.gitignore` re-asserts these patterns so the workspace is
safe even when checked out in isolation.

## Audit commands & output

Run from repo root. Last run: **2026-06-04**.

```bash
$ git ls-files | grep -E '\.env'
travel-agent/.env.example
travel-agent/travel-agent-chatbot/.env.example
viza-be/submission-service/.env.example
viza-be/travel-service/.env.example
viza-fe/internal-website/.env.example
viza-fe/marketing-website/.env.example
```

All six matches are `.env.example` templates (intended to be tracked). **No real env file is tracked.**

```bash
$ git ls-files | grep -iE 'service-account|\.p12$|\.pfx$|\.key$|\.pem$'
(none)
```

No service-account JSON, key, or certificate material is tracked.

## Re-running the audit

```bash
git ls-files | grep -E '\.env'          # expect only *.env.example
git ls-files | grep -iE 'service-account|\.p12$|\.pfx$|\.key$|\.pem$'   # expect empty
```

If either command surfaces a real secret, treat it as a leak: purge per
[`secret-rotation.md`](./secret-rotation.md), rotate the credential, and run the
SEC-002 history-purge procedure.
