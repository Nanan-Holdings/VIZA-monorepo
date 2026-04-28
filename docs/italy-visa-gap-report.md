## Italy Schengen Type C — China Corridor — Gap Report

**Generated:** 2026-04-27
**Schema version:** v1 (reused from `seed-eu-schengen-c-short-stay-form-fields.ts`)
**Visa type:** `EU_SCHENGEN_C_SHORT_STAY`
**Submission corridor:** `IT_VFS_CN` (Italy ← China via VFS Global)
**Adapter:** `viza-be/submission-service/src/italy-vfs-cn/`

Goal: when a user is assigned the `EU_SCHENGEN_C_SHORT_STAY` package
with destination Italy and residency in China, VIZA can prefill the
VFS Global Italy China-corridor application form to a 1:1 schema match
of the harmonized Annex I question set.

---

## 1. Coverage Summary

### Schema (field-level)

**Identical to** `docs/schengen-visa-gap-report.md` §1 — the
`EU_SCHENGEN_C_SHORT_STAY` seed is the canonical field set. No
divergence introduced for Italy. All 171 fields across 12 logical
sections are reused as-is.

### Submission corridor (autofill driver)

| Component | Status | Notes |
|-----------|--------|-------|
| `errors.ts` | Complete | `ItVfsError` taxonomy parallel to `FvError` and `AuError` |
| `pages.ts` | Conjectural | Page-id enum scaffolded from VFS Global SPA pattern; URL regex stubs marked `TODO(walk)` |
| `selectors.ts` | Conjectural | Selector groups scaffolded; DOM names are placeholders pending live walk |
| `normalize.ts` | Skeleton | Type signatures + harmonized → corridor mapping outline; field-level mappings TBD post-walk |
| `index.ts` | Public surface | Re-exports all modules |
| `fill-steps.ts` | **Not yet implemented** | Top open item — depends on live walk |
| `run.ts` | **Not yet implemented** | Top-level entry — depends on `fill-steps.ts` |
| Queue worker dispatcher | Not yet wired | Awaits `run.ts` |
| Recon walk script | Template | `viza-be/submission-service/scripts/walk-italy-vfs-cn.ts` ready to run against a provisioned VFS-CN account |

---

## 2. Gaps and Limitations

### 2.1 Live-portal QA — VFS-CN form not driven

**Status:** open
**Impact:** High — autofill cannot ship to production without it.

**Why deferred:** VFS Global's China-Italy form is behind a VFS account
identity gate. Driving it requires a real (or operationally-provisioned)
VFS-CN account, which is out of band for this scaffold pass.

**Workaround:** the harmonized schema is already authoritative against
the EU Commission Annex I PDF (`schengen-visa-gap-report.md` §4). The
field inventory is correct. What remains is the corridor's DOM
mapping, page identity, and validation contract — all captured by a
single recon walk.

**Action:** run `walk-italy-vfs-cn.ts` with a VFS-CN test account, then
fold the captured DOM into `selectors.ts` and `pages.ts`. Implement
`fill-steps.ts`. Live-walk acceptance criteria match France-Visas
walk-report (`france-visas-walk-report.md`) — converge in ≤10
iterations.

### 2.2 Cloudflare Turnstile / anti-bot at VFS

**Status:** flagged
**Impact:** Medium — failure mode rather than gap.

VFS Global gates registration with Cloudflare Turnstile and may
challenge login under anomalous-traffic conditions. The scaffold's
stealth-browser launch profile is shared with France-Visas
(`"france-visas"` hardening); a VFS-specific profile lift may be
required if Turnstile fires consistently.

**Workaround:** until Turnstile-solver wiring lands, gate-detect at
the registration step and route to `it_blocked` queue status with
operator handoff (mirror CEAC `GateDetectedError` → `ds160_blocked`).

### 2.3 Document upload

**Status:** out of scope per playbook §5.6
**Impact:** None — by-design boundary.

Supporting documents (passport scan, photo, itinerary, insurance,
funds proof, employer letter) live in `application_documents` and
are uploaded through VIZA's existing document flow, not the
autofiller. The runner stops at the appointment-eligibility step
before VFS prompts for uploads.

### 2.4 Appointment booking + payment

**Status:** out of scope (deliberate stop boundary)
**Impact:** None — applicant attestation boundary.

VFS appointment slots are time-scarce, identity-attested, and require
the applicant to commit to a date + city. Booking is left to the
applicant. Payment is handled at the appointment.

### 2.5 No corridor-specific schema fields

**Status:** by-design
**Impact:** None.

Per playbook §11.13, country-portal-specific questions (if discovered)
go behind a `fv_*`-style prefix in the corridor's `normalize.ts`, not
the seed. Initial inspection of public VFS-CN pages did not surface
non-Annex-I questions, but the live walk is the source of truth.

### 2.6 Other Italy corridors (Italy-from-India, Italy-from-MENA, etc.)

**Status:** future packages
**Impact:** None on v1.

Each corridor adapter is independent: copy `italy-vfs-cn/` to
`italy-vfs-<corridor>/`, update URL constants, rerun the walk. The
schema does not move.

---

## 3. Conditional-logic status

All conditional-logic operators carry over from the
`EU_SCHENGEN_C_SHORT_STAY` schema:

- `||` (OR) — exercised by `IS_EVENT`, `COST_SELF`, `COST_SPONSOR` gates
- `&&` (AND) — exercised by `IS_ATV_NATIONAL`
- `in` / `not in` — exercised by `IS_ATV_NATIONAL` Annex IV nationality list
- `required_unless` — exercised by 44 starred fields for UK Withdrawal Agreement beneficiaries
- Cross-step gating — supported (since UK-005 v2 fix to `DynamicStepForm`)

No new operators or gates are introduced for the Italy corridor.

---

## 4. Reviewer Checklist

- [ ] `EU_SCHENGEN_C_SHORT_STAY` seed already applied (`schengen-visa-gap-report.md` reviewer checklist)
- [ ] No new package or migration required for Italy
- [ ] `italy-vfs-cn/` module typechecks cleanly (`cd viza-be/submission-service && npm run type-check`)
- [ ] Recon walk script runs against `https://visa.vfsglobal.com/chn/en/ita/` pre-login
- [ ] Live walk completed with a provisioned VFS-CN account
- [ ] `pages.ts` `ItVfsPageId` enum confirmed against live URL set
- [ ] `selectors.ts` field groups populated from live DOM
- [ ] `normalize.ts` field-level mappings filled in
- [ ] `fill-steps.ts` per-page fillers implemented
- [ ] `run.ts` end-to-end runner stops at appointment-eligibility (no booking, no payment)
- [ ] Submission-service worker wired (`processItVfsCnItem` + `it_prefill_pending` status)
- [ ] Result card surfaces VFS reference + appointment-booking CTA

---

## 5. Schema source-truth checklist

- [x] Schema reused from `EU_SCHENGEN_C_SHORT_STAY` — no Italy-specific schema additions
- [x] No new seed script created (playbook §3 Step 1: name by visa type, not country)
- [x] No new `visa_packages` row (multilateral visa rule)
- [x] Stop boundary documented (appointment-eligibility, mirrors France-Visas stop-at-PDF)
- [ ] Live VFS-CN portal QA — pending operational account

---

## 6. Open Questions for Live Walk

These are the specific things the recon walk must answer:

1. **Number of wizard pages.** VFS SPAs typically render 4–8; France-Visas was 6. Italy?
2. **Section ordering.** Does VFS-Italy match Annex I order (personal → travel doc → contact → trip → purpose → cost → declaration)? Or its own rearrangement?
3. **Repeatable groups.** How does the form render `previous_schengen_visa` repeats, `other_nationalities`, `previous_schengen_visa_fingerprints`? Add-row buttons? Modal? Inline?
4. **Conditional reveals.** Same gate-and-reveal pattern as France-Visas (occupation → employer block, has-host → host block)? Or pre-rendered with disabled inputs?
5. **Validation surface.** Per-field inline errors? A validation summary banner? Both? Selector?
6. **Save / draft semantics.** Auto-save? Explicit "Save draft" button? Side-effects (e.g. France-Visas Yes/No modal after step 1)?
7. **Appointment selection page identity.** Is appointment-eligibility a separate URL (good — clear stop point) or embedded in the form (need a heading-based stop marker)?
8. **Reference / draft ID.** What's the equivalent of France-Visas's `FRA1PE...` reference?
9. **Captcha surface.** Does login fire Turnstile under headless? Under stealth-hardening?
10. **i18n.** Is there an `?lang=en` URL parameter? Cookie-based? Query-string? Selector pinning depends on this.
