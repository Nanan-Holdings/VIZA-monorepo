# Visa Schema Playbook — Adding a New Country

How to take a country's official visa application form and reproduce it
as a VIZA visa package, so that when staff assign the package to a
user, the user's `/application` page renders a **1:1 field-level match**
of the live government form.

---

## 0. First contact — read this before touching anything

**Read these files in this order.** They give you the codebase
context you need before following the playbook.

1. `/CLAUDE.md` — repo-wide Ralph instructions, commit format, stop condition
2. `/.claude/CLAUDE.md` — AI-collaborator rules, lessons loop, plan mode defaults
3. `/prd.json` — current work and existing story IDs (so you don't reuse a prefix)
4. `/progress.txt` — full build history for prior countries; **US-015 through US-031 and UK-001 through UK-005 are the canonical worked examples, read them**
5. `/docs/uk-visa-scope.md` + `/docs/uk-visa-gap-report.md` — structural templates in their final form
6. This playbook end to end before starting step 1

**Environment setup** (one-time per fresh clone):

```bash
cd viza-be/agent-backend && npm install
cd viza-fe/internal-website && npm install
```

`viza-be/agent-backend/.env.local` must exist and contain:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

If the file is missing, ask the user — do not guess credentials.
Confirm the env is wired by running:

```bash
cd viza-be/agent-backend && npm run type-check
cd viza-fe/internal-website && npm run type-check
```

Both must pass cleanly before you start.

**Supabase ground rules:**
- Supabase MCP is **read-only** (per `/.claude/CLAUDE.md`). Never
  attempt writes through MCP.
- All writes go through seed scripts or Drizzle migrations.
- Seed-script output `"Done: N rows seeded (N defined)"` is your
  verification. If the two numbers don't match, an insert failed
  silently — stop and investigate before proceeding.

**Canonical reference: US DS-160** (`viza-be/submission-service/src/`,
`viza-be/agent-backend/scripts/seed-ds160-form-fields.ts`, ~330 fields,
18 CEAC pages). DS-160 is the only implementation that has been
QA'd end-to-end against the live government portal (CEAC) — it is
the ground truth for what "1:1 parity" actually means in this codebase.

The UK Standard Visitor build is included as a secondary worked
example of scaling the pattern to a new country, but **UK has not yet
been QA'd against the live Access UK form** — it's a high-fidelity
reconstruction from public guidance documents.

Estimated time per country: 1–2 days for a mid-complexity visitor
form, longer for multi-purpose umbrellas (like DS-160's 100+ visa
categories or UK Standard Visitor's 11 purposes).

---

## 1. Mission statement

**One rule:** the `/application` page for a country's visa package must
show the same fields, in the same order, with the same conditional
branches as the official government form. Anything missing on our side
is a field the Home Office will ask for later — bad for the user.

---

## 2. Prerequisites

Before starting a new country, you should understand:

- **`visa_form_fields` table** (`viza-be/agent-backend/src/db/schema.ts`) — generic key-value definitions, keyed by `visa_type`
- **`visa_packages` table** — catalog of available visa products; a country is usually 1 package per visa type
- **Seed script pattern** (`viza-be/agent-backend/scripts/seed-<country>-<visa-type>-form-fields.ts`) — idempotent delete + re-insert
- **`DynamicStepForm`** (`viza-fe/internal-website/components/dynamic-step-form.tsx`) — the generic renderer
- **`evaluateShowIf`** (`viza-fe/internal-website/lib/form-utils.ts`) — conditional logic evaluator

If you don't know the data flow end to end, **read §9 (US DS-160 reference)
first** — it's the only implementation with live-portal QA. The UK
gap report and seed script (§10) are useful as a second data point
for how the pattern applies to a country with pure-dynamic rendering
and no submission automation.

---

## 3. Step-by-step process

### Step 1 — Pick the visa scope

Most countries offer dozens of visa types. Do NOT try to cover all of
them in one package. One package = one visa product on the official
site. Name it `{COUNTRY}_{VISA_TYPE}` (e.g. `UK_STANDARD_VISITOR`,
`JP_TOURIST`, `VN_E_VISA`).

**Multinational visas** — some visas cover multiple countries with a
shared form (Schengen, ECOWAS, Caribbean Common Security, GCC). When
this applies:

- **Scope to the harmonized form**, not any individual member state's
  embassy portal. Schengen's Annex I form (EU Regulation 810/2009) is
  accepted by all 29 member states; each embassy adds local UX but
  the field set is shared.
- **Name the package by the visa type, not a country**:
  `EU_SCHENGEN_C_SHORT_STAY`, not `FR_SCHENGEN_C` or 29 separate
  packages.
- **Document country-specific variations** (fees, supporting
  documents, biometrics centres, appointment systems) in the gap
  report, not the schema.
- **Pick the visa type variant explicitly** — Schengen has Type C
  (short-stay <90 days), Type D (long-stay national), FTD/FRTD
  (transit). These are separate packages.

If the country has an "umbrella" visa that bundles multiple purposes
(like UK Standard Visitor covers tourism + business + study + medical
+ etc.), treat it as one package with a `purpose_of_visit` field that
unlocks sub-journeys — see step 5.

### Step 2 — Research the live form

Sources, in order of preference:

1. **The actual online application** — start an application (throwaway
   account if possible) and screenshot every page. This is the ground
   truth.
2. **Caseworker guidance PDFs** — most governments publish internal
   caseworker instructions that enumerate every field. (UK example:
   the Home Office "Visit caseworker guidance", ~70 pages.)
3. **Supporting documents guide** — tells you what the gov't expects,
   which implies what the form asks.
4. **Immigration rules / appendix documents** — primary source for
   what's legally required.

**Do not rely only on:** tourism sites, third-party visa services,
Wikipedia. These drift from the real form.

**Web-scraping caveat:** most gov forms are behind an email/identity
gate. WebFetch / WebSearch will not reach the actual application
pages. Use public guidance + screenshots as your source of truth.

**Research fallback — when the live form can't be driven**

Many forms can't be previewed (in-person-only embassies, identity-gated
portals like Access UK, schedule-only systems). In that case, work
from these sources in priority order:

1. **The published application PDF** — almost every ministry provides
   a downloadable copy. Harmonized EU forms are always PDFs
   (Schengen Annex I, etc.). Field names come straight from the PDF.
2. **Caseworker / civil-servant operational guidance** — the UK Home
   Office "Visit caseworker guidance" (70 pages) enumerates every
   field applicants are asked. Equivalent docs exist for most
   jurisdictions.
3. **Supporting-documents checklists** — tell you what's gathered,
   which implies what's asked.
4. **Legal basis** — immigration rules, EU visa codes, national
   immigration acts. Primary source for mandatory fields.

When you use fallback sources, call it out in the gap report's
"Source Material" section: the schema is a **reconstruction**, not a
live-portal capture. Add "live-portal QA pass" as an explicit open
item.

### Step 3 — Build the field inventory

For each page of the live form, record:

| Column | What to write |
|--------|--------------|
| Field name | snake_case, stable across versions (`given_names`, not `gn`) |
| Label | Exact text shown to the user, in English |
| Field type | `text` \| `select` \| `date` \| `file` \| `radio` \| `checkbox` \| `textarea` \| `country` |
| Required | true/false |
| Step number | Integer, starts at 1 |
| Display order | Integer, within a step |
| Conditional | `showIf: "parent_field === value"` or multi-value with `||` |
| Validation | `{ maxLength: 50, pattern: "^...", format: "DD/MM/YYYY" }` |
| Options | For select/radio, array of `{ value, text }` |
| Placeholder | Example text shown inside the input |
| Group | `block_group` (visually grouped set), `inline_group` (side-by-side pair), `repeat_group` (repeatable set) |

A spreadsheet or Notion table with these columns makes step 5 much
easier. For the UK this was ~222 rows.

### Step 4 — Identify sub-journeys and repeatable groups

Two patterns to watch for:

**Sub-journey** — a section of fields that only shows if a parent
select/radio has a specific value. Example: UK "business" purpose
unlocks `uk_business_contact_name`, `uk_business_company_name`, etc.
Use a shared `showIf` expression across the subset.

**Repeatable group** — a set of fields the user fills multiple times
(dependants, previous visits, previous passports, previous names,
travel history by country). Use:
- `repeatable: true`
- `repeat_group: "group_name"` (same name for every field in the set)
- `max_items: N` (optional, defaults to 5)

The renderer instances each group: instance 0 uses the base field name,
instance 1+ uses `fieldname__2`, `fieldname__3`, etc.

### Step 5 — Write the seed script

Copy `viza-be/agent-backend/scripts/seed-uk-standard-visitor-form-fields.ts`
as the template. Change only:
- `VISA_TYPE` constant
- The `FIELDS` array

Conventions that save pain:

```ts
const YES_NO = [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }];

// Reusable purpose gates — declared once, referenced in every sub-journey field
const IS_BUSINESS = "purpose_of_visit === business";
```

Each field literal:

```ts
{
  field_name: "passport_number",
  label: "Passport number",
  field_type: "text",
  required: true,
  step_number: 2,
  step_name: "About You — Passport & Identity Documents",
  display_order: 1,
  placeholder: "e.g., 123456789",
  validation_rules: { maxLength: 20 },
},
```

For conditional sub-journey fields, add `conditional_logic`:

```ts
{
  field_name: "uk_business_contact_name",
  // ...
  conditional_logic: { showIf: IS_BUSINESS },
  validation_rules: { maxLength: 80, block_group: "business_details" },
},
```

For a repeatable group, every field in the group carries the same
`repeat_group` name and the gating `showIf`:

```ts
{
  field_name: "dependant_given_names",
  // ...
  conditional_logic: { showIf: "applying_with_dependants === yes" },
  validation_rules: { maxLength: 50, repeatable: true, repeat_group: "dependants" },
},
```

Only the **first** field in the group needs `max_items`.

### Step 6 — Register the package

Add a migration at `viza-be/agent-backend/drizzle/NNNN_<country>_<visa_type>_package.sql`:

```sql
INSERT INTO visa_packages (country, visa_type, name, description)
VALUES (
  'united_kingdom',
  'UK_STANDARD_VISITOR',
  'UK Standard Visitor Visa',
  'Standard visitor visa for the United Kingdom (up to 6 months)'
)
ON CONFLICT (visa_type) DO NOTHING;
```

The `ON CONFLICT DO NOTHING` clause makes the migration idempotent.

### Step 7 — Run the seed

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-<country>-<visa-type>-form-fields.ts
```

The seed deletes all rows with the target `visa_type` then re-inserts
from the `FIELDS` array. Safe to re-run any number of times.

**Verification:** the final line of output must read
`Done: N rows seeded (N defined)` where both N's match the length
of your `FIELDS` array. A mismatch means an insert batch failed
silently — scroll up for the `Batch M error:` line. Do not proceed
to the next step until this matches.

### Step 8 — Type-check

```bash
cd viza-fe/internal-website && npm run type-check
cd viza-be/agent-backend && npm run type-check
```

Both must pass with zero errors.

### Step 9 — Manual walkthrough

- Assign the new visa package to a test user via the admin portal
- Log in as that user, open `/application`
- Walk every step, answer every conditional branch, trigger every
  sub-journey
- Submit and verify answers persist to `visa_application_answers`
- Check the review step renders every field

### Step 10 — Write the docs

Create `docs/<country>-visa-scope.md` (scope + canonical journey + source
URLs) and `docs/<country>-visa-gap-report.md` (coverage summary + known
limitations).

**Blank templates are committed at:**
- `docs/_templates/visa-scope-template.md`
- `docs/_templates/visa-gap-report-template.md`

Copy, rename, fill in `{PLACEHOLDERS}`. The UK docs are the canonical
filled-in example.

### Step 11 — Register PRD stories and log progress

The codebase tracks country builds as user-story groups in `prd.json`.
Follow the pattern UK-001 → UK-005 used.

1. **Pick a 2–3 letter prefix** for the country that's not already in
   `prd.json`. Check with:
   ```bash
   grep -o '"[A-Z]\{2,3\}-[0-9]\{3\}"' prd.json | sort -u
   ```
   Existing prefixes: `US-`, `UK-`. Suggested for common cases: `SCH`
   (Schengen), `JP` (Japan), `VN` (Vietnam), `AU` (Australia), `CA`
   (Canada), `KR` (Korea), `CN` (China), `IN` (India).

2. **Add 5 stories to `prd.json`** following the UK template:
   - `{PREFIX}-001` Pin scope / canonical journey
   - `{PREFIX}-002` Model field inventory in seed script
   - `{PREFIX}-003` Wire package into dynamic form path
   - `{PREFIX}-004` Publish gap report for unsupported fields/branches
   - `{PREFIX}-005` Document workflow + next expansion path

   Each story starts at `passes: false` and flips to `true` as the
   work lands. Copy the `acceptanceCriteria`, `priority`, and `notes`
   shape from UK-001 through UK-005.

3. **Append a progress.txt entry per story** in the format the existing
   entries use:
   ```
   ## YYYY-MM-DD - {PREFIX}-00N
   - What was implemented
   - Files changed: ...
   - Learnings: ...
   ---
   ```

4. **Ralph stop condition**: if the agent is running under the Ralph
   loop (`CLAUDE.md`), it stops when ALL `prd.json` stories pass.
   So finishing `{PREFIX}-005` with `passes: true` is the completion
   signal.

---

## 4. Code patterns reference

### Conditional logic syntax

Evaluated by `evaluateShowIf` in `viza-fe/internal-website/lib/form-utils.ts`.

| Pattern | Example |
|---------|---------|
| Equality | `other_names_used === yes` |
| Inequality | `marital_status !== single` |
| OR | `a === b \|\| c === d \|\| e === f` |
| AND | `a === yes && b === yes` |
| List membership | `current_nationality in [af, bd, cd, er, et, gh, ir, iq, ng, pk, so, lk]` |
| List non-membership | `current_nationality not in [us, ca, gb]` |
| Empty sentinel | `foo === _empty` (matches empty string) |

List values are bracketed, comma-separated, and matched
case-insensitively against `values[field]`. The atom parser checks
`not in` before `in` so the longer keyword wins. Composes with `||`
and `&&` exactly like equality atoms — the Schengen schema's
`IS_ATV_NATIONAL = current_nationality in [af, bd, cd, er, et, gh, ir, iq, ng, pk, so, lk] && purpose_of_journey === airport_transit`
is a worked example.

### Required-unless (exempt a required field from blocking submission)

Some forms mark fields as "starred" — required for the general
population but optional for a specific beneficiary class. Annex I of
the Schengen Visa Code is the canonical example (fields 21, 22, 30,
31, 32 are optional for EU-UK Withdrawal Agreement beneficiaries).

Express this at the schema level via `validation_rules.required_unless`:

```ts
{
  field_name: "current_occupation",
  required: true,                                     // still required in general
  validation_rules: {
    maxLength: 80,
    required_unless: "has_eu_family_member === yes",  // exempt for beneficiaries
  },
}
```

`DynamicStepForm` evaluates the expression against current values and
skips the required check when it matches. The field still renders —
only its blocking behaviour is waived. Supports all operators listed
above (`||`, `&&`, `in`, `not in`, etc.).

For large sets of starred fields, annotate them via a post-processor
at the bottom of the seed (see `STARRED_FIELD_NAMES` in
`seed-eu-schengen-c-short-stay-form-fields.ts`) to avoid editing every
field literal.

**Not supported:**
- Date arithmetic (e.g. "is under 18 derived from DOB") — ask a
  separate radio and let the UI auto-fill from DOB downstream
- Arithmetic comparisons (`<`, `>`) — express via user-declared radios
  (e.g. "will you stay more than 90 days?")

### Field types

| Type | Use for | Options? |
|------|---------|----------|
| `text` | Short free text | No |
| `textarea` | Long free text | No |
| `date` | Dates (use `format: "DD/MM/YYYY"` unless the source form uses another format) | No |
| `select` | Dropdown with a known list | Yes |
| `radio` | Yes/no or 2–4 mutually exclusive options | Yes |
| `checkbox` | Boolean (rarely used — prefer radio for explicit no) | No |
| `country` | ISO 3166-1 country picker | Use `validation_rules: { source: "ISO3166-1" }`. Rendered by `components/ui/country-dropdown.tsx` using the `country-data-list` npm package — no manual country fixtures needed |
| `file` | Document upload (rare in schema — prefer `application_documents` table) | No |

### Block vs inline vs repeat groups

| Group type | Effect | Example |
|-----------|--------|---------|
| `block_group` | Wrap a consecutive set of fields in a visual container box | `home_address` — line 1, line 2, city, postcode, country stacked inside one box |
| `inline_group` | Render a consecutive pair of fields side-by-side in a 2-col grid | `passport_dates` — issue + expiry shown side by side |
| `repeat_group` | Make the whole set repeatable with add/remove controls | `dependants` — add another dependant button |

Groups are declared via `validation_rules`. They can be combined:
a field can be in a `block_group` AND a `repeat_group` AND an
`inline_group` simultaneously.

### Cross-step conditionals — now work, but be careful

As of v2 of the UK seed, `DynamicStepForm` seeds its `values` state
with the full `prefill` (all accumulated prior answers), so a field
on step 8 can gate on an answer from step 7.

Limit: the parent field must be on an **earlier** step. A step-N field
cannot depend on a step-N+1 field (the answer doesn't exist yet).

### Purpose-of-visit umbrella pattern

When one visa product covers multiple purposes, use:
1. A single `purpose_of_visit` select field with all options
2. A dedicated "Purpose-Specific Details" step after the trip step
3. Each sub-journey's fields carry `conditional_logic: { showIf: IS_XXX }`
4. Declare reusable constants for the gates:

```ts
const IS_BUSINESS = "purpose_of_visit === business";
const IS_STUDY = "purpose_of_visit === short_study";
// ...reference in every sub-journey field
```

This scales cleanly up to ~15 purposes. Beyond that, consider
splitting into multiple packages.

### Under-18 applicant pattern

```ts
{ field_name: "is_applicant_under_18", field_type: "radio", ... },
{
  field_name: "parent_consent_letter_held",
  conditional_logic: { showIf: "is_applicant_under_18 === yes" },
  // ...
},
```

Ask the under-18 status explicitly rather than deriving from DOB —
the conditional engine does not do date arithmetic.

---

## 5. Things that will bite you

### 5.1 Same-name field clashes across visa types
Field names in `visa_form_fields` are scoped by `visa_type`, so
reusing `passport_number` across countries is fine. But within a
visa type, names must be unique. Prefix cross-purpose fields if
necessary (e.g. `marriage_partner_full_name` not just
`partner_full_name` — we already had a `partner_` namespace from
the family section).

### 5.2 Idempotency
Seed must delete-then-insert:

```ts
await supabase.from("visa_form_fields").delete().eq("visa_type", VISA_TYPE);
// then insert
```

Without the delete, running the seed twice duplicates every row.

### 5.3 Cross-step conditional bug (now fixed)
If you see sub-journey fields stubbornly not rendering, check
`DynamicStepForm` is still seeding `values` from full `prefill`:

```ts
const init: Record<string, string> = { ...prefill };
```

Not:

```ts
const init: Record<string, string> = {};
for (const field of step.fields) { init[field.fieldName] = ...; }
```

The first form sees cross-step values; the second does not.

### 5.4 Display order inside a step
Fields render sorted by `display_order` within a step. When you
insert a new field mid-step, you must bump the `display_order` of
every following field in that step. The seed will still run with
duplicate orders but the UI render order becomes undefined.

### 5.5 Dependants ≠ family
Don't conflate `has_children` (family section — always asked) with
`applying_with_dependants` (dependants step — only if those family
members are **also applying for UK visas alongside you**). The
dependants workflow needs separate applications per dependant —
the schema captures them but the spawning logic is a v3 workflow
task.

### 5.6 Document uploads are out of scope for the schema
Supporting docs (bank statements, consultant letters, birth
certificates, etc.) live in `application_documents`, not in
`visa_form_fields`. Don't add `file` fields to the seed.

### 5.7 Biometrics, fees, IHS are out of scope
Post-submission steps handled by separate pages (TLS Contact / VFS
Global / gov payment portals). Never bring them into the form schema.

---

## 6. File/directory checklist

For every new country/visa, you should end up with:

```
viza-be/agent-backend/
├── drizzle/
│   └── NNNN_<country>_<visa_type>_package.sql     # registers the package
├── scripts/
│   └── seed-<country>-<visa-type>-form-fields.ts  # 1:1 field definitions

docs/
├── <country>-visa-scope.md        # scope, source URLs, canonical journey
└── <country>-visa-gap-report.md   # coverage, known limitations, reviewer checklist
```

No frontend changes should be needed — `DynamicStepForm` renders every
visa type generically. If you find yourself writing frontend code for
a specific country, that's a signal you're trying to use the schema
to express something it can't (see §5 "Not supported"). Extend the
generic renderer, not the country-specific path.

---

## 7. Reviewer checklist template

Copy this into `docs/<country>-visa-gap-report.md` §7:

```markdown
- [ ] Seed applied (N rows in `visa_form_fields` with visa_type = `<VISA_TYPE>`)
- [ ] Package registered in `visa_packages`
- [ ] Assign the package to a test user
- [ ] Walk every step, answer every conditional, trigger every sub-journey
- [ ] Test every repeatable group (add/remove, values persist)
- [ ] Test multi-value `||` gates
- [ ] Test cross-step gating (if any)
- [ ] Submit test application — verify all N answers persist to `visa_application_answers`
- [ ] Review step (`DynamicReviewStep`) renders every field
```

---

## 8. When the live form changes

The Home Office (or equivalent) will update their form periodically.
Re-validate against the live form:
- Quarterly, as a baseline
- Whenever a policy change is announced (post-Brexit, fee hikes, new
  visa categories)
- When users report fields missing on our side

Drift is usually additive (new fields appear). Bump the `Schema version`
header in the gap report and add a new row to the "Closed in vN" section.

---

## 9. Reference implementation — US DS-160 (canonical, QA'd against live CEAC)

**DS-160 is the canonical reference** for this codebase. It's the
US non-immigrant visa form: ~330 fields, 18 CEAC content pages, one
form covering 100+ visa categories (B1/B2, F-1, J-1, H-1B, L-1, O, P,
etc.), plus automated submission through the CEAC portal with CAPTCHA
solving.

Why it's canonical:
- **End-to-end QA'd against the live CEAC portal** — every field,
  every page, every conditional has been driven through the real form
  and verified to land correctly
- **Has the full pipeline** — schema → dynamic form → hybrid React
  steps → normalization → submission automation. Every layer VIZA
  exercises is present here
- **Coverage is enforced in code** — `ds160-completeness-verify.ts`
  asserts 100% coverage of CEAC autofill-mapped keys. Drift can't
  silently ship

Deliverables to study before building a new country:
- **Seed:** `viza-be/agent-backend/scripts/seed-ds160-form-fields.ts` — ~330 field definitions
- **Hardcoded React steps:** `viza-fe/internal-website/components/application-steps/{personal-info,passport,travel-info}-step.tsx`
- **Typed intake schema:** `viza-fe/internal-website/types/ds160-intake.ts` (`DS160CompleteIntake`, `HARDCODED_TO_DS160_MAP`)
- **Normalization:** `viza-fe/internal-website/app/actions/ds160-normalize.ts` (`flattenPersonalInfo`, `flattenPassport`, `flattenTravel`)
- **Submission automation:** `viza-be/submission-service/src/ceac/` (Playwright + 2captcha)
- **Mappings:** `viza-be/submission-service/src/ds160-form-mappings.ts` (13 mapping groups across 18 CEAC pages)
- **Audits:** `viza-be/submission-service/src/ds160-coverage-audit.ts` + `ds160-completeness-verify.ts`

**Read the full build history in `progress.txt`** — US-015 through
US-031 document every design decision, every bug fix, and every
verification pass. That log is the single best onboarding document
for understanding why DS-160 is shaped the way it is.

The rest of §9 breaks down each intricacy so you know when to adopt
which pattern for a new country.

### 9.1 When to reach for DS-160 patterns

| Need | Look at |
|------|---------|
| Form has >200 fields | DS-160 scale patterns (§9.2) |
| One visa product covers many sub-categories | `isPurposeOfTripField` auto-lock (§9.6) |
| Some fields need React-level UX (file upload, date picker, auto-derive) | Hybrid hardcoded+dynamic split (§9.3) |
| Fields map to external system with different key names | Normalization/alias layer (§9.4–5) |
| Country requires automated submission to a government portal | CEAC automation architecture (§9.7) |
| Gov portal has a CAPTCHA on the start page | `start-page-captcha.ts` + 2captcha (§9.7) |

### 9.2 Scale — how DS-160 organises ~330 fields

- **Seed:** `viza-be/agent-backend/scripts/seed-ds160-form-fields.ts` (~3000 lines)
- **Steps:** 18 content pages matching the CEAC page structure
- **Coverage:** every CEAC field must appear in the seed OR be derived from a hardcoded step (no silent gaps — enforced by `ds160-completeness-verify.ts`)

The "one seed per visa type" rule still holds — DS-160 isn't split by
category. All 100+ visa categories answer the same form, which the
gov't filters downstream.

### 9.3 The hybrid approach — hardcoded steps + dynamic form

DS-160 is the only visa in the codebase that uses BOTH:
- **Hardcoded React step components:**
  - `viza-fe/internal-website/components/application-steps/personal-info-step.tsx`
  - `.../passport-step.tsx`
  - `.../travel-info-step.tsx`
- **Dynamic form fields** (same `visa_form_fields` table as everything else)

**Why hybrid?** Three specific reasons:
1. Fields that need bespoke UX (guided date picker, file uploads,
   auto-split of full-name into surname+given-names)
2. Fields pre-filled from `applicant_profiles` with strict validation
   the generic renderer can't express (e.g. passport format varies by
   country and needs inline preview)
3. Review-page logic that wants a typed interface
   (`DS160CompleteIntake` in `viza-fe/internal-website/types/ds160-intake.ts`)

**Rule for a new country:** don't reach for hardcoded steps unless
you have one of those three reasons. The UK package (§10) proved that
pure-dynamic works for a 222-field form. Hardcoded steps fragment
the render path and add maintenance cost.

### 9.4 The normalization layer — `ds160-normalize.ts`

`viza-fe/internal-website/app/actions/ds160-normalize.ts` transforms
answers from the hybrid form into the DS-160 canonical field_name
keys used by the submission service. Three transforms that are
common enough to reuse for other countries:

- **Name splitting** — `fullName → surname + given_names`
  (most passports format as "SURNAME, Given Names" but users type
  "John Smith")
- **Place splitting** — `placeOfBirth → city + state + country`
- **Date decomposition** — `ISO date → day + month + year parts`
  (many gov portals store date components separately)

Plus domain-specific ones (`accommodationAddress → street/city/state/zip`,
length-of-stay derivation from arrival+departure).

If your country's submission requires these transforms, copy the
pattern from `ds160-normalize.ts` — the `flattenPersonalInfo`,
`flattenPassport`, `flattenTravel` functions are self-contained and
easy to adapt.

### 9.5 CEAC autofill alias keys

3 DS-160 field names differ between our seed script and the CEAC
autofill JSON (e.g. `intended_arrival_date` vs `trip_arrival_date`).
Solution: the normalization layer emits both the canonical key and
the CEAC alias. Documented in the US-020 progress entry.

**Takeaway:** when integrating with an external submission system,
expect field-name drift. Plan for alias keys in the normalization
layer rather than renaming fields in the seed (renames break
historical answers).

### 9.6 UI intricacies in `DynamicStepForm` that come from DS-160

Most of the oddities in `viza-fe/internal-website/components/dynamic-step-form.tsx`
exist because DS-160 needs them. If your country doesn't trip these
cases, you can ignore them:

- **Purpose-of-trip auto-lock** (`isPurposeOfTripField`, `findBOptionValue`):
  DS-160 offers 20+ purpose options; VIZA only supports B1/B2 visa
  categories. On the "Purpose of Trip to the U.S." field, the form
  auto-selects the B option and disables the dropdown. Pattern
  applies anywhere the source form has options outside our supported
  scope.

- **LESS_THAN_24_HOURS sibling-disabling** (`isDisabledByLT24`):
  When a trip-duration select is set to "less than 24 hours", the
  paired text field (number of days/weeks/months) is zeroed and
  disabled. DS-160 couples these via `inline_group`. Generic pattern
  whenever a picker value nullifies a companion input.

- **Repeat-group max override** (`REPEAT_GROUP_MAX_OVERRIDES`):
  `specific_travel_plans` is marked repeatable in the seed but
  shouldn't actually repeat (CEAC only takes one). Hardcoded override
  to `max_items: 1`. Better solution would be to fix the seed, but
  this is defensive.

- **Gating toggles** (`gatingToggles`, `GATING_LABEL_PATTERNS`):
  Questions like "Are you part of a group?" hide subsequent
  companion-person fields until answered — even when those fields
  don't have an explicit `conditional_logic.showIf`. Uses label-text
  pattern matching. **Avoid this pattern for new countries** — add
  explicit `showIf` instead of relying on label-text heuristics.

### 9.7 CEAC automation — `viza-be/submission-service/src/ceac/`

**Only DS-160 has automated submission.** The CEAC portal (where
DS-160 is submitted) is a stateful ASP.NET app with CAPTCHA gates,
session tokens, and a multi-page flow. The submission service uses
Playwright to drive it.

Key files and what they do:

| File | Role |
|------|------|
| `session.ts` | Opens a browser session, navigates to CEAC start, holds session state |
| `captcha-solver.ts` | 2captcha v2 JSON API client (createTask + poll), typed errors, refund-on-wrong-answer via `reportBadCaptcha` |
| `start-page-captcha.ts` | Screenshots the start-page image CAPTCHA, sends to 2captcha, types the answer; retry wrapper up to 3 attempts |
| `selectors.ts` | CEAC-specific CSS selectors — splits CAPTCHA selectors into `solvableCaptchaSelectors` (image CAPTCHA → 2captcha) vs `blockingCaptchaSelectors` (reCAPTCHA / hCaptcha / Cloudflare → give up) |
| `gates.ts` | `detectGate` / `assertNoGate` — classifies page state as blocked (GateDetectedError) or clear |
| `orchestrator.ts` | `PAGE_FILL_MAP` — maps each of 18 CEAC pages to a `DS160_MAPPING_GROUPS` entry, fills fields in order |
| `errors.ts` | `GateDetectedError` (CAPTCHA/block) vs `SessionBootstrapError` (browser/network). Drives queue-item classification: `ds160_blocked` vs `ds160_prefill_failed` |
| `stop-at-sign.ts` | Pauses before signing — user handoff boundary (VIZA does not auto-sign and submit; the human finishes) |
| `smoke.ts` | Probe script with `--solve-captcha` flag for manual telemetry runs |
| `pages.ts` | Page-structure helpers (get all DS-160 content pages, detect page ID) |

**Radio-button fill strategy** (US-025 follow-up): The Security
Background pages have 27 yes/no radios per page. Text/select fill
doesn't work — the orchestrator's `fillPageFields` has a dedicated
`radio` branch that clicks the right option by value match.

**Telemetry** (US-026): `captcha-solver.ts` exports
`CaptchaSolveTelemetry` (`solveId`, `durationMs`, `attempt`, `outcome`).
Every solve attempt is recorded in `ceac_result_payload.captchaSolve`.
API keys and solved text are never logged to long-lived storage.

**Stop-at-sign handoff** (US-025 scope): the orchestrator fills every
field but never clicks submit. It stops at the "sign and submit"
boundary so a human reviews and confirms. This is intentional — the
automation is "prefill assistant", not "autonomous submission".

**When you'd need all this:** only if a future country requires
government-portal submission automation AND that portal has a similar
stateful ASP.NET / CAPTCHA pattern. For countries with e-visa APIs
or fully manual submission, skip §9.7 entirely.

### 9.8 Coverage audits — keeping the schema honest

Two scripts keep DS-160 drift from silently shipping:

- `viza-be/submission-service/src/ds160-coverage-audit.ts` — measures
  simplified-form → DS-160 mapping coverage (direct vs lossy vs missing)
- `viza-be/submission-service/src/ds160-completeness-verify.ts` —
  sample payloads for every DS-160 section; asserts 100% coverage of
  the CEAC autofill-mapped keys

**Adopt for any country with automated submission.** For countries
with manual submission, the reviewer checklist (§7) is enough.

### 9.9 CEAC live-portal gotchas (2026-04-25 deep dive)

A full end-to-end run against live CEAC surfaced behaviour that is
not visible from reading the form in isolation. If you are extending
the submission pipeline (or building a similar one for another
country), the following are the things that cost a lot of time to
discover. Documenting here so the next person doesn't repeat them.

**Photo upload is on a different domain (identix.state.gov)**
Clicking CEAC's `btnUploadPhoto` is a form submit that navigates
*cross-domain* to `https://identix.state.gov/qotw/Upload.aspx?<token>`
— a separate ASP.NET system that hosts the actual `<input type="file">`.
After upload + face detection, identix's `Result.aspx` page renders
either an accept (`btnContinue`) or reject (`btnUploadAnother`)
button, and clicking the accept redirects back to CEAC's confirm
photo page with a `?save` query param.

There is **no `<input type="file">` anywhere on the CEAC photo
upload page itself** — searching the DOM for one returns zero
results. Relying on Playwright's `filechooser` event or
`setInputFiles` against the CEAC origin will time out. The handler
must drive the cross-domain dance.

**ASP.NET `<input type="image">` buttons need `name.x` / `name.y`
form fields**
Identix's submit buttons are image inputs (`<input type="image"
class="next">`). When the browser submits the form via a real click,
it includes hidden `<name>.x` and `<name>.y` form fields with the
click coordinates — that is how ASP.NET knows which image button
was pressed. Three traps:

1. `el.click()` via `page.evaluate` does NOT add x/y for image
   inputs in headless Chromium. The form posts but ASP.NET ignores
   the click (server thinks no button was pressed).
2. Playwright's native `click({ force: true })` sends real coords,
   but `force: true` does **not** bypass viewport bounds — clicks on
   buttons below the viewport fail with `Element is outside of the
   viewport` even after `scrollIntoView`.
3. Setting a tall viewport via `page.setViewportSize({ width: 1280,
   height: 1600 })` sometimes still leaves the buttons off-screen
   if the page layout was computed against the original viewport.

The reliable workaround for image-input submission is to bypass
the click entirely and submit the form directly:

```ts
await page.evaluate(`
  const btn = document.querySelector('#ctl00_cphButtons_btnContinue');
  const form = btn.closest('form');
  ['x', 'y'].forEach(c => {
    const inp = document.createElement('input');
    inp.type = 'hidden';
    inp.name = btn.name + '.' + c;
    inp.value = '5';
    form.appendChild(inp);
  });
  form.submit();
`);
```

This is what `viza-be/submission-service/src/ceac/upload-photo.ts`
does for the identix `btnContinue` button.

**Confirm Photo page has no Next button — advance via sidebar**
After photo upload identix returns to
`photo_confirmphoto.aspx?node=ConfirmPhoto&save`. That page renders
only Back, Save, and "Choose a Different Photo" — there is no Next
button at all. Clicking Save goes to a "Save Confirmation"
interstitial whose "Continue Application" button just returns to
where you were (loops forever).

The actual advance mechanism is the **sidebar**: the REVIEW link
(`<a id="REVIEW" href="/GenNIV/General/review/review_reviewpersonal.aspx?node=ReviewPersonal">`)
is `disabled="true"` while `?save` is in the URL. Navigating to the
canonical Confirm Photo URL (without `?save`) re-renders the page,
which enables REVIEW. Then `page.goto(reviewUrl)` advances.

**Review is a chain of sub-pages, not a single page**
Once you reach `/review/review_reviewpersonal.aspx`, CEAC takes you
through ~7 read-only review sub-pages
(`review_reviewpersonal`, `review_reviewtravel`, `review_reviewUSContact`,
`review_reviewFamily`, `review_reviewWorkEducation`,
`review_reviewsecurity`, `review_reviewlocation`) each with its own
Next button, all under `/review/review_*` URLs. The orchestrator
must accept staying on `review` across sub-pages until
`sign_and_submit` appears.

**Heading-based page detection is unreliable for Review pages**
Each review sub-page reuses the original section's heading:
`review_reviewpersonal` has heading "Personal, Address, Phone, and
Passport Information" — which matches the `passport` heading
pattern. URL-based detection must take precedence for any page
under `/review/review_*`. `pages.ts` codifies this with a URL-first
override before the heading-pattern loop.

**Sign Certify precedes the actual Sign and Submit**
The first page after Review is
`signtheapplication.aspx?node=SignCertify` — an attestation step
that does NOT have the passport-signature input or the final-submit
button. Strict marker checks
(`signatureFieldPresent && finalSubmitPresent`) will fail here. But
this **is** the right terminal stop for `handoff_ready`: going
beyond requires user attestation. The orchestrator's sign-and-submit
branch treats heading + URL match as sufficient, even when strict
markers are absent.

**`isEditable()` matters in addition to `isVisible()`**
Some CEAC fields (e.g. `social_media_identifier`) are present and
visible in the DOM but disabled when their sibling dropdown is set
to "NONE". Without `isEditable()`, the orchestrator burns the full
5s actionability timeout per field on every page.

**MSAJAX UpdatePanel postbacks**
Most CEAC controls (radios, AutoPostBack selects, NA checkboxes)
fire a partial postback that reveals or enables dependent fields.
Polling `Sys.WebForms.PageRequestManager.isInAsyncPostBack` returns
false BEFORE the postback dispatches and produces false positives.
The reliable wait is to subscribe to `add_endRequest` (one-shot)
and resolve when it fires:

```ts
await page.evaluate(`
  new Promise((resolve) => {
    const prm = Sys.WebForms.PageRequestManager.getInstance();
    const handler = () => { prm.remove_endRequest(handler); resolve(); };
    prm.add_endRequest(handler);
  })
`);
```

`viza-be/submission-service/src/ceac/aspnet.ts` has the production
version with timeout + bail-out.

**2captcha "Normal Captcha" — submit raw text, do not uppercase**
CEAC's BotDetect CAPTCHA is case-sensitive. 2captcha returns the
answer in the original case. `.toUpperCase()` on the response
silently breaks ~70% of solves with no error code (CEAC just
re-renders an error and you retry on a fresh image, burning
solver budget).

**Anti-bot SessionTimedOut on the START button**
Even with stealth + a correct CAPTCHA, CEAC sometimes redirects
the START click to `SessionTimedOut.aspx` as an anti-bot signal.
There is no recovery for the same browser context — bootstrap a
fresh one and retry. Quadratic backoff between attempts (5s, 20s,
45s, 80s, 125s) handles transient IP rate-limits without flooding.

**Idle session expiry is a separate failure mode (~10 min)**
Distinct from the start-page anti-bot timeout. After ~10 minutes
of idle CEAC drops the session and any Next click redirects to
`SessionTimedOut.aspx`. Recovery is via the Retrieve Application
form (Application ID + first 5 letters of surname + year of birth +
security answer) — all four must be persisted at start time. See
`resume-application.ts` and `rebuildSessionForResume` in `session.ts`.

**Synthetic faces from `thispersondoesnotexist.com` pass photo QA**
Useful for end-to-end tests without checking in a real face. CEAC's
photo quality check requires 600x600 JPEG, < 240 KB, head centered,
neutral background — a downloaded synthetic face resized via
`sips -z 600 600 ... -s formatOptions 80` lands at ~78 KB and
passes face detection.

### 9.10 Patterns that exist because CEAC is weird (not because they're good)

DS-160 is the canonical reference, but some of its patterns are
battle-scars from CEAC's own quirks. Adopt them only if your country
has the same quirk:

- **Label-text pattern matching** for gating toggles
  (`GATING_LABEL_PATTERNS` in `dynamic-step-form.tsx`) — fragile to
  label changes. DS-160 needs this because early seed entries lacked
  explicit `conditional_logic`; for a new country, always use explicit
  `showIf`.
- **Hardcoded React steps** — reach for them only for the three
  reasons in §9.3. Pure-dynamic works fine up to 222 fields (see §10).
- **`REPEAT_GROUP_MAX_OVERRIDES` client-side patch** — `specific_travel_plans`
  is overridden to `max_items: 1` because CEAC only accepts one. Fix
  the seed instead of adding new client-side overrides.
- **Lossy field mappings** — DS-160 initially had 20 lossy mappings
  (`full_name → surname + given_names` etc.). That's a normalization
  layer, not a schema pattern. Don't design a schema that requires
  lossy compression — split at the source.

**The rule:** if your country needs something DS-160 has for a
reason that applies to your country too, copy it. If DS-160 has it
because CEAC is weird, skip it.

---

## 10. Second example — UK Standard Visitor (pure-dynamic, not yet live-QA'd)

**Caveat up front:** UK Standard Visitor is a high-fidelity
**reconstruction** from public UK Home Office guidance (visit
caseworker PDFs, supporting-document guides, Immigration Rules
Appendix V). It has **NOT been QA'd end-to-end against the live
Access UK form** — that form is behind an identity gate and cannot
be driven by automated tools. Expect drift; re-validate quarterly.

Despite that, UK is a useful second data point because it exercises
a different pipeline shape:
- **Pure-dynamic rendering** (no hardcoded React steps)
- **No submission automation** (no Playwright, no CAPTCHA handling,
  no gov-portal integration)
- **Single database layer** — answers land in `visa_application_answers`
  and the story ends there

If your new country looks like that (most e-visa / manual-submission
countries do), UK is the pattern to copy. If it needs submission
automation, follow §9 instead.

### Deliverables

- **Scope doc:** `docs/uk-visa-scope.md` — pins the canonical journey,
  lists official source URLs, declares the scope contract, documents
  known source-flow ambiguities. Template for step 1–2.
- **Seed:** `viza-be/agent-backend/scripts/seed-uk-standard-visitor-form-fields.ts`
  — 222 fields, 12 steps, 11 purposes. Template for step 5.
- **Migration:** `viza-be/agent-backend/drizzle/0010_uk_standard_visitor_package.sql`
  — idempotent `INSERT ... ON CONFLICT DO NOTHING`. Template for step 6.
- **Gap report:** `docs/uk-visa-gap-report.md` — coverage summary,
  remaining limitations (with the *why*), conditional-logic status,
  reviewer checklist. Template for step 10.

### Build history

**Phase 1 — initial scope (2026-04-23, user stories UK-001 through UK-005):**
- UK-001 pinned the canonical journey (Standard Visitor via Access UK)
- UK-002 built the first seed (108 → 130 fields, 11 steps)
- UK-003 registered the package via migration 0010
- UK-004 wrote the gap report with 8 known gaps + 2 flagged conditional-logic risks
- UK-005 published the expansion roadmap (scope doc §8: Immediate / v1.1 / v2)

**Phase 2 — full parity pass (2026-04-24):**
- Verified UK-005 Immediate #1: `||` operator works
- Resolved UK-005 Immediate #2: cross-step conditional was broken; fixed
  by seeding `DynamicStepForm` values state from full `prefill`
- Expanded the schema from 130 → 222 fields (11 → 12 steps), closing
  the v1.1 and most v2 items: all purpose sub-journeys (business,
  study, medical, transit, marriage, PPE, academic 12m, organ donor,
  clinical training), previous UK visits repeatable, dependants,
  under-18 applicant fields, structured travel history, BRP, national
  ID, civil penalty, public funds, immigration-law breach,
  user-declared TB test

**Still open** (tracked in `docs/uk-visa-gap-report.md` §3):
- Dependants spawning workflow (schema captures, but separate-application
  creation isn't automated)
- Nationality-based TB test auto-gating (needs `in` operator in
  `evaluateShowIf`)
- **Live-portal QA pass** — schema has not been walked against the
  real Access UK form

### Country-level rule of thumb

If the country has an umbrella visa like UK Standard Visitor (one
product covering tourism + business + study + medical + etc.), expect
~200+ fields, ~12 steps, and a heavy Step 8 of purpose-specific
sub-journeys. If it's a single-purpose form (pure tourist e-visa with
no branches), expect ~50–80 fields, ~6–8 steps, mostly same-step
conditionals. Scope accordingly.

**When in doubt, look at how DS-160 does it (§9) — it's the tested
one.**

---

## 11. Third example — France-Visas (Schengen Type C, JSF/PrimeFaces, live-QA'd 2026-04-25)

The France-Visas implementation
(`viza-be/submission-service/src/france-visas/`) is the second pipeline
that has been QA'd end-to-end against a live government portal. The
two portals are completely different stacks (CEAC = ASP.NET WebForms;
France-Visas = Jakarta Faces + PrimeFaces) so almost everything in §9
needed a parallel implementation. The findings below are what was
non-obvious from outside.

### 11.1 Where the pipeline starts and stops (deliberate scope)

Identical contract to DS-160: **prefill assistant, not autonomous
submission.** The runner stops after the in-progress CERFA PDF has
been downloaded. It does NOT click the post-form transmission chain
(`accueil → phase2 → phase3`) because **phase 3 requires the applicant
to certify they have already booked a biometrics appointment at their
visa center** — a fact-attestation to the French government, not a
click that automation can honestly fire. Once an applicant has booked
biometrics with VFS Global / TLScontact / BLS, they finish the
transmission flow themselves. This stop boundary mirrors DS-160's
"stop at sign-and-submit".

### 11.2 The Schengen visa is multilateral but each country runs its
own portal

Schengen Type C visas are issued under the harmonized EU Visa Code
(Regulation 810/2009, Annex I). The seed
(`viza-be/agent-backend/scripts/seed-eu-schengen-c-short-stay-form-fields.ts`)
is the harmonized field set — accepted by all 29 Schengen states. But
each member state runs its own application portal: France-Visas,
Germany's VIDEX, Spain's Sede Electrónica, Netherlands' VisaRIO, and
several others. **The same answers can be sent to any of them with a
country-specific normalizer + autofiller.** France-Visas is the first
worked example; the same harmonized seed + a `germany-visa/`,
`spain-visa/` set of selectors would cover the others.

This is different from the US/UK, which each have one government
portal per visa type.

### 11.3 The 6-step France-Visas form vs the 12-section harmonized seed

France-Visas consolidates the 12 logical Annex I sections into 6 form
steps:

| FR step | URL | What it covers |
|---|---|---|
| 1 | `step1.xhtml` "Your plans" | Eligibility triage — nationality, travel doc, purpose, destination, deposit country/town |
| 2 | `step2.xhtml` "Your information" | Personal + residence + occupation + (conditional) employer |
| 3 | `step3.xhtml` "Your last visa" | Prior Schengen visa gate + (conditional) dates + fingerprints |
| 4 | `step4.xhtml` "Your stay" | Trip dates, duration, entries |
| 5 | `step5.xhtml` "Your contacts" | Host person/org + funding sources + representative |
| 6 | `step6.xhtml` "Your supporting documents" | Informational checklist (no inputs) |

So `FvPageId` only enumerates step1-step6 + accueil + review/confirmation
(not step1-step12). The normalizer
(`viza-be/submission-service/src/france-visas/normalize.ts`) maps the
seed's flat field map to FR's 6-step structure.

**Naming collision to be aware of:** `visas-selected-applicant-country_input`
appears on BOTH step 2 (country of residence, 201 options) AND step 4
(number of entries, 2 options `1`/`M`). Same `name` attribute, different
semantics depending on step. Selectors must always be qualified by step.

### 11.4 JSF / PrimeFaces specifics — how to drive cascading selects

France-Visas is built on Jakarta Faces with PrimeFaces widgets. Setting
`<select>.value` and dispatching a synthetic `change` event does **not**
trigger the JSF AJAX postback that rebuilds dependent dropdowns. The
working pattern (codified in
`viza-be/submission-service/src/france-visas/primefaces-ajax.ts`):

```ts
window.PrimeFaces.widgets[widgetVar].selectValue(value);
window.PrimeFaces.widgets[widgetVar].triggerChange();
```

Then `await page.waitForResponse(<step-url POST>)` to ensure the
postback completes before the next select is fired.

**Cascading postbacks clear unrelated fields.** Step 1's selects fire
in this order: nationality → deposit-country → stayDuration → destination
→ deposit-town → authority → travel-document → purposeCategory → purpose.
Any postback in this chain can blank a previously-set select. The
defensive fix in `fill-steps.ts` is `reapplyClearedSelects()`, which
iterates up to 3 passes re-firing any select that's no longer at its
target. **Text fields are filled LAST** for the same reason (postbacks
also clear text inputs, observed in step 2 — server even auto-uppercases
text values, so `"Zhang"` becomes `"ZHANG"` on the wire).

**Conditional widgets aren't registered until the gate fires AND the
postback completes AND PrimeFaces re-runs widget bootstrap** (which is
async). Calling `selectPrimeFacesOption` immediately after the gate
choice fails with "widget not found". The fix is `waitForPrimeFacesWidget`
in `primefaces-ajax.ts` — polls `PrimeFaces.widgets[<var>]` for up to
5s before firing.

### 11.5 CAPTCHA — `Captchetat` is much simpler than CEAC's BotDetect

France-Visas uses the French government's standard CAPTCHA service
(Captchetat). Critically, the image is served as an inline
`data:image/png;base64,…` URL — **no HTTP fetch needed**. Read `src`,
base64-decode, send to 2captcha. No canvas dance, no cache-poisoning
risk, no naturalWidth race. See
`viza-be/submission-service/src/france-visas/registration-captcha.ts`.

There's a hidden `captchetat-uuid` companion field on the form that
ties the image to the server-side validator. It must NOT be cleared
between read and submit — the implementation reads `src` once and
leaves the DOM untouched.

### 11.6 Headless detection is real — needed a per-call hardening
profile

The first end-to-end smoke run worked headful but failed headless
with a `/login-error` redirect from Keycloak. The standard
`puppeteer-extra-plugin-stealth` patches were insufficient.
`stealth-browser.ts` was extended with a per-call
`hardening: "default" | "france-visas"` opt-in. CEAC continues to
use `"default"`; France-Visas uses `"france-visas"` which adds:

- Chromium launch flags: `--disable-blink-features=AutomationControlled`,
  `--window-size=1440,900`, `--no-default-browser-check`,
  `--disable-features=IsolateOrigins,site-per-process`, etc.
- Browser context: `viewport: 1440×900`, `locale: en-US`,
  `timezoneId: Europe/Paris`
- `addInitScript` overriding `navigator.webdriver`, `navigator.languages`,
  `hardwareConcurrency`, `deviceMemory`, `platform`, `permissions.query`,
  and a realistic `navigator.plugins` list

After hardening, headless smoke runs pass. **For any other Schengen
country portal that uses Keycloak (most do), reach for this profile
first.**

### 11.7 Step-1 button shape: Verify → Next → Yes/No modal

A non-obvious 3-stage transition. Step 1's submit button starts as
"Verify" (eligibility check). After server-side validation passes,
the button **swaps** to "Next". Clicking Next then opens a Yes/No
confirmation modal ("Save your application and proceed?"). Clicking
Yes advances to step 2.

Naïve "click the next button once" doesn't work. The fix in `run.ts`
is a polling-loop `advanceStep()` that on each tick clicks any visible
Yes button OR any visible Next/Verify/Continue button, and waits until
the destination page identity is detected. Same loop covers all 3
shapes (single Next, Verify→Next, Continue) without per-step branching.

### 11.8 Conditional reveal patterns (occupation → employer, etc.)

France-Visas uses conditional reveals heavily. Three notable ones:

- **Step 2 occupation → employer subsection:** picking most occupation
  values (e.g. Employee=`69002`) reveals 7 employer fields (name,
  address, phone, email, business segment, country). These don't
  exist in the DOM until the occupation cascade fires.
- **Step 5 cbxHasHostPerson → 8 host fields.** Same pattern.
- **Step 5 cbxHasAutoFunding → `autoFundings` multi-checkbox group**
  (Cash, Credit card, Traveller's cheques, Accommodation prepaid,
  Transport prepaid, Other).

The seed expresses the gate-and-reveal relationships via
`conditional_logic.showIf`. The fill helpers (`fill-steps.ts`) check
the gating answer and only fire the conditional fields when needed.
**Filling a conditional field whose gate is closed is a no-op** because
the widget isn't registered — but it fails noisily, so always check
the gate first.

### 11.9 Two PDF surfaces — pick the in-progress one for prefill-only

After step 6 the accueil dashboard shows two PDF buttons per
application:

- **"Read pdf application in progress"** — available immediately on
  every draft. Returns the CERFA Schengen visa form (~200 KB PDF v1.6)
  prefilled with the applicant's data.
- **"Read pdf completed application"** — only available after the
  applicant has completed the post-form transmission chain
  (accueil → phase2 → phase3). Same form, with a "submitted to
  consulate" stamp.

For the prefill autofiller, **use the in-progress PDF** (no transmission
needed). The applicant takes that PDF to their VAC appointment and
France-Visas updates the "completed" PDF later. See
`accueil.ts` `finalizeAndDownloadPdf()` for the click + download
capture.

### 11.10 Reference format — `FRA1PE20267040641`

The reference France-Visas assigns after step 6 saves: 3-letter
country code (`FRA`) + 3-character city/consulate code (`1PE` =
Beijing) + sequential id. **This is what applicants quote to the
consulate and the VAC**, not the 13-digit internal ID
(`2026705144836`) that's also visible.

Both are captured in the run result so the queue worker can persist
either.

### 11.11 Country-code mapping (ISO-2 ↔ ISO-3)

The harmonized seed uses ISO-3166-1 alpha-2 codes (`CN`, `FR`, `US`).
France-Visas uses alpha-3 (`CHN`, `FRA`, `USA`). The normalizer
(`normalize.ts`) embeds a 200-entry alpha-2 → alpha-3 table and
accepts alpha-3 input as a pass-through. **Reject unknown codes
loudly** rather than guessing — a wrong country code on the wire is
a hard rejection at the consulate.

### 11.12 Schema gaps the FR walk surfaced (now fixed in seed)

Three Annex I fields the original seed didn't have, that FR's step 3
"Your last visa" Yes-path requires. Added in 0011 follow-up:

- `prior_schengen_visa_5y` (radio gate)
- `prior_schengen_visa_valid_from` / `_to` (dates, conditional)

Pre-existing fields (`prev_schengen_fingerprints_given`,
`prev_fingerprints_date`, `prev_fingerprints_visa_sticker`) cover the
fingerprints sub-branch.

**Lesson:** when integrating a country portal with a harmonized seed,
expect the country to ask 1-3 fields the harmonized form skips. Add
them to the seed only if they're legitimately Annex I (or the
harmonized equivalent for your visa class) — otherwise they belong in
a `<country>_*` overrides namespace, not the canonical schema.

### 11.13 Country-specific fields not in harmonized seed — `fv_*` prefix
convention

A few France-Visas-specific questions don't map to harmonized Annex I:

- "Do you have a French family member?" (step 2 — distinct from "EU
  family member")
- "Will you travel to multiple Schengen destinations?" (step 4)
- The deposit-country / deposit-town / specific purpose codes (step 1)

The frontend collects these under `fv_*` prefixed seed keys
(`fv_has_french_family`, `fv_has_multiple_destinations`,
`fv_deposit_country`, `fv_deposit_town`, `fv_purpose`,
`fv_occupation_code`, `fv_business_segment`). The normalizer reads
them; they default to safe values if absent. **Do this for every
country portal that adds non-harmonized questions** — keep the seed
canonical, namespace country-specific overrides per portal.

### 11.14 Critical files (mirrors §9.7)

| File | Role |
|---|---|
| `france-visas/sign-in.ts` | Keycloak login + `restoreFvSession` from stored storageState |
| `france-visas/registration.ts` | Keycloak account registration (CAPTCHA + mailbox provider) — needs Resend/Mailgun/IMAP wired before production |
| `france-visas/primefaces-ajax.ts` | `selectPrimeFacesOption`, `setJsfTextInput`, `setJsfCheckbox{,Group}`, `selectPrimeFacesRadio`, `waitForPrimeFacesWidget`, `waitForJsfIdle` |
| `france-visas/fill-steps.ts` | `fillStep1`–`fillStep5` with cascade re-fill; step 6 is informational so no fillStep6 |
| `france-visas/run.ts` | `fillFranceVisasApplication` — top-level entry, polling-loop advance, optional finalize+PDF |
| `france-visas/accueil.ts` | `startNewApplication` + `finalizeAndDownloadPdf` (PDF download stop point) |
| `france-visas/selectors.ts` | `FV_STEP1_FIELDS` … `FV_STEP5_FIELDS`, taxonomy enums, gate markers |
| `france-visas/normalize.ts` | Seed answer map → FV wire format. ISO-2/3 country, sex/civil-status/occupation/purpose enums. |
| `france-visas/errors.ts` | `FvError` taxonomy parallel to CEAC's |
| `france-visas/inbox-poller.ts` | `MailboxProvider` interface for verification-email link extraction |

### 11.15 Iteration history (2026-04-24/25 walks)

The full walk took ~10 iterations against the live site to converge.
Headline failures and their fixes, in case any of them recur for
another country:

1. **PrimeFaces selectValue alone doesn't trigger AJAX** → use
   `selectValue + triggerChange`.
2. **Cascading postbacks clear upstream selects** → defensive
   re-apply pass after the cascade settles.
3. **Conditional widgets race PrimeFaces bootstrap** → poll
   `PrimeFaces.widgets[<var>]` until registered.
4. **Step 1 needs 3-stage transition (Verify → Next → Yes-modal)** →
   polling-loop advance.
5. **Headless triggered Keycloak `/login-error` redirect** →
   per-call stealth hardening profile.
6. **Schengen seed lacked prior-visa gate + dates** → added 3 fields
   to seed (legitimate Annex I).
7. **Continue button on accueil was disabled by default** → consent
   checkbox (`j_idt182_input`) must be ticked via PrimeFaces widget
   API first.
8. **Phase 3 transmission requires an attestation we can't honestly
   automate** → stop at the in-progress PDF download instead.

If your next country portal exhibits any of (1)–(5), the fixes
generalize. (6) is country-specific. (7)–(8) are France-specific
flow gates — for other Schengen portals, identify the analogous
stop boundary before automating.


---

## 12. Lessons from real-portal integrations

These came out of the Schengen seed + France-Visas walk + UK Standard
Visitor scaffold + Vietnam recon work in 2026-Q1/Q2. Drop-in rules to
follow before you build a new country runner.

### 12.1 Portal step count rarely matches your harmonized schema

France-Visas runs 6 steps; Annex I (the harmonized Schengen field set)
is 12. Don't force step parity — map fields bidirectionally and keep
both representations. The portal's section labels are presentation
metadata, not the schema's structural axis.

_Source: `docs/france-visas-walk-report.md` Section 9._

### 12.2 Field-name collisions across steps cause silent
fill-the-wrong-field bugs

The same name (e.g. `visas-selected-applicant-country_input`) appears on
multiple steps with different meaning. Always key field identity by
`(step_number, field_name)` — never on `field_name` alone. The seed
schema already uses this composite key; runners must too.

_Source: `docs/france-visas-walk-report.md` Section 9._

### 12.3 Use a starred-field post-processor for beneficiary-class
optionality

Hand-seeding `required_unless` on 40+ fields scales poorly. One
`STARRED_FIELD_NAMES` Set in the seed script centralizes the rule and
makes the optionality logic auditable in one place. New countries with
similar "fields-marked-optional-for-class-X" patterns should reuse the
pattern.

_Source: `viza-be/agent-backend/scripts/seed-eu-schengen-c-short-stay-form-fields.ts`._

### 12.4 One `purpose_of_journey` master gate beats N visa products

Tourism / business / study / family / medical etc. share most fields —
multiplex via conditional sub-branches under one product. `IS_TOURISM`,
`IS_BUSINESS` etc. as derived booleans on top of a single
`purpose_of_journey` field. Avoid forking the seed into N separate
products.

_Source: `docs/schengen-visa-scope.md` (10 purpose options) + the seed's
`IS_TOURISM` / `IS_BUSINESS` disjunctions._

### 12.5 JSF/PrimeFaces portals need portal-specific orchestration

Cascading selects don't auto-fire change events; text fields uppercase
on blur; widget registration must precede AJAX postback. Generic
Playwright form-fill fails. Wire portal-specific helpers (e.g.
`selectPrimeFacesOption`, `setJsfTextInput`, `selectPrimeFacesRadio`,
`waitForJsfIdle`) before any per-step fill code.

_Source: `docs/france-visas-walk-report.md` Section 8._

### 12.6 Repeatable + block groups need explicit grouping metadata

`validation_rules` must include `repeat_group` and `block_group` so
orchestrators render multi-entry sections (companions, prior visas,
work history) correctly. Without these, the runner can't tell a single
field from a group instance.

_Source: `validation_rules` patterns in
`seed-eu-schengen-c-short-stay-form-fields.ts`._

### 12.7 Walk before you map (added 2026-04)

Every new country runner must produce a walk-report
(`docs/<country>-walk-report.md`) generated from a Playwright recon
script, before the seed is finalized. Skipping this step costs 5–10×
more iteration than running the recon once. Pattern in
`viza-be/submission-service/scripts/walk-uk-portal.ts` and
`viza-be/submission-service/src/vietnam/form-recon-v3.ts`.
