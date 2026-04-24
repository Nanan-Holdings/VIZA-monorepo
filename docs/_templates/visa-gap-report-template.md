# {COUNTRY} {VISA TYPE} — Gap Report

**Generated:** {YYYY-MM-DD}
**Schema version:** v1 (seed-{country}-{visa-type}-form-fields.ts)
**Visa type:** `{COUNTRY}_{VISA_TYPE}`

> Copy this template to `docs/{country}-visa-gap-report.md` before
> filling in. Delete this blockquote when done.

Goal: when a user is assigned the {COUNTRY} {VISA TYPE} package, their
`/application` page renders a 1:1 schema match of what they would see
on the live {OFFICIAL SYSTEM NAME} form.

---

## 1. Coverage Summary

| Section | Step | Fields | Notes |
|---------|------|--------|-------|
| {Section name} | 1 | {N} | {Notes — repeatable groups, conditional gates} |
| {Section name} | 2 | {N} | |
| ... | ... | ... | |
| **Total** | **{N}** | **{N}** | — |

---

## 2. Purpose Options (Step {N})

{If your visa has a purpose-of-visit umbrella, enumerate the options
here. Otherwise delete this section.}

`purpose_of_visit` covers the full {VISA TYPE} umbrella — {N} purposes:
- `{value}` — {Label}
- ...

Each purpose unlocks a bespoke sub-journey in Step {N}.

---

## 3. Remaining Limitations

{For each limitation, state what it is, why it's deferred, what the
impact is, and what workaround (if any) exists.}

### 3.1 {Limitation title}

**Status:** {e.g. schema present, workflow missing}
**Impact:** {Low / Medium / High}

{Description.}

**Why deferred:** {concrete reason — depends on another system change, out of v1 scope, etc.}

**Workaround:** {what staff/users do in the meantime, or "none — gap is open".}

### 3.2 ...

---

## 4. Closed in this version (optional — remove for v1)

Track what each version closed from a prior list:

- **{Gap title}** — {what was done to close it}
- ...

---

## 5. Conditional Logic Status

### 5.1 `||` and `&&` operators
`lib/form-utils.ts` `evaluateShowIf` splits on `||` then `&&` and
evaluates each atom with `===` / `!==`. Multi-value gating works.

### 5.2 Cross-step conditionals
As of the UK v2 playbook, `DynamicStepForm` seeds `values` state from
the full `prefill`, so cross-step conditionals work. Verify this is
still the case if you adopt a pattern where a later-step field gates
on an earlier-step answer.

### 5.3 Not supported — list membership operator
No `in` operator for country lists or value-set membership. If your
form gates fields on nationality lists (TB test, visa-waiver checks),
either enumerate with `||` or add a user-declared radio as fallback.

---

## 6. Implementation Notes

### 6.1 Seed script is idempotent
`scripts/seed-{country}-{visa-type}-form-fields.ts` deletes all rows
with `visa_type = '{VISA_TYPE}'` then re-inserts. Safe to re-run.

### 6.2 Repeatable groups used
- `{group_name}` (step {N}) — gated on `{parent_field} === yes`
- ...

### 6.3 Block groups used (visually grouped fields)
`{block_name}`, `{block_name}`, ...

### 6.4 Inline groups used (side-by-side pair rendering)
`{inline_name}`, ...

---

## 7. Reviewer Checklist

Before marking as production-ready:

- [ ] Seed applied ({N} rows in `visa_form_fields` with visa_type = `{VISA_TYPE}`)
- [ ] Package registered in `visa_packages` via migration
- [ ] Assign a test user the `{VISA_TYPE}` package
- [ ] Walk every step, answer every conditional, trigger every sub-journey
- [ ] Test every repeatable group (add/remove instance, values persist)
- [ ] Test multi-value `||` in any multi-value conditionals
- [ ] Test cross-step gating (if any sub-journey is step-N gated on step-<N answer)
- [ ] Submit a test application — verify all {N} answers persist to `visa_application_answers`
- [ ] Review step (`DynamicReviewStep`) renders every field
- [ ] Live-portal QA pass completed (or explicitly deferred with reason)

---

## 8. Source Material

List every document consulted. If you used only fallback sources
(research fallback in playbook §3 Step 2), say so explicitly — the
schema is a **reconstruction**, not a live-portal capture, until the
live-portal QA pass is done.

- {Source 1 — URL or document title + date}
- {Source 2}
- ...

{Note any expected drift — when the government next updates the form,
what in this schema is most likely to need revalidation.}
