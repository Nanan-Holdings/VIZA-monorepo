# Public Feedback Form Guide

Scope: `app/feedback/**`.

- `page.tsx` provides the public route shell and metadata.
- `feedback-form.tsx` owns the accessible, client-side beta-feedback flow and
  sends submissions only to `POST /api/feedback`.
- `feedback-copy.ts` contains the route-scoped English and Chinese display
  copy. Keep stored fields language-neutral.
- The route is intentionally public. Do not add applicant authentication or
  write directly to Supabase from the browser.
