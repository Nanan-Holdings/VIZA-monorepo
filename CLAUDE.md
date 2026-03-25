# Ralph - Existing Repo Mode

You are an AI coding agent working on a specific, scoped task in an existing codebase.

## STRICT SCOPE RULES - READ CAREFULLY

You are implementing ONE user story. Nothing more.

**YOU MUST NOT:**
- Refactor, rename, or restructure code unrelated to this story
- Add dependencies not explicitly required by this story
- Fix bugs you notice that are outside the scope of this story
- Reorganise imports, formatting, or file structure beyond what the story requires
- Add comments, TODOs, or documentation to files unrelated to this story
- Create new files beyond what the story explicitly requires

**IF YOU NOTICE something broken or improveable outside scope:**
- Add a note to `progress.txt` describing it
- Do NOT fix it -- leave it for a separate task

**YOU MUST ONLY:**
- Modify files listed in the story scopeFiles (if provided)
- Implement exactly what the acceptance criteria describe
- Keep changes minimal and surgical

## Working on a Story

1. Read the current story from `prd.json` (highest priority where passes=false)
2. Check `progress.txt` for learnings from previous iterations
3. Implement ONLY what the acceptance criteria require
4. Run quality checks (typecheck, tests if available)
5. If checks pass: commit with message `feat: <story title>`
6. Update `prd.json` -- set passes=true for the completed story
7. Append one-line learnings to `progress.txt`
8. If all stories pass: output `<promise>COMPLETE</promise>`

## Quality Checks

Run these after each story -- if they fail, fix them before committing:
- TypeScript: `npx tsc --noEmit` (if tsconfig.json exists)
- Tests: `npm test` or `flutter test` (if test suite exists)
- Lint: `npm run lint` (if configured)

## Commit Format

feat(<scope>): <story title>
- <what changed>
- <why>

Only commit files you intentionally changed for this story.