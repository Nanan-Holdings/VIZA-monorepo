# U.S. Appointment Assisted-Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement U.S. B1/B2 appointment assistance in stages: A connects the existing China USVisaScheduling assisted-live state flow, B adds stronger official-site gate classification, and C validates full live booking with real credentials and authorization.

**Architecture:** Keep agent-backend as the API/state machine and submission-service as the only browser automation runner. The frontend only triggers explicit user actions and displays redacted status, slots, final approval, and official evidence. Unsupported official-site conditions must become `appointment_manual_required` or `appointment_failed`, never hidden success.

**Tech Stack:** TypeScript, Express, Supabase service-role repositories, Next.js client components, Playwright, Vitest, Node test runner.

---

### Task A1: Agent-Backend Assisted-Live State Flow

**Files:**
- Modify: `viza-be/agent-backend/src/services/us-appointment/USAppointmentOrchestrator.ts`
- Test: `viza-be/agent-backend/src/services/us-appointment/us-appointment.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that assert China assisted-live `runJob()` queues runner work without creating a manual login checkpoint, and that metadata no longer says `no_final_confirmation_click`.

- [ ] **Step 2: Run focused backend test**

Run: `cd viza-be/agent-backend; npx vitest run src/services/us-appointment/us-appointment.test.ts --testTimeout=15000`

Expected: the new tests fail because current code still creates a login manual action.

- [ ] **Step 3: Implement minimal orchestrator change**

Change `runAssistedLiveDisabledStep()` so eligible `CN/usvisascheduling` jobs transition to an automated runner-ready state such as `appointment_login_required` with `requiresUserAction=false`, no pending manual action, and audit metadata that says supported checkpoints are handled by submission-service.

- [ ] **Step 4: Run focused backend test**

Expected: all U.S. appointment service tests pass.

### Task A2: Submission Runner Handoff and Booking Semantics

**Files:**
- Modify: `viza-be/submission-service/src/us-appointment/runner.ts`
- Test: `viza-be/submission-service/src/us-appointment/__tests__/runner.spec.ts`

- [ ] **Step 1: Write failing tests**

Update runner tests so login handoff is no longer manual by default and metadata no longer advertises `no_final_confirmation_click` or `no_payment_automation`.

- [ ] **Step 2: Run focused submission-service test**

Run: `cd viza-be/submission-service; npx ts-node src/us-appointment/__tests__/runner.spec.ts`

Expected: the updated tests fail against current handoff metadata.

- [ ] **Step 3: Implement minimal runner change**

Adjust handoff/gate metadata and processing so eligible jobs either progress through the injected portal client or persist `appointment_manual_required` only when the portal client returns an unsupported gate/error.

- [ ] **Step 4: Run focused submission-service test**

Expected: all runner tests pass.

### Task A3: Frontend Copy and Client Helper Guardrail

**Files:**
- Modify: `viza-fe/internal-website/messages/en.json`
- Modify: `viza-fe/internal-website/messages/zh.json`
- Modify: `viza-fe/internal-website/lib/us-appointment/AGENTS.md`

- [ ] **Step 1: Update copy**

Replace dry-run/manual-boundary copy with gated assisted-live language: VIZA may automate supported China USVisaScheduling checkpoints, user still selects slots and approves final booking, official evidence is captured.

- [ ] **Step 2: Run frontend static checks**

Run: `cd viza-fe/internal-website; npm run type-check; npm run lint`

Expected: both commands pass or report pre-existing unrelated issues clearly.

### Task A4: Final Verification for Stage A

**Files:**
- Review changed files only.

- [ ] **Step 1: Run focused backend tests**

Run agent-backend U.S. appointment test.

- [ ] **Step 2: Run focused submission runner tests**

Run submission-service U.S. appointment runner test.

- [ ] **Step 3: Run docs/content conflict scan**

Run `rg` for old U.S. appointment dry-run-only phrases in the touched areas.

---

### Stage B: Gate Classification

Add explicit portal result types for supported CAPTCHA, unsupported CAPTCHA/MFA, waiting room, policy warning, payment authorization, missing selected slot, and confirmation-missing states. Each gate must produce redacted diagnostics and either continue through a supported automation path or persist `appointment_manual_required`.

### Stage C: Live Portal Validation

Run the full browser path with real USVisaScheduling credentials, applicant data, payment authorization if needed, and an actually selected slot. Preserve official screenshots/traces and database evidence before claiming live completion.
