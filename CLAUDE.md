# VIZA Claude Operating Contract

Start with the repository-root `AGENTS.md`, then read the nearest nested
`AGENTS.md` before editing. It is the authoritative source for current product
boundaries, module maps, quality gates, and Ralph workflow.

Use [`CODEX.md`](CODEX.md) and
[`docs/agent-development-framework.md`](docs/agent-development-framework.md)
for the shared multi-agent operating model. For non-trivial requests, split
independent work into exclusive ownership lanes by default and retain one
orchestrator for shared contracts, integration, and final verification.

## Direct requests vs. Ralph work

- A direct user request is executed as scoped work; do not select a PRD story
  unless the user explicitly requests the PRD/Ralph workflow.
- For explicit PRD/Ralph work, follow the root `AGENTS.md` workflow exactly:
  one eligible story is the integration unit; update `prd.json` and append to
  `progress.txt` only after its required checks pass.

## Non-negotiables

- Check the dirty worktree before editing and preserve unrelated changes.
- Run only the checks for packages actually modified, plus the required smoke
  test for user-facing work.
- Keep database, auth/RLS, payment, official-submission, and deployment writes
  single-owner; parallel review is allowed but not competing implementation.
- Never commit secrets, environment files, applicant documents, or credentials.
