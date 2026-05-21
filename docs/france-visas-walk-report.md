# France-Visas Step-by-Step Walk Report

**Walk date:** 2026-04-24
**Applicant profile:** Chinese national, Ordinary passport, submission in China (Beijing), main destination France, purpose Tourism, Short-stay Type C
**Outcome:** All 6 form steps walked end-to-end; draft saved with reference `2026705103880`. No application submitted.

---

## 1. Step Map (Observed)

| Step | URL | Title | Button | Purpose |
|------|-----|-------|--------|---------|
| 1 | `step1.xhtml` | Your plans | "Verify" → "Next" | Eligibility triage (nationality + travel doc + purpose) |
| 2 | `step2.xhtml` | Your information | Next | Personal + residence + occupation |
| 3 | `step3.xhtml` | Your last visa | Next | Previous Schengen visas |
| 4 | `step4.xhtml` | Your stay | Next | Trip dates + duration + entries |
| 5 | `step5.xhtml` | Your contacts | Next | Host + funding + representative |
| 6 | `step6.xhtml` | Your supporting documents | Continue | Informational document checklist (no inputs) |
| — | `accueil.xhtml` | My applications | — | Dashboard. Draft saved. |

Confirmed: **the form is 6 steps, not the 12 in the Annex I seed** (`docs/schengen-visa-scope.md`).

---

## 2. Step 1 — "Your plans" (13 fields)

Fieldsets: `Your situation` · `Your stay` · `Your travel document` · `Your plans`

| Field | `name=` | Type | Annex I |
|---|---|---|---|
| Current nationality * | `formStep1:visas-selected-nationality_input` | select / 199 ISO-3 | 6 |
| EU family member * | `formStep1:hasNationalFamily` | radio (:0=Yes, :1=No) | 17-18 |
| Place of submission (country) * | `formStep1:Visas-selected-deposit-country_input` | select / 200 ISO-3 | **FR-specific** |
| Visa type requested * | `formStep1:Visas-selected-stayDuration_input` | select `C`/`D`/`A` | **FR-specific** |
| Main destination of stay * | `formStep1:Visas-selected-destination_input` | select / cascades on stayDuration (38) | **FR-specific** |
| City of submission * | `formStep1:Visas-selected-deposit-town_input` | select / cascades on deposit-country | **FR-specific** |
| Issuing authority * | `formStep1:Visas-selected-authority_input` | select / 205 ISO-3 | 11 |
| Travel document type * | `formStep1:Visas-dde-travel-document_input` | select / 9 types | 11 |
| Travel document number * | `formStep1:Visas-dde-travel-document-number` | text, maxlen 20 | 12 |
| Date of issue * | `formStep1:Visas-dde-release_date_real_input` | date, dd/MM/yyyy | 13 |
| Expiry date * | `formStep1:Visas-dde-expiration_date_input` | date, dd/MM/yyyy | 14 |
| Your plans (purpose category) * | `formStep1:Visas-selected-purposeCategory_input` | select / 9 categories | 23 parent |
| Main purpose of stay * | `formStep1:Visas-selected-purpose_input` | select / cascades on purposeCategory | 23 |

**Cascading chain (confirmed correct fill order):**
`nationality → deposit-country → stayDuration → destination → deposit-town → authority → travel-document → purposeCategory → purpose`. Upstream postbacks clear downstream selects AND text fields — fill text fields LAST after cascade stabilizes.

**Submit flow:** button reads "Verify" → eligibility check → button swaps to "Next".

---

## 3. Step 2 — "Your information" (25+ fields, with conditional reveals)

Fieldsets: `Your identity` · `Your personal information` · `Details of your identity` · `Your family` · `Your job`

### Always visible (25 fields)

| Field | `name=` | Type | Annex I |
|---|---|---|---|
| Sex * | `formStep2:DDE002_102_input` | select `F`/`M`/`X` | 2 |
| Marital status * | `formStep2:DDE002_104_input` | select `DIV`/`MAR`/`AUT`/`PAC`/`SEP`/`CEL`/`VEU` | 10 |
| Last name/s * | `formStep2:visas-input-applicant-surname` | text, max 40 | 1 |
| Last name at birth | `formStep2:visas-input-applicant-surnameAtBirth` | text, max 150 | 3 |
| First name/s * | `formStep2:visas-input-applicant-firstnames` | text, max 40 | 4 |
| DOB day * | `formStep2:visas-input-applicant-dayOfBirth` | text, max 2 | 5 |
| DOB month * | `formStep2:visas-input-applicant-monthOfBirth` | text, max 2 | 5 |
| DOB year * | `formStep2:visas-input-applicant-yearOfBirth` | text, max 4 | 5 |
| Place of birth * | `formStep2:visas-input-applicant-placeOfBirth` | text, max 50 | 7 |
| Country of birth * | `formStep2:visas-selected-countryOfBirth_input` | select / 201 ISO-3 | 8 |
| Current nationality | `formStep2:visas-selected-nationality_input` | select (prefilled from step 1) | 6 |
| National ID no. | `formStep2:visas-input-idcardNumber` | text, max 20 | 9 |
| Nationality at birth * | `formStep2:visas-selected-nationalityOfBirth_input` | select / 198 | 6 |
| Other nationalities | `formStep2:visas-select-otherNationalities` | **198 checkboxes** (pick multiple) | 6 |
| Address * | `formStep2:visas-input-applicant-street` | text, max 50 | 19 |
| Post code | `formStep2:visas-input-applicant-zipcode` | text, max 10 | 19 |
| City * | `formStep2:visas-input-applicant-place` | text, max 50 | 19 |
| Country of residence * | `formStep2:visas-selected-applicant-country_input` | select / 201 ISO-3 | 19 |
| Telephone number * | `formStep2:visas-input-applicant-phoneNumber` | text, max 20 | 20 |
| Email address * | `formStep2:visas-input-applicant-email` | text, max 70 | 19 |
| Resident of another country? | `formStep2:radioNotResident` | radio Yes/No | 19 extension |
| Has French family? | `formStep2:radioHasFrenchFamily` | radio Yes/No | **FR-specific** |
| Has EU/EEA/CH/UK family? | `formStep2:radioHasNationalFamily` | radio Yes/No | 17-18 |
| Occupation * | `formStep2:visas-input-applicant-activity-occupation_input` | select / 37 categories | 21 |

### Conditional reveal: picking certain occupation values shows employer section

| Field | `name=` | Type |
|---|---|---|
| Business segment * | `formStep2:visas-input-applicant-activity-businessSegment_input` | select / 22 industries |
| Employer name * | `formStep2:visas-input-applicant-employer-name` | text, max 50 |
| Employer address * | `formStep2:visas-input-applicant-employer-street` | text, max 50 |
| Employer city * | `formStep2:visas-input-applicant-employer-place` | text, max 50 |
| Employer country * | `formStep2:visas-selected-applicant-employer-country_input` | select / 201 |
| Employer phone * | `formStep2:visas-input-phoneNumber-employer` | text, max 20 |
| Employer email * | `formStep2:visas-input-email-employer` | text, max 70 |

(There's also a likely reveal for Yes on `radioHasFrenchFamily` / `radioHasNationalFamily` — not walked.)

---

## 4. Step 3 — "Your last visa" (1 field visible, conditional rest)

Fieldset: `Previous visa`

| Field | `name=` | Type |
|---|---|---|
| Had previous Schengen visa? | `formStep3:haveOldSchengenVisas` | radio Yes/No |

If **Yes**, conditional reveal likely asks for previous visa number, validity dates, and fingerprint history (Annex I 28-29). Not walked in this session.

---

## 5. Step 4 — "Your stay" (7 fields)

Fieldsets: `Details of your stay` · `Your plans for staying`

| Field | `name=` | Type |
|---|---|---|
| Multiple destinations? * | `formStep4:radioHasSeveralDestination` | radio Yes/No |
| Date of arrival * | `formStep4:date-of-arrival_input` | date, dd/MM/yyyy |
| Date of departure * | `formStep4:date-of-departure_input` | date, dd/MM/yyyy |
| Planned duration (days) * | `formStep4:visas-dde-number-days-travel` | text, max 5 |
| Number of entries * | `formStep4:visas-selected-applicant-country_input` | select `1`=1 entry / `M`=Multiple |
| Number of stays * | `formStep4:visas-input-applicant-numberOfStays_input` | text |
| Purpose category * | `formStep4:visas-selected-purposeCategory_input` | select / **10 options** (+AUTR=Other vs step 1's 9) |

**Naming drift:** `visas-selected-applicant-country_input` on step 4 means "number of entries" (`1`/`M`), NOT country of residence (which is what it means on step 2). Namespace collision — selectors must be qualified by step prefix.

---

## 6. Step 5 — "Your contacts" (conditional-heavy)

Fieldsets: `Host person or organisation` · `Funding of travel costs` · `Person completing the form`

### Always visible — toggle checkboxes

| Field | `name=` |
|---|---|
| Has host person? | `formStep5:cbxHasHostPerson_input` |
| Has host organisation? | `formStep5:cbxHasHostOrganization_input` |
| Is invited for application? | `formStep5:cbxHasPlaceOfApplication_input` |
| Self-funded? | `formStep5:cbxHasAutoFunding_input` |
| Has guarantor? | `formStep5:cbxHasGuarantor_input` |

### Revealed when cbxHasHostPerson is checked (8 required fields)

`formStep5:visas-input-applicant-hostPerson-{surname,firstnames,address,zipcode,place,phoneNumber,email}` + `visas-selected-hostPerson-country_input`.

### Revealed when cbxHasAutoFunding is checked

| Field | `name=` | Type |
|---|---|---|
| Funding methods * | `formStep5:autoFundings` | **multi-checkbox group**, values: `HPP` (Accommodation prepaid), `TPP` (Transport prepaid), `CHQ` (Traveller's cheques), `CCR` (Credit card), `ARG` (Cash), `AUT` (Other) |

### Always visible — representative (optional, 8 fields)

`formStep5:visas-input-application-representative-{surname,firstnames,street,zipcode,place,phoneNumber,email}` + `visas-input-application-representative-country_input`. All optional (blank if applicant fills it themselves).

**Validation rule:** "You must indicate at least one host person or organisation" — at least one of the first 3 checkboxes must be checked.

---

## 7. Step 6 — "Your supporting documents" (informational, NO inputs)

Fieldsets listing required documents for the VAC appointment:

1. **Pre-requisites** — travel document (<10y old, 2 blank pages, 3mo validity past return), ID photo, note verbale for official travel docs
2. **Purpose of travel/stay** — trip reservation, return ticket/itinerary
3. **Socio-professional situation** — employment contract / company registration / school certificate / pension proof
4. **Funds** — bank statements, pay slips, pension statements
5. **Accommodation** — hotel reservation OR €120/day budget proof OR tenancy agreement OR ownership certificate OR host invitation
6. **Travel health insurance** — insurance certificate

Button: "Continue" → returns to accueil dashboard. **No form submission happens here.** The fee ("Applicable rate") and appointment scheduling live on a separate post-form surface accessed through the VAC.

---

## 8. JSF / PrimeFaces mechanics (confirmed)

- Framework: **Jakarta Faces + PrimeFaces**
- ID pattern: `formStepN:fieldname` for inputs; `formStepN:fieldname_input` for the native select wrapped by PrimeFaces SelectOneMenu
- Widget registration: `window.PrimeFaces.widgets.widget_formStepN_<underscored_fieldname>`
- Hidden state: `_csrf`, `jakarta.faces.ViewState`, `formSteps`, `formStepN` — all must be preserved
- **Setting `<select>.value` and firing `change` does NOT trigger the AJAX postback.** Only `widget.selectValue(v); widget.triggerChange()` does.
- Every postback may clear downstream selects AND text fields. Fill order: selects (in cascade order, waiting for postbacks between each) → radios → text fields LAST.
- Server-side auto-uppercases text fields (Last name "Zhang" becomes "ZHANG", place "Beijing" becomes "BEIJING").
- Clicking "Next" without valid data shows inline error messages (`.ui-message-error` + `.ui-messages-error`) but does not show a modal; clicking "Next" with valid data on step 1 shows a **Yes/No confirmation modal** before advancing.

---

## 9. Drift vs Annex I seed — summary

| Drift | Severity | Action |
|---|---|---|
| Step count 6 vs 12 | High | Collapse seed step mapping into 6 FR steps |
| Step 1 is an eligibility triage, not Personal Details | High | Reorder seed; FR starts with nationality + travel doc |
| ISO-3 vs ISO-2 country codes | Medium | Add mapping layer in orchestrator |
| `visas-selected-applicant-country_input` has different semantics across steps | Medium | Namespace selectors by step prefix |
| 4 France-specific fields in step 1 (deposit-country/town, stayDuration, destination) | Medium | Add FR overrides layer |
| 37 occupation categories (vs seed's free-text?) | Low | Adopt FR's taxonomy as canonical |
| 22 business-segment categories (conditional on occupation) | Low | Add to schema |
| Funding methods are 6-value multi-checkbox (seed has different structure) | Low | Remap |
| "Other nationalities" is 198 checkboxes (multi-select) | Low | Use same list as nationality select |
| Document checklist step has no inputs — purely informational | N/A | Skip in fill flow; surface in UI as guidance |
| French overseas territories in destination list (Guadeloupe, Martinique, etc.) | N/A | Keep as valid Schengen Type C destinations |
| Step 1 button is "Verify" (eligibility) before becoming "Next" | Medium | Nav helper must accept both labels |
| Post-step-1 Yes/No confirmation modal on Next | Medium | Nav helper must auto-confirm |
| Step 6 is not a form — skip in orchestrator | N/A | Advance past step 6 via "Continue" without fill |

---

## 10. Recommended scaffold follow-ups

1. Add `FV_STEP2_FIELDS`, `FV_STEP3_FIELDS`, `FV_STEP4_FIELDS`, `FV_STEP5_FIELDS` to `selectors.ts` (step 6 needs no fields).
2. Encode conditional-reveal chains as metadata on field entries (e.g. `revealedWhen: { field: 'occupation', value: ['69002', ...] }`).
3. Update `navigator.ts` to handle the Yes/No confirmation modal that appears on step 1 "Next".
4. Extend `primefaces-ajax.ts` with `setJsfCheckbox(name, value)` helper for multi-checkbox groups like `autoFundings` and `otherNationalities`.
5. Add a `postFillReflowGuard()` that re-applies text field values after all cascading select postbacks stabilize.
6. Update `docs/schengen-visa-scope.md` to note the FR-specific 6-step consolidation.
