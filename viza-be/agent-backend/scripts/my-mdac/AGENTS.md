# Malaysia MDAC Seed Agent Guide

Scope: Malaysia `MY_MDAC_ARRIVAL_CARD` form schema only.

Keep this package separate from Malaysia eVISA and generic visitor-entry flows.
Fields should come from Immigration Malaysia / MDAC official requirements, and
official portal automation should live in `viza-be/submission-service` only after
the field and option inventory is verified.

`official-options.ts` stores MDAC-specific official dropdown values scraped from
the MDAC portal, including Malaysian state values and state-dependent city
values. Keep option `value` fields aligned with official portal values because
the Playwright runner submits those values directly.

`option-labels.ts`, `option-translations.zh.json`, and
`translate-options-with-google.ts` are display-only helpers for the Chinese UI.
They must never replace the official `value`, `label_en`, or `official_label`
that the submission runner uses against the MDAC portal.
