# India e-Visa Extraction Scope — v1

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-29

---

## 1. Canonical Journey

**Visa type:** India e-Visa (Tourist / Business / Medical / Conference)
**VIZA visa_type key:** `IN_E_VISA`

Government of India Ministry of Home Affairs Bureau of Immigration
issues e-Visa via `https://indianvisaonline.gov.in/evisa`. Public
portal — applicant creates an application reference on first visit.

Seven variants on `visa_type_requested`:
- e-Tourist 30-day double entry (~USD 25)
- e-Tourist 1-year multi (~USD 40)
- e-Tourist 5-year multi (~USD 80)
- e-Business 1-year multi (~USD 80, max 180-day stay)
- e-Medical 60-day triple (~USD 80)
- e-Medical-Attendant 60-day triple (~USD 80)
- e-Conference 30-day single (~USD 80, MEA clearance required)

### Application Structure

9 steps (extends Asia-tourist 8-step template with a Purpose-Specific
Details sub-journey gated by purpose_of_visit):

1. Personal Information (incl. SAARC nationality + religion + parents'
   nationality + parents' birthplace)
2. Passport
3. Contact & Home Address
4. Occupation
5. Trip Details (incl. cities to visit)
6. Purpose-Specific Details (business / medical / conference sub-journeys)
7. Host in India (with Aadhaar / PAN / passport)
8. Travel History (incl. countries visited last 10 years)
9. Character & Declaration

---

## 2. v1 Scope

- 7 submission variants
- ~110 fields (largest non-DS-160 schema, second only to UK Standard
  Visitor in conditional complexity)
- IN-specific: SAARC nationality block, religion + parents' nationality
  + parents' birthplace, transgender option in sex select, MEA clearance
  number for conference visa, cities-to-visit textarea, biometric-on-
  arrival workflow

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| Regular Tourist Visa (paper) | Consular flow |
| Employment Visa | Sponsor-driven |
| Student Visa | School-sponsored |
| Research Visa | MEA pre-clearance |
| Journalist Visa | Special category |
| OCI (Overseas Citizen of India) | Lifetime card, distinct legal status |
| Diplomatic / Service / Official | Bilateral channels |

---

## 4. Known Source-Flow Ambiguities

1. Live-portal QA possible — public portal, no account.
2. Stay-length nationality cap (90 days for most; 180 for US/UK/CA/JP
   on e-Tourist 1-year/5-year). Schema regex caps at 180; live portal
   filters per nationality.
3. SAARC nationality declaration is jurisdiction-specific intelligence
   gathering — applicants from / formerly from BD/BT/NP/PK/LK/MV/AF
   trigger additional scrutiny.
4. MEA conference clearance number is mandatory for e-Conference visa
   only. Captured in step 6 sub-journey.
5. Date format DD/MM/YYYY.
6. Biometric on arrival is portal-side workflow, not in form.

---

## 5. Design Principle

Source-truth-over-manual-approximation.

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-in-e-visa-form-fields.ts
```

---

## 7. Source Material

- indianvisaonline.gov.in/evisa public landing
- MEA / Bureau of Immigration applicant guidance
- Form-VI (consular paper antecedent)
- Indian High Commission applicant guidance pages
  (London, Washington, Beijing, Tokyo, Singapore — cross-checked)

---

## 8. Next Expansion Path

1. Live-portal QA pass (easy, public).
2. IN e-Visa Playwright runner (no auth, well-defined form).
3. `IN_OCI` (Overseas Citizen of India) lifetime card.
4. `IN_EMPLOYMENT_VISA` consular.
5. `IN_STUDENT_VISA` consular.

---

**Maintainer:** Edward Zehua Zhang
