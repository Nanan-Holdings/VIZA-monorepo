# Agent Development Framework

**Status:** accepted

## Outcome

VIZA uses an orchestrator-and-workers model: parallelize independent discovery,
implementation, and verification work by default; serialize work where a
shared contract, a high-risk system, or a single file demands one accountable
owner. This is the operating contract for Codex and Claude collaborators.

## Audit findings — 2026-08-29

| Finding | Impact | Resolution |
| --- | --- | --- |
| `AGENTS.md` is comprehensive and current, but root `CLAUDE.md` is Ralph-only. | Direct requests can be misrouted into the PRD queue. | Make `AGENTS.md` authoritative and keep Ralph as an explicit mode. |
| `.claude/CLAUDE.md` names retired packages and obsolete database conventions. | Agents can follow incorrect architecture and validation guidance. | Reduce it to a compatibility entry point that defers to current repo guides. |
| The repository has 180+ local instruction files but no fan-out/fan-in protocol. | Parallel workers can collide, duplicate investigation, or leave integration gaps. | Use owned-path task briefs, an interface freeze, and one integration owner. |
| Existing dirty work is normal in this repository. | Broad edits and mechanical cleanup can destroy in-flight work. | Require an initial status check and explicit preservation boundaries. |
| Quality rules are package-scoped, while some old instructions require every check/build. | Unnecessary waits slow changes and hide the relevant signal. | Run only checks for modified packages plus the required targeted smoke test. |

## Decision

Use a **four-lane, staged fan-out/fan-in workflow**. The root agent owns scope,
architecture, shared interfaces, integration, final verification, and the user
report. Workers own bounded, non-overlapping deliverables.

```text
request
  │
  ├─ triage + ownership map (orchestrator)
  ├─ parallel lanes: discovery | implementation | tests/docs
  │                     only where interfaces are frozen
  ├─ fan-in: review contracts, resolve conflicts, integrate
  └─ package checks + smoke test + evidence-backed handoff
```

### Lane policy

| Lane | Parallel by default? | Ownership rule |
| --- | --- | --- |
| Discovery, code reading, test-gap analysis | Yes | Read-only; report evidence and recommended path. |
| Isolated feature modules, focused tests, docs | Yes | Exclusive directories/files; no shared contract changes. |
| Shared APIs, types, schemas, configuration | After design decision | One designated writer; consumers start only after its contract is published. |
| Migrations, auth/RLS, payment, official submission, deployment | No, except read-only review | Single accountable implementer; reviewers may inspect in parallel. |
| Integration and final checks | No | Orchestrator owns reconciliation and final evidence. |

## Operating procedure

### 1. Triage

Before modifying files, inspect `git status --short`, read the root and nearest
module instructions, and locate the source of truth. Classify the request:

- **Tiny:** one mechanical, low-risk edit with a clear owner. Work directly.
- **Scoped:** multiple independent files or an obvious test/doc split. Fan out.
- **Cross-cutting:** interfaces, packages, or user flow span boundaries. Freeze
  the contract first, then fan out only isolated work.
- **High-risk:** database, auth, RLS, payment, official portal, deployment, or
  destructive data action. Keep one writer and use parallel review only.

### 2. Interface freeze

For cross-cutting work, the orchestrator records these items in the task brief
before workers edit code: owner, affected paths, public types/API shape,
failure behavior, migration/rollout plan, and acceptance tests. An uncertain
interface is a design task, not an implementation task.

### 3. Delegated-task contract

Every worker receives this compact brief:

```markdown
Goal: <one deliverable>
Owned paths: <exclusive files/directories>
Forbidden paths: <shared files or other lanes>
Contract: <frozen API/type/behavior, or "read-only investigation">
Acceptance: <targeted tests, lint/type check, or evidence required>
Report: changed paths; commands/results; risks/blockers; integration notes
```

Workers do not expand scope, modify another lane's path, resolve shared
contract disputes alone, run broad destructive commands, or overwrite existing
unrelated work. They report conflicts immediately.

### 4. Fan-in and evidence

The orchestrator reviews each report, inspects the combined diff, resolves any
contract mismatch, and then runs the checks required for the modified packages.
For a user-facing change, run at least the smoke test required by the relevant
`AGENTS.md`; report credential/environment limitations precisely. A clean type
check alone is not completion for persistence, official-submission, or UI work.

## Concurrency patterns

### Preferred three-worker split

1. **Mapper:** traces the current flow, module guidance, edge cases, and
   proposes the smallest safe change. Read-only.
2. **Builder:** changes the isolated implementation paths under an already
   frozen contract.
3. **Verifier:** adds or updates focused tests, checks regressions, and reports
   untested risks. It must not edit the builder's owned implementation file.

The root agent retains integration. If workers are limited, prioritize mapper
for ambiguous work and verifier for risky work; do not delegate merely to
increase agent count.

### Cross-package feature split

1. Root agent publishes shared request/response types and failure semantics.
2. Frontend, backend, and tests/docs receive exclusive paths.
3. Root agent integrates in dependency order: migration/configuration, backend,
   frontend, then end-to-end verification.

### Country/portal rollout split

Use a single evidence owner for official portal observation. Parallel lanes may
work on schema crosswalk, frontend display, and runner safety guards only after
the evidence owner publishes the canonical field/page contract. No parallel
worker may claim live-submission support without the prescribed browser and DB
evidence.

## Guardrails that preserve speed

- Prefer separate files and modules over multiple writers in a shared file.
- Batch independent read-only commands and package checks, but never run
concurrent writers on the same file.
- Avoid new dependencies unless the task needs them; do not run `npm install`
  as a routine repair.
- Keep the user informed at meaningful transitions: triage, active parallel
  lanes, integration, and any blocker.
- Do not use agents to bypass explicit approvals, credentials, product gates,
  or official-portal safety boundaries.

## Tool compatibility

`AGENTS.md` remains the primary, tool-neutral instruction file. `CODEX.md`,
root `CLAUDE.md`, and `.claude/CLAUDE.md` are compatibility entry points that
point to this framework. When files disagree, apply the nearest `AGENTS.md`,
then this framework, and treat older prose as historical context.

## Success measures

Track these per substantial request or sprint:

| Signal | Target |
| --- | --- |
| Parallelizable tasks that receive an ownership map | 100% |
| Simultaneous conflicting writers | 0 |
| Final integrations with package-scoped checks | 100% |
| User-facing changes with a smoke-test result or explicit blocker | 100% |
| Rework caused by unstated interface changes | Downward trend |

