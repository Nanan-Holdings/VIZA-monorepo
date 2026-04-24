## EU Schengen Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-24

---

## 1. Canonical Journey

**Visa type:** Schengen Short-Stay Visa (Type C) — up to 90 days in any 180-day period
**VIZA visa_type key:** `EU_SCHENGEN_C_SHORT_STAY`

Schengen is a **multilateral** visa: one application is submitted to the
member state of main destination (or first entry, if no single main
destination), and if approved it permits travel to all 29 Schengen Area
states. Our v1 target is the harmonized application form defined in
**Annex I of Regulation (EC) No 810/2009 ("Visa Code")**, as amended by
Regulation (EU) 2019/1155. Every member state accepts this shared field
set; local portals (France-Visas, VFS, BLS International, TLS Contact,
etc.) render the same data with member-state branding.

This scope explicitly covers the full Type C umbrella: tourism,
business, visiting family/friends, cultural, sports, official visit,
medical reasons, short-term study, airport transit, and "other". Each
purpose unlocks its own sub-journey in Step 8 (host details, invitation,
business contacts, treatment specifics, event specifics, etc.).

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility guidance | `https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/visa-policy_en` | European Commission visa policy pages — authoritative overview |
| 2. Legal basis | `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02009R0810-20200202` | Visa Code (Reg. 810/2009) — Annex I is the harmonized form |
| 3. Member-state submission portals | `https://france-visas.gouv.fr` / `https://visas.vfsglobal.com` / `https://blsinternational.com` / `https://www.tlscontact.com` | Where applicants book appointments and submit online (same field set per Annex I) |
| 4. Biometrics / post-submission | Member-state VAC or consulate | In-person biometrics capture and document handover |

The **v1 extraction target** is step 2 — Annex I itself. Step 3 portals
vary by consulate but render the same question set.

### Application Structure

The form collects data across 12 logical steps that map to Annex I
fields 1–33 (as amended by Regulation (EU) 2019/1155, in force from
February 2020; the pre-amendment 1–37 numbering was consolidated):

1. Personal Details (Annex I 1–9)
2. Parental Authority (Annex I 10 — minors only)
3. Travel Document & Identity (Annex I 11–16)
4. EU/EEA/CH/UK Withdrawal Agreement Family Member (Annex I 17–18)
5. Contact Details & Residence (Annex I 19–20)
6. Occupation (Annex I 21–22, starred — exempt for UK Withdrawal Agreement beneficiaries)
7. Trip Details (Annex I 23–27)
8. Purpose-Specific Details (Annex I 24, 30–31 by purpose)
9. Accommodation in Schengen (Annex I 30 hotel/temporary)
10. Travel History (Annex I 28–29)
11. Financial Support (Annex I 32, starred)
12. Declaration (Annex I 33 filler block + 37 place/date/signature + six consents)

---

## 2. v1 Scope — What Is Included

- **One visa category only:** Schengen Type C short-stay (up to 90 days in any 180-day period)
- **One application form:** the harmonized Annex I form, accepted by all 29 Schengen member states
- **Schema extraction:** all Annex I sections (1–37), fields, options, requiredness, conditional logic
- **Dynamic form rendering:** via existing `visa_form_fields` + `DynamicStepForm`
- **No automated submission** — member-state portals are stateful, identity-gated, and differ per consulate. Prefill-only.

---

## 3. Out-of-Scope Visa Categories (v1)

Categories that use different forms or journeys and must be modelled as
separate `visa_type` entries in later iterations.

| Category | Reason for exclusion |
|----------|---------------------|
| **Schengen Type D (long-stay national visa, >90 days)** | Issued under national law by each member state; each uses its own form (France's long-séjour, Germany's nationales Visum, Italy's visto nazionale). No harmonized EU-level schema exists. |
| **Facilitated Transit Document (FTD / FRTD)** | Issued only by Lithuania for Russian nationals transiting to Kaliningrad; governed by Regulation (EC) No 693/2003, not the Visa Code. |
| **Airport Transit Visa (ATV) for specific nationalities** | Annex I applies to Type A as well, but ATV requirements and supporting documents differ per nationality list (Annex IV of Visa Code). Covered by our "airport_transit" purpose path but may need additional nationality-gated fields in v1.1. |
| **Type C at-the-border / humanitarian visas** | Issued under exceptional procedures by border guards; not a standard online application. |
| **Member-state-specific bilateral arrangements** | E.g. Swiss Confederation national visas. Schengen acquis applies but national procedures diverge. |

Future iterations can add them as additional `visa_type` entries and
seed scripts (e.g. `FR_TYPE_D`, `DE_TYPE_D`, `EU_SCHENGEN_ATV`).

---

## 4. Known Source-Flow Ambiguities

Things we observed during scope analysis that are uncertain — documented
rather than silently assumed.

1. **Member-state portal divergence (UX only, not field set)** — individual
   Schengen consulates use different appointment systems (France-Visas
   vs VFS vs BLS vs TLS Contact). The underlying field set is identical
   (Annex I), but each portal orders fields differently and adds local
   guidance text. The VIZA schema uses a single canonical ordering; the
   Step 1–12 progression matches Annex I field numbers, not any specific
   portal's wizard flow.

2. **Fingerprint exemption rules are nationality- and age-gated** — Annex I
   field 30 asks whether fingerprints have been collected previously,
   but the **requirement** to give fingerprints is governed by Visa Code
   Article 13 (children under 12 exempt; applicants whose fingerprints
   are on file from the last 59 months are exempt). The schema captures
   the answer but does not gate the question — every applicant sees it.
   A nationality-and-age-aware gate would require an `in` operator in
   `evaluateShowIf`.

3. **Travel medical insurance declaration** — Annex I does not itself
   ask about travel medical insurance, but it is a Visa Code Article 15
   requirement (minimum €30,000 coverage, valid across all Schengen
   states). Member-state portals handle this as a supporting-document
   upload rather than a form field. We follow the portal convention:
   insurance lives in `application_documents`, not the schema.

4. **"Main destination" ambiguity for multi-country itineraries** — when
   a traveller spends equal time in multiple Schengen states, the main
   destination is the one of longest stay; if tied, the state of first
   entry (Visa Code Art. 5). The schema asks both fields separately;
   the applicant self-selects.

5. **Purpose-code mapping to Annex I** — Annex I field 23 lists fixed
   options ("tourism", "business", etc.). We add "other" + free text as
   a safety valve for purposes that don't cleanly fit (e.g. family event
   + medical, religious pilgrimage, volunteer work). These should be
   routed to the nearest canonical purpose by an immigration adviser
   before submission.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official
> field structure, requiredness, options, and conditional logic in a
> machine-readable VIZA schema before optimizing downstream automation.

The Schengen schema must be grounded in the Annex I form. Hand-written
or partially copied field lists are not acceptable proof of parity.
Any fields that cannot be verified against Annex I or the Visa Code
are flagged in the gap report.

---

## 6. Integration with Existing Infrastructure

| Component | Approach |
|-----------|----------|
| `visa_form_fields` table | New rows with `visa_type = 'EU_SCHENGEN_C_SHORT_STAY'` |
| `visa_packages` table | New row registered via Drizzle migration `0011_eu_schengen_c_short_stay_package.sql` |
| Seed script | `scripts/seed-eu-schengen-c-short-stay-form-fields.ts` (idempotent delete + re-insert) |
| Frontend rendering | No code changes — `DynamicStepForm` is visa-type-agnostic |
| Submission automation | **None in v1.** Member-state portals are too divergent for a single automation. Consider per-portal Playwright shims in v2 if staff volume justifies it. |
| Answer storage | Existing `visa_application_answers` table |
| Country field in visa_packages | `european_union` (not a member state — this is a multilateral visa) |

---

## 7. How the Schengen Schema Was Derived

The live Schengen member-state portals (France-Visas, VFS, BLS, TLS
Contact) are identity-gated and cannot be driven by automated tooling
without a real applicant's documents. We followed the **research
fallback** path in the playbook (§3 Step 2):

1. **Primary source:** Annex I of Regulation (EC) No 810/2009 as amended
   by Regulation (EU) 2019/1155. This is the legally-binding harmonized
   form every member state must use.
2. **Secondary source:** EU Commission's Visa Handbook (Commission
   Decision C(2010) 1620 final, as updated) — operational guidance for
   consular staff enumerating every applicant-facing question.
3. **Tertiary source:** member-state portal screenshots (public
   pre-login pages) — used to verify that local UX faithfully renders
   Annex I fields.

Sources consulted:
- Regulation (EC) No 810/2009 — Annex I (application form)
- Regulation (EU) 2019/1155 — Visa Code amendment (current form version)
- European Commission Visa Handbook — consolidated operational guidance
- France-Visas online application preview (public pre-login pages)
- VFS Global Schengen information pages (country-specific)

The schema is therefore a **reconstruction** of the Annex I form — it
has not been driven end-to-end against any specific member-state portal.
Live-portal QA must happen before production.

### How to Rerun or Update the Schema

1. Edit `viza-be/agent-backend/scripts/seed-eu-schengen-c-short-stay-form-fields.ts`
2. Run: `npx tsx scripts/seed-eu-schengen-c-short-stay-form-fields.ts`
3. Verify output: `Done: N rows seeded (N defined)` with matching N's
4. No frontend deployment needed — the dynamic form reads from DB at runtime

### How to Add a Related Visa Category

1. Copy the seed script to e.g. `seed-fr-type-d-long-stay-form-fields.ts`
2. Change `VISA_TYPE` to a new key (e.g. `FR_TYPE_D_LONG_STAY`)
3. Update the `FIELDS` array against the relevant national form
4. Add a Drizzle migration inserting into `visa_packages`
5. Run the seed
6. Assign the package via the admin interface

---

## 8. Next Recommended Actions

### Immediate (before production)
1. **Live-portal QA pass** — walk the schema against at least one member-state portal (France-Visas is the most accessible English-language preview) and record every discrepancy in the gap report.
2. **Confirm `||` and cross-step conditionals still work** — the UK v2 playbook fixed both; Schengen uses both (`COST_SELF`/`COST_SPONSOR` gates, `IS_EVENT` combined purpose gate). Verify `evaluateShowIf` and `DynamicStepForm` value-state seeding are intact.
3. **Document the insurance carve-out in the review step** — the declaration page should remind applicants that travel medical insurance (min €30k, Schengen-wide) is a Visa Code requirement handled as a supporting document upload, not a form field.

### Short-term (v1.1)
4. **Nationality-gated Airport Transit Visa (ATV) fields** — Annex IV lists nationalities that require an ATV even for airside transit. Add a user-declared radio until `in` operator support lands in `evaluateShowIf`.
5. **Previous Schengen visa repeatable group** — verify the `previous_schengen_visas` group renders correctly with add/remove for the common case of frequent travellers (5+ prior visas).
6. **Hotel confirmation number field** — several member-state portals ask for the hotel booking reference. Evaluate whether to add it to Step 9 or keep it document-only.

### Medium-term (v2)
7. **Schengen Type D long-stay packages** — Italy (`IT_TYPE_D`), France (`FR_TYPE_D`), Germany (`DE_TYPE_D`) are the highest-demand starting set. Each needs its own seed keyed to the national form.
8. **Per-portal submission automation** — if volume justifies it, Playwright shims for France-Visas / VFS / TLS (each as a separate submission-service adapter, DS-160 is the architectural reference).
9. **Visa sticker parsing & fingerprint exemption helper** — OCR a previously-issued visa sticker to auto-fill the "fingerprints collected previously" block and flag the 59-month exemption window.

---

## 9. Source material checklist (honesty disclosure)

- [ ] Live portal was driven end-to-end: **no** — member-state portals are identity-gated; we used public pre-login pages only.
- [x] Published application PDF consulted: yes — the authoritative EU Commission PDF at home-affairs.ec.europa.eu was walked row-by-row against the schema on 2026-04-24 (v1.2 QA pass).
- [x] Caseworker guidance consulted: yes — EU Commission Visa Handbook.
- [x] Legal basis consulted: yes — Visa Code (Regulation 810/2009 as amended by 2019/1155).
- [x] Source-verification QA pass completed: yes — 9 discrepancies fixed in v1.2 (see gap report §4).
- [ ] Live-portal QA pass completed (member-state consulate portal): **no** — still deferred; recommended before production for the specific consulate(s) routing applications through this package.
