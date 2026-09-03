# VIZA Claude Compatibility Instructions

This file is intentionally short because the previous version described retired
packages and rules that conflict with the active monorepo.

1. Read `../AGENTS.md` first, then the nearest nested `AGENTS.md`.
2. Read `lessons.md` at the start of a session and apply relevant lessons.
3. Follow `../CLAUDE.md`, `../CODEX.md`, and
   `../docs/agent-development-framework.md` for the shared operating model.
4. Use multi-agent fan-out by default only for independent, non-overlapping
   work; keep high-risk writes and final integration single-owner.
5. The root `AGENTS.md` determines validation, commit, safety, and PRD/Ralph
   behavior. Do not rely on historical package names or generic checklists.
