# {COUNTRY} Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** {YYYY-MM-DD}

> Copy this template to `docs/{country}-visa-scope.md` before filling
> in. Delete this blockquote when done. Placeholders are `{LIKE_THIS}`.

---

## 1. Canonical Journey

**Visa type:** {FULL VISA NAME}
**VIZA visa_type key:** `{COUNTRY}_{VISA_TYPE}`

{One-paragraph description of which applicants this visa serves, for
how long, and why it's the v1 target. For umbrellas, name the sub-purposes
the visa covers.}

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility guidance | `{URL}` | {What the user reads first} |
| 2. Application start | `{URL}` | {Where they click "Apply now"} |
| 3. Online application | `{URL OR system name}` | {The actual form — our extraction target} |
| 4. Biometrics / post-submission | `{provider}` | {Where they go after the form} |

The **v1 extraction target** is step 3.

### Application Structure

{The form collects data across N logical sections — list them in the
order the official form presents. These map to `step_number` in the
seed.}

1. {Section name}
2. {Section name}
...

---

## 2. v1 Scope — What Is Included

- **One visa category only:** {e.g. Schengen Type C short-stay}
- **One application system:** {e.g. harmonized Annex I form / France-Visas portal}
- **Schema extraction:** all sections, fields, options, requiredness, conditional logic
- **Dynamic form rendering:** via existing `visa_form_fields` + `DynamicStepForm`
- **No automated submission** in v1 (unless your country specifically requires it — see DS-160 for the pattern)

---

## 3. Out-of-Scope Visa Categories (v1)

Categories we explicitly exclude. They use different application
journeys with different field sets.

| Category | Reason for exclusion |
|----------|---------------------|
| {Category} | {Why — different journey / different fields / different evidence} |
| {Category} | {Why} |

Future iterations can add them as additional `visa_type` entries and
seed scripts.

---

## 4. Known Source-Flow Ambiguities

Things we observed during scope analysis that are uncertain, document
rather than silently assume:

1. **{Ambiguity name}** — {What's unclear, how we handled it, what a
   future maintainer should verify.}
2. ...

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official
> field structure, requiredness, options, and conditional logic in a
> machine-readable VIZA schema before optimizing downstream automation.

The {COUNTRY} schema must be grounded in the actual {official source}
application flow. Hand-written or partially copied field lists are not
acceptable proof of parity. Any fields that cannot be verified against
the official source must be flagged in the gap report.

---

## 6. Integration with Existing Infrastructure

| Component | Approach |
|-----------|----------|
| `visa_form_fields` table | New rows with `visa_type = '{COUNTRY}_{VISA_TYPE}'` |
| `visa_packages` table | New row registered via Drizzle migration |
| Seed script | `scripts/seed-{country}-{visa-type}-form-fields.ts` (idempotent delete + re-insert) |
| Frontend rendering | No code changes — `DynamicStepForm` is visa-type-agnostic |
| Submission automation | {In v1: none / Playwright against {portal} / e-visa API} |
| Answer storage | Existing `visa_application_answers` table |

---

## 7. How the {COUNTRY} Schema Was Derived

{Describe the research process. If you had live-portal access,
say so. If you worked from PDF + guidance (research fallback in
playbook §3 Step 2), say so and list the documents used.}

Sources consulted:
- {Source 1}
- {Source 2}
- {Source 3}

### How to Rerun or Update the Schema

1. Edit `viza-be/agent-backend/scripts/seed-{country}-{visa-type}-form-fields.ts`
2. Run: `npx tsx scripts/seed-{country}-{visa-type}-form-fields.ts`
3. Verify output: `Done: N rows seeded (N defined)` with matching N's
4. No frontend deployment needed — the dynamic form reads from DB at runtime

### How to Add a Related Visa Category

1. Copy the seed script to `seed-{country}-{new-category}-form-fields.ts`
2. Change `VISA_TYPE` to a new key
3. Update the `FIELDS` array
4. Add a Drizzle migration inserting into `visa_packages`
5. Run the seed
6. Assign the package via the admin interface

---

## 8. Next Recommended Actions

### Immediate (before production)
1. **{Action}** — {Why it must happen first.}
2. ...

### Short-term (v1.1)
3. **{Action}**
4. ...

### Medium-term (v2)
5. **{Action}**
6. ...

---

## 9. Source material checklist (honesty disclosure)

- [ ] Live portal was driven end-to-end: {yes / no — if no, say why}
- [ ] Published application PDF consulted: {yes / no / link}
- [ ] Caseworker guidance consulted: {yes / no / link}
- [ ] Legal basis consulted: {yes / no / link}
- [ ] Live-portal QA pass completed: {yes / no — must be yes before production}
