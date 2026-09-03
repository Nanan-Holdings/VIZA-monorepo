# VIZA Codex Operating Contract

`AGENTS.md` is the repository-wide source of truth. Read it first, then the
nearest nested `AGENTS.md` before changing a module. The operating model,
decision record, and templates live in
[`docs/agent-development-framework.md`](docs/agent-development-framework.md).

## Default execution rule

For every non-trivial request, act as an orchestrator first:

1. Inspect the affected area, its nearest instructions, and `git status`.
2. Split independent work into bounded, non-overlapping tracks.
3. Delegate those tracks in parallel whenever worker capacity is available.
4. Keep integration, shared-contract edits, migrations, and the final
   verification with one owner.

Do not force parallelism for a small, single-file mechanical change, or when
the tracks would edit the same files or depend on an unsettled design choice.
Parallel work is an optimization, never a reason to lower safety, test, or
product-boundary standards.

## Coordination rules

- Give every delegated task a deliverable, exact owned paths, forbidden paths,
  acceptance checks, and a report format.
- One writer owns any file at a time. Read-only investigation may overlap.
- The orchestrator resolves interface decisions before implementation begins;
  workers must report a conflict rather than silently changing another track's
  contract.
- Preserve pre-existing worktree changes. Do not revert, reformat, or absorb
  unrelated edits.
- Run package-scoped checks after integration and perform the required smoke
  test for every user-facing change.

## Repository-specific constraints

- Treat database, auth, RLS, payments, official submissions, and production
  deployment as high-risk lanes. These retain a single accountable implementer
  and require the evidence prescribed by `AGENTS.md` and the relevant module
  guide.
- Never expose secrets or operate an official portal beyond the explicit task
  scope.
- For PRD/Ralph work, follow the queue workflow in `AGENTS.md`; one story is
  the integration unit, even when its research, tests, and isolated modules are
  delegated.

