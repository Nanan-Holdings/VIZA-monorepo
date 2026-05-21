## Italy Schengen Type C Visa — China Corridor — Extraction Scope

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-27

---

## 1. Canonical Journey

**Visa type:** Schengen Short-Stay Visa (Type C) — issued by an Italian
consulate to a resident of mainland China (PRC), submitted through the
VFS Global Italy China corridor.

**VIZA visa_type key:** `EU_SCHENGEN_C_SHORT_STAY` (existing — schema is
reused, not duplicated).
**VIZA submission corridor key:** `IT_VFS_CN`.

Italy is a Schengen member state. Applicants apply on the harmonized
**Annex I** application form (Regulation (EC) 810/2009 as amended by
Regulation (EU) 2019/1155) — the same form France-Visas implements.
The schema is therefore identical to the existing
`EU_SCHENGEN_C_SHORT_STAY` seed; this corridor exists only because the
**submission portal differs**.

Unlike France, Italy's Ministry of Foreign Affairs (MAECI) has not
deployed a unified online application portal equivalent to
`france-visas.gouv.fr`. Each Italian consulate routes applicants
through a different operational channel — most commonly **VFS Global**
(`visa.vfsglobal.com`). This scope pins the **China-VFS** corridor as
the v1 Italy submission target.

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility / consular guidance | `https://ambpechino.esteri.it/` (Beijing), `https://consshanghai.esteri.it/` (Shanghai), `https://consguangzhou.esteri.it/` (Guangzhou), `https://conschongqing.esteri.it/` (Chongqing) | Italian consulate websites direct applicants to VFS for visa lodgement |
| 2. Submission portal | `https://visa.vfsglobal.com/chn/zh-cn/ita/` (zh-CN) and `/chn/en/ita/` (en) | VFS Global China–Italy lodgement and appointment booking |
| 3. Application form | Embedded in the VFS account (post-login) — collects Annex I fields, supporting docs, appointment slot | Identity-gated, requires VFS account |
| 4. Biometrics + document handover | VFS Application Centres in Beijing, Shanghai, Guangzhou, Chongqing, Wuhan, Chengdu, Hangzhou, Jinan, Kunming, Shenyang, Wuxi, Xi'an | In-person biometrics capture and physical-document submission |
| 5. Decision / passport return | VFS courier or in-person collection | Out-of-band post-submission |

The **v1 submission target** is step 3 — the VFS Italy China-corridor
form. The schema (the field set) is already canonical via
`EU_SCHENGEN_C_SHORT_STAY`; this corridor adds the autofill driver.

### Application Structure

Same 12 logical steps as the harmonized Annex I schema — see
`docs/schengen-visa-scope.md` §1 for the canonical breakdown. The VFS
Italy form consolidates these into ~5–7 web wizard pages (exact step
count to be confirmed by live walk; mirrors the France-Visas 12→6
collapse pattern).

---

## 2. v1 Scope — What Is Included

- **One submission corridor:** Italy-from-China via VFS Global.
- **One visa category:** Schengen Type C short-stay (≤90 days in any 180-day period).
- **Schema reuse:** the existing `EU_SCHENGEN_C_SHORT_STAY` seed is the canonical field set. **No new seed, no new package row.**
- **Submission corridor adapter:** new submission-service module
  `viza-be/submission-service/src/italy-vfs-cn/` parallel to
  `france-visas/` and `au-visitor/`. Provides errors, pages, selectors,
  normalize, and (post-walk) fill-steps for the VFS portal.
- **Stop boundary:** stop after the application is saved as a draft and
  the appointment-eligibility step is reached. **No automated
  appointment booking, no payment.** Mirrors France-Visas
  stop-at-PDF and AU stop-at-review.

---

## 3. Out-of-Scope

| Item | Reason |
|------|--------|
| **Italy Type D (long-stay national visa)** | National visto, governed by Italian Decreto Legge 286/1998 — different form, separate `IT_TYPE_D` package in v2 |
| **Other Italy submission corridors** | Italy-from-India / Italy-from-UK / Italy-from-MENA each route through different VFS country sites or BLS — separate `IT_VFS_<corridor>` adapters in v1.1+ |
| **Direct embassy submission (non-VFS)** | A handful of Italian consulates accept direct paper submissions — out of scope for online autofill |
| **Automated appointment booking** | VFS booking is identity-gated, time-slot-scarce, and applicant-attested. Same boundary as France-Visas |
| **Payment** | VFS handles fee collection at the appointment (cash/card on-site) or via the post-form payment gateway — not automated |
| **Document upload** | Supporting docs go in `application_documents` per playbook §5.6, not the schema or the autofiller |

---

## 4. Known Source-Flow Ambiguities

1. **VFS form is identity-gated.** No throwaway-account preview is
   possible; live walk requires a real VFS China account. The recon
   script (`scripts/walk-italy-vfs-cn.ts`) drives the public pre-login
   pages plus a known-good account if one is provisioned. Until the
   walk is run end-to-end, the page-id and selector inventories in
   `pages.ts` / `selectors.ts` are **conjectural**, anchored on the
   well-known VFS Global SPA pattern observed across other countries.
2. **Page count.** VFS country corridors typically render a single
   SPA wizard with 4–8 sections. Italy China specifics confirmed
   only after walk.
3. **Annex I divergence.** VFS rarely diverges from Annex I question-set,
   but UI ordering and conditional logic vary per corridor. The
   harmonized seed is the source of truth for which fields exist; the
   corridor adapter handles ordering and DOM mapping.
4. **Captcha.** VFS Global's account flow uses Cloudflare Turnstile +
   occasional reCAPTCHA-v2 on registration. Login itself is
   captcha-free in normal traffic. Stealth profile required (mirror
   France-Visas `stealth-browser.ts` "france-visas" hardening profile;
   reuse or fork into "vfs-global").
5. **Language.** The China VFS site offers zh-CN and en. Field labels
   and validation messages differ. The selector layer should pin
   `?lang=en` to keep selectors stable; user-visible content is
   irrelevant for the autofiller.

---

## 5. Design Principle

> **Schema-once, corridor-many.** Schengen visas share a harmonized
> field set across 29 member states; the only thing that varies is the
> submission portal. Build one schema, multiple corridor adapters.

For Italy this means:
- The `EU_SCHENGEN_C_SHORT_STAY` seed stays canonical (no `it_*`
  prefix fields except where Italy's VFS form genuinely asks
  non-Annex-I questions — those go in the corridor's `normalize.ts`,
  never the seed).
- The corridor adapter is a thin mapping layer + Playwright driver.

---

## 6. Integration with Existing Infrastructure

| Component | Approach |
|-----------|----------|
| `visa_form_fields` table | **Unchanged** — `EU_SCHENGEN_C_SHORT_STAY` rows already cover Italy |
| `visa_packages` table | **Unchanged** — same `EU_SCHENGEN_C_SHORT_STAY` package |
| Seed script | **Unchanged** — `seed-eu-schengen-c-short-stay-form-fields.ts` is canonical |
| Frontend rendering | **Unchanged** — `DynamicStepForm` is visa-type-agnostic |
| Submission automation | New module `viza-be/submission-service/src/italy-vfs-cn/` |
| Recon walk | New script `viza-be/submission-service/scripts/walk-italy-vfs-cn.ts` |
| Queue dispatcher | TBD — `processItVfsCnItem` to be added to `submission-service/src/index.ts` once fill-steps land |
| Country field on user-facing portal | Routing logic: when `EU_SCHENGEN_C_SHORT_STAY` answers indicate destination/main-country = Italy AND applicant resides in China, dispatch to `italy-vfs-cn` runner. Otherwise dispatch France-Visas (current default) |

---

## 7. How the Italy-VFS-CN Schema Was Derived

The schema is reused from `EU_SCHENGEN_C_SHORT_STAY` with **zero
modification**. See `docs/schengen-visa-scope.md` §7 for the
derivation history of that seed.

The corridor adapter (selectors, page identity, normalize) is a
**reconstruction** anchored on the public VFS Global China-Italy
landing pages (https://visa.vfsglobal.com/chn/en/ita/) plus the
well-known VFS Global SPA structure observed across other VFS
country sites. Live-portal QA must run before production.

### How to Rerun or Update the Corridor Adapter

1. Run the recon walk: `npx tsx viza-be/submission-service/scripts/walk-italy-vfs-cn.ts --headful` against a provisioned VFS-CN account
2. Diff the captured DOM against `selectors.ts` / `pages.ts`
3. Update the corridor adapter; re-run typecheck
4. No frontend or seed changes are required for portal drift — only the corridor adapter changes

### How to Add a Related Italy Corridor

1. Copy `italy-vfs-cn/` to e.g. `italy-vfs-in/` for India
2. Update URL constants and corridor-specific normalize quirks
3. Rerun recon walk against the new corridor
4. No schema changes — the seed remains `EU_SCHENGEN_C_SHORT_STAY`

---

## 8. Next Recommended Actions

### Immediate (before production)

1. **Live walk against VFS-CN with a provisioned account** — fill the
   `selectors.ts` and `pages.ts` stubs from real DOM; capture the page
   transition contract (next-button shapes, modals, validation
   summary selectors).
2. **Implement `fill-steps.ts`** — per-page fillers wired to the
   harmonized seed via `normalize.ts`. Mirrors France-Visas
   `fillStep1`..`fillStep5` shape.
3. **Wire into the queue worker** — add `isItVfsCnJob`,
   `processItVfsCnItem`, and an `it_prefill_pending` status to
   `submission-queue` (mirror AU/UK migration pattern). Routing rule:
   `EU_SCHENGEN_C_SHORT_STAY` answers with `country_of_main_destination
   === IT` + applicant residency in CN → italy-vfs-cn; otherwise
   france-visas.

### Short-term (v1.1)

4. **Stealth profile hoist.** Lift the France-Visas
   `stealth-browser.ts "france-visas"` hardening profile into a
   shared `vfs-global` profile usable by every VFS corridor adapter.
5. **Cloudflare Turnstile handling.** VFS gates registration with
   Turnstile; even login may trigger it in anomalous-traffic
   conditions. Plan a per-corridor Turnstile-solver or operator-handoff.
6. **Resume-by-reference.** VFS Global persists drafts behind an
   application-reference ID; mirror `resumeApplicationByTrn` from AU
   for retry and idle-recovery.

### Medium-term (v2)

7. **Italy-from-other-corridors** — `italy-vfs-in`, `italy-vfs-ph`,
   `italy-vfs-uk`, `italy-bls-mena`. Each is a fresh adapter dir; the
   schema does not move.
8. **Italy Type D long-stay packages** — `IT_TYPE_D_STUDENT`,
   `IT_TYPE_D_WORK`, `IT_TYPE_D_FAMILY` — separate seed scripts keyed
   to MAECI's national visto form.
9. **Per-consulate routing matrix** — for any Schengen country that
   doesn't have a unified portal (Italy, Spain, Greece, Portugal, etc.),
   maintain a corridor-routing table that picks the right adapter
   based on `(destination_country, residency_country)`.

---

## 9. Source material checklist (honesty disclosure)

- [ ] Live VFS-CN portal driven end-to-end: **no** — identity-gated; recon walk pending an operational account
- [x] Public VFS-CN landing pages consulted: yes — `https://visa.vfsglobal.com/chn/en/ita/`
- [x] Italian consulate websites consulted: yes (ambpechino, consshanghai, consguangzhou)
- [x] Harmonized Annex I form is the schema source: yes — `EU_SCHENGEN_C_SHORT_STAY` already QA'd against the EU Commission PDF
- [ ] Live-portal QA pass completed (VFS-CN form): **no** — top open item before production
- [x] Stop-at-appointment-eligibility boundary documented: yes (§2)
