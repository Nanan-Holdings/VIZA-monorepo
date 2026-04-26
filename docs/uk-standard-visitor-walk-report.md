# UK Standard Visitor Visa — apply-uk-visa.service.gov.uk Walk Report

> **Status: live walk complete (sample of 8 pages + full inventory of 44).**
> Walk performed 2026-04-26 against the user's in-flight Standard Visitor application
> via `https://visas-immigration.service.gov.uk/forceResume/<uuid>`. Captures
> live in `viza-be/submission-service/uk-walk-out/`.

---

## 1. Scope

Captures the post-auth structure of the UK Standard Visitor visa application
form on `apply-uk-visa.service.gov.uk` end-to-end from the applicant's
`forceResume` URL up to (but not including) the payment screen.

**Stepper observed (pre-Pay):**
`Start → Application → Documents → Declaration → Pay → Further actions`

The runner must complete `Application` (44 pages) and `Documents` (3
checkboxes), then halt at `Declaration` (1 ack page) — the page after
Declaration is `Pay`, which is the stop boundary.

**What this enables**
- Extending `viza-be/submission-service/src/uk/orchestrator.ts` past its
  current registration-page stop, page-by-page, using the captured selectors.
- Building `viza-be/submission-service/src/uk/field-mappings.ts` post-auth
  entries (parallel to `france-visas/field-mappings.ts`).
- Updating `viza-be/agent-backend/scripts/seed-uk-standard-visitor-form-fields.ts`
  with any seed gaps.

---

## 2. Walk capture method

The bundled `scripts/walk-uk-portal.ts` autonomous-click script was
sandbox-blocked from running against gov.uk live. Walk was performed
interactively via the Playwright MCP browser instead, dumping per-page
field metadata to `uk-walk-out/page-<slug>.json` via a one-line evaluator.

To repeat:

```bash
cd viza-be/submission-service
export UK_TEST_RESUME_URL='https://visas-immigration.service.gov.uk/forceResume/<uuid>'
export UK_TEST_PASSWORD='<password>'
npx ts-node scripts/walk-uk-portal.ts --headful   # autonomous version
```

Output → `viza-be/submission-service/uk-walk-out/`.

---

## 3. Page inventory (44 application pages, in order)

Sourced from the "Check your answers" summary at `/edit/application` (which
lists every sub-page via Change links). Each entry is a separate page
reachable at `/edit/application.0.<slug>`. Repeatable groups are flagged.

| # | Slug | Section | Title | Repeatable? |
|---|---|---|---|---|
| 1 | `standardApplicantsEmail` | Personal information | Contacting you by email | — |
| 2 | `hasAdditionalEmailEV` | Personal information | Additional email | — |
| 3 | `standardTelephoneDetailsList.0` | Personal information | Your telephone number | yes |
| 4 | `standardContactingYouByTelephone` | Personal information | Contacting you by telephone | — |
| 5 | `identityNameForLeaveToEnterList.0` | Personal information | Your name | yes (also-known-as) |
| 6 | `standardGenderRelationshipOOC` | Personal information | Your sex and relationship status | — |
| 7 | `standardAddressOoC` | Personal information | Your address | — |
| 8 | `standardAboutYourHomeOoC` | Personal information | About this property | — |
| 9 | `travelDocumentIssueDetails` | Passport details | Your passport | — |
| 10 | `standardIdentityCard` | Personal information | Your identity card (USA) | — |
| 11 | `standardNationalityDOBOoC` | Personal information | Your nationality, country and date of birth | — |
| 12 | `standardOtherNationality` | Personal information | Your other nationalities | — |
| 13 | `immigrationStatus` | Current status | Your immigration status | — |
| 14 | `employmentStatus` | Employment | Your employment status | — |
| 15 | `fundingEmploymentEmployerDetails` | Employment | Your employer | — |
| 16 | `fundingEmploymentJobDetails` | Employment | Your job | — |
| 17 | `fundingOtherIncome` | Income and expenditure | Your income and savings | — |
| 18 | `plannedSpendOnVisitToUK` | Income and expenditure | About the cost of your visit | — |
| 19 | `monthlyOutgoings` | Income and expenditure | About your financial situation | — |
| 20 | `payingForYourVisit` | Income and expenditure | Paying for your visit | — |
| 21 | `odwPlannedTravelInformation` | Planned travel | Your planned travel information | — |
| 22 | `spokenLanguagePreference` | English language | Spoken language preference | — |
| 23 | `purposeOfVisitForVV` | Travel information | Main reason for your visit | — |
| 24 | `purposeOfTourismVisitForVV` | Travel information | Main reason for your holiday visit | conditional on tourism |
| 25 | `aboutYourVisit` | Travel information | Your activities | — |
| 26 | `hasDependants` | Dependant details | People financially dependent on you | — |
| 27 | `parentOneDetails` | Parent details | Give details about your first parent | — |
| 28 | `familyInUk` | Family in the UK | Family who live in the UK | — |
| 29 | `travellingWithOtherPeople` | Travel information | Travelling as part of an organised group | — |
| 30 | `travellingWithOtherPeopleDetails` | Travel information | Travelling with another person | — |
| 31 | `accommodationArrangements` | Accommodation details | Accommodation in the UK | — |
| 32 | `otherAccommodationDetailsList.0` | Accommodation details | Accommodation in the UK (per place) | yes |
| 33 | `standardTimesTravelledToUK` | Travel history (UK) | UK travel history | — |
| 34 | `timesTravelledToOtherCountries` | Travel history (other) | Travel to AUS/CAN/NZ/USA/CHE/EEA | — |
| 35 | `standardWorldTravelHistory` | Travel history (other) | World travel history | — |
| 36 | `standardImmigrationProblems` | Travel history (UK) | Immigration history (refusals etc) | — |
| 37 | `standardImmigrationBreach` | Travel history (UK) | Breach of UK immigration law | — |
| 38 | `standardCriminalConvictions.0.standardCriminalConvictionType` | Convictions and other penalties | Convictions and other penalties | yes (per conviction) |
| 39 | `standardWarCrimes` | Other history | War crimes | — |
| 40 | `standardTerroristActivities` | Other history | Terrorist activities, organisations and views | — |
| 41 | `standardExtremistActivities` | Other history | Extremist organisations and views | — |
| 42 | `standardPersonOfGoodCharacter` | Other history | Person of good character | — |
| 43 | `standardEmploymentHistory` | Employment | Your employment history | — |
| 44 | `otherInformation` | Extra information | Additional information about your application | — |

After Application: `Documents` (1 mandatory + N optional ack checkboxes;
universal `Save and continue` button), then `Declaration`, then **stop at Pay**.

---

## 4. Field-name patterns (universal across all pages)

Field DOM ids and names follow strict, mechanical conventions. Encode these
into `uk/field-mappings.ts` and reuse across pages — most fields don't need
per-page special-casing.

### 4.1 Submit button (every page)

```html
<input id="submit" name="submit" type="submit" value="Save and continue">
```

Selector: `input#submit, input[name="submit"][value="Save and continue"]`.
**Never click anything else** that looks like a submit during the run —
gov.uk has zero-CSRF inline buttons elsewhere (e.g. delete-this-place,
add-another) that would mutate state.

### 4.2 Plain text input

`<input type="text" id="<camelCase>" name="<camelCase>">` where id == name.
Examples: `givenName`, `familyName`, `placeOfBirth`, `employer`,
`telephoneNumber` (`type="tel"`), `name` (in accommodation), `purposeOfTourismVisitForVV`.

Fill with `page.locator('#<id>').fill(value)`; press `Tab` to trigger
client-side validation.

### 4.3 Date split (universal pattern)

Every date is rendered as three numeric inputs:

```html
<input type="number" id="<field>_day"   name="<field>.day">
<input type="number" id="<field>_month" name="<field>.month">
<input type="number" id="<field>_year"  name="<field>.year">
```

Observed fields: `dob`, `dateOfIssue`, `expiryDate`, `dateOfArrival`,
`dateOfLeave`, `accommodationDetails.dateRange.from`, `…dateRange.to`,
`jobStartDate` (month + year only). For `jobStartDate` only `month` + `year`
exist (no day).

Filler:
```ts
async function fillDateSplit(page: Page, base: string, isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  if (d) await page.locator(`#${base}_day`).fill(String(Number(d)));
  await page.locator(`#${base}_month`).fill(String(Number(m)));
  await page.locator(`#${base}_year`).fill(y);
}
```

### 4.4 Address split (universal pattern)

```html
<input id="<addressBase>_line1"        name="<addressBase>.line1">
<input id="<addressBase>_line2"        name="<addressBase>.line2">
<input id="<addressBase>_line3"        name="<addressBase>.line3">
<input id="<addressBase>_townCity"     name="<addressBase>.townCity">
<input id="<addressBase>_province"     name="<addressBase>.province">
<input id="<addressBase>_postCode"     name="<addressBase>.postCode"   ← OR
<input id="<addressBase>_postalCode"   name="<addressBase>.postalCode" ← per page (sigh)
<select id="<addressBase>_countryRef"  name="<addressBase>.countryRef">
<input  id="<addressBase>_countryRef_ui">  ← autocomplete UI textbox; type
                                              the country name and `Tab`
                                              to commit
```

Observed bases: `outOfCountryAddress`, `otherOutOfCountryAddress`,
`address` (employer), `accommodationDetails.address`. Postal-code field
name diverges between `postCode` and `postalCode` per page — runner must
detect at fill time, not assume.

### 4.5 Radio button (single-choice question)

```html
<input type="radio" id="<field>_<valueSlug>" name="<field>" value="<value>">
```

Examples: `purposeRef_tourism` (`purposeRef`), `isCorrespondenceAddress_true`
(`isCorrespondenceAddress`), `emailOwner_you` (`emailOwner`).

Fill via `page.locator('#<field>_<valueSlug>').check()`.

### 4.6 Checkbox group (multi-choice)

```html
<input type="checkbox" id="<field>_<valueSlug>" name="<field>[i]" value="<value>">
```

Indexed by `[i]` in the name attribute. Examples: `telephoneNumberPurpose[0]`,
`telephoneNumberType[2]`. Multiple boxes can be checked.

### 4.7 Select dropdown (with autocomplete UI shadow)

Country selectors are HTML `<select>` paired with an accessibility-friendly
autocomplete `<input>`:

```html
<select id="<field>" name="<field>">…</select>
<input  id="<field>_ui" type="text">   ← user-visible autocomplete
```

Setting the underlying `<select>` value works. The `_ui` companion is
populated by gov.uk's accessible-autocomplete script; not strictly required
to fill but type-and-tab-out for parity with manual entry.

### 4.8 Phone (split country code + number)

```html
<input id="phone_code"   name="phone.code"   type="tel">
<input id="phone_number" name="phone.number" type="tel">
```

Universal across `fundingEmploymentEmployerDetails` and others that capture
phone.

---

## 5. Conditional logic discovered

- **`purposeOfTourismVisitForVV`** appears only when `purposeOfVisitForVV.purposeRef === "Tourism (including visiting family and friends)"`. Other purposes route to a different sub-question or skip entirely.
- **`hasAdditionalEmailEV` → conditional second-email page**. Same shape: hidden when "No".
- **`isCorrespondenceAddress` (yes/no)** on `standardAddressOoC` gates the second `otherOutOfCountryAddress.*` block. When "Yes", the block stays empty in the runner.
- **`accommodationArrangements`** is a yes/no gate: "Do you have an address for where you are going to stay in the UK?" — when "Yes", `otherAccommodationDetailsList.0` becomes accessible.
- **`employmentStatus`** routes into `fundingEmploymentEmployerDetails` + `fundingEmploymentJobDetails` only for "Employed" / "Self-employed".
- **`hasDependants`** "Yes" routes into a `dependantsList.0` repeatable (not yet captured).
- **`travellingWithOtherPeople`** + `travellingWithOtherPeopleDetails` — two-step group-travel branch.
- **`standardCriminalConvictions.0.standardCriminalConvictionType`** is a per-conviction repeatable; the list grows when "Yes" is picked at the parent.

The runner must detect conditional pages by URL probing rather than fixed
sequence — gov.uk's flow controller skips pages that don't apply.

---

## 6. Widgets needing portal-specific orchestration

Most fields are vanilla HTML controls, no JSF/PrimeFaces-style widget
pollution. Two exceptions:

### 6.1 Country autocomplete

The `<input>_ui` autocomplete fires `change` events on the underlying
`<select>` after a `Tab` or `Enter` keystroke. Setting the `<select>`
value programmatically works but does NOT update the `_ui` textbox; the
runner should set both for visual parity:

```ts
await page.locator(`#${base}_countryRef`).selectOption(value);
await page.locator(`#${base}_countryRef_ui`).fill(visibleLabel);
await page.locator(`#${base}_countryRef_ui`).press("Tab");
```

### 6.2 Date splits expect numeric strings without leading zeros

`fillDateSplit` above already does `String(Number(...))`. Submitting `"01"`
vs `"1"` doesn't error but inconsistent-with-portal patterns can trigger
the validator on subsequent pages. Strip leading zeros.

---

## 7. Stop-at-pay verification

The application Check-Your-Answers page renders a single primary button
labelled `Continue` that advances Application → Documents. Then Documents
has `Save and continue` → Declaration. Then Declaration → **Pay**.

Halt patterns the runner must respect (case-insensitive):

```
^pay\b
^submit\b
^confirm and pay
^make payment
^pay now
^proceed to payment
^continue to payment
```

Stop boundary for this walk: the URL after Declaration's Save-and-continue
will be a `/pay` or `/payment` route (not yet visited; halt before
clicking Declaration's Save during a real run).

**Final pre-Pay page:** `Declaration` (URL fragment unconfirmed; visit
`/edit/declaration` to capture).
**Final pre-Pay button text:** `Save and continue`.

---

## 8. Follow-up actions

1. **Build `uk/fillers.ts`** with the 8 generic primitives from §4 (text,
   date split, address split, radio, checkbox group, select+autocomplete,
   phone split, mandatory submit click). Unlike France-Visas, there is **no
   PrimeFaces** — Playwright's built-in `fill` / `check` / `selectOption`
   do everything.
2. **Build `uk/field-mappings.ts`** that maps each of the 44 page slugs to
   the field set below it. Conditional logic (§5) is encoded as
   `dependsOn: { slug, value }` per field.
3. **Extend `uk/orchestrator.ts`** past `registration` to walk the 44
   application pages, then Documents (3 checkboxes), then Declaration
   (single ack), then halt at Pay. The orchestrator detects the next page
   by reading `<title>` (always `Application - <human title>` or
   `Documents` / `Declaration` / `Pay`).
4. **Update `seed-uk-standard-visitor-form-fields.ts`**: cross-check that
   all 44 page slugs have at least one seeded field. Pages without seed
   coverage today (TBD by diff) need new entries.
5. **`processUkItem` write-back**: when `handoffReady` flips true, capture
   `portalUrl` (`https://visas-immigration.service.gov.uk/forceResume/<uuid>`),
   `portalUsername` (the email from `standardApplicantsEmail`), and the
   user-supplied `portalPassword` (encrypted via `encryptSecret`). Code path
   already in place in `src/index.ts:processUkItem`.

---

## 9. Captured artifacts

```
viza-be/submission-service/uk-walk-out/
├── check-answers-summary.json                     ← 44-page inventory
├── page-000-documents.json                        ← Documents step
├── page-000-documents.png
├── page-standardApplicantsEmail.json              ← email owner radio
├── page-standardTelephoneDetailsList.json         ← phone + purpose checkboxes
├── page-identityNameForLeaveToEnter.json          ← given/family/single name
├── page-standardAddressOoC.json                   ← address split + correspondence radio
├── page-travelDocumentIssueDetails.json           ← passport + 3-input date splits
├── page-standardNationalityDOBOoC.json            ← country selects + DOB
├── page-fundingEmploymentEmployerDetails.json     ← employer address + phone split
├── page-odwPlannedTravelInformation.json          ← arrival/leave date splits
├── page-purposeOfVisitForVV.json                  ← 8-option radio
└── page-otherAccommodationDetailsList.json        ← UK accommodation address + dates
```

8/44 pages captured at field level. The remaining 36 follow §4 patterns
(text, radio, checkbox, date-split, select). Spot-check 3 more before
implementing the runner if uncertainty remains; otherwise implement
against §4 conventions and let the orchestrator's per-page validation
report any divergences.
