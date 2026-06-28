# Visa Packages — Development Status Tracker

**Last updated:** 2026-04-28

Tracks the development phase of each visa package across two axes:

- **Client wizard** — `viza-fe/internal-website/components/client/wizards/<country>/` data schema + step flow
- **Backend submission service** — `viza-be/submission-service/src/<country>/` Playwright autofill + result/callback wiring

## Phase legend

| Phase | Definition |
|-------|-----------|
| 0 | Not started — no wizard, no submission module (scope/recon docs may exist) |
| 1 | Schema/recon scaffolded — selectors or scope docs only, no orchestrator |
| 2 | Client wizard complete, backend stops pre-auth or absent |
| 3 | Backend autofill operational, halts before submit/pay/sign — no application-ID callback |
| 4 | End-to-end: wizard complete, backend submits or hands off, application reference returned to user |

## Status summary

| Visa | Phase | Wizard | Backend | Reference returned | Next blocker |
|------|-------|--------|---------|--------------------|--------------|
| US (CEAC DS-160) | 4 | 9 steps | Full orchestrator | Yes — application ID via callback | None — production |
| France Schengen | 4 | 12 steps | Full + optional finalize | Yes — `applicationReference` (FRA-format) + optional CERFA PDF | None — production |
| Australia (Subclass 600) | 3 | 13 steps | 20-page form walk, stops at Review | TRN captured, no post-sign callback | Post-sign submission + callback |
| Vietnam (e-visa) | 3 | 12 steps | Full fill, stops before Pay | `registrationCode` captured pre-pay | External payment + email-PDF capture loop |
| UK (Standard Visitor) | 3 | 11 steps | Resume flow fills all 44 post-auth pages, halts at declaration/£135 pay | Reference captured at declaration, no post-pay callback | Account provisioning at scale + wizard field coverage + applicant pay handoff |
| Italy-VFS-CN (Schengen) | 1 | Reuses Schengen wizard | Selectors + errors only — no `run.ts` | No | Orchestrator + live walk deferred |
| Egypt | 0–1 | None | Phase-A read-only recon helper | No | Wizard + authenticated automation (needs preregistered account) |
| Indonesia | 0 | None | None — scope/gap/recon docs only | No | Wizard + backend module |
| Japan | 0 | None | None — scope/gap docs only | No | Wizard + backend module |
| Korea | 0 | None | None — scope/gap docs only | No | Wizard + backend module |

## Per-visa detail

### US — CEAC DS-160 — Phase 4

- Wizard: `viza-fe/internal-website/components/client/wizards/us/config.ts` — 9 steps (identity, contact, passport, travel, usStay, work, usContact, family, background) with US-specific payload builder.
- Backend: `viza-be/submission-service/src/ceac/index.ts` — exports `CeacOrchestrator`, `CeacNavigator`, `CeacCaptchaSolver`, `CeacCheckpointStore`, `CeacGates`, sign-and-submit detection, artifact capture.
- Status: end-to-end. Application ID returned to user.

### France Schengen — france-visas.gouv.fr — Phase 4

- Wizard: `viza-fe/internal-website/components/client/wizards/schengen/config.ts` — 12 steps mapped to Annex I of the Visa Code (purpose, personal, document, contact, trip_dates, trip_destination, accommodation, occupation, family_eu, travel_history, funding, declaration).
- Backend: `viza-be/submission-service/src/france-visas/run.ts` — `fillFranceVisasApplication(credentials, answers)` returns `draftReference` + `applicationReference` (FRA-format) + optional CERFA PDF via finalize mode. Errors typed in `france-visas/errors.ts` (SESSION_EXPIRED, VALIDATION_FAILED, GATE_DETECTED).
- Auth: preregistered account.
- Status: end-to-end. Reference returned to user.

### Australia — Subclass 600 Visitor — Phase 3

- Wizard: `viza-fe/internal-website/components/client/wizards/au/config.ts` — 13 steps (stream, personal, passport, contact, application_context, trip_dates, visit, companions, funding, health, character, declaration). 365-day max stay; visa-stream selector (tourist / business_visitor / sponsored_family / frequent_traveller); 7-item health and character declarations.
- Backend: `viza-be/submission-service/src/au-visitor/orchestrator.ts` — walks 20-page VSS-AP-600 form via heading-based page detection; defaults unknown fields to "No"; halts at Review (mirrors DS-160 boundary). Returns `RunResult { reachedPage, trn, pagesWalked, validationErrors }`.
- Gap: post-sign submission + Transaction Reference Number callback to applicant. Reports: `docs/au-visa-gap-report.md`, `docs/au-visa-scope.md`, `docs/au-recon/`.

### Vietnam — evisa.gov.vn — Phase 3

- Wizard: `viza-fe/internal-website/components/client/wizards/vn/config.ts` — 12 steps (purpose, personal, passport, contact, trip_dates, vn_destination, host, occupation, companions, funding, declaration). 90-day max stay; border-gate selector (Noi Bai, Tan Son Nhat, Da Nang, Cam Ranh, Phu Quoc, land); investment / press purpose options.
- Backend: `viza-be/submission-service/src/vietnam/run.ts` — `fillVietnamApplication()` drives Vue SPA, fills every `VN_FIELD_MAPPINGS` entry, deliberately halts before Pay/Submit. Returns `FillVietnamResult { status: "scaffolded_pending_walk" | "submitted_pending_pay", registrationCode?, submittedAtIso?, fieldsFilled, fieldsSkipped }`.
- Gap: external-payment loop. E-visa PDF arrives by email ~3 working days after payment — needs ingestion job. Reports: `docs/vietnam-visa-gap-report.md`, `docs/vietnam-visa-qa-report-2026-04-24.md`.

### UK — Standard Visitor — Phase 3

- Wizard: `viza-fe/internal-website/components/client/wizards/uk/config.ts` — 11 steps (purpose, personal, passport, contact, ukvi, trip_dates, uk_address, employment, history, funding, declaration). 180-day max stay; UKVI account check; criminal/terrorism/visa-refusal declarations.
- Backend: `src/uk/resume.ts` `resumeUkApplication()` signs into the saved-application (email+password) resume URL, walks all 44 post-auth pages via `page-bindings.ts` fillers (incl. `immigrationStatus`), ticks Documents + Declaration acknowledgements, and halts before `/pay` (`status: "stopped_at_pay"`). `src/uk/normalize.ts` `normalizeUkAnswers()` translates the wizard answer shape → the seed wire-shape the fillers consume (mirrors `france-visas/normalize.ts`); wired into `runUkHalt` (`src/queue/halt-runners.ts`). `src/uk/orchestrator.ts` remains the pre-auth prover (language → country → VAC → start → registration). Account provisioning: `src/uk/register.ts` fills the email+password "save your answers" page and captures the emailed resume link into `uk_accounts` (gated by `UK_REGISTER_COMMIT`).
- Gap: declaration + £135 Worldpay are intentionally left to the applicant (legal attestation + their card) — surface the resume link + reference in the client UI; widen wizard field coverage so fewer pages are left blank for review; account provisioning throughput. Reports: `docs/uk-auto-submit-plan.md`, `docs/uk-visa-gap-report.md`, `docs/uk-standard-visitor-walk-report.md`, `docs/uk-visa-recon-2026-04-25.json`.

### Italy-VFS-CN (Schengen via VFS Global) — Phase 1

- Wizard: reuses the shared `schengen` wizard config — no Italy-specific step variants yet.
- Backend: `viza-be/submission-service/src/italy-vfs-cn/index.ts` — exports error classes (`ItVfsError`, `LoginFailedError`, `CorridorIneligibleError`), page-detection helpers (`detectPage`, `assertPage`, `waitForPage`), selector maps (`IT_VFS_URLS`, `IT_VFS_LOGIN_SELECTORS`, `IT_VFS_PERSONAL_FIELDS` … `IT_VFS_COST_FIELDS`, `IT_VFS_GATE_MARKERS`), and normalize types. **No `run.ts` or orchestrator.ts.** Module comment: "Live walk and `fill-steps.ts` / `run.ts` are deferred to a follow-up pass — the exports below cover the schema-mapping layer that does not require live-portal access."
- Gap: live walk + orchestrator. Reports: `docs/italy-visa-gap-report.md`, `docs/italy-visa-scope.md`.

### Egypt — visa2egypt.gov.eg — Phase 0–1

- Wizard: none.
- Backend: `viza-be/submission-service/src/egypt/form-recon.ts` only — Phase-A QA helper, stealth Chromium walk of public pages, captures `eg-recon-out/page-NN-*.{png,html}` + `summary.json`. Comment: "Phase A scope: read-only navigation, NO account registration, NO form submissions."
- Gap: wizard schema + Phase-B authenticated automation (needs preregistered account). Reports: `docs/egypt-visa-gap-report.md`, `docs/egypt-visa-scope.md`.

### Indonesia — Phase 0

- Wizard: none.
- Backend: none — only `docs/indonesia-visa-scope.md`, `docs/indonesia-visa-gap-report.md`, `docs/indonesia-visa-walk-report.md`, `docs/indonesia-visa-recon-2026-04-28.json`.
- Gap: everything (wizard + backend).

### Japan — Phase 0

- Wizard: none.
- Backend: none — only `docs/japan-visa-scope.md`, `docs/japan-visa-gap-report.md`.
- Gap: everything.

### Korea — Phase 0

- Wizard: none.
- Backend: none — only `docs/korea-visa-scope.md`, `docs/korea-visa-gap-report.md`.
- Gap: everything.

## Cross-cutting next steps (priority order)

1. **UK** — map post-auth form selectors, wire orchestrator past registration page, return reference. Closest Phase-2→4 jump.
2. **Australia** — implement post-sign submission + TRN callback.
3. **Vietnam** — design payment-relay UX + email-PDF ingestion job (e-visa arrives ~3 working days after pay).
4. **Italy-VFS-CN** — write `run.ts` orchestrator over existing selectors.
5. **Egypt** — provision preregistered account, then build wizard + Phase-B automation.
6. **Indonesia / Japan / Korea** — start wizard scaffolding from existing scope docs.

## Onboarding a new country (Phase 0 → 4)

This section is the recipe a new agent (or contributor) follows to drive a country from `phase: 0` to `phase: 4`. The machine-readable companion `visa-packages-status.json` encodes the same contract via its `phase3Acceptance` / `phase4Acceptance` arrays and the per-story `dependsOn` chains; this section mirrors them for humans.

### Phase acceptance checklists

**Phase 3 — backend autofill operational, halts before submit/pay/sign:**

- `viza-be/submission-service/src/<cc>/run.ts` exports `fillXApplication(credentials, answers)` returning a typed result.
- Orchestrator walks every form page/step until immediately before submit / pay / sign.
- Result captures any pre-pay reference (`TRN` / `registrationCode` / `draftReference`) and lists `fieldsFilled` / `fieldsSkipped`.
- Errors typed in `src/<cc>/errors.ts`: `SESSION_EXPIRED`, `VALIDATION_FAILED`, `GATE_DETECTED` at minimum.
- Wizard config exists at `viza-fe/internal-website/components/client/wizards/<cc>/config.ts` with steps + payload builder.
- `npm run type-check` passes in both `viza-be/submission-service` and `viza-fe/internal-website`.

**Phase 4 — end-to-end with reference returned to user:**

- Phase 3 acceptance satisfied.
- Submission, signing, or external-pay handoff implemented; reference (TRN / VAF# / `registrationCode`) flows back to the applicant.
- Callback or polling captures the post-submit reference into `submission_queue` / application row.

### File skeleton per country

Each new country needs the following files, created in this order so each layer can consume the previous one:

| Order | File | Purpose |
|-------|------|---------|
| 1 | `viza-be/submission-service/src/<cc>/form-recon.ts` | Live authenticated walk; emits `docs/<cc>-visa-recon-<date>.json` keyed by page slug. |
| 2 | `viza-be/submission-service/src/<cc>/form-mappings.ts` | `X_FIELD_MAPPINGS` typed against the wizard payload shape. |
| 3 | `viza-fe/internal-website/components/client/wizards/<cc>/config.ts` (+ `types.ts`, `payload.ts`) | Wizard schema following neighbouring `au/` and `vn/` shape. |
| 4 | `viza-be/submission-service/src/<cc>/errors.ts` | `SESSION_EXPIRED` / `VALIDATION_FAILED` / `GATE_DETECTED` + country-specific gates. |
| 5 | `viza-be/submission-service/src/<cc>/run.ts` | `fillXApplication(credentials, answers)` orchestrator halting before pay/sign. |
| 6 | `viza-be/submission-service/src/<cc>/__tests__/run.test.ts` | Fixture-driven walk; asserts halt page reached. |
| 7 | `viza-be/submission-service/src/<cc>/sign-and-submit.ts` (Phase 4 only, when applicable) | Post-halt submit + reference callback. |

### Story dependency chain

```
form-recon.ts                         (recon JSON committed)
  → form-mappings.ts                  (selectors → wizard payload)
    → wizard config.ts                (frontend schema + payload builder)
      → run.ts + errors.ts            (orchestrator halt-before-pay = Phase 3)
        → __tests__/run.test.ts       (fixture coverage)
          → sign-and-submit.ts        (Phase 4 — sign-submit pattern)
            or payment-relay handoff  (Phase 4 — external-pay pattern)
            or appointment + PDF      (Phase 4 — VFS pattern)
```

### Account / credential seeding

If the portal requires a preregistered government account, do this before any authenticated recon:

1. Add migration `viza-be/agent-backend/drizzle/<NNNN>_<cc>_accounts.sql` (mirror `0024_eg_accounts.sql`).
2. Extend `viza-be/submission-service/src/types.ts` with the `<Cc>Account` type.
3. Add `loadXAccount()` to `viza-be/submission-service/src/account-loader.ts`.
4. Seed Edward's row via `viza-be/submission-service/scripts/seed-edward-test-credentials.ts`.

If creds are not yet provisioned, set the recon story `blocked: true` with `blockedReason` in the JSON — do not attempt the live walk.

### Shared infrastructure

- **Captcha**: import from `viza-be/submission-service/src/captcha/index.ts`. Generic helper `solveCaptcha(siteKey, pageUrl, type)` reads `TWOCAPTCHA_API_KEY` from env. Do not vendor a new solver per country.
- **Account loader**: extend `src/account-loader.ts`; do not query Supabase directly from the orchestrator.
- **Page detection**: reuse the heading-based pattern from `src/au-visitor/orchestrator.ts` or the URL-marker pattern from `src/italy-vfs-cn/index.ts` (`detectPage` / `assertPage` / `waitForPage`).

### Phase 4 sub-patterns

Phase 4 is not a single shape — pick the pattern that matches the portal:

1. **Sign-and-submit** (AU pattern, in flight):
   - Native HTML5 canvas signature pad in `viza-fe/internal-website/components/client/signing/`.
   - PNG output 600×200 @ 2× DPR, transparent background.
   - `/client/signing/[applicationId]/page.tsx` route + `app/actions/submit-signature.ts` server action.
   - `src/<cc>/sign-and-submit.ts` loads the PNG from Supabase storage, attaches it on the declaration page, submits, captures the final reference.
   - Reference written to `submission_queue.<cc>_trn` (or equivalent) and `application.confirmation_number`.

2. **External pay + email PDF ingestion** (VN pattern, deferred):
   - Payment-relay UX hands the applicant to the official portal for card entry.
   - Email-PDF ingestion job polls a mailbox for the issued e-visa PDF (~3 working days for VN) and attaches it to the application row.

3. **Appointment booking + Annex I PDF** (Italy VFS pattern):
   - Orchestrator books a VFS appointment slot, captures `appointment_reference`, halts before any payment.
   - `pdf-lib` AcroForm overlay generates the official Annex I Schengen short-stay PDF for the applicant to print and bring. **Not** an online form fill.

### Loop control fields (in `visa-packages-status.json`)

When wiring a new country into the autonomous loop, set these per-country and per-story fields:

- `countries.<cc>.phase` — current phase 0–4.
- `countries.<cc>.targetPhase` — usually `3` (loop scope) or `4` if Phase 4 work is in scope.
- `countries.<cc>.atTarget` — derived; flip to `true` when phase reaches `targetPhase`.
- `countries.<cc>.deferred` + `deferReason` — skip entirely (e.g. Japan, Korea).
- `countries.<cc>.note` — country-specific scope clarification (e.g. AU "Phase 4 = signature pad + /signing + post-Review submit; payment skipped"; Italy-VFS-CN "VFS appointment autofill + Annex I PDF, NOT online form fill").
- `stories[].priority` — lower number picked first; group by country in tens (UK 10–13, IT 20–23, EG 30–32, ID 40–42, AU 50–54).
- `stories[].dependsOn` — list of story IDs that must be `passes:true` first.
- `stories[].blocked` + `blockedReason` — set when human-in-the-loop recon or unprovisioned creds gate the work; the loop skips and picks the next eligible story.

### Out-of-scope escapes

If a story's acceptance cannot be met without a Phase 3 → 4 capability that is not in scope (live submission, payment provider, email ingestion), stop and flip `blocked:true` with `blockedReason` — do not paper over the boundary by stubbing.

## How to update this file

When a visa moves between phases or selectors are mapped:

1. Edit the row in **Status summary** (phase number + Next blocker).
2. Edit the **Per-visa detail** section (file paths, status, gap).
3. Bump **Last updated** at the top.
4. Mirror the change in `visa-packages-status.json` (`countries.<cc>.phase` and any story `passes` flips).
5. Commit with `docs(submission-service): bump <visa> to Phase N`.

## Continuous run (Claude Code autonomous loop)

Machine-readable companion: [`visa-packages-status.json`](./visa-packages-status.json). Append-only progress log: [`visa-packages-progress.txt`](./visa-packages-progress.txt).

**Goal:** drive every country to Phase 3. Phase 3 → 4 work (post-sign submit, payment relay, email-PDF ingestion) is tracked in *Cross-cutting next steps* above and is **not** in scope for the loop.

**Per-iteration contract** (mirrors the Ralph pattern in repo-root `CLAUDE.md`):

1. Read `visa-packages-status.json` and `visa-packages-progress.txt`.
2. Pick the next story by `loopInstructions.pickStrategy` — lowest `priority` where `passes:false` AND `blocked:false` AND every `dependsOn` id is `passes:true`. Tie-break by smallest `3 - countries[<cc>].phase`.
3. Implement only that story; keep diff minimal and follow `acceptance` literally.
4. Run `npm run type-check` in every package modified (per `CLAUDE.md`).
5. Commit using the project commit standard (`feat(<scope>): <description>` — see `.claude/CLAUDE.md`).
6. Flip `passes:true` for the story in `visa-packages-status.json`. If a country's last story passes, bump `countries.<cc>.phase` to `3` and `atTarget:true`.
7. Append a dated entry to `visa-packages-progress.txt`.
8. Stop when every story is `passes:true` (or every country `atTarget:true`) — emit `<promise>COMPLETE</promise>`.

**Blocked stories** (e.g. `VP-EG-02` — needs preregistered government account): do **not** attempt. Leave `blocked:true` until a human flips it. The loop should skip and pick the next eligible story.

**Out-of-scope escapes:** if a story's acceptance can't be met without a Phase 3 → 4 capability (live submission, payment), stop and report — do not paper over the boundary.
