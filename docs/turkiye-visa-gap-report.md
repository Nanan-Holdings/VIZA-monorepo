# Türkiye Tourist e-Visa Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped, live-portal QA easy and pending
**Created:** 2026-04-28

---

## 1. Coverage Summary

`TR_E_VISA` registered as a `visa_packages` row and seeded with:

- 8 logical steps
- ~70 fields
- 11+ conditional gates, 3 repeat groups
- Two entry-frequency variants on `visa_type_requested`
- Two purposes (tourism / commerce)
- TR-specific: dual-language country naming (Türkiye / Turkey),
  comprehensive port-of-entry list (8 airports + 4 land borders +
  3 cruise ports)

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match MFA guidance | ✅ |
| Field labels match live evisa.gov.tr | ⚠️ Pending live QA (low effort) |
| Stay-length nationality cap | ⚠️ Schema caps 90; live portal enforces |
| Date format | ✅ DD/MM/YYYY |
| Document upload | ❌ Out-of-schema |
| Submission automation | ❌ Out-of-scope v1; portal is open + automatable |

---

## 3. Conditional-Logic Status

`===` only.

---

## 4. Document Uploads — Out of Schema

evisa.gov.tr requires the form fields only — most documents are
verified at the border. Travellers should still carry: hotel booking,
return ticket, financial proof, passport.

---

## 5. Submission Automation — Strong Candidate

`evisa.gov.tr` is one of the most automation-friendly e-Visa portals
in this catalog: no account, no Cloudflare/WAF (as of 2026-04), simple
multi-step form, predictable validation. After live QA, this is a
high-priority Playwright runner candidate.

Per playbook §13, deferred until first applicant.

---

## 6. Top Open Items

1. **Live-portal QA pass** (easy: no auth needed).
2. **Playwright submission runner** — high ROI given low automation
   barriers.
3. **Stay-length nationality lookup table** — internal mapping for
   showing applicants the correct max-stay.

---

## 7. Reviewer Checklist

- [ ] Seed run: `Done: N rows seeded (N defined)` matches
- [ ] `npm run type-check` passes
- [ ] Migration `0033_tr_e_visa_package.sql` applies cleanly
- [ ] All 8 steps render via `DynamicStepForm`

---

## 8. Open Items / Future Work

| Item | Priority | Effort |
|------|----------|--------|
| Live-portal QA pass | High | XS (no auth) |
| Playwright submission runner | High | M |
| Nationality → max-stay mapping table | Med | S |
| `TR_RESIDENCE_PERMIT` | Med | L |
| `TR_WORK_PERMIT` (employer-driven) | Low | XL |
| `TR_STUDENT_VISA` | Low | L |

---

**Maintainer:** Edward Zehua Zhang
