# CI Required Checks & Path Filters (CI-007)

Documented branch-protection policy for `main` (no dashboard action here — this
is the intended required-checks list). Each workflow is path-filtered so PRs
only run the jobs they affect.

| Workflow | File | Path filter | Gates |
| --- | --- | --- | --- |
| ci-internal-website (CI-001) | `.github/workflows/ci-internal-website.yml` | `viza-fe/internal-website/**` | type-check, lint, build |
| ci-marketing (CI-002) | `.github/workflows/ci-marketing.yml` | `viza-fe/marketing-website/**` | type-check, lint, build |
| ci-agent-backend (CI-003) | `.github/workflows/ci-agent-backend.yml` | `viza-be/agent-backend/**` | type-check, lint, build |
| ci-submission-service (CI-004) | `.github/workflows/ci-submission-service.yml` | `viza-be/submission-service/**` | type-check, test (no lint script) |
| secret-scan (SEC-005) | `.github/workflows/secret-scan.yml` | all | gitleaks |
| db-verify (MIG-005) | `.github/workflows/db-verify.yml` | all | runner_job + runner-input schema |
| submission-service-image (DEP-005) | `.github/workflows/submission-service-image.yml` | `viza-be/submission-service/**` | Docker build (push on main) |
| qa-gates | `.github/workflows/qa-gates.yml` | internal-website | E2E / a11y (existing) |

## Required-checks policy (branch protection on `main`)

- Always required: **secret-scan**.
- Required when the matching path changed: the four `ci-*` jobs + `db-verify`
  (schema) + `submission-service-image` (Dockerfile builds).
- The new `ci-*` jobs do NOT duplicate qa-gates (E2E/a11y stays separate).
