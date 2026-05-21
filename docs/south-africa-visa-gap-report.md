# South Africa Visitor's Visa + eVisa Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped
**Created:** 2026-04-29

---

## 1. Coverage Summary

`ZA_VISITOR_VISA` registered with:

- 8 logical steps incl. yellow-fever endemic-country travel screening
- ~80 fields
- 13+ conditional gates (incl. life-partner via `||`, yellow-fever
  certificate dependent on endemic-country travel)
- 3 repeat groups
- 3 submission variants (eVisa, Visitor Single, Visitor Multiple)

ZA-specific: life-partner status, yellow-fever screening (SA +
endemic countries), available funds ZAR, 6-airport + 6-SADC-land-border
+ 2-cruise-port port-of-entry list.

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match DHA-1738 + VFS guidance | ✅ |
| eVisa live form | ⚠️ Pending live QA |
| VFS Global Visitor's Visa form | ⚠️ Pending live QA (account-gated) |
| Life-partner gating (married OR life_partner) | ✅ Uses `||` (joins NZ + CA) |
| Yellow-fever certificate (gated on endemic-country travel) | ✅ |
| Date format | ✅ DD/MM/YYYY |
| Document upload | ❌ Out-of-schema |
| Submission automation | ❌ Out-of-scope |

---

## 3. Conditional-Logic Status

Operators in use: `===`, `||` (married OR life_partner). Joins NZ +
CA as third VIZA schema using `||` in sub-journey gate. Cross-step
dependency: yellow-fever certificate gates on yellow-fever travel
declaration in same step.

---

## 4. Document Uploads — Out of Schema

- Passport bio
- Recent photograph
- Financial proof
- Return / onward ticket
- Accommodation booking
- Sponsor invitation letter (where applicable)
- Yellow Fever Vaccination Certificate (if traveling from endemic country)

---

## 5. Submission Automation — Out of Scope v1

eVisa is publicly accessible (selected nationalities only). VFS Global
Visitor's Visa requires VFS account.

---

## 6. Top Open Items

1. eVisa live-portal QA pass.
2. VFS Global walk + recon (account-gated).
3. eVisa Playwright runner.

---

## 7. Reviewer Checklist

- [ ] Seed run matches
- [ ] type-check passes
- [ ] Migration `0041_za_visitor_visa_package.sql` applies
- [ ] All 8 steps render
- [ ] Life-partner sub-journey opens for `married` OR `life_partner`
- [ ] Yellow-fever certificate appears when endemic-country travel = yes

---

## 8. Open Items / Future Work

| Item | Priority | Effort |
|------|----------|--------|
| eVisa live-portal QA | High | M |
| VFS Global walk recon | Med | M |
| eVisa Playwright runner | High | M |
| `ZA_CRITICAL_SKILLS_WORK_VISA` | High | XL |
| `ZA_BUSINESS_VISA` | Med | L |
| `ZA_RELATIVES_VISA` | Low | L |

---

**Maintainer:** Edward Zehua Zhang
