# VIZA Monorepo - AI Collaborator Instructions

## Project Overview

**VIZA** - All-in-one visa services app with Admin, Client, and Admin portals.

**Stack:** TypeScript, Node.js, Next.js 16, Supabase, Anthropic Claude SDK, Shopify

**Packages:** `agent-backend`, `admin-website`, `report-generator`, `viza-mobile`, `database`

**Always read package-level CLAUDE.md** when working in that directory.

---

## Critical Rules

1. **Unit Conversion (Reports):** Lab results use SI units, ranges use conventional units. Always convert before comparing. See `report-generator/CLAUDE.md` for details.

2. **Database:** Single Supabase DB (`database/schema.sql`). Coordinate schema changes. Users table uses `name` column (NOT `first_name`/`last_name`).

3. **Auth:** Use `createAdminClient()` to bypass RLS (admin portal, agent backend). Never hardcode user IDs.

4. **Before Committing:** Run `npm run lint && npm run type-check && npm run build` in package directory.

5. **Supabase MCP:** Read-only. Do not attempt to write, insert, update, or delete data through it.

---

## Commit Message Standards

**Format:** `<type>(<scope>): <description>`

**Type:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`

**Scope:** Package (`agent-backend`, `admin-website`, `report-generator`, `mobile`) or module (`auth`, `pdf`, `scoring`, `orders`, `admin-v2`, `staff`)

**Description Rules:**
- Minimum 10 characters
- Lowercase, imperative mood ("add" not "adds")
- Be specific - explain WHAT changed
- No vague terms: "updates", "fixes stuff", "changes", "wip"

**Examples:**
```
✅ feat(auth): add password reset flow for locked accounts
✅ fix(scoring): correct unit conversion for eGFR metric
✅ chore(deps): upgrade Supabase client to v2.39.0

❌ fix stuff
❌ updates
❌ wip
```

**Don't include:** Co-Authored-By lines, emoji, ticket-only references

---

## Common Pitfalls

- **Unit conversion:** Use `convertMetricValue()` before comparing lab values to ranges
- **User isolation:** Use `UserScopedToolRegistry` in agent-backend, never query all users
- **Schema changes:** Search codebase for table references before modifying
- **RLS:** Use `createAdminClient()` intentionally, don't disable everywhere

## Package Notes

- **agent-backend:** Read `docs/PROGRESS.md` first. All tools via `UserScopedToolRegistry`. Use admin client.
- **admin-website:** Three portals (`/admin-v2/*`, `/staff/*`, `/admin/*`).
- **report-generator:** Unit conversion is #1 bug source. See package CLAUDE.md for full rules.

---

## Plan Mode Default

Enter plan mode when the path isn't obvious or when architectural decisions are involved.
Use judgment — skip plan mode for simple mechanical tasks even if they have many steps.

**Always enter plan mode for (no exceptions):**
- Database schema changes or migrations
- Auth, security, or RLS policy changes
- Changes that span more than one package in the monorepo

**Opt-out:** If the user says "just do it", "no plan needed", or similar — skip plan mode
(except for the always-plan categories above).

If implementation goes sideways mid-task, STOP and re-plan immediately — don't push through.
Write detailed specs upfront to reduce ambiguity.

---

## Subagent Strategy

- Use subagents liberally to keep the main context window clean
- Offload research, codebase exploration, and parallel analysis to subagents
- For complex problems, throw more compute via subagents rather than reasoning in-context
- One focused task per subagent — avoid broad multi-purpose agent prompts

**Model selection:**
- Explore/research tasks → Haiku (`claude-haiku-4-5-20251001`) — fast and cheap for reading/searching
- Plan/architecture tasks → Sonnet (`claude-sonnet-4-6`) — use for design decisions

---

## Demand Elegance

For all non-trivial code (regardless of who initiates the change):
- Internally ask "is there a more elegant way?" before presenting the solution
- If you catch yourself about to present a hacky solution and revise it, briefly say why
  - Example: "Reconsidered using a regex here — a simple `.split()` is clearer and sufficient"
- Skip this for simple, obvious fixes — don't over-engineer

---

## Self-Improvement Loop

**At the start of every session:**
Read `.claude/lessons.md` and output as the very first line of your response:
`Reviewed .claude/lessons.md — N lessons active.`

**After any explicit correction** ("you did X wrong", "that's not right", etc.):
1. Identify the pattern behind the mistake — not just the surface error
2. Append a new entry to `.claude/lessons.md`:

```
## YYYY-MM-DD — <short title>
**What happened:** brief description of the mistake
**Rule:** actionable instruction to prevent recurrence
```

**Maintaining lessons.md:**
- Delete lessons that are no longer accurate or relevant — keep the file clean and high-signal
- Lessons are committed to git and shared with the team

---

**Last Updated:** 2026-02-26
