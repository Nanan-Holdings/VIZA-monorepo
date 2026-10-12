# Interview practice

Scope: `app/client/interview-practice/**`.

- `page.tsx` owns preparation, officer selection, interview and report stages.
- `copy.ts` owns complete English/Chinese UI copy, localized officer profiles,
  deterministic question plans and report labels. Keep officer IDs and report
  enum values stable across language changes.
- `_hooks/use-live-talking.ts` owns the existing avatar connection and playback.
- `page.test.tsx` covers localized stages, preservation of the selected officer,
  speech-recognition language and the locale sent to the interview API.

The current interface locale controls UI, new questions, report requests,
speech recognition, speech synthesis and avatar voice selection. Preserve
applicant-authored answers and transcript text. Changing the language must not
reset the current route stage or selected officer. API behavior is governed by
`app/api/interview/AGENTS.md`.
