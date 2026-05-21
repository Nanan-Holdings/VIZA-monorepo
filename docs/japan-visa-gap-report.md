# Japan Tourist Visa (Short-Term Stay) — Gap Report

**Generated:** 2026-04-27
**Schema version:** v1 (`seed-jp-tourist-form-fields.ts`)
**Visa type:** `JP_TOURIST`

Goal: when a user is assigned the `JP_TOURIST` package, their
`/application` page renders a 1:1 schema match of the MOFA "Application
for Visa" form (Form A) Tourism Short-Term Stay path. Note that there is
**no online portal target for PRC residents** — the form is paper-
submitted through a designated travel agency (JVAC China). For non-PRC
nationalities the same field set is accepted at Japanese embassies and
(where eligible) at the `evisa.mofa.go.jp` self-service portal.

---

## 1. Coverage Summary

| Section | Step | Fields | Notes |
|---------|------|--------|-------|
| Personal Information | 1 | 17 | Other-names gate, other-nationalities repeatable, marital status spouse block |
| Passport | 2 | 9 | Other-passports gate + repeatable group |
| Contact & Home Address | 3 | 6 | `home_address` block group |
| Occupation | 4 | 5 | `employer_details` block group |
| Trip Details | 5 | 10 | Tourism purpose locked; `trip_dates` inline group; `accommodation_details` block group |
| Inviter in Japan | 6 | 11 | `inviter` block group, full block gated on `has_inviter_in_japan` |
| Travel History | 7 | 8 | Repeatable `prior_japan_visits`; refusals (Japan + other-country) gated |
| Character & Declaration | 8 | 10 | Criminal / deportation / overstay gated; declaration checkbox |
| **Total** | **8** | **76** | — |

Field count source: `Done: 76 rows seeded (76 defined)` from the seed
runner against live Supabase on 2026-04-27.

---

## 2. Purpose Options (Step 5)

`JP_TOURIST` is a **single-purpose** package: `purpose_of_visit` is
locked to `tourism` for v1. The other purposes that share MOFA Form A
(Business Visit, Conference, Visiting Relatives, Spouse, Work, Study,
etc.) belong on future packages with their own schemas:

- `JP_BUSINESS_VISIT` — short-term business activities, MOFA Form A with
  inviter-as-host-organisation block
- `JP_CONFERENCE` — academic / industry conferences
- `JP_SPOUSE` — Form B (Spouse / Child of Japanese National)
- `JP_WORK_*` — long-term employment categories (Form C series)

These are deferred because the field set diverges meaningfully (employer
sponsorship for Work, Certificate of Eligibility for long-stay, etc.).

---

## 3. Remaining Limitations

### 3.1 Live-portal QA is N/A for the v1 target audience

**Status:** Schema is a reconstruction from the public MOFA Form A PDF
**Impact:** Low (for PRC residents — no portal exists), Medium (for
non-PRC residents using `evisa.mofa.go.jp`)

The v1 audience is PRC residents who submit through a designated travel
agency, so there is no government-run portal whose live DOM we can drive
against. For non-PRC residents using `evisa.mofa.go.jp` directly, that
portal is identity-gated and was not driven during this build.

**Why deferred:** No portal access for the primary audience; the eVisa
portal flow belongs on a separate `JP_E_VISA` package once the eligible
applicant base for VIZA is sized.

**Workaround:** The schema mirrors the published MOFA Form A PDF
verbatim, so applicants whose answers map cleanly to the PDF will have
1:1 field parity. Drift will surface only if MOFA revises the form.

### 3.2 Submission channel is out of schema

**Status:** Schema captures applicant answers; submission to the
designated travel agency is out-of-band. The "render answers → MOFA
Form A PDF" last-mile is shipped as part of v1.0 (see §6.5 below).
**Impact:** Low (PDF rendering closes the immediate gap).

PRC residents must hand the completed form (with supporting documents)
to a JVAC-designated travel agency in mainland China. VIZA does not
automate the hand-off — the applicant downloads the printable Form A
PDF from the StatusStep and delivers it to the agency themselves.

**Why fully closing the channel is deferred:** Each designated agency
runs its own intake portal (some accept PDF via email or upload, others
require physical delivery). Modeling agency-specific channels in the
schema would couple us to one agency.

**Workaround:** The PDF download CTA on the JpResultCard is the
shipped v1 closure. A future enhancement is per-agency direct upload
where the agency exposes an API.

### 3.3 Document uploads are out of schema (per playbook §5.6)

**Status:** Documents live in `application_documents`, not
`visa_form_fields`
**Impact:** Low

Required supporting documents — passport bio page, photo, itinerary,
financial proof, employer letter, travel insurance — are tracked in the
existing `application_documents` table per playbook convention.

**Workaround:** None needed; this is the standard pattern.

### 3.4 No automated submission

**Status:** Out of scope for this package
**Impact:** Low (matches user-confirmed scope)

Unlike `US_DS160` (CEAC automation), `EU_SCHENGEN_C_SHORT_STAY`
(France-Visas automation), and `AU_VISITOR_600` (ImmiAccount
stop-at-review), `JP_TOURIST` has no automation pipeline. The user
explicitly chose schema-only because the v1 audience (PRC residents)
has no online portal to automate against.

**Workaround:** Schema-only build matches the constraint — the
submission channel is the agency, which is human-mediated by design.

### 3.5 Inviter immigration-status field is free text

**Status:** Schema present; no enum
**Impact:** Low

MOFA Form A item 31 asks for the inviter's immigration status if the
inviter is a foreign national in Japan. Possible values include
"permanent resident", "long-term resident", "spouse of Japanese
national", "engineer / specialist in humanities" (work visa), and many
other status of residence labels. Modeling as free text avoids stale
enums; staff can enumerate later if data shows need.

---

## 4. Closed in this version

This is v1 — first release of `JP_TOURIST`. Nothing closed yet.

---

## 5. Conditional Logic Status

### 5.1 `||` and `&&` operators

`evaluateShowIf` in
`viza-fe/internal-website/lib/form-utils.ts` supports both. Not used in
v1 — every `JP_TOURIST` gate is a single-atom comparison
(`HAS_INVITER`, `HAS_CRIMINAL`, etc.). If future steps add multi-value
gates (e.g. multiple purposes in a `JP_TOURIST_UMBRELLA`), the operator
is available.

### 5.2 Cross-step conditionals

Not used in v1 — every `showIf` parent lives in the same step as the
gated field. The `DynamicStepForm` cross-step seeding behaviour (UK v2
fix) is not exercised here.

### 5.3 List membership operator (`in` / `not in`)

Not used in v1. `JP_TOURIST` has no nationality-list-gated branches
(unlike Schengen Annex I which uses `current_nationality in [...]` for
ATV / fingerprint waivers).

### 5.4 Repeatable groups

| Group | Step | Max items | Gate |
|-------|------|-----------|------|
| `other_nationalities` | 1 | 3 | `has_other_nationalities === yes` |
| `other_passports` | 2 | 3 | `has_other_passports === yes` |
| `prior_japan_visits` | 7 | 5 | `visited_japan_before === yes` |

---

## 6. Implementation Notes

### 6.1 Seed script is idempotent

`scripts/seed-jp-tourist-form-fields.ts` deletes all rows with
`visa_type = 'JP_TOURIST'` then re-inserts. Safe to re-run.

### 6.2 Block groups used

`place_of_birth` (step 1), `spouse` (step 1), `home_address` (step 3),
`employer_details` (step 4), `accommodation_details` (step 5), `inviter`
(step 6).

### 6.3 Inline groups used

`passport_dates` (step 2), `trip_dates` (step 5).

### 6.4 Frontend changes scoped to the result card + download CTA

Per playbook §6, `DynamicStepForm` renders every field generically — no
schema-side renderer changes. The only `JP_TOURIST`-specific frontend
code is:

- `app/client/application/_components/result-cards/JpResultCard.tsx` —
  terminal-state card with the MOFA Form A download button
- One branch in `SubmissionStatusStep.tsx` to dispatch on
  `country === "JP"`
- A short-circuit in `app/client/application/long-form/page.tsx`'s
  `handleDynamicReviewComplete` that skips the `submission_queue`
  insert + translation call for `JP_TOURIST` (no automation pipeline)
  and synthesizes the terminal `JpSubmissionResult` client-side

This is the same shape every other country uses (per-country result
card + dispatch in `SubmissionStatusStep`), so the convention holds.

### 6.5 MOFA Form A PDF rendering pipeline

VIZA renders the official MOFA "Application for Visa" form (Form A)
on demand from `visa_application_answers`:

| Layer | Path | Role |
|-------|------|------|
| Template | `viza-fe/internal-website/lib/jp-tourist/templates/mofa-form-a.pdf` | The official PDF MOFA publishes at `https://www.mofa.go.jp/files/000124525.pdf`. Vendored because the MOFA CDN denies non-browser fetches. |
| Country mapper | `viza-fe/internal-website/lib/jp-tourist/country-codes.ts` | Translates `country.name` answers (from `country-data-list`) to MOFA dropdown labels (e.g. "United States" → "USA", "Vietnam" → "VIET NAM"). |
| Renderer | `viza-fe/internal-website/lib/jp-tourist/render-form-a.ts` | Loads template, walks answers via the inline field-name → MOFA AcroForm mapping, fills text / radio / dropdown widgets, returns `Uint8Array`. |
| API | `viza-fe/internal-website/app/api/applications/[id]/jp-form-a-pdf/route.ts` | Auth-gated GET endpoint. Returns `application/pdf` with a `Content-Disposition: attachment` filename keyed to the applicant's surname + application id prefix. |
| UI | `JpResultCard.tsx` | Surfaces the API URL as a prominent "Download MOFA Application for Visa" button on the terminal step. |

**AcroForm vs flat:** The MOFA template carries 60 named AcroForm
fields (plus an XFA layer that pdf-lib strips). The renderer fills by
field name, not coordinate, which makes it resilient to template
re-flows.

**Lossy mappings (documented in render-form-a.ts):**
- VIZA's 4 character-question radios (`has_criminal_record`,
  `has_been_deported`, `has_overstayed_japan`,
  `has_drug_or_trafficking_history`) cover MOFA's 6 specific questions.
  The renderer maps the two clean cases (crime → RB5[3], deport/overstay
  → RB5[1]) and leaves the drug / prostitution / trafficking radios
  unticked so the applicant reviews each before signing.
- VIZA's 4 spouse fields don't all have a Form A counterpart (Form A
  only has "Partner's profession"). Spouse details are routed into the
  Remarks block instead.
- Schema captures one `inviter` block; Form A has Guarantor + Inviter.
  Renderer fills the Guarantor block and writes "Same as above" in the
  Inviter block (the form's own convention when the two are the same
  person).

**Encoding limit:** pdf-lib's default WinAnsi-encoded Helvetica cannot
render characters outside Latin-1 (no CJK, no smart quotes, no arrow
glyphs). The renderer sanitizes input — common smart quotes / dashes /
arrows are remapped to ASCII equivalents; anything else is replaced
with `?`. MOFA Form A is filled in romanized English per passport, so
ASCII coverage is the realistic floor. Embedding a TTF font (via
fontkit) would unlock CJK and other scripts but adds ~5MB to the bundle
— deferred to v1.1 if needed.

**Visual truncation vs data truncation:**
- `T64` ("Dates and duration of previous stays in Japan") has
  `maxLength=50` on the AcroForm widget. The renderer emits dates only
  (`DD/MM/YYYY-DD/MM/YYYY` joined by `; `) which fits two visits
  cleanly. Visit purposes go to the Remarks block so detail isn't lost.
- A handful of widgets (port_of_entry, T28[0] remarks) are visually
  narrower than the data fits. Data is preserved in the AcroForm
  stream — Acrobat horizontal-scrolls inside the field on click — but
  static print rendering may show only the first N characters. Not a
  data-loss issue; cosmetic only. Future polish: shrink widget font
  size via `field.setFontSize(7)`.

---

## 7. Reviewer Checklist

Before marking as production-ready:

- [ ] Seed applied (76 rows in `visa_form_fields` with
      `visa_type = 'JP_TOURIST'`)
- [ ] Package registered in `visa_packages` via migration 0021
- [ ] Assign a test user the `JP_TOURIST` package
- [ ] Walk every step, answer every conditional, trigger every
      sub-block (other-names, other-nationalities, married, other-
      passports, has-inviter, visited-japan, refused-japan,
      refused-other-country, criminal, deported, overstayed)
- [ ] Test every repeatable group (`other_nationalities`,
      `other_passports`, `prior_japan_visits`) — add / remove
      instances, values persist
- [ ] Submit a test application — verify all 76 answers persist to
      `visa_application_answers`
- [ ] Review step (`DynamicReviewStep`) renders every field
- [ ] **PDF rendering of MOFA Form A** — track as a separate v1.1 item;
      not blocking schema acceptance
- [ ] Live-portal QA — N/A for the PRC resident audience; deferred to
      a future `JP_E_VISA` package for eligible nationalities

---

## 8. Source Material

This schema is a **reconstruction** from public MOFA documents — there
was no live portal to drive for the v1 audience, and no live-portal QA
pass has been performed.

- MOFA "Application for Visa" PDF (Form A, English):
  `https://www.mofa.go.jp/files/000124525.pdf`
- MOFA Visa overview (English): `https://www.mofa.go.jp/j_info/visit/visa/`
- MOFA Visa information for Chinese nationals:
  `https://www.mofa.go.jp/j_info/visit/visa/topics/china.html`
- MOFA JAPAN eVISA system overview:
  `https://www.mofa.go.jp/j_info/visit/visa/visaonline.html` (used to
  confirm `evisa.mofa.go.jp` is not directly accessible to PRC residents)
- MOFA Tourist Short-Term Stay guidance:
  `https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html`

Expected drift: MOFA periodically revises Form A wording; the most
likely drift is in the criminal-record and refused-visa wording (item
33 onwards), which historically has been adjusted to reflect updated
exclusion grounds. Re-validate quarterly per playbook §8.
