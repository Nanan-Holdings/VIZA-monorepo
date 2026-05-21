# Subclass 600 Live ImmiAccount Walk — 2026-04-27

**Account:** edwardmiao3367735757@gmail.com
**Form:** Application for a Visitor Short Stay Visa (`VSS-AP-600`)
**Form revision:** 1419 (Internet) 01/11/2012.1
**Live URL:** `https://online.immi.gov.au/elp/app?action=new&formId=VSS-AP-600`
**Walk endpoint:** Review Page (post-page-20)
**TRN assigned:** EGPCDOGHNP

## Section structure (14 logical pages reachable in this walk)

| Page | Section | Recon file |
|------|---------|-----------|
| 1 | Terms and Conditions | page-01-tc.json |
| 2 | Application context (stream + purpose + specialised work) | page-02-after-yes.json, page-02-state.json |
| 3 | Primary applicant (personal + passport + ID + birth + relationship) | page-03.json, page-04.json |
| 4 | Critical data confirmation | page-05.json (mislabelled), page-04-confirm.json |
| 5 | Travelling companions | page-06.json (mislabelled — actually page 5) |
| 6 | Contact details | page-07.json |
| 7 | Authorised recipient | page-08.json (mislabelled — actually page 7) |
| 8 | Non-accompanying family unit | page-09.json |
| 9 | Entry to Australia | page-10.json (mislabelled) |
| 11 | Current overseas employment | page-12.json (mislabelled) |
| 12 | Financial support | page-13.json |
| 16 | Health declarations | page-17.json (mislabelled) |
| 17 | Character declarations | page-18.json (mislabelled) |
| 18 | Visa history | page-19.json (mislabelled) |
| 20 | Declarations | recon captured pre-Next |
| Review | Review Page | (walk endpoint) |

## Critical schema corrections surfaced by live walk

### A. Stream count: live form lists **only 4 streams**, not 5

```
Live (page 2):
- Business Visitor stream
- Frequent Traveller stream (tourism or business purposes)
- Sponsored Family stream (requires Sponsorship form 1149)
- Tourist stream (tourism/visit family or friends)
```

**No "Approved Destination Status (ADS) stream" in this universal form.**
ADS is a separate online product reachable via a different ImmiAccount
"new application" entry (likely registered for Chinese travel agencies
operating ADS group tours, not the universal Subclass 600 path).

**Schema action:** drop `ads` from `stream` enum, or split `AU_VISITOR_600`
into the universal 4-stream package and a separate `AU_VISITOR_600_ADS`
package for the ADS-only flow.

### B. Subclass 600 nationality eligibility is enforced at form-level

Submitting a Singapore-passport applicant on page 3 returned:
> "Based on the passport details, Test Given TESTSURNAME is not eligible
> to apply using this online service."

Subclass 600 is for nationalities NOT eligible for eVisitor 651 / ETA 601.
Submitting a 651-eligible nationality is rejected at the critical-data
confirmation step (page 4).

**Schema action:** add `country_of_passport` validation hint
`subclass_600_eligible_nationality` and document the eVisitor / ETA
exclusion lists in the gap report.

### C. Application context page surfaces 7 questions not in current schema

1. `applying_outside_australia` ✓ already in schema
2. `applying_all_outside_australia` (group application gate) — NEW
3. `current_location_country` ✓
4. `current_location_legal_status` (enum: Citizen / Permanent Resident / Visitor / Student / Work Visa / No Legal Status / Other) — NEW (different enum from `residency_status`)
5. `purpose_of_stay_initial` (Business / Tourism / Family visit / Study / Religious event / Other) — NEW (sits alongside stream, captures sub-purpose)
6. `significant_dates_in_australia` (textarea) — NEW
7. `event_invited_by_organisation` — NEW (specialised work gate)
8. `event_paid_by_organisation` — NEW (specialised work gate)
9. `specialised_non_ongoing_work` — NEW (eligibility triage)
10. `entertainer_or_supporting_entertainer` — NEW (eligibility triage)
11. `production_director_or_participant` — NEW (eligibility triage)
12. `representative_of_foreign_government_or_un` — NEW (exempt group gate)
13. `applying_as_part_of_group_of_applications` — NEW

### D. Personal-details page extras (page 3)

Live captures fields my schema misses:

- `pacific_australia_card_holder` (Pacific-Australia Card holder gate) — NEW
- `national_id_reason_for_not_providing` (textarea, conditional on `has_national_id === no` AND PRC passport) — NEW
- `chinese_commercial_code_number` (text — unique to PRC passport, distinct from name-in-Chinese-chars) — NEW
- `passport_place_of_issue` is a SELECT (Chinese province codes) when passport country = PRC, vs free-text text-input for non-PRC passports — schema must encode this country-conditional type
- Sex enum: live form is `Female / Male / Other` (3 values, value codes "1"/"2"/"3"), my seed has `male / female / indeterminate` — labels diverge from the live form

### E. Travelling companions page (page 5)

- `under_18_travelling_with_parent_or_guardian` — NEW
- `under_18_reason_no_parent` (conditional textarea) — NEW
- `other_persons_travelling_with_applicant` (group application) — NEW

Already-mapped fields covered: `accompanying_applicant_*` repeatable.

### F. Contact details page (page 6)

- `department_office` — typeahead combobox (not in schema). Values are "Country, City" e.g. `China, Beijing`, `China, Shanghai`, `India, New Delhi`. NEW
- Phone: separate `home_phone`, `business_phone`, `mobile_phone` — schema has only 2 phone fields. Update to 3.
- Phone validation: digits only, **no spaces**. Schema placeholder `+62 812 3456 7890` would fail.
- State/Province for residential address becomes a SELECT (Chinese province codes) when country = PRC; free text otherwise.

### G. Authorised recipient page (page 7) — 4-option radio, not boolean

Schema has 2-step `uses_migration_agent` (radio Yes/No) +
`has_authorised_recipient` (radio Yes/No). Live form has a single
4-option radio:
- No
- Yes, a registered migration agent
- Yes, a legal practitioner
- Yes, another person

Plus an "Electronic communication" required `email` (no_correspondent
fallback even when "No" picked).

### H. Entry to Australia page (page 9) — many gates not in schema

- `visa_valid_for_six_years` — NEW (multi-entry > 12 months)
- `length_of_stay_in_australia` enum: "Up to 3 months / 6 months / 12 months" — schema currently has free-text months
- `multiple_entries_intended` ✓ (covered)
- `multiple_entry_dates_known` — NEW
- `parent_or_step_parent_of_au_pr_or_citizen` — NEW (longer-validity gate)
- `applied_for_au_parent_visa` — NEW
- `application_has_queue_date` — NEW
- `multiple_stay_12_months_per_visit` — NEW
- `study_in_australia` ✓ (was in schema as `intends_to_study_more_than_3_months`)
- `visit_relatives_friends_in_australia` — NEW

### I. Employment page (page 11) — single status select

Live form: ONE select `employment_status` (Employed / Self employed /
Unemployed / Retired / Student / Other) gating sub-blocks. Schema has
this concept but the live form's "Unemployed" branch requires
`unemployment_date_from` + `unemployment_last_position` (text), which
the schema currently doesn't model.

### J. Financial support page (page 12) — 4 funding source options

Live: Self funded / Supported by current overseas employer / Supported
by other organisation / Supported by other person.
Schema currently has 7 options including `tour_operator` (ADS),
`australian_sponsor`, `scholarship_grant` — these are absent from the
live universal form.

Plus: free-text `funds_available_description` (textarea), not
`funds_available_amount` + `funds_currency` (structured).

### K. Health declarations (page 16) — 7 questions

1. `lived_outside_country_of_passport_5y_3mo` (3-month consecutive
   threshold) — NEW (not in schema)
2. `intends_to_enter_health_facility` ✓ partially in schema
3. `intends_health_care_worker_or_facility` ✓ partially
4. `intends_aged_or_disability_care` — NEW
5. `intends_child_care_centre_or_school` — NEW
6. `classroom_more_than_3_months` — NEW
7. `tb_or_chest_xray_abnormality` (combined gate question) — schema has separate fields
8. `medical_costs_for_listed_conditions` (combined gate for blood
   disorder / cancer / heart / hepatitis / HIV / kidney / mental /
   pregnancy / respiratory / other) — schema has only `has_serious_medical_condition`
9. `requires_ongoing_medical_care_or_assistive_tech` — NEW

### L. Character declarations (page 17) — 18 questions

Schema has 6-7 character questions. Live has 18:
- currently awaiting legal action ✓
- ever convicted (incl. removed from records) ✓
- domestic/family violence order — NEW
- arrest warrant or Interpol notice ✓ (partial)
- sexually based offence involving child — NEW
- sex offender register — NEW
- acquitted on grounds of insanity / unsoundness — NEW
- found not fit to plead — NEW
- national security risk — NEW
- genocide / war crimes / crimes against humanity ✓ (partial)
- associated with criminal-conduct person/group — NEW
- associated with violent organisation — NEW
- military / police / intelligence — partial
- military training / weapons / chem/bio — NEW
- people smuggling/trafficking — NEW
- removed/deported/excluded ✓
- overstayed visa anywhere — schema has it
- (more attestations on page)

### M. Visa history (page 18) — 3 questions

- `held_or_holds_visa_australia_or_other_country` — NEW (separate from `has_current_au_visa`)
- `not_complied_or_overstayed_anywhere` ✓
- `visa_refused_or_cancelled_anywhere` ✓

### N. Declarations (page 20) — 16 attestation Yes/No radios

All 16 are **Yes/No radios** (not checkboxes per schema). My schema
uses 5 attestation checkboxes — should be expanded to ~16 Yes/No
radios to match live form: read information, complete and correct,
fraud consequences, post-grant cancellation, post-decision changes,
notify of address change / family unit change, privacy notice,
biometrics consent, no-further-stay 8503, study limit, depart on time,
fingerprint/facial-image consent, law-enforcement disclosure consent,
visitor-no-work, etc.

## Form-level technical findings

### Date format: `DD MMM YYYY` (e.g. `15 Jun 1990`)
Form normalises `DD/MM/YYYY` to `DD MMM YYYY` on blur but rejects on
the initial validate. Internally stored as ISO `YYYY-MM-DD`. Schema
should specify `format: "DD MMM YYYY"` for AU dates.

### Form lifecycle
- **20 logical pages** (sections 2-20), preceded by T&C (1) and
  followed by review (`01/11`).
- After data fields submit, a `_dlg-_0b0` Confirm modal sometimes
  intercedes for cross-section warnings (e.g. on Page 6 contact).
- Session uses `online.immi.gov.au/elp/app` ASP.NET-style form posts
  with field names like `_2a0b0a0a0e0a0a<page>a<section><index><suffix>`.

### Field name convention
`_2a0b0a0a0e0a0aXaYbZ` where `X` = page index (2 = page 2/context, 3 = page 3/applicant, etc.) and Y/Z = sub-section. Stable across the form lifecycle so good for selectors.

### Combobox typeahead pattern
Office picker uses a `wc-suggestions` listbox with `data-wc-value`
attributes. Selection requires clicking the option, not typing the
value — `setText` alone is silently dropped on validate.

### `setInputFiles` not encountered
No file uploads in the form schema — supporting documents go to a
separate post-submission upload step.

### Save and resume work
Form saves draft on every Next click. Returning to the application
from "My applications" continues from the last saved page. TRN
assigned at application creation, persists across resumes.

## Submission automation feasibility

The form is fully drivable via Playwright with:
- ImmiAccount login (username + password + TOTP MFA → user must enter
  TOTP each session OR persist storageState if TOTP can be temporarily
  disabled in the test account)
- Page-by-page advance via the `_g1` Next button
- Confirm modal handled via `_dlg-_0b0`
- Field-name selectors are stable across sessions
- All 20 pages reached + Review page hit + TRN assigned in this walk

**Stop point for prefill assistant**: the Review page. After Review
the next step is Payment + Submit, which charges the AUD 200 visa
fee — mirrors DS-160's "stop at sign-and-submit" boundary.

## Files captured

```
docs/au-recon/page-01-tc.json
docs/au-recon/page-02-after-yes.json     # context, 4 streams confirmed
docs/au-recon/page-02-state.json
docs/au-recon/page-03.json               # primary applicant
docs/au-recon/page-04.json               # critical data
docs/au-recon/page-04-confirm.json
docs/au-recon/page-05.json
docs/au-recon/page-06.json               # contact details
docs/au-recon/page-07.json               # authorised recipient
docs/au-recon/page-08.json               # non-accompanying family
docs/au-recon/page-09.json               # entry to Australia (most fields)
docs/au-recon/page-10.json               # employment status
docs/au-recon/page-12.json               # employment unemployed branch
docs/au-recon/page-13.json               # financial support
docs/au-recon/page-17.json               # health declarations
docs/au-recon/page-18.json               # character declarations 18 Q
docs/au-recon/page-19.json               # visa history 3 Q
docs/au-recon/walk-summary.md            # this file
```

(File names are slightly off-by-one due to the validation-retry rounds
on pages 2 and 3; the section→file map above is the authoritative
mapping.)
