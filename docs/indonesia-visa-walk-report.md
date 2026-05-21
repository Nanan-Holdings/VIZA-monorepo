# Indonesia eVisa Portal — Live Walk Report

**Generated:** 2026-04-28
**Portal:** `evisa.imigrasi.go.id`
**Visa scope:** `ID_C1_TOURIST` (C1 Tourist Single Entry, formerly B211A)
**Recon script:** `viza-be/submission-service/scripts/walk-id-evisa.ts`
**Raw capture archive:** `docs/indonesia-visa-recon-2026-04-28.json`
**Recon mode:** Public-pages only (no WNA account provisioned)

---

## 1. Walk summary

| Page | URL | Visible fields | Heading / title |
|------|-----|---------------|------------------|
| 1 | `/` (landing) | 0 inputs | "The Official e-Visa Website for Indonesia" |
| 2 | `/front/info/evoa` | 0 inputs | "General Information" — visa categories overview |
| 3 | **`/front/register/wna`** | **18 inputs (28 in DOM)** | WNA (foreign national) registration form |
| 4 | `/front/register/guarantor-register` | 24 inputs (82 in DOM) | Indonesian-side guarantor / sponsor registration form |
| 5 | `/front/faq/aff9642b-…` | 0 inputs | General Information FAQ |
| 6 | `/front/faq/dd5c2220-…` | 0 inputs | Tourist visa requirements FAQ |

**The post-registration C1 application form is identity-gated** behind a
verified WNA account and was NOT walked in this run. A follow-up walk
with a provisioned account is required before the schema can be marked
production-ready (gap report §3.1, §7).

---

## 2. WNA registration form — confirmed field set (page 3)

The 18 visible fields on `/front/register/wna` are the canonical applicant
identity gate that every C1 applicant fills in before the application
form unlocks.

### 2.1 Field map (live → seed)

| Live field | Type | Required | Maps to seed field | Notes |
|---|---|---|---|---|
| `document_travel_id` | select (14 opts, UUIDs) | yes | `passport_type` | UUID-keyed; runner translates seed enum (ordinary / diplomatic / official / travel_document / other) |
| `full_name` | text | yes | `surname` + `given_names` | **DRIFT — see §3.1** |
| `gender` | radio MALE / FEMALE | yes | `sex` | Live uses uppercase MALE / FEMALE; seed uses lowercase male / female; runner case-folds |
| `birth_place` | text | yes | `place_of_birth_city` (+ `_country`) | **DRIFT — see §3.2** |
| `birthday` | text DD/MM/YYY | yes | `date_of_birth` | Placeholder typo on live ("YYY"); accepts YYYY |
| `phone_code` | select (262 country codes) | no | (split out of `telephone_number`) | **DRIFT — see §3.3** |
| `mobile_phone` | text | no | `mobile_number` | semantic match |
| `mother` | text | yes | `mother_full_name` | **CONFIRMED Indonesian-immigration-specific requirement** |
| `passport_number` (id=`number`) | text | yes | `passport_number` | ✓ |
| `country_id` | select (228 countries, UUIDs) | yes | `passport_country` | UUID-keyed; runner translates ISO-3166 |
| `release_date` | text DD/MM/YYY | yes | `passport_issue_date` | naming drift, semantic match |
| `expired_date` | text DD/MM/YYY | yes | `passport_expiry_date` | naming drift, semantic match |
| `release_place` | text | yes | `passport_place_of_issue` | naming drift, semantic match |
| `_username` (id=`username`) | text | yes | (account email) | not in seed — account-creation only |
| `confirm_email` | text | yes | (account email confirm) | account-creation only |
| `_password` | password | yes | (account password) | account-creation only |
| `_confirm_password` | password | yes | (account password confirm) | account-creation only |

### 2.2 Document-type select (`document_travel_id`) — 14 options

The select holds 14 UUID-keyed options. The runner must build a
text-to-UUID map at runtime by reading the `<option>` text values. From
the recon JSON:

```
document_travel_id options (UUIDs only — texts not captured in this pass):
  152cc4bc-7f8a-4828-b6a8-c252b932d942
  6523cd39-5fc8-4573-99da-a6e20af32d45
  9734eea2-efc7-44ee-b280-f3e45f579d86
  37341319-791e-40b5-b5a8-9257133d5f1c
  3487b014-b7da-45eb-88bd-1d54f3bc6355
  ... (14 total)
```

**Action:** the next recon pass should capture option *text* (the
visible label) alongside the UUID `value`. The current recon JSON has
both — they're recorded as `{value, text}` pairs in
`indonesia-visa-recon-2026-04-28.json`. Use those when building the
runner's enum mapping.

---

## 3. Drift between live registration form and reconstructed seed

These are concrete deltas the v1 seed needs reconciling with. None
break the schema (the runner mediates between canonical names and live
field names) but they affect what the runner does at submission time.

### 3.1 `full_name` is one field on the live portal

Live registration uses a single `full_name` text input. The seed splits
into `surname` + `given_names`. **No seed change needed** — splitting
is the canonical / passport-formatted shape (SURNAME, Given Names per
ICAO 9303). The runner concatenates `surname + ", " + given_names` when
filling the live `full_name` input.

Justification: passports format names as "SURNAME, Given Names"; many
downstream country portals (UK, Schengen, JP) split. Keeping the seed
split keeps cross-country re-use cleaner.

### 3.2 `birth_place` is one free-text field on the live portal

Live registration has a single `birth_place` text input. The seed
splits into `place_of_birth_city` + `place_of_birth_country` (a country
picker). **No seed change needed** — splitting captures structured data
that the runner concatenates as `"<city>, <country>"` when filling the
live input.

### 3.3 Phone is `phone_code` (select) + `mobile_phone` (text), not free-text combined

Live registration splits country code (select, 262 country codes,
UUID-keyed) from phone number. The seed has free-text
`telephone_number` + `mobile_number` with country-code-included
placeholders. **Seed change deferred** — the canonical model is
runner-agnostic; the runner extracts `+<dial-code>` prefix from the
seed value and fills `phone_code` + `mobile_phone` separately. If
multiple country portals diverge on this, revisit.

### 3.4 No `passport_issuing_authority` on the registration form

The seed has `passport_issuing_authority` but the live registration
does not collect it. **Likely on the post-registration C1 application
form** (most portals separate "issuing authority" from "place of
issue"). Confirmed only when the gated walk happens.

### 3.5 No `nationality` on the registration form

The seed has a `nationality` country picker on step 1; live registration
asks only for `country_id` (passport issuing country). Most applicants'
nationality matches their passport issuing country, but dual nationals
and travel-document holders need both — keeping the field in the seed
because the post-registration application form is expected to ask.

### 3.6 No `marital_status` on the registration form

Same logic as 3.5 — registration is identity-gate only; martial status
+ spouse block + occupation + trip details + sponsor + travel history
+ character questions all live on the post-registration application
form, which was not captured in this walk.

### 3.7 Sponsor / guarantor block — additions from page 4 (`/guarantor-register`)

The Indonesian-side guarantor registration page (used by sponsoring
individuals or institutions) confirms several sponsor identifiers and
revealed one missing field:

- `npwp` (Indonesian Tax ID, Nomor Pokok Wajib Pajak — 15-16 digit) was
  REQUIRED on the corporate-sponsor form. **Patched into the seed** as
  `sponsor_corporate_npwp` (required when `sponsor_type === corporate`).
- `NO_NIB` (Business Registration Number) was OPTIONAL on the live
  guarantor form. Seed updated: `sponsor_corporate_nib` is now
  `required: false`.
- `agencyType` (55 UUID-keyed options) and `businessType` (7 options)
  selects exist on the corporate-sponsor flow. **Not added to seed in
  v1** — these are organisation-classification fields the corporate
  sponsor selects when they register an account, not data the visa
  applicant provides. Revisit if applicant-side input is needed.
- Granular Indonesian address: `address` + `no` (street number) + `rt`
  + `rw` + `postal_code` + `province_name` + `city_name` +
  `district_name` + `village_name`. **Deferred to v1.1** — the seed
  uses a single `sponsor_address` text field; runner splits when
  filling the live form. Indonesian-style RT/RW addressing is rare
  outside Indonesia and adding 8 sponsor fields for a use case that's
  already gated (only sponsored applicants see the block) was not worth
  the schema bloat in v1.

### 3.8 Field name conventions on the live portal

The live portal uses Indonesian-influenced names:
- `release_date`, `release_place` (not `issue_date`, `place_of_issue`)
- `expired_date` (not `expiry_date`)
- `mother` (not `mother_name` / `mother_full_name`)
- `birthday` (not `date_of_birth`)
- `_username` / `_password` (Symfony-style underscore prefix)

**Seed retains canonical names** — consistent with US / UK / JP / VN /
AU / SCH. Runner translates at submission.

---

## 4. Updated coverage delta

After applying the seed patch (NPWP + NIB optional), the seed has:

| Section | Live-portal QA status | Field count |
|---|---|---|
| Personal Information (step 1) | **Partial** — registration subset confirmed; marital_status / spouse block / nationality unverified | 17 |
| Passport (step 2) | **Partial** — registration subset confirmed (number, type, country, dates, place of issue); `passport_issuing_authority` + `has_other_passports` repeatable unverified | 10 |
| Contact & Home Address (step 3) | **Unverified** — not on registration | 8 |
| Occupation (step 4) | **Unverified** — not on registration | 5 |
| Trip Details (step 5) | **Unverified** — not on registration | 12 |
| Sponsor in Indonesia (step 6) | **Partial** — corporate sponsor fields confirmed via guarantor-register page; sponsor_corporate_npwp added (required); NIB demoted to optional | 12 |
| Travel History (step 7) | **Unverified** — not on registration | 9 |
| Character & Declaration (step 8) | **Unverified** — not on registration | 10 |
| **Total** | **Reg-form fields confirmed; application-form fields still reconstructed** | **83** |

---

## 5. Remaining open items (post-walk)

1. **Provision a WNA account** — required to walk the
   post-registration C1 application form. Single biggest open item.
2. **Re-run `walk-id-evisa.ts --login`** with `ID_EVISA_EMAIL` /
   `ID_EVISA_PASSWORD` env vars set. The login arm of the script will:
   - Click the Login link from the landing page
   - Fill credentials
   - (interactive flag) pause for any CAPTCHA / 2FA
   - Walk the dashboard → "Apply for visa" → C1 form steps autonomously
     up to the first terminal "Pay" / "Submit" button
3. **Patch the seed** for any drift the gated walk surfaces, especially:
   - Confirmed step-by-step layout of the C1 application form (currently
     reconstructed as 8 logical steps, but the live portal may use
     fewer / more / differently-named pages)
   - Marital status + spouse block requiredness and conditional
     structure
   - Trip details: arrival date, length of stay, port of entry,
     accommodation (free-text vs select; multi-destination support)
   - Travel history: prior visits / refusals / character questions

4. **Capture select-option text** alongside UUID values for
   `document_travel_id`, `country_id`, `phone_code`, `agencyType`,
   `businessType`, `nationality_id`. The recon JSON already has both
   `value` and `text` for every option — use those tables when building
   the submission runner's enum-translation map.

5. **Document upload behaviour** — the `Upload` submit button on the
   registration form is the file picker for the passport bio scan and
   photo; capture the accepted MIME types and any image-quality
   constraints (red / white background, 600×600, etc.) when the runner
   walks the live upload step.

---

## 6. Honesty disclosure

- [x] Live portal walked: **Partial** — public pages + WNA registration
      form (identity-gate fields) walked. Post-registration application
      form NOT walked (gated).
- [x] All public-page captures saved: **Yes** —
      `docs/indonesia-visa-recon-2026-04-28.json` (6 pages, 129 KB)
- [x] Recon script committed: **Yes** —
      `viza-be/submission-service/scripts/walk-id-evisa.ts`
- [x] Drift between reconstruction and live registration documented:
      **Yes** — §3
- [x] Seed patched for confirmed drift: **Yes — NPWP added to corporate
      sponsor (required); NIB demoted to optional.** Other drift items
      (full_name, birth_place, phone_code split) handled at runner
      level, not schema level.
- [ ] Post-registration C1 application walked: **No** — pending account
      provisioning. Single biggest open item.
- [ ] Submission automation runner: **Not started** — needs the gated
      walk first.

---

## 7. Files touched in this pass

- `viza-be/submission-service/scripts/walk-id-evisa.ts` (new — recon
  driver, public-pages + optional `--login` walk arm)
- `docs/indonesia-visa-recon-2026-04-28.json` (new — raw recon archive)
- `docs/indonesia-visa-walk-report.md` (this file)
- `viza-be/agent-backend/scripts/seed-id-c1-tourist-form-fields.ts`
  (patched: +`sponsor_corporate_npwp`, NIB demoted to optional, display
  orders bumped to keep monotonic ordering inside the sponsor block)
- `docs/indonesia-visa-gap-report.md` (updated coverage delta + QA
  status — see follow-on commit)
