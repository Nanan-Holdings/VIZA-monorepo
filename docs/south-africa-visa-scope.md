# South Africa Visitor's Visa + eVisa Extraction Scope — v1

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-29

---

## 1. Canonical Journey

**Visa type:** South Africa Visitor's Visa (Sec 11) + eVisa pilot
**VIZA visa_type key:** `ZA_VISITOR_VISA`

DHA (Department of Home Affairs) processes Visitor's Visa via VFS
Global. The canonical public application route — verified live on
2026-04-30 — is the country-specific VFS portal at
`https://visa.vfsglobal.com/zaf/en/dha`.

The previously listed `https://www.evisa.gov.za` host does **not**
resolve (NXDOMAIN), and `https://ehome.dha.gov.za` returns 403/404
on every public path probed (it is the internal Home Affairs portal,
not the applicant entry point). The DHA website
(`https://www.dha.gov.za`) only links outward to VFS Global —
`https://visa.vfsglobal.com/zaf/en/dha/attend-centre`,
`https://visa.vfsglobal.com/zaf/en/dha`. Treat VFS as the sole live
target for ZA recon and orchestration.

The eVisa pilot for selected nationalities (CN, IN, NG, KE, CM, MX,
SA, AE, EG) is currently routed through the same VFS pages — there
is no separate self-service eVisa host as of this scope's verification
pass.

Three variants on `visa_type_requested`:
- eVisa (selected nationalities, ~ZAR 1,520, online)
- Visitor Single Entry (~ZAR 1,520, up to 3-month stay)
- Visitor Multiple Entry (~ZAR 1,520, up to 3-year validity,
  3-month stay per entry)

### Application Structure

8 steps including yellow-fever endemic-country travel screening
(mandatory SA public-health rule):

1. Personal Information (incl. life-partner status)
2. Passport
3. Contact & Home Address
4. Occupation
5. Trip Details (incl. available funds ZAR)
6. Host in South Africa (with SA ID / passport number)
7. Travel History (incl. yellow-fever screening)
8. Character & Declaration

---

## 2. v1 Scope

- 3 submission variants
- ~80 fields
- ZA-specific: life-partner status (Sec 11 distinct from married),
  yellow-fever screening, comprehensive port-of-entry list (6 airports
  + 6 SADC land borders + 2 cruise ports)

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| General Work Visa | Sponsor-driven |
| Critical Skills Work Visa | Skills list assessment |
| Intra-Company Transfer | Multinational employer |
| Business Visa | Investment requirement |
| Study Visa | Sponsor-driven (school) |
| Relative's Visa | Family-sponsored |
| Retired Person's Visa | Means-tested |
| Treaty Visa | Bilateral channels |
| Permanent Residence | Different application |
| Asylum Seeker Permit | Distinct legal track |

---

## 4. Known Source-Flow Ambiguities

1. Live-portal QA partially possible — eVisa is open; Visitor's Visa via
   VFS Global is account-gated.
2. Life-partner gating (`||` with married) — second VIZA schema after
   NZ + CA using compound OR.
3. Yellow-fever screening is jurisdiction-specific (SA + ~20 African +
   Asian countries). Schema gates yellow-fever certificate question on
   yes-radio for endemic-country travel.
4. Date format DD/MM/YYYY.

---

## 5. Design Principle

Source-truth-over-manual-approximation.

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-za-visitor-visa-form-fields.ts
```

---

## 7. Source Material — Reconstruction Disclaimer

- DHA-1738 (Application for Visa) paper antecedent
- DHA-84 forms
- VFS Global SA applicant guidance
- VFS Global ZA-DHA portal landing + attend-centre page
  (visa.vfsglobal.com/zaf/en/dha — recon captured 2026-04-30,
  20 fields across 2 pages)
- DHA Immigration Act Sec 11 reference

**Live-portal QA pass** runs through VFS Global; both Visitor's Visa
and the eVisa pilot use the same portal entry point. A VFS account
is required before the form surface becomes navigable.

---

## 8. Next Expansion Path

1. eVisa live-portal QA (easy).
2. eVisa Playwright runner.
3. `ZA_CRITICAL_SKILLS_WORK_VISA` (high-value).
4. `ZA_RELATIVES_VISA` family.
5. `ZA_BUSINESS_VISA`.

---

**Maintainer:** Edward Zehua Zhang
