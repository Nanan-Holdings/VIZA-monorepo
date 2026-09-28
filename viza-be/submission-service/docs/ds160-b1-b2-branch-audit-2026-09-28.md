# DS-160 B1/B2 branch audit — 2026-09-28

Final addendum: the audit also covers both ordinary unknown-address enums
(`spouse_address_type` and `partner_address_type`). Their declared
`do_not_know` option is valid without a sentinel-checkbox flag; undeclared
`DOES_NOT_APPLY` remains invalid. The live audit now has 7 tests. The final
shared-validator/service/renderer sweep passed 382 tests across 7 suites.

This is a finite contract and runtime audit for the active B1/B2 DS-160
schema. It covers the DB-driven manual form, deterministic completion and
assistant validation, repeat rows, age/nationality/travel gates, and the
pre-review field contract. It does not modify or inspect a customer's live
application.

## Evidence boundary

The audit uses the live production metadata export captured on 2026-09-28,
plus the checked-in CEAC contract and public control snapshots from
2026-09-22:

- `D:/Temp/ds160-live-schema-20260928.json` (337 live rows; read-only export)
- `docs/ds160-branch-control-audit-2026-09-22.json`
- `docs/ds160-consolidated-field-checklist-2026-09-22.json`
- `viza-fe/internal-website/lib/__tests__/fixtures/ds160-live-branch-metadata-20260928.json`

The snapshot is selector and control evidence. Its `officialVerification` flag
is `false`; a captured DOM control or `required=false` HTML attribute is not
independent proof of every CEAC server rule. The counts below therefore state
coverage of the repository contract and replay evidence, not legal or
sentence-by-sentence official verification.

## Exact coverage counts

| Surface | Count | Result |
| --- | ---: | --- |
| Contract rows, including compatibility rows | 337 | 331 active rows plus 6 legacy compatibility rows |
| Active fields in the consolidated checklist | 331 | 187 historical exact rows + 143 selector-reconciled rows + 1 repaired sex row |
| Conditional expressions | 81 active | 83 in the historical report included 2 legacy social-media expressions |
| Conditional fields | 235 active | 238 live conditional rows minus 3 legacy rows |
| Repeat groups | 22 active | 20 multi-item groups plus 2 explicit single-row explanations |
| Runtime frontend gates | 5 | age/work, ESTA/VWP, marital routing, occupation routing, stay-unit/U.S.-contact |
| Focused FE test files run | 12 | includes live metadata branch audit and sentinel regression coverage |

The historical `specific_travel_plans` repeat entry is absent from the current
337-row live export and is excluded from the active inventory. It is not a
current repeat control and is not reported as an open branch. The two
single-item groups, `visa_refused` and `immigrant_petition`, retain their
official explanation metadata without being treated as arbitrary repeat rows.

## Conditional branch matrix

The 81 expressions below are the complete active branch list from the live
metadata. The two historical social-media expressions are compatibility-only
and intentionally absent from this inventory.

### Personal, travel, and previous travel

1. `other_names_used === yes` → other name rows
2. `has_telecode === yes` → telecode rows
3. `marital_status === other` → other marital-status explanation
4. `other_nationality === yes` → other nationality and passport question
5. `other_nationality_has_passport === yes` → other passport number
6. `permanent_resident_other_country === yes` → permanent-resident country
7. `has_specific_plans === yes` → arrival/departure/planned-location rows
8. `has_specific_plans === no` → intended arrival and stay rows
9. specific plans or a stay unit of year/month/week/day → U.S. address rows
10. `trip_payer_type === other_person` → person payer rows
11. `payer_address_same_as_home === no` → person payer address rows
12. `trip_payer_type === other_company` → company payer rows
13. `has_companions === yes` → group-travel question
14. `companion_group_travel === yes` → group name
15. `companion_group_travel === no` → companion identity/relationship rows
16. `has_been_in_us === yes` → previous visit and driver's-license questions
17. `has_us_drivers_license === yes` → driver's-license rows
18. `has_us_visa === yes` → prior visa rows
19. `visa_lost_or_stolen === yes` → lost-visa year/explanation
20. `visa_cancelled_or_revoked === yes` → cancellation explanation
21. `has_been_refused === yes` → refusal explanation
22. `immigrant_petition_filed === yes` → petition explanation
23. `mailing_same_as_home === no` → mailing-address rows
24. `has_other_phones === yes` → additional phone
25. `has_other_emails === yes` → additional email
26. a non-`NONE` social platform → social handle
27. `has_other_social_media === yes` → other social rows
28. `passport_document_type === other` → passport explanation
29. `lost_passport === yes` → lost passport rows

### Family and U.S. contact

30. either father-name value is known → father date/U.S.-residence rows
31. either mother-name value is known → mother date/U.S.-residence rows
32. `has_immediate_us_relatives === yes` → immediate-relative rows
33. `has_immediate_us_relatives === no` → other-relative question
34. married, legally separated, or common-law → spouse rows
35. `spouse_address_type === other` → spouse address rows
36. `marital_status === civil_union` → partner rows
37. `partner_address_type === other` → partner address rows
38. `marital_status === widowed` → deceased-spouse rows
39. `marital_status === divorced` → former-spouse count and rows
40. specific plans are not no, or stay unit is not hours → U.S. contact identity rows
41. U.S. contact relationship is present and the same stay condition holds → U.S. contact address rows

### Work, education, travel history, and security

42. `primary_occupation === other` → occupation explanation
43. `primary_occupation === not_employed` → unemployment explanation
44. a non-empty occupation other than retired/homemaker/not-employed → present employer rows
45. `has_previous_employer === yes` → previous employer rows
46. `has_attended_education === yes` → education rows
47. `has_clan_tribe === yes` → clan/tribe name
48. `has_traveled_last_five_years === yes` → traveled-country rows
49. `has_belonged_to_organization === yes` → organization rows
50. `has_specialized_skills === yes` → specialized-skills explanation
51. `has_served_military === yes` → military rows
52. `has_served_paramilitary === yes` → paramilitary explanation
53. `vwp_denial === yes` → ESTA/VWP denial explanation
54–80. each of the 27 CEAC security questions answered `yes` → its matching
   explanation field: communicable disease, physical/mental disorder, drug
   abuse, arrest/conviction, controlled-substance violation, prostitution,
   money laundering, human trafficking, aiding trafficking, trafficking
   beneficiary, illegal activity, terrorist activity, terrorist support,
   terrorist membership, terrorist family, genocide, torture, extrajudicial
   killing, child soldier, religious-freedom violation, population control,
   coercive transplant, immigration fraud, removal order, withheld child
   custody, and illegal voting/renunciation branches.

81. `ds160_preparer_assistance === yes` → preparer identity/address/relationship
   rows.

## Repeat matrix

| Group | Activation | Evidence |
| --- | --- | --- |
| `other_nationality` | other nationality = yes | observed |
| `permanent_resident` | permanent resident elsewhere = yes | observed |
| `trip_purpose` | purpose rows | observed |
| `planned_locations` | specific plans = yes | observed |
| `companions` | companions = yes and group travel = no | observed |
| `previous_visits` | prior U.S. visit = yes | observed, max 5 |
| `drivers_licenses` | U.S. driver's license = yes | observed; six rows are a lower bound |
| `visa_refused` | refused visa = yes | structural single-row |
| `immigrant_petition` | immigrant petition = yes | structural single-row |
| `additional_phones` | other phones = yes | observed |
| `additional_emails` | other emails = yes | observed |
| `social_media` | social platform | observed |
| `other_social_media` | other social media = yes | observed |
| `lost_passport` | lost passport = yes | observed |
| `us_relatives` | immediate U.S. relative = yes | observed |
| `former_spouses` | marital status = divorced | observed |
| `previous_employers` | previous employer = yes | observed, max 2 |
| `education` | attended education = yes | observed |
| `languages` | language history | observed |
| `traveled_countries` | travel in the last five years = yes | observed |
| `organizations` | organization membership = yes | observed |
| `military_service` | military service = yes | observed |

Repeat fields must be evaluated with the row's own scoped controller values.
The completion code does this through `getRepeatInstanceValues`; a completed
row must not hide a missing second row.

The conditional probes use independent `trueAnswers` and `falseAnswers`
captured in the fixture by a standalone metadata oracle; the test never calls
the production expression evaluator to choose its expected branch. Each probe
retains the live target's `required`, `conditionalLogic`, step, and validation
metadata, and preserves the associated controller inventory. It then checks
the target through `evaluateShowIf`, dynamic completion, and assistant
validation. The optional `intended_arrival_date` branch is additionally
checked through `computeAllTabCompletion`, which exercises the page-level CEAC
gate. For the one CEAC_ESTA target, the probe supplies an explicit VWP
nationality runtime context so the nationality gate is tested rather than
silently filtering the field.

Repeat probes retain every member's live `required` and `conditionalLogic`
metadata and include the live local controllers. Their values are normalized
to text probe values only to isolate repeat scoping from field-format rules;
they still cover a populated second row for multi-item groups and reject a
stale second row for the two `max_items=1` explanation groups.

## Runtime gate matrix

| Gate | Current implementation | Evidence status |
| --- | --- | --- |
| Work/education age gate | `lib/ds160-age-gate.ts` and submission-service age gate | positive/negative observed; boundary is age 14 |
| ESTA/VWP nationality gate | `lib/ds160-age-gate.ts` and nationality catalog | validated 2026-09-22: 37 positive and 174 negative codes, with Yes/No explanation routing |
| Marital routing | spouse/partner/deceased/former-spouse and relationship validators | page-group observed; not every cross-product is an independent official proof |
| Present occupation routing | occupation branch and employer fields | page-group observed across the occupation replay set |
| Stay unit/U.S. contact | plans plus H/day-or-longer logic | positive/negative observed; under 24 hours skips U.S. contact |

## Findings and repairs

### A. Unsupported `DOES_NOT_APPLY` was falsely completing a required field — fixed

The current contract explicitly says `employer_name` does not allow
`DOES_NOT_APPLY`. Before this audit, a stale answer with that sentinel was
treated as complete:

```text
validateApplicationAnswers(
  employer_name = "DOES_NOT_APPLY",
  field.required = true,
  validationRules = { maxLength: 75 }
)
=> errors: [], missingFields: [], progress: { completed: 1, total: 1 }
```

The repair adds `lib/form-field-sentinels.ts` and uses the same metadata-gated
predicate in `application-tab-completion.ts`, `form-assistant/validator.ts`,
and `components/dynamic-step-form.tsx`. Allowed sentinels complete the field
and skip ordinary format checks. Unsupported sentinels are invalid, remain
incomplete, block Continue/review, and leave the input editable. The helper
normalizes casing and whitespace so legacy `does_not_apply` values cannot
bypass the check. The live 53-field sentinel matrix now has positive and
negative coverage for every field and every opposite sentinel.

### B. Repeat-row assistant questions lose the instance key

`runAssistantTurn` maps the first missing answer key through a map keyed only by
base field names. A missing repeat row such as `former_spouse_surname__2` or
`education_institution_name__2` is therefore not found by
`fieldByName.get(item.fieldName)`. The same lookup is used for the current
question and for the next question after a patch. The missing list still has
the row-specific key, but the assistant can render a generic completion message
or repeat the wrong row. The correction must resolve a suffixed answer key to
its base schema field while preserving the suffix for persistence, conflict
checks, review navigation, and labels.

### C. “No/unknown/N/A” now uses one shared sentinel policy

The schema distinguishes `DO_NOT_KNOW` and `DOES_NOT_APPLY` per field. Date
controls, SSN, parent/family fields, U.S. contact unknown-name handling, and
preparer synchronized sentinels still have their domain-specific cross-field
rules, but the allow/reject decision now comes from one field-contract
predicate. Regression coverage verifies:

- allowed SSN N/A succeeds and advances;
- unsupported employer-name N/A blocks with a field-level error;
- allowed parent DOB/name unknown succeeds without date parsing;
- unsupported unknown on a normal text field blocks;
- preparer name N/A remains synchronized across surname/given-name;
- U.S. contact unknown requires the paired name values;
- stale unsupported sentinels cannot produce 100% progress or a successful review.

## Verification run

The following focused test command passed on 2026-09-28:

```text
npx vitest run \
  lib/form-assistant/__tests__/validator.test.ts \
  lib/form-assistant/review-issues.test.ts \
  lib/form-assistant/service.test.ts \
  lib/__tests__/ds160-age-gate.test.ts \
  lib/__tests__/ds160-family-validation.test.ts \
  lib/__tests__/ds160-travel-validation.test.ts \
  lib/__tests__/ds160-nationality-validation.test.ts \
  lib/__tests__/application-schema-ui-contract.test.ts \
  components/__tests__/dynamic-step-form-ssn-validation.test.tsx \
  components/__tests__/dynamic-step-form-date-validation.test.tsx \
  components/__tests__/dynamic-step-form-performance.test.tsx \
  lib/__tests__/ds160-live-branch-audit.test.ts \
  --testTimeout=20000
```

The live metadata branch audit also runs independently with the following
command:

```text
npx vitest run lib/__tests__/ds160-live-branch-audit.test.ts \
  --testTimeout=20000 --reporter=verbose
```

Result: **6 tests passed, 0 failed**. It checks the dated 337-row live export
when present, the exact 331/6 active/compatibility split, all 81 active
conditional expressions in both truth directions, all 22 active repeat groups,
second-row required scoping, and all 53 sentinel-bearing fields in both the
allowed and opposite unsupported branches. The broader focused suite reported
**12 files, 383 tests passed, 0 failed** on the final rerun; the frontend
`npm run type-check` also passed. The repeat assistant suffix lookup remains
owned by the form-assistant service worker and is outside the files changed
here.
