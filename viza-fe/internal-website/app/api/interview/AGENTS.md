# Interview API

Scope: `app/api/interview/**`.

- `route.ts` streams officer questions, with deterministic fallback questions.
- `report/route.ts` scores transcripts and provides a local fallback report.
- `avatar/[action]/route.ts` proxies the existing avatar service.
- `locale.test.ts` verifies request language, fallback copy, report labels and
  preservation of applicant answers.

Use the explicit current interface locale when provided, otherwise the
`NEXT_LOCALE` cookie. Both English and Chinese must reach model prompts and
fallbacks. Transcript content remains the applicant's original text. Report
enums are stable data values; localize their labels at the display boundary.
