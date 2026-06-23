# VIZA DS-160 CEAC Runtime Validation PRD

**Version:** 1.1
**Status:** Draft for implementation
**Owner:** VIZA
**Last updated:** 2026-06-23

---

## 1. Product Summary

The previous CEAC autofill pass produced strong module-level building blocks, but it did **not** prove that the live `submission-service` worker can actually perform DS-160 fill and live-assisted submission end to end from this machine.

Two concrete gaps remain:

1. the live DS-160 queue worker is still wired to the legacy `prefillDs160()` prototype instead of the new CEAC runtime modules
2. the real CEAC site can present an anti-bot / human-verification gate at the start page, which blocks unattended progress unless the configured CAPTCHA-solving path can handle it

This PRD is for the follow-up pass that makes the CEAC worker **truthful, live-path wired, and testable**. The goal is to:

- wire the worker to the intended CEAC runtime pipeline
- make runtime outcomes explicit (`submitted`, `blocked/manual_required`, `failed`)
- add an operator-verifiable smoke path that proves what the machine can currently reach
- preserve the live-assisted submission contract when the CEAC path is available and applicant authorization is complete

---

## 2. Problem Statement

The repo now contains a substantial CEAC helper layer under `viza-be/submission-service/src/ceac/`:

- session bootstrap
- page identity detection
- navigation and validation helpers
- checkpoints and Application ID capture
- `.dat` artifact capture and recovery tracking
- final sign/submit handling
- success/failure result payloads
- screenshot diagnostics

However, the live worker still does not use that architecture as its primary DS-160 execution path.

Observed runtime facts from this machine:

- `submission-service` type-checks
- the new CEAC modules compile
- a direct Playwright probe to `https://ceac.state.gov/GenNIV/Default.aspx` can fail to land on the expected start page
- CEAC can return an anti-bot page asking for a human verification code and showing a support ID

That means we currently have a **false-comfort gap**:

- the PRD flags can say complete
- modules can compile
- but the real worker/runtime can still be blocked before form filling or final submission starts

This pass must close that truth gap.

---

## 3. Goals

Build a CEAC runtime path that:

1. uses the new CEAC modules from the live DS-160 worker path
2. stops claiming success based only on module existence or PRD state
3. detects and reports CEAC anti-bot/manual gates explicitly
4. solves supported CAPTCHA gates through the configured provider when live-assisted submission is enabled
5. completes final DS-160 sign/submit when applicant authorization, signature data, and gate checks are complete
6. adds a repeatable smoke/diagnostic path so operators can test runtime readiness honestly from the host

---

## 4. Non-Goals

This phase does **not** include:

- inventing applicant data, signature inputs, security answers, travel facts, or official-portal answers
- bypassing unsupported anti-automation defenses such as Cloudflare, hCaptcha, or other gates outside the configured solver's capability
- submitting without applicant authorization and complete required signature data
- pretending a blocked start page counts as a successful submitted run

---

## 5. Truth Contract

The worker must report what actually happened.

Allowed truthful outcomes:

- **submitted**: the worker reached the Sign and Submit flow, completed authorized final submission, and captured official confirmation/proof evidence when available
- **blocked/manual_required**: CEAC presented an unsupported gate, a required applicant fact was missing, CAPTCHA solving was unavailable/failed, payment/finality required external control, or another manual condition prevented unattended progress
- **failed**: the worker or runtime failed independently of CEAC's manual gate

Disallowed behavior:

- claiming DS-160 submission success when the CEAC start page or final page was gated and not solved
- collapsing manual gate detection into a vague unknown-page failure with no operator context
- treating compiled modules or PRD completion alone as live proof of form-filling or submission success
- entering or fabricating final signature data that was not provided by the applicant/application record

---

## 6. Functional Requirements

### 6.1 Live worker wiring

The DS-160 queue processor must use the new CEAC session/navigation/result modules as its primary path.

It must no longer rely on the legacy `prefillDs160()` prototype as the authoritative implementation.

### 6.2 Start-page readiness and anti-bot detection

The CEAC bootstrap flow must:

- distinguish expected start page vs supported CAPTCHA gate vs unsupported manual gate vs other blocked states
- solve supported image CAPTCHA gates through the configured CAPTCHA provider when enabled
- capture useful diagnostic context (for example visible body text, support ID, screenshot, or marker classification)
- surface that distinction in worker status/output

### 6.3 Real CEAC orchestration

When CEAC allows progression, the live worker must:

- load answers from VIZA
- drive page-by-page fill using the new CEAC helpers
- checkpoint/save at natural boundaries
- capture Application ID and `.dat` artifacts when available
- enter applicant-authorized signature data on the final sign/submit page
- solve the final CAPTCHA through the configured provider when required
- click final submit only after all live-assisted gates pass
- capture official confirmation evidence after submission

### 6.4 Outcome persistence

The system must persist outcomes so operators can tell which class of result occurred:

- submitted success with official evidence
- blocked/manual-required
- genuine failure

Persistence should update the existing queue/application records with as little schema churn as possible.

### 6.5 Operator-verifiable diagnostics

The repo must include a documented smoke/diagnostic path that can be run from the machine to answer:

- can we reach the expected CEAC start page?
- are we anti-bot gated?
- can the configured CAPTCHA provider solve the supported gate?
- did the site return another blocked state?

The output must be structured enough for operators to trust it.

---

## 7. Success Criteria

This PRD is successful only if all of the following are true:

1. the live worker path is wired to the CEAC runtime modules
2. CEAC anti-bot/manual gates are surfaced explicitly and truthfully
3. supported CAPTCHA gates can be solved through the configured provider when enabled
4. the worker can produce distinct persisted outcomes for submitted vs blocked/manual vs failure
5. the repository includes a repeatable smoke/diagnostic path for CEAC readiness
6. the final DS-160 submission path requires explicit applicant authorization and real signature data

---

## 8. Story Breakdown

- **US-009**: pin runtime-validation scope and truth contract
- **US-010**: replace the legacy DS-160 worker path with the CEAC runtime pipeline
- **US-011**: detect CEAC anti-bot and manual-intervention gates explicitly
- **US-012**: implement real page-by-page CEAC fill orchestration on the new flow
- **US-013**: persist CEAC runtime outcomes and queue semantics clearly
- **US-014**: add operator-verifiable CEAC smoke diagnostics and test instructions
- **US-015**: complete gated final sign/submit and official proof capture

---

## 9. Operational Notes

Current observed CEAC behavior from this host:

- direct navigation to `https://ceac.state.gov/GenNIV/Default.aspx` can return a human-verification page instead of the expected DS-160 start flow
- the page body can include language like: "This question is for testing whether you are a human visitor and to prevent automated spam submission"
- a CEAC support ID may be present and should be recorded in diagnostics when available

Design implication:

- runtime testing must treat this as a first-class operational state, not an incidental exception
- supported CAPTCHA-solving failures are operational blockers, not successful submissions

---

## 10. Out of Scope for Ralph in This Pass

Ralph should not bypass unsupported anti-automation systems. If CEAC requires an unsupported manual action, missing applicant fact, payment/finality step, or external operator action, the system should expose that cleanly and stop.
