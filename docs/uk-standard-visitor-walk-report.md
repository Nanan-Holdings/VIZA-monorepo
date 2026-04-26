# UK Standard Visitor Visa — apply-uk-visa.service.gov.uk Walk Report

> **Status: skeleton.** Run `viza-be/submission-service/scripts/walk-uk-portal.ts` against the
> live portal with the test resume URL + password to populate the per-page sections below.
> See `france-visas-walk-report.md` for the canonical format.

---

## 1. Scope

This document captures the post-auth structure of the UK Standard Visitor visa
application form on `apply-uk-visa.service.gov.uk`, walked end-to-end from the
applicant's `forceResume` URL up to (but not including) the payment screen.

**What this enables**
- Updating `viza-be/agent-backend/scripts/seed-uk-standard-visitor-form-fields.ts`
  with any missing or renamed fields discovered in the live walk.
- Extending `viza-be/submission-service/src/uk/orchestrator.ts` past its current
  registration-page stop, page-by-page, using the captured selectors.
- Building `viza-be/submission-service/src/uk/field-mappings.ts` post-auth entries.

**What this does NOT cover**
- Payment flow (we deliberately stop at the pay button — per Q1 user constraint).
- Post-decision artifact retrieval (handled by separate UKVI delivery process).

---

## 2. Walk capture method

```bash
cd viza-be/submission-service
export UK_TEST_RESUME_URL='https://visas-immigration.service.gov.uk/forceResume/<uuid>'
export UK_TEST_PASSWORD='<password>'
npx ts-node scripts/walk-uk-portal.ts --headful
```

Outputs to `viza-be/submission-service/uk-walk-out/` — one JSON + one PNG per
page, plus a combined `walk.json`. The script halts automatically when it
encounters a Pay/Submit/Confirm-and-pay button.

---

## 3. Page inventory (TO FILL FROM walk.json)

For each page captured, document:

| # | URL fragment | Heading | Field count | Required fields | Submit button(s) |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

---

## 4. Field-name → seed mapping gaps

Diff the `field_name`s captured by the walk against the seed in
`seed-uk-standard-visitor-form-fields.ts`. List below any fields found live but
missing from the seed (or vice versa):

- **Missing in seed:**
  - _none yet — populate after live walk_
- **In seed but not seen live:**
  - _none yet — populate after live walk_
- **Renamed:**
  - _none yet — populate after live walk_

---

## 5. Conditional logic discovered

UK forms branch heavily by purpose-of-visit, prior-travel-history, and
employment status. Document any newly discovered branching:

- _populate after walk_

---

## 6. Widgets needing portal-specific orchestration

Following the France-Visas pattern, document any widgets that need
custom Playwright interaction beyond `selectOption` / `fill`:

- _populate after walk_

---

## 7. Stop-at-pay verification

The walk script halts when it sees a button matching:

```
^pay\b
^submit\b
^confirm and pay
^make payment
^pay now
^proceed to payment
```

Confirm in the captured `walk.json` that the final page recorded
`stoppedAtPay: true` and document its heading + URL here so the runner
implementation has the same anchor:

- **Final page heading:** _TBD_
- **Final page URL:** _TBD_
- **Final button text:** _TBD_

---

## 8. Follow-up actions after walk

1. Update `seed-uk-standard-visitor-form-fields.ts` for the diffs in §4.
2. Extend `src/uk/orchestrator.ts` past `registration` using the captured
   selectors. Stop at the page identified in §7.
3. Add `UkApplicationReference` + portal URL + username to the
   `UkSubmissionResult` write-back in `src/index.ts:processUkItem`.
4. Update this document's status banner to "complete" when the runner
   reaches stop-at-pay reliably across two consecutive runs.
