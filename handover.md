# Success-Result System — Follow-up Handover

The Philippines UI edit has been completed separately. This handover covers
only the reusable all-country success-result architecture, design-system
documentation, and regression prevention work that remains.

## P0: terminal success is structurally inside Review for every product

This is a shared long-form layout issue. The application currently aliases
`statusStepIndex` to `reviewStepIndex` and renders `SubmissionStatusStep`
inside the Review branch:

- `viza-fe/internal-website/app/client/application/long-form/page.tsx:2368-2372`
- `viza-fe/internal-website/app/client/application/long-form/page.tsx:5178-5210`
  (dynamic forms)
- `viza-fe/internal-website/app/client/application/long-form/page.tsx:5323-5353`
  (fallback forms)
- `viza-fe/internal-website/lib/application-submission-display.ts:39-47`
  always keeps review alongside status.

Implement one distinct terminal `Confirmation`/success step after Review for
every **confirmed success**. Pending, failure, and action-required states stay
associated with Review. The project already supports a `confirmation` section
type in `lib/application-step-sections.ts`; wire it into the long-form step
list rather than adding country-specific placement conditions.

## Shared result-card architecture

`SubmissionStatusStep.tsx:2462` is the central dispatch point for country
results. Add a presentation-only shared `TerminalSuccessPanel` under:

`viza-fe/internal-website/app/client/application/_components/result-cards/`

It should own the neutral success layout, title, reference block, artifact
region, and canonical `ActionButton` slots. Country adapters should own only:

- terminal-success predicate;
- localized product data;
- official evidence/artifacts;
- a next step only when it adds a fact not already shown.

Preserve Korea's stricter official-evidence predicate. Do not treat every
`submitted` value as a confirmed official success.

Migrate bespoke result cards to this shell progressively. Most still import
legacy rectangular `Button`; terminal artifact actions should use canonical
`ActionButton` (`sm` for card actions). Full pale-green evidence/success
surfaces in Thailand, France, and Taiwan should be neutral when migrated;
semantic icons or small accents may remain.

## Design-system documentation and enforcement

`viza-fe/internal-website/frontend.md` is the central written design guide—do
not create a separate `design.md`. The current dirty-worktree additions already
make `/ui-components` the visual reference gate and prohibit redundant adjacent
status/disclaimer/next-step copy.

Follow-up changes:

1. Add a **Submission results / terminal states** subsection to `frontend.md`:
   distinct terminal panel after Review; neutral canonical shell; `ActionButton`
   for result actions; render every fact once; country additions supply data to
   the shared composition rather than bespoke styling.
2. Correct the button guide: `ActionButton` is canonical; `BrandActionButton`
   is only a backward-compatible alias.
3. Add the corresponding implementation invariant to
   `app/client/application/AGENTS.md`.
4. After the shared panel exists, add it as a specimen to `/ui-components` with
   success, pending, action-required, and failure states; optional references
   and artifacts; and `sm` canonical actions.
5. Add a focused lint/audit rule that rejects raw `components/ui/button`
   imports in `result-cards/**` and `*ResultCard.tsx`, except documented
   exceptions. Prose alone will not prevent drift.

## Registry and test coverage

Replace the country-only coverage list at
`result-cards/covered-countries.ts` with a `(country, visaType)` result
registry. The current list omits Singapore and Philippines despite their
dispatcher support. A new product must declare its success presentation before
coverage passes.

Add:

- `TerminalSuccessPanel` unit tests: title/reference/artifact actions render
  once; primary and secondary action variants; Chinese/English support.
- Parameterized placement tests: confirmed success appears as its own
  confirmation region after Review for both dynamic and fallback flows; all
  other states stay Review-associated.
- Dispatcher/registry completeness tests for every supported result pair.
- Migration tests for Singapore, PH arrival/departure, MY, TH, VN, KR, one
  generic e-visa, and one failed/manual flow.
- Authenticated browser smoke tests for at least Singapore, Philippines, one
  generic e-visa, and a failed/manual flow.

The status center is a summary/navigation surface, not an in-flow terminal
result; do not fold it into this change.
