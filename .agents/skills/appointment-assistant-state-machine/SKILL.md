---
name: appointment-assistant-state-machine
description: Build, refactor, debug, or review VIZA visa appointment assistants as persisted, user-gated state machines. Use for appointment UI, runner status mapping, applicant review pages, alias account and OTP stages, observed slot selection, payment checkpoints, explicit final confirmation, and official confirmation evidence for any country or scheduling provider.
---

# Appointment Assistant State Machine

Present one clear current step, backed by persisted server state. Never make the
user interpret several status dashboards or infer what “review” means.

## Workflow

1. Read the repository and nearest module `AGENTS.md` files.
2. Inspect `components/client/korea-appointment/KoreaAppointmentAssistant.tsx`
   as the reference interaction pattern when it exists.
3. Read `references/state-contract.md` completely before changing UI or status
   mapping.
4. Inventory backend job statuses, pending manual actions, slots, payment state,
   approvals, confirmation evidence, and retry/cancellation semantics.
5. Define one pure `getAppointmentStage(snapshot)` mapping. Derive the screen
   from persisted data; do not maintain a second local workflow state.
6. Render the compact progress strip and exactly one actionable stage card.
7. Connect each primary action to an existing persisted server transition or add
   a scoped transition with idempotency and authorization checks.
8. Localize all copy, apply VIZA brand rules, and verify desktop and mobile.
9. Test the route without triggering work on page load. Verify official portals
   one country at a time, read-only first, and preserve redacted evidence.

## Required Behavior

- Opening an assistant is read-only: load status and applicant review data only.
- The first screen is a real review page. Display saved values, label missing
  values explicitly, and provide both Edit and Confirm actions.
- The review confirmation is persisted consent. A local checkbox alone must not
  advance the workflow.
- Use the canonical stages: `review`, `account`, `slots`, `confirm`, `result`.
  Add a provider-specific stage only when it represents a genuinely separate
  user decision.
- Show account verification, CAPTCHA, WAF, MFA, policy, or identity checks only
  inside the current account/checkpoint stage.
- Show only officially observed slots. Never synthesize, cache as current after
  expiry, or silently choose a slot.
- Put payment authorization in the confirmation stage and store redacted payment
  metadata only. Never collect full card data in VIZA-owned fields.
- Require a separate persisted final approval after slot selection. Do not expose
  or invoke the official final action before approval.
- Call the flow successful only after an official confirmation reference and
  evidence are captured.
- Never send placeholder or fabricated applicant data to an official portal.

## Verification

- Run the modified package's type-check and lint checks.
- Smoke the authenticated route and confirm only one stage card is visible.
- Verify the review page displays stored data and its Confirm button is gated.
- Check a narrow mobile viewport for overflow and action order.
- Run official-site reconnaissance sequentially. Stop before account creation,
  payment, slot booking, or submission unless the user supplied authorized real
  data and explicitly requested that exact action.
