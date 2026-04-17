# VIZA DS-160 CEAC Runtime Validation PRD

**Version:** 1.0  
**Status:** Draft for implementation  
**Owner:** VIZA  
**Last updated:** 2026-04-18

---

## 1. Product Summary

The previous CEAC autofill pass produced strong module-level building blocks, but it did **not** prove that the live `submission-service` worker can actually perform DS-160 autofill end to end from this machine.

Two concrete gaps remain:

1. the live DS-160 queue worker is still wired to the legacy `prefillDs160()` prototype instead of the new CEAC runtime modules
2. the real CEAC site currently presents an anti-bot / human-verification gate at the start page, which blocks unattended autofill before the form even begins

This PRD is for the follow-up pass that makes the CEAC worker **truthful, live-path wired, and testable**. The goal is not to pretend headless Playwright can magically pass CEAC anti-bot defenses. The goal is to:

- wire the worker to the intended CEAC runtime pipeline
- make runtime outcomes explicit (`handoff_ready`, `blocked/manual_required`, `failed`)
- add an operator-verifiable smoke path that proves what the machine can currently reach
- preserve the stop-at-sign contract when the CEAC path is available

---

## 2. Problem Statement

The repo now contains a substantial CEAC helper layer under `viza-be/submission-service/src/ceac/`:

- session bootstrap
- page identity detection
- navigation and validation helpers
- checkpoints and Application ID capture
- `.dat` artifact capture and recovery tracking
- sign-page stopping contract
- success/failure result payloads
- screenshot diagnostics

However, the live worker still does not use that architecture as its primary DS-160 execution path.

Observed runtime facts from this machine:

- `submission-service` type-checks
- the new CEAC modules compile
- a direct Playwright probe to `https://ceac.state.gov/GenNIV/Default.aspx` did **not** land on the expected start page
- CEAC instead returned an anti-bot page asking for a human verification code and showed a support ID

That means we currently have a **false-comfort gap**:

- the PRD flags can say complete
- modules can compile
- but the real worker/runtime can still be blocked before form filling starts

This pass must close that truth gap.

---

## 3. Goals

Build a CEAC runtime path that:

1. uses the new CEAC modules from the live DS-160 worker path
2. stops claiming success based only on module existence or PRD state
3. detects and reports CEAC anti-bot/manual gates explicitly
4. preserves recoverable DS-160 stop-at-sign behavior when CEAC access is available
5. adds a repeatable smoke/diagnostic path so operators can test runtime readiness honestly from the host

---

## 4. Non-Goals

This phase does **not** include:

- auto-solving CEAC captcha or anti-bot challenges
- bypassing CEAC anti-automation defenses
- final DS-160 submission
- entering passport-number signature on the final page
- pretending a blocked start page counts as a successful autofill run

---

## 5. Truth Contract

The worker must report what actually happened.

Allowed truthful outcomes:

- **handoff_ready**: the worker reached the Sign and Submit page and stopped before irreversible actions
- **blocked/manual_required**: CEAC presented a human-verification or otherwise unsupported manual gate that prevented unattended progress
- **failed**: the worker or runtime failed independently of CEAC's manual gate

Disallowed behavior:

- claiming DS-160 autofill success when the CEAC start page was anti-bot gated
- collapsing manual gate detection into a vague unknown-page failure with no operator context
- treating compiled modules or PRD completion alone as live proof of form-filling success

---

## 6. Functional Requirements

### 6.1 Live worker wiring

The DS-160 queue processor must use the new CEAC session/navigation/result modules as its primary path.

It must no longer rely on the legacy `prefillDs160()` prototype as the authoritative implementation.

### 6.2 Start-page readiness and anti-bot detection

The CEAC bootstrap flow must:

- distinguish expected start page vs anti-bot/manual gate vs other blocked states
- capture useful diagnostic context (for example visible body text, support ID, screenshot, or marker classification)
- surface that distinction in worker status/output

### 6.3 Real CEAC orchestration

When CEAC allows progression, the live worker must:

- load answers from VIZA
- drive page-by-page fill using the new CEAC helpers
- checkpoint/save at natural boundaries
- capture Application ID and `.dat` artifacts when available
- stop at the Sign and Submit page without entering passport signature, captcha, or final submit

### 6.4 Outcome persistence

The system must persist outcomes so operators can tell which class of result occurred:

- handoff-ready success
- blocked/manual-required
- genuine failure

Persistence should update the existing queue/application records with as little schema churn as possible.

### 6.5 Operator-verifiable diagnostics

The repo must include a documented smoke/diagnostic path that can be run from the machine to answer:

- can we reach the expected CEAC start page?
- are we anti-bot gated?
- did the site return another blocked state?

The output must be structured enough for operators to trust it.

---

## 7. Success Criteria

This PRD is successful only if all of the following are true:

1. the live worker path is wired to the CEAC runtime modules
2. CEAC anti-bot/manual gates are surfaced explicitly and truthfully
3. the worker can produce distinct persisted outcomes for success vs blocked/manual vs failure
4. the repository includes a repeatable smoke/diagnostic path for CEAC readiness
5. no code path performs final DS-160 submission

---

## 8. Story Breakdown

- **US-009**: pin runtime-validation scope and truth contract
- **US-010**: replace the legacy DS-160 worker path with the CEAC runtime pipeline
- **US-011**: detect CEAC anti-bot and manual-intervention gates explicitly
- **US-012**: implement real page-by-page CEAC fill orchestration on the new flow
- **US-013**: persist CEAC runtime outcomes and queue semantics clearly
- **US-014**: add operator-verifiable CEAC smoke diagnostics and test instructions

---

## 9. Operational Notes

Current observed CEAC behavior from this host:

- direct navigation to `https://ceac.state.gov/GenNIV/Default.aspx` can return a human-verification page instead of the expected DS-160 start flow
- the page body can include language like: "This question is for testing whether you are a human visitor and to prevent automated spam submission"
- a CEAC support ID may be present and should be recorded in diagnostics when available

Design implication:

- runtime testing must treat this as a first-class operational state, not an incidental exception

---

## 10. Out of Scope for Ralph in This Pass

Ralph should not try to solve or bypass CEAC anti-bot defenses. If CEAC requires human action, the system should expose that cleanly and stop.