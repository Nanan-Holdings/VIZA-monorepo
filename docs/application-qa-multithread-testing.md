# Application QA Multithread Testing

## Purpose

This runbook verifies that one completed Universal Profile can prefill every
supported DB-driven application schema, remain bilingual, persist safely, and
render in multiple Chrome tabs without frontend or backend errors.

> **Safety boundary (2026-08-15):** Persistent schema-QA draft creation and
> fixture filling are local-Supabase-only and require a dedicated
> `@viza.test` applicant. Do not run `qa:create-schema-drafts` or
> `qa:fill-schema-drafts` against a hosted project or a normal applicant
> profile. QA-purpose rows are excluded from customer/admin application lists
> and cannot enter a live submission queue.

The QA operator for this workflow is Codex. Use a dedicated local
`@viza.test` applicant at `http://localhost:3000/client/universal-info` and keep
Chrome in the foreground during the visual run. References to the historical
Edward test dataset below document past evidence only and are not authorization
to reuse that normal profile for persistent fixture generation.

This is an intake and prefill test. Do not make an official submission, solve a
CAPTCHA, create an official-site account, accept a declaration, or enter
payment-card data unless a dated focused-run section records explicit
authorization and a narrower no-submit boundary. The 2026-08-02 run authorized
Edward's passport, portrait, and statement for local VIZA QA and authorized
official form filling only up to the pre-submit/payment boundary. It did not
authorize CAPTCHA solving outside the earlier Indonesia-only test.

## Edward QA Dataset

The connected development profile uses Edward's existing test account. The
passport identity facts below were verified against the applicant-authorized
passport image during the 2026-08-02 run. Schema-only values such as travel
history, security answers, parent dates, accommodation, flights, funds, portal
credentials, and declarations remain explicitly non-submittable QA fixtures.

Core profile expectations:

| Field group | QA expectation |
| --- | --- |
| Name | Passport legal name `ZEHUA ZHANG`; surname `ZHANG`; given name `ZEHUA` |
| Birth | `2006-03-24`; Tianjin, China |
| Identity | Male; Chinese nationality |
| Occupation | Software Engineer |
| Contact | VIZA-managed alias where required; profile phone/address remain applicant-profile facts |
| Passport | Applicant-authorized passport image; China issuing country; place of issue Singapore |

Never promote the generated dry-run answers or official-site drafts to a real
submission without applicant review and replacement of every QA fixture.

## Preconditions

1. The frontend is running from `viza-fe/internal-website` on port `3000`.
2. The agent backend is running from `viza-be/agent-backend` on port `3002`.
3. `GET http://127.0.0.1:3002/health` returns success and startup reports a
   successful Supabase connection.
4. The migration
   `viza-fe/internal-website/supabase/migrations/20260801193500_create_universal_profile_answers.sql`
   has been applied to the connected development Supabase project.
5. Chrome is signed in to the Edward VIZA test account and
   `/client/universal-info` loads without an authentication redirect.
6. The worktree is inspected before testing. Preserve unrelated edits and do
   not run the full migration backlog merely to install the Universal Profile
   table.

## Service Startup And Health

Run the services in separate terminals:

```bash
cd viza-fe/internal-website
npm run dev
```

```bash
cd viza-be/agent-backend
npm run dev
```

Verify them before opening the application tabs:

```bash
curl -fsS http://127.0.0.1:3000/client/login >/dev/null
curl -fsS http://127.0.0.1:3002/health
```

Keep both terminals visible or retain their logs. Record new Next.js console
errors, failed server actions, backend error-level logs, and non-2xx requests.

## Universal Profile Completion Gate

Before the multitab application run:

1. Open `/client/universal-info` in authenticated Chrome.
2. Confirm the core profile shows all 18 readiness details as present.
3. Confirm the expanded profile no longer shows the missing-migration warning.
4. Complete every visible reusable field in all seven categories:
   identity, contact, travel documents, family, work and education, immigration
   history, and background.
5. Use internally consistent benign answers. A negative branch must not have
   contradictory positive-branch detail. Do not fabricate criminal, medical,
   refusal, overstay, trafficking, military, or security history.
6. Save every category and reload the page.
7. Confirm saved values render in Review Application format and remain present
   after reload.
8. Confirm no field classified as trip-specific, payment, declaration,
   CAPTCHA, credential, OTP, invitation, accommodation, or destination-specific
   itinerary data appears in the Universal Profile. If one appears, record it
   as a schema-classification defect rather than filling it.

The current catalog contains 1,761 `visa_form_fields` rows across 18 schemas.
The Universal Profile loader must paginate beyond Supabase's default 1,000-row
response limit. Category saves must also be chunked below the server action's
250-answer request limit.

## Six-Tab Chrome Batches

Open exactly six application tabs per batch. Keep the Universal Profile in a
separate reference tab. Add `skipFormCheck=true` only for QA navigation; it
does not authorize final submission.

### Batch A — Major visitor visas

| Tab | Destination | Schema | URL |
| --- | --- | --- | --- |
| 1 | United States | `DS160` | `/client/application/long-form?country=united_states&visaType=DS160&skipFormCheck=true` |
| 2 | United Kingdom | `UK_STANDARD_VISITOR` | `/client/application/long-form?country=united_kingdom&visaType=UK_STANDARD_VISITOR&skipFormCheck=true` |
| 3 | Australia | `AU_VISITOR_600` | `/client/application/long-form?country=australia&visaType=AU_VISITOR_600&skipFormCheck=true` |
| 4 | France/Schengen | `EU_SCHENGEN_C_SHORT_STAY` | `/client/application/long-form?country=france&visaType=EU_SCHENGEN_C_SHORT_STAY&skipFormCheck=true` |
| 5 | Japan | `JP_TOURIST` | `/client/application/long-form?country=japan&visaType=JP_TOURIST&skipFormCheck=true` |
| 6 | Vietnam | `VN_E_VISA` | `/client/application/long-form?country=vietnam&visaType=VN_E_VISA&skipFormCheck=true` |

### Batch B — Regional visa and permit schemas

| Tab | Destination | Schema | URL |
| --- | --- | --- | --- |
| 1 | Thailand | `TH_TOURIST_E_VISA` | `/client/application/long-form?country=thailand&visaType=TH_TOURIST_E_VISA&skipFormCheck=true` |
| 2 | Egypt | `EG_E_VISA` | `/client/application/long-form?country=egypt&visaType=EG_E_VISA&skipFormCheck=true` |
| 3 | South Korea | `KR_C39_SHORT_TERM_VISIT` | `/client/application/long-form?country=south_korea&visaType=KR_C39_SHORT_TERM_VISIT&skipFormCheck=true` |
| 4 | Taiwan | `TW_ENTRY_PERMIT` | `/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT&skipFormCheck=true` |
| 5 | Indonesia C1 | `ID_C1_TOURIST` | `/client/application/long-form?country=indonesia&visaType=ID_C1_TOURIST&skipFormCheck=true` |
| 6 | Indonesia B1 | `ID_B1_EVOA` | `/client/application/long-form?country=indonesia&visaType=ID_B1_EVOA&skipFormCheck=true` |

### Batch C — Arrival and departure declarations

| Tab | Destination | Schema | URL |
| --- | --- | --- | --- |
| 1 | Singapore | `SG_ARRIVAL_CARD` | `/client/application/long-form?country=singapore&visaType=SG_ARRIVAL_CARD&skipFormCheck=true` |
| 2 | Malaysia | `MY_MDAC_ARRIVAL_CARD` | `/client/application/long-form?country=malaysia&visaType=MY_MDAC_ARRIVAL_CARD&skipFormCheck=true` |
| 3 | Thailand | `TH_TDAC_ARRIVAL_CARD` | `/client/application/long-form?country=thailand&visaType=TH_TDAC_ARRIVAL_CARD&skipFormCheck=true` |
| 4 | Philippines arrival | `PH_ETRAVEL_ARRIVAL_CARD` | `/client/application/long-form?country=philippines&visaType=PH_ETRAVEL_ARRIVAL_CARD&skipFormCheck=true` |
| 5 | Philippines departure | `PH_ETRAVEL_DEPARTURE_CARD` | `/client/application/long-form?country=philippines&visaType=PH_ETRAVEL_DEPARTURE_CARD&skipFormCheck=true` |
| 6 | Vietnam pre-arrival | `VN_PREARRIVAL_DECLARATION` | `/client/application/long-form?country=vietnam&visaType=VN_PREARRIVAL_DECLARATION&skipFormCheck=true` |

## Per-Tab Test Procedure

For each tab, record the schema and draft application ID, then:

1. Wait for the sidebar and first visible form step to finish loading.
2. Confirm the selected country and visa type match the tab URL.
3. Confirm reusable identity, passport, contact, address, family, work,
   education, immigration-history, and background answers are prefilled where
   the country schema has an equivalent field.
4. Verify that application-specific travel dates, destinations, flights,
   accommodation, inviter/sponsor, payment, declarations, signatures, and
   consent remain empty unless the schema legitimately derives them.
5. Compare at least five mapped values against the Universal Profile reference
   tab. Include a name, birth fact, passport fact, contact/address fact, and one
   family/work/history fact.
6. Check both columns: Chinese source values must stay on the left and
   English/official values on the right. Select, date, country, radio, and
   checkbox answers must not diverge between columns.
7. Traverse every step without final submission. Enter synthetic trip-only QA
   values where required to unlock the next step, save the draft, and reload.
8. Open Review Application and record missing required fields, unexpected
   overwrites, invalid option values, date-format failures, hidden-field
   leakage, or untranslated copy.
9. Inspect browser console errors and the backend terminal before moving to the
   next tab.

## Pass Criteria

A schema passes only when:

- the page loads without an unhandled frontend or backend error;
- all equivalent reusable fields prefill without overwriting an existing draft;
- every required field can receive and persist a schema-valid value;
- conditional branches show and hide consistently;
- bilingual values and official option codes remain aligned;
- reload returns the same saved draft values;
- Review Application has no unexplained missing reusable field;
- no final official submission, payment, CAPTCHA, or account creation occurs.

## Result Log Template

Copy one row per schema into the run log:

| Timestamp | Batch/tab | Country | Visa type | Application ID | Schema rows | Reusable expected | Reusable prefilled | Required missing | Console/backend errors | Result | Defect link |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |  |  |

For each defect, capture the canonical profile key, application field name,
stored value, visible Chinese value, visible English/official value, expected
mapping, step name, and whether the problem survives reload.

## 2026-08-01 Preparation Run

- Frontend: running on port `3000`; authenticated Universal Profile page was
  reachable in Chrome.
- Agent backend: started on port `3002`; Supabase connection check succeeded.
- Catalog: 1,761 form rows across 18 DB-driven schemas.
- Edward core profile: populated with a complete synthetic QA dataset.
- Expanded profile migration: `create_universal_profile_answers` was applied
  to development Supabase on 2026-08-01. Verification confirmed RLS is enabled,
  the service role has CRUD access, and `authenticated` has no direct table
  access.
- Loader defect found: the Universal Profile schema query previously stopped at
  Supabase's first 1,000 rows. The worktree now paginates the complete catalog.
- Save defect found: the identity category can exceed the 250-answer server
  action limit. The worktree now saves a category in 200-answer chunks.
- Classification defect found: the expanded profile currently exposes
  application-specific fields including intended visa validity, requested visa
  type, destination address/administrative fields, representative/account
  details, and declaration acknowledgements. These must be excluded before an
  operator can truthfully claim that every visible Universal Profile field is
  reusable or safely populate the entire expanded page.
- Static checks: frontend type-check passed; focused ESLint passed.
- Focused tests: 10 profile field/prefill tests passed. The existing expanded
  editor test failed because it still expects the removed `1/2 saved` progress
  text; this failure is separate from pagination and save chunking.
- Batch A used six new dry-run draft applications so older application answers
  could not override profile prefill. All six pages loaded with no browser
  console errors or backend error logs.

### Batch A preparation results

| Country/schema | Fresh application ID | Core profile result | Finding |
| --- | --- | --- | --- |
| United States / `DS160` | `daaf92e4-fe73-4dea-9766-a348061b4008` | Partial pass | Name, birth date/city/state/country, nationality, address, email, phone, and passport facts prefilled. Extended reusable facts remain unavailable until migration/profile completion. |
| United Kingdom / `UK_STANDARD_VISITOR` | `9a286db1-75ce-4e80-9692-1f9d53bc9275` | Partial pass | Name, birth facts, nationality, passport, email, phone, and city/state prefilled. Extended reusable facts remain unavailable. |
| Australia / `AU_VISITOR_600` | `07ecc4fd-0494-4eaf-8ce3-97fde5bd044a` | Fail | Date/country of birth and core identity prefilled, but town/city of birth, state/province of birth, and passport nationality stayed empty. |
| France / `EU_SCHENGEN_C_SHORT_STAY` | `111a0e91-9a1c-49d2-9c90-26410c544ca3` | Partial pass | Name, birth facts, nationality, passport, email, phone, occupation, and address facts prefilled. Extended reusable facts remain unavailable. |
| Japan / `JP_TOURIST` | `699afb12-1720-45f6-a8d3-0d9b37fc3108` | Fail | Core name, birth date/city/country, nationality, passport, authority, address, email, and phone prefilled, but birth state/province stayed empty. |
| Vietnam / `VN_E_VISA` | `b5c3564c-1154-48a6-896e-7c385263ff1f` | Fail | Core name, birth date/place, nationality, passport, authority, email, and phone prefilled, but required re-enter-email stayed empty. |

Batch B, Batch C, complete required-field traversal, and Review Application
accuracy remain gated on removing application-specific fields from the profile
classifier and filling the resulting reusable-only expanded dataset.

## 2026-08-01 Indonesia Focused Run

- Country/schema: Indonesia / `ID_C1_TOURIST`.
- Fresh application: `9e6769fa-4175-49eb-a67e-951acbe9d75f`.
- Current schema: 24 rows: 22 application fields and 2 declarations.
- Fixed creation-time profile aliases for Indonesia `birth_place`, `birthday`,
  and `passport_place_of_issue`.
- Fixed the Indonesia phone split so `+6581234567` is represented as country
  code `+65` and local number `81234567` in the VIZA form.
- Browser verification: full name, gender, Shanghai birthplace, date of birth,
  China passport country/issuing country, issue/expiry dates, email, phone code,
  and local mobile number render correctly on the fresh draft.
- Remaining truthful applicant inputs: mother's full name and the intended
  Indonesia accommodation/address/postal code.
- Required C1 documents currently absent: passport bio-page image, latest color
  photo, return/onward-ticket PDF, and three-month personal bank-statement PDF.
  The VIZA checklist was aligned with the worker so all four prerequisites are
  visible before submission.
- Safety checkpoint: the connected Edward profile contains an explicitly
  synthetic QA passport, phone, address, and test dates. Do not enqueue this
  draft to the Indonesian government portal or accept the truth declaration.
  Replace the synthetic facts and upload the applicant's real documents first.

## 2026-08-02 Sixteen-Schema Parallel Run

Scope: every active DB schema except the two Indonesia schemas already covered
by the focused run. Every application below was created as a fresh `draft` with
purpose `VIZA_PLACEHOLDER_DRY_RUN`; none was queued or given a submitted time.

### Automated gates

- Live catalog: 18 schemas / 1,761 fields; 16 non-Indonesia schemas selected.
- Fresh QA draft creation seeded all 16 from the corrected Universal Profile.
- Conditional required-field audit: all 16 report `missingRequiredCount: 0`.
- Country-provider dry run: all 16 validate and return `submitted_mock` in
  `dry_run` mode. This is a contract result, not an official submission.
- Browser batches: all 16 long-form routes rendered in authenticated Chrome;
  the final ten visible tabs reported `已保存` and non-zero populated controls.
- No application reached payment or final official submission.

### Schema and mapper defects fixed

1. Passport legal given name no longer inherits the account nickname
   `Edward`; the reusable legal name is `ZEHUA ZHANG`.
2. Passport issuing country, place of issue, and issuing authority are separate
   facts; birthplace is no longer reused as residence city/state.
3. Universal phone and passport-place aliases now map to their canonical
   profile keys.
4. Three-letter country codes such as `CHN` and `SGP` normalize to an
   official form's two-letter options instead of being cleared on hydration.
5. DS-160 `has_specific_plans` maps to the provider's
   `has_specific_travel_plans` key.
6. MDAC, SGAC, and Philippines eTravel portal normalizers now accept their
   live-schema aliases and profile fallbacks.
7. The pre-submit harness forces local system Chrome, disables external
   CAPTCHA/cloud-browser services, and refuses applications without the QA
   purpose sentinel.

### Per-schema results

| Schema | Application ID | Required missing | Provider dry run | Official pre-submit result |
| --- | --- | ---: | --- | --- |
| `AU_VISITOR_600` | `28e9cf66-fefb-4a35-b922-fbd820ee7881` | 0 | Pass | Blocked: no applicant ImmiAccount row; runner status remains partial. |
| `DS160` | `40a2174d-2753-41bb-84ff-3d6bc90db021` | 0 | Pass | CEAC reached the start CAPTCHA; stopped before solving because authorization was Indonesia-only. |
| `EG_E_VISA` | `0d2279ce-34a0-46b1-b95e-4695330cd5a1` | 0 | Pass | Blocked: authenticated Egypt portal account/recon is not implemented. |
| `EU_SCHENGEN_C_SHORT_STAY` | `bdbe7a9b-502b-4d8b-bdec-e79567ec15b0` | 0 | Pass | Blocked: no readable France-Visas account for this applicant. |
| `JP_TOURIST` | `10d819d5-bb61-4ae0-a4c1-e7671eedd006` | 0 | Pass | Paper/PDF route; no online payment portal in scope. |
| `KR_C39_SHORT_TERM_VISIT` | `041841bc-0480-4bce-8226-06ad983620b6` | 0 | Pass | Partial module: supporting documents/KVAC live selectors remain gated. |
| `MY_MDAC_ARRIVAL_CARD` | `e3f68479-b321-4c0d-8e74-74c606f37d8b` | 0 | Pass | Official MDAC form filled and intentionally threw `mdac_stopped_before_submit`; 3 screenshots. |
| `PH_ETRAVEL_ARRIVAL_CARD` | `66a56203-19da-4751-a20c-fe44fe948470` | 0 | Pass | Official site requires an eTravel/eGovPH account before the form; 2 screenshots. |
| `PH_ETRAVEL_DEPARTURE_CARD` | `e0ca590c-df5f-43a4-8192-f5dae980fd58` | 0 | Pass | Same official account gate; 2 screenshots. |
| `SG_ARRIVAL_CARD` | `4ab15833-c57f-4f80-bd3e-80faa1fa9e36` | 0 | Pass | Official ICA review reached; `stopped_before_submit`; 2 screenshots. |
| `TH_TDAC_ARRIVAL_CARD` | `dd83d65b-7891-48e3-a74a-f652cd515bf6` | 0 | Pass | Official Cloudflare/CAPTCHA gate; Browser API/2Captcha deliberately disabled; 2 screenshots. |
| `TH_TOURIST_E_VISA` | `34b71694-602e-46e2-9081-81ea544294b7` | 0 | Pass | Official runner is `not_started`. |
| `TW_ENTRY_PERMIT` | `b5d237ab-b1d3-49fa-a01d-3ba3daf2c7a0` | 0 | Pass | Missing Taiwan-specific supporting documents; live module otherwise stops at CAPTCHA. |
| `UK_STANDARD_VISITOR` | `2cef3c47-7389-486a-a74d-81c887b7cdf9` | 0 | Pass | Existing UKVI saved application walked in system Chrome and halted before pay. |
| `VN_E_VISA` | `233558dd-3ef1-46e4-b3d2-db7ffccef6cb` | 0 | Pass | Partial runner; official checkpoint/CAPTCHA flow not authorized in this batch. |
| `VN_PREARRIVAL_DECLARATION` | `4755b35f-e828-4406-989c-9c3d9a1de54d` | 0 | Pass | Official portal presented CAPTCHA before the declaration form; stopped with 2 screenshots. |

### Important interpretation

`missingRequiredCount: 0` proves the VIZA schema can store a value for every
currently visible required branch. It does not prove the fixture is truthful.
Unknown father details, parent dates, travel/security history, flights, hotels,
funds, declarations, passwords, and the nine-digit Vietnam visa number are QA
fixtures only. They must be reviewed or replaced before any real submission.

## 2026-08-02 Indonesia Authorized Visible QA

- Application: `9e6769fa-4175-49eb-a67e-951acbe9d75f`, schema
  `ID_C1_TOURIST`.
- The operator explicitly authorized the local use of `Passport.jpg`,
  `Portrait.JPG`, and `Statement.pdf`. A one-page QA-only return-ticket PDF was
  generated and uploaded only to the local VIZA application.
- The passport comparison found that the earlier draft still contained the
  synthetic QA passport number, birth date, birthplace, issue date, expiry
  date, and passport-form name. Those profile/application fields were corrected
  from the authorized passport before the official preview.
- A dedicated applicant inbox alias under `@viza.it.com` was provisioned and
  saved as the Indonesia official-account email. The applicant's personal
  email remains the forwarding/login destination and is not used as the
  official portal username.
- Structured bilingual values now use one canonical value, preventing stale
  phone/email/passport copies from restoring old data. The Indonesia phone
  renders as country code `+65` plus the local number only.
- Postal code `80351` returned several villages. The lookup now scores all
  matching directory rows against the typed accommodation address instead of
  silently taking the first row, so `Pererenan` is selected rather than
  unrelated `Kapal`.
- Visible local runner:

  ```bash
  cd viza-be/submission-service
  set -a; source ../agent-backend/.env.local; set +a
  INDONESIA_VISIBLE_QA_MODE=local npm run indonesia:visible-qa
  ```

- Browser result: all four local required-document records were verified with
  `uploaded` status, the headed Chrome window was left open for inspection, and
  neither the VIZA Submit button nor any official-site action was clicked.
- Official preview safety: `INDONESIA_ACCOUNT_REGISTRATION_SUBMIT=false` is
  enforced by the headed runner. The official text/date/select fields can be
  filled visibly, but passport/photo paths are intentionally omitted because
  government upload endpoints may retain files before Register is clicked.
- The applicant supplied the mother's full legal name in Latin letters. It was
  saved to both the Indonesia draft and the reusable family profile, then
  supplied to the headed official preview through `ID_QA_MOTHER_NAME`.
- Official preview result: the public WNA registration form retained all 13
  verified text/date values, while the production helper also populated the
  document type, gender, phone-code country, and passport-country controls.
  The browser was left open for operator inspection. No official file upload,
  Register click, account creation, visa submission, or payment occurred.
- 2Captcha is authorized for this Indonesia test if a CAPTCHA is encountered.
  The no-submit registration preview does not intentionally invoke CAPTCHA;
  never solve one merely to cross the Register or payment boundary.
