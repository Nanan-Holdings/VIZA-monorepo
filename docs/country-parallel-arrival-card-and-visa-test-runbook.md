# Country-Parallel Arrival-Card and Visa Test Runbook

## Purpose and outcome

Run one controlled VIZA test across every destination currently in the client
catalogue. Work may proceed in parallel, but every destination has its own
truthful itinerary and its own application. The desired outcomes are:

1. every catalogue route can be opened, completed, saved, reviewed, and
   evidenced;
2. free, live arrival/departure declarations reach an official confirmation
   where the traveller is eligible and the portal's submission window is open;
3. paid visa/ETA/eVisa routes reach the **first official payment boundary**,
   then stop without creating a charge; and
4. routes not yet wired to a live official runner are tested through VIZA's
   form, validation, review, and handoff boundary only. They must not be
   represented as official submissions.

This is a real-travel workflow, not a synthetic fixture run. It is separate
from `application-qa-multithread-testing.md`, which remains a local,
no-official-submission QA procedure.

## Operator authorization

The applicant has approved this run and states that the travel represented by
each application is intended travel. The operator may use the applicant's
existing VIZA profile, passport/contact data, supplied trip evidence, and
application-scoped VIZA email inbox to:

- create and save an application for every listed route;
- transmit the applicable details to an official portal **only** for the free
  declaration routes in the live-completion lane below;
- use the submission service's configured CAPTCHA-solving path when an
  authorized official flow presents a CAPTCHA; and
- follow each paid route only until the portal first requests a payment,
  card, wallet authorization, purchase confirmation, or an equivalent
  irreversible fee action.

Paste this acknowledgement into the run record before starting:

> I confirm that I intend to take the trip stated in each named country
> application, that its passenger, passport, itinerary, accommodation, and
> health/customs/declaration answers are truthful and current, and that I
> authorize VIZA to submit the free official arrival/departure declarations in
> their permitted submission windows. I authorize paid visa tests only up to,
> and not through, the first payment action. I also authorize VIZA's configured
> CAPTCHA-solving service to complete CAPTCHA challenges needed for these
> authorized official portal flows.

This authorization removes the VIZA consent blocker for the run. It does not
turn placeholder travel into a truthful declaration, bypass a portal's
eligibility or opening window, waive an OTP/account/identity check, or permit a
payment. A CAPTCHA challenge is expected to be handled by the configured
submission-service solver; it is not a manual approval checkpoint. If a route
lacks current truthful travel data, mark it `BLOCKED — TRUTH DATA` and
continue with the other routes; do not invent an answer.

## Non-negotiable stop rules

| Event | Required action | Result label |
| --- | --- | --- |
| Free arrival/departure declaration with current, eligible trip data and an open official window | Submit once through the designated VIZA runner and wait for official evidence. | `OFFICIAL CONFIRMED` |
| A paid visa/ETA/eVisa shows an amount, payment method, virtual-card request, wallet, purchase button, or a final paid submission action | Capture evidence, record the amount/currency and portal step, then stop. Do not enter, issue, or expose a card. | `STOPPED — PRE-PAYMENT` |
| Portal presents a CAPTCHA in an authorized flow | Let the submission service use its configured TwoCaptcha integration, retain the attempt diagnostics, and continue if it succeeds. Do not ask for a manual CAPTCHA confirmation. | Continue; otherwise `ACTION REQUIRED — CAPTCHA` |
| Portal asks for an OTP, account sign-in, appointment, biometric booking, or human identity verification before payment | Preserve the state and record the exact unblocker. Do not claim completion. | `ACTION REQUIRED` |
| A travel date is outside the official filing window or has already passed | Leave the application scheduled/draft; do not force it through the portal. | `SCHEDULED` or `BLOCKED — WINDOW` |
| Duplicate application or active queue job is detected | Do not retry or create a second filing. Reuse the existing application/job and investigate. | `BLOCKED — DUPLICATE` |

Never change the environment to fake an entitlement, payment, official
confirmation, submission date, or CAPTCHA success. Never use test data in an
official declaration.

## CAPTCHA handling: use the actual submission service

This run must use the real submission-service runner for an authorized
official flow. If a portal presents Cloudflare Turnstile, reCAPTCHA, hCaptcha,
or another supported challenge, the runner must call its configured TwoCaptcha
integration and continue only with the challenge result returned to that
browser session. It must not pause solely to ask the operator to click a
"Verify you are human" checkbox.

The test record must capture the application ID, queue/job ID, portal stage,
solver outcome, and redacted error code if one occurs. It must not store a
CAPTCHA token, API key, browser cookie, or solver credentials. A true solver
failure, unsupported challenge, rate limit, or portal account/OTP requirement
is an evidence-backed `ACTION REQUIRED` result; it is not permission to
manually bypass the control. The next stop rule still wins: if the portal then
reaches a payment boundary, stop before payment.

## Current execution lanes

The source of truth for this classification is the active application catalogue
and runner registry, not a country name alone. A country can have more than
one route and each route must be tested separately.

| Lane | Routes | Target | Completion evidence |
| --- | --- | --- | --- |
| A — live free declaration | Singapore `SG_ARRIVAL_CARD`; Malaysia `MY_MDAC_ARRIVAL_CARD`; Thailand `TH_TDAC_ARRIVAL_CARD`; Philippines `PH_ETRAVEL_ARRIVAL_CARD` and applicable departure route; South Korea `KR_E_ARRIVAL_CARD`; Vietnam `VN_PREARRIVAL_DECLARATION` | Submit once when the official filing window and traveller eligibility allow it. | Official confirmation page/screenshot, QR where supplied, PDF where supplied, reference number, official/VIZA notification, and final VIZA result card. |
| B — runner-backed paid route | Indonesia `ID_C1_TOURIST` and `ID_B1_EVOA`; Vietnam `VN_E_VISA`; any route whose current runner reaches an official fee step | Exercise the real runner only to its first payment boundary. | Screenshot/URL/state immediately before payment, stated fee/currency if shown, VIZA application ID, and queue/job ID. |
| C — catalogue form and handoff | Every remaining listed visa, ETA, entry permit, visa-on-arrival, or arrival-card route | Complete the VIZA application, validation, upload/review, and the available official-handoff/pre-payment boundary. | Saved application ID, full review screenshot, validation status, route/handoff state, and precise limitation. |

Do not interpret Lane C as a product failure. It records current test coverage
truthfully while allowing the team to identify routes that still need a live
official runner.

## Start local services and preflight

Use separate terminals and the local environment already configured for this
workspace. Do not put passwords, service-role keys, or applicant documents in
the run log.

```bash
cd viza-fe/internal-website
npm run dev -- --port 3001
```

```bash
cd viza-be/agent-backend
npm run dev
```

```bash
cd viza-be/submission-service
npm run dev
```

Before creating applications, record these checks:

1. `http://127.0.0.1:3001/client/login` loads and the intended applicant can
   sign in.
2. `http://127.0.0.1:3002/health` is healthy (or the environment's configured
   agent-backend health endpoint is healthy).
3. The submission service has its required environment configuration and
   starts without a runner/configuration error.
4. VIZA's application-scoped inbox forwarding is configured and the applicant
   has consented to it. Confirm delivery with a non-sensitive test message;
   do not expose the inbox address or a message token in the run log.
5. The worktree is reviewed. Preserve the existing unrelated work; this
   runbook does not authorize source changes or deployment.
6. For every Lane A item, check the official portal's current filing window
   and the traveller's eligibility immediately before queueing it. Use the
   portal's live guidance, not remembered timing rules.
7. Confirm that the actual submission service is running with its CAPTCHA
   solver configuration available for the authorized lanes. Never substitute a
   manual browser click just because a Cloudflare challenge appears.

## Prepare a truthful trip sheet first

Create one row per country route before opening tabs. The same person may be
used across routes, but the dates, entry/exit points, flight numbers,
accommodation, transit status, health/customs answers, and purpose must be
true for that particular destination. A person cannot truthfully submit
simultaneous arrival declarations for incompatible itineraries.

| Route | Intended arrival/departure | Carrier/flight or land/sea entry | Accommodation/contact in destination | Documents or special facts | Window checked | Ready? |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

For each route, also confirm passport validity, nationality/residence,
destination transit rules, traveller role, and whether the declaration is
required. Mark a non-applicable arrival/departure declaration `NOT APPLICABLE`
rather than submitting it merely for coverage.

## Parallel execution model

Use application ID as the unit of work. Do not share a form tab, queue job, or
managed inbox answer across countries.

```text
trip-sheet row
    -> unique VIZA application
    -> complete + save + review
    -> lane decision
       -> A: scheduled/live official submission -> official artifacts
       -> B: runner -> first payment boundary -> stop
       -> C: form + validation/handoff -> record limitation
    -> evidence bundle + final result row
```

Run parallel batches at the capacity of the browser/runner pool, keeping Lane
A jobs independently observable. A safe order is:

1. Validate and save all catalogue applications in parallel.
2. Queue eligible Lane A applications one at a time per country; wait until a
   durable job exists before moving on. Do not enqueue a retry while the job
   is queued, scheduled, or processing.
3. Run Lane B applications to their first payment boundary in parallel only
   when the browser contexts and inbox/OTP flows are independent.
4. Complete Lane C reviews in parallel and log the missing automation or
   portal dependency as a product finding.
5. Revisit scheduled Lane A jobs when their official windows open. A
   scheduled item is successful scheduling, not an official submission.

## Per-route procedure

1. Open the country product from the VIZA destination picker. Verify the
   country, product code, and purpose against the trip sheet before saving.
2. Create a new application only if the applicant has no existing active
   application for that exact country/product/itinerary. Record the VIZA
   application ID immediately.
3. Verify profile prefill against the passport and current contact facts.
   Correct stale data in VIZA before continuing; do not "fix" a mismatch on
   an official portal only.
4. Complete every route-specific item using the matching trip-sheet row.
   Upload only documents approved for this application and note any document
   requirement that cannot be fulfilled.
5. Save, reload, and open Review Application. Resolve validation errors and
   confirm the displayed itinerary/declarations are still truthful.
6. Take a pre-action screenshot containing the product, review status, and
   application ID/reference where visible. Redact passport number, full home
   address, QR payload, barcode, and contact details before putting evidence
   in an issue or shared document.
7. Apply the lane rule:

   - **Lane A:** use VIZA's normal primary submission action once. Observe the
     queue/job through terminal state. The submission service handles an
     encountered supported CAPTCHA through TwoCaptcha; do not ask the operator
     to click a human-verification checkbox. A pass requires an official portal
     confirmation, not merely "queued" or "processing".
   - **Lane B:** follow the normal runner until the first payment boundary.
     Capture the boundary and stop immediately, even if the portal offers a
     VIZA virtual card.
   - **Lane C:** complete the VIZA form and available handoff. Record whether
     the limitation is a missing live runner, an official login, a timing
     window, document review, an appointment, or another portal constraint.
8. Reload the VIZA result page. Verify that stored evidence belongs to this
   application and country, has the expected type (screenshot/PDF/QR/reference
   or pre-payment state), and contains no stale evidence from another run.
9. Record exactly one terminal result using the template below.

## Country and route coverage matrix

Complete every row that appears in the destination picker. `A`, `B`, and `C`
refer to the lanes above; they are the starting test target and may be refined
only with evidence from the current environment.

### Direct catalogue routes

| Country | Product code(s) | Initial lane | Required terminal point |
| --- | --- | --- | --- |
| Australia | `visitor_subclass_600` | C | Review/handoff boundary |
| Argentina | `tourist_visa_or_ave` | C | Review/handoff boundary |
| Brazil | `visitor_visa_or_evisa` | C | Review/handoff boundary |
| Cambodia | `tourist_evisa` | C | Review/handoff boundary |
| Canada | `CA_TRV` | C | Review/handoff boundary |
| Chile | `tourist_visa` | C | Review/handoff boundary |
| China | `tourist_l_visa` | C | Review/handoff boundary |
| Colombia | `check_mig_or_visitor_visa` | C | Review/handoff boundary |
| Cuba | `dviajeros_entry_form` | C | Review/handoff boundary |
| Dominican Republic | `eticket_entry_exit` | C | Review/handoff boundary |
| Egypt | `evisa_tourism` | C | Review/handoff boundary |
| India | `IN_E_VISA` | C | Review/handoff boundary |
| Indonesia | `ID_C1_TOURIST`; `ID_B1_EVOA` | B | First payment boundary |
| Ireland | `short_stay_c_visit_visa` | C | Review/handoff boundary |
| Israel | `eta_il_or_visitor_visa` | C | Review/handoff boundary |
| Japan | `short_term_tourism_evisa`; `JP_VISIT_JAPAN_WEB` | C | Review/handoff boundary |
| Jordan | `evisa_or_visitor_visa` | C | Review/handoff boundary |
| Kenya | `KE_ETA` | C | Review/handoff boundary |
| Laos | `tourist_evisa` | C | Review/handoff boundary |
| Malaysia | `MY_MDAC_ARRIVAL_CARD` | A | Official confirmation |
| Maldives | `tourist_visa_on_arrival` | C | Review/handoff boundary |
| Mexico | `visitor_visa_or_exemption` | C | Review/handoff boundary |
| Morocco | `visa_free_or_evisa` | C | Review/handoff boundary |
| Nepal | `tourist_visa_on_arrival` | C | Review/handoff boundary |
| New Zealand | `visitor_visa` | C | Review/handoff boundary |
| Oman | `tourist_evisa` | C | Review/handoff boundary |
| Peru | `tourist_visa` | C | Review/handoff boundary |
| Philippines | `PH_ETRAVEL_ARRIVAL_CARD`; `PH_ETRAVEL_DEPARTURE_CARD` | A | Official confirmation when applicable |
| Qatar | `hayya_a1_tourist_visa` | C | Review/handoff boundary |
| Russia | `unified_evisa` | C | Review/handoff boundary |
| Saudi Arabia | `SA_E_VISA` | C | Review/handoff boundary |
| Singapore | `SG_ARRIVAL_CARD` | A | Official confirmation |
| South Africa | `visitor_visa_tourism` | C | Review/handoff boundary |
| South Korea | `KR_C39_SHORT_TERM_VISIT`; `KR_E_ARRIVAL_CARD` | C; A | Review/handoff; official confirmation |
| Sri Lanka | `eta_tourism` | C | Review/handoff boundary |
| Taiwan | `TW_ENTRY_PERMIT` | C | Review/handoff boundary |
| Tanzania | `tourist_evisa` | C | Review/handoff boundary |
| Thailand | `TH_TDAC_ARRIVAL_CARD` | A | Official confirmation |
| Turkiye | `TR_E_VISA` | C | Review/handoff boundary |
| United Arab Emirates | `AE_TOURIST_VISA` | C | Review/handoff boundary |
| United Kingdom | `UK_STANDARD_VISITOR` | C | Review/handoff boundary |
| United States | `DS160` | C | Review/handoff boundary |
| Vietnam | `evisa_tourism`; `VN_PREARRIVAL_DECLARATION` | B; A | First payment boundary; official confirmation |

### Schengen main-destination routes

Each country below uses `EU_SCHENGEN_C_SHORT_STAY`. Test the actual main
destination only; do not create 29 live visa applications for a single trip.
For country-wide catalogue coverage, each row still needs form/review evidence.

| Main destination | Initial lane | Result |
| --- | --- | --- |
| Austria | C | Review/handoff boundary |
| Belgium | C | Review/handoff boundary |
| Bulgaria | C | Review/handoff boundary |
| Croatia | C | Review/handoff boundary |
| Czech Republic | C | Review/handoff boundary |
| Denmark | C | Review/handoff boundary |
| Estonia | C | Review/handoff boundary |
| Finland | C | Review/handoff boundary |
| France | C | Review/handoff boundary |
| Germany | C | Review/handoff boundary |
| Greece | C | Review/handoff boundary |
| Hungary | C | Review/handoff boundary |
| Iceland | C | Review/handoff boundary |
| Italy | C | Review/handoff boundary |
| Latvia | C | Review/handoff boundary |
| Liechtenstein | C | Review/handoff boundary |
| Lithuania | C | Review/handoff boundary |
| Luxembourg | C | Review/handoff boundary |
| Malta | C | Review/handoff boundary |
| Netherlands | C | Review/handoff boundary |
| Norway | C | Review/handoff boundary |
| Poland | C | Review/handoff boundary |
| Portugal | C | Review/handoff boundary |
| Romania | C | Review/handoff boundary |
| Slovakia | C | Review/handoff boundary |
| Slovenia | C | Review/handoff boundary |
| Spain | C | Review/handoff boundary |
| Sweden | C | Review/handoff boundary |
| Switzerland | C | Review/handoff boundary |

## Evidence and result log

Store raw official artifacts only in the application-scoped protected storage.
In the shared run log, link the application ID and a redacted artifact record;
never paste passport numbers, QR contents, email aliases, confirmations with
personal data, or payment/session tokens.

| Started | Country/product | Application ID | Lane | Official window checked | Last safe portal state | Reference/job ID | Artifacts stored | Terminal result | Blocker/next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |

Use only these terminal results:

- `OFFICIAL CONFIRMED` — a Lane A portal confirms the declaration and VIZA
  shows matching evidence.
- `STOPPED — PRE-PAYMENT` — the paid boundary was reached and no payment was
  attempted.
- `HANDOFF VERIFIED` — the VIZA form/review and current handoff boundary
  passed, but no live official runner is available.
- `SCHEDULED` — truth data is ready but the official filing window is not yet
  open.
- `ACTION REQUIRED` — human OTP/login/appointment/document action is needed,
  or the configured CAPTCHA solver returned a documented failure.
- `BLOCKED — TRUTH DATA`, `BLOCKED — WINDOW`, `BLOCKED — DUPLICATE`, or
  `FAILED` — include the exact, evidence-backed reason.

## Close-out checklist

1. Confirm every direct catalogue and Schengen row has one terminal result.
2. For each `OFFICIAL CONFIRMED`, compare country, traveller, itinerary, and
   reference against the correct VIZA application before considering it done.
3. For every paid route, verify no payment intent was confirmed, no card was
   entered or issued for payment, and no official fee receipt exists.
4. For scheduled or blocked declarations, record the date/window or missing
   truthful fact needed to resume; do not retry automatically.
5. Inspect runner logs and VIZA result cards for failures, duplicate jobs, or
   cross-application artifacts. Capture only redacted diagnostics.
6. Produce a count by terminal result and a prioritized backlog of missing
   runners, schema defects, official portal changes, and required human steps.

The run is complete when every row has an evidence-backed terminal result—not
when every country has an official submission. That distinction keeps the test
useful, legally accurate, and free of unintended payments.
