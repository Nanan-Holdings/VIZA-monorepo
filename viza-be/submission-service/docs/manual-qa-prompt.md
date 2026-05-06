# Manual QA prompt — submission-service

Copy-paste the block below into Cursor on the QA machine. The QA agent will set up the repo, run each visa's Playwright autofill in **headed** mode, and report back what it observed.

> **Scope of this QA pass:** US (CEAC DS-160), France (france-visas.gouv.fr), Australia (Subclass 600), Vietnam (e-visa).
> Only US and France have ready-made smoke-test scripts. AU and VN need a tiny harness script to be written before they can run — instructions are included.
> No automation actually submits the form. CEAC stops at the sign-and-submit page; France creates a draft only; AU stops at Review; VN stops before Pay.

---

## Prompt to paste into Cursor

```
You are helping me manually QA the VIZA submission-service Playwright autofill flows on this laptop. We want to confirm that each visa's automation actually drives the live portal end-to-end (no real submission — every flow stops short of the irreversible action).

You will work inside `viza-be/submission-service/`. The runners live in `src/ceac/` (US), `src/france-visas/` (France), `src/au-visitor/` (Australia), and `src/vietnam/` (Vietnam).

Run every Playwright session in HEADED mode (visible browser) so I can watch each step. Take notes as you go.

## 0 — Setup (do this once)

1. From the repo root, ensure git is clean and you're on `main`:
   ```
   git status
   git pull --ff-only origin main
   ```

2. Install deps and Playwright Chromium inside `viza-be/submission-service/`:
   ```
   cd viza-be/submission-service
   npm install
   npm run install-browsers
   ```

3. Copy `.env.example` to `.env` and fill in the secrets I gave you separately. You'll need:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — to read applicant data (US + AU paths)
   - `TWOCAPTCHA_API_KEY` — needed for the US CEAC start-page CAPTCHA
   - `RESEND_API_KEY` — only needed if you exercise the worker loop; safe to leave blank for smoke runs
   - `SUBMISSION_RESULT_SECRET_KEY` — encrypts/decrypts ciphertext in the per-applicant credential vault (≥16 chars). Required for the UK + EG + IT flows since the runner now reads through `applicant_secret` (SECRETS-002) — there is no `process.env.UK_PORTAL_*` fallback.

4. **Seed per-applicant credentials into the vault** (UK + EG + IT only). The submission-service runner reads UK portal credentials exclusively from the `applicant_secret` table via `applicantVault.require()`. To seed Edward's developer applicant for QA:

   ```
   EDWARD_UK_PASSWORD=... EDWARD_UK_RESUME_URL=https://... \
   EDWARD_EG_EMAIL=... EDWARD_EG_PASSWORD=... \
   npx tsx scripts/seed-edward-test-credentials.ts
   ```

   The seed script populates both the legacy `*_accounts` rows AND the new `applicant_secret` rows (`uk.portal.resume_url`, `uk.portal.username`, `uk.portal.password`). If you skip this step the UK runner will throw `VaultMissError` on the handoff write and abort the run.

5. Confirm `npm run type-check` passes before running any flow.

For each flow below: write down the exact terminal command you ran, the final outcome JSON / status line, and screenshots of any failure. If a step needs a credential I haven't given you, stop and ask me.

---

## 1 — US (CEAC DS-160) smoke

**Goal:** confirm the start-page reachability + CAPTCHA solver works on this machine and IP.

```
# 1a. Reachability check (no CAPTCHA spend)
npx tsx src/ceac/smoke.ts --headed

# 1b. CAPTCHA solver check (uses 2captcha credit ~$0.003)
npx tsx src/ceac/smoke.ts --solve-captcha --headed
```

**Pass criteria:**
- 1a → JSON `outcome: "start_page"` with exit code 0.
- 1b → `reachedPostCaptcha: true` and `postSolvePageId` is something other than `start` / `unknown` (typically `security_notice`).

**Fail modes to capture:**
- `outcome: "anti_bot_gate"` → IP is being challenged. Try a residential network or skip US for now.
- `captchaOutcome.status: "wrong_answer"` → run 1b once more before reporting.

**Full worker path** (only if you have a real applicant queued in `submission_queue` with `status: "ds160_prefill_pending"` — ask me first):
```
npx tsx src/index.ts
```
Watch the queue row transition to `ds160_prefilled`, `ds160_prefill_failed`, or `ds160_blocked`. Confirm `ceac_result_payload` has populated `sectionCoverage`, `captchaSolve`, and `applicationId`.

Reference doc: `docs/ceac-smoke-test.md`.

---

## 2 — France (france-visas.gouv.fr) smoke

**Goal:** sign in to the preregistered France-Visas account, autofill steps 1–6 of a draft application, capture the application reference, do NOT finalize.

There is a ready-made smoke runner at `scripts/run-fv-smoke.ts` and an example answers file at `scripts/fv-answers.example.json`. Use the example file as-is for QA — it's a placeholder Chinese tourist applicant.

```
export FV_EMAIL='<the email I gave you>'
export FV_PASSWORD='<the password I gave you>'
npx ts-node scripts/run-fv-smoke.ts ./scripts/fv-answers.example.json --headful
```

**Pass criteria:**
- Final log line: `✓ Prefilled successfully. Steps: step1, step2, step3, step4, step5, step6.`
- A `Draft reference` is printed.
- An `Application reference` of the form `FRA-…` is printed.

**After the run:** sign in to france-visas.gouv.fr in a normal browser using the same credentials → go to "Mes demandes" → confirm the new draft exists → delete it so we don't pollute the account.

**Fail modes to capture:** the script prints `✗ Failed at <stepN>` plus validation messages. Copy those verbatim.

Reference: `scripts/run-fv-smoke.ts`.

---

## 3 — Australia (Subclass 600 visitor) smoke

There is **no standalone smoke script yet** — `src/au-visitor/run.ts` exports `fillVisitor600Application()` but expects a caller to launch the browser context. You'll write a tiny harness script.

### 3a. Create `scripts/run-au-smoke.ts`

```ts
import "dotenv/config";
import { launchStealthBrowser } from "../src/ceac/stealth-browser";
import { fillVisitor600Application } from "../src/au-visitor/run";

async function main() {
  const username = process.env.AU_USERNAME;
  const password = process.env.AU_PASSWORD;
  const totpSecret = process.env.AU_TOTP_SECRET;
  if (!username || !password || !totpSecret) {
    console.error("AU_USERNAME, AU_PASSWORD, AU_TOTP_SECRET required");
    process.exit(1);
  }

  // Minimal answer map — extend as needed. Keys must match AU_VISITOR_600 seed schema.
  const answers: Record<string, unknown> = {
    passport_country_of_issue: "CHN",
    // ... ask Edward for a fuller answer map before a full walk
  };

  const handles = await launchStealthBrowser({ headless: false });
  try {
    const result = await fillVisitor600Application({
      context: handles.context,
      credentials: { username, password, totpSecret },
      answers,
      options: { runId: `au-smoke-${Date.now()}` },
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await handles.browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(2); });
```

### 3b. Run it

```
export AU_USERNAME='<ImmiAccount username>'
export AU_PASSWORD='<ImmiAccount password>'
export AU_TOTP_SECRET='<base32 TOTP secret>'
npx ts-node scripts/run-au-smoke.ts
```

**Pass criteria:**
- Browser logs into ImmiAccount, passes MFA, opens a fresh Subclass 600 application, walks pages, stops at the Review page.
- Output JSON has `outcome: "review_reached"` and `result.trn` populated.

**Stop and ask me before this step** if I haven't given you ImmiAccount credentials and a TOTP secret — without all three the login will fail.

Reference: `src/au-visitor/run.ts`, `src/au-visitor/orchestrator.ts`.

---

## 4 — Vietnam (evisa.gov.vn) smoke

No login required — the e-visa form is unauthenticated. No standalone smoke script yet. Write one.

### 4a. Create `scripts/run-vn-smoke.ts`

```ts
import "dotenv/config";
import { fillVietnamApplication } from "../src/vietnam/run";

async function main() {
  // Minimal answers — extend with realistic test data. Keys must match VN_E_VISA seed field_name.
  const answers: Record<string, string> = {
    // ... ask Edward for a working answer map
  };

  const result = await fillVietnamApplication(
    { answers },
    { headless: false, runId: `vn-smoke-${Date.now()}` },
  );
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => { console.error(err); process.exit(2); });
```

### 4b. Run it

```
npx ts-node scripts/run-vn-smoke.ts
```

**Pass criteria:**
- Browser drives evisa.gov.vn through the Vue SPA, fills every field, stops just before the Pay/Submit button.
- Output JSON has `status: "submitted_pending_pay"` and a `registrationCode` value.

**Important:** the runner is hard-coded to never click Pay/Submit. If you see the browser about to click either button, kill the process immediately and tell me — that would be a regression.

Reference: `src/vietnam/run.ts`.

---

## What to send back to me

For each of the 4 visas, send:
1. The exact command you ran.
2. The terminal output (final JSON / final log line).
3. A 30-second screen recording or 3 screenshots showing the headed browser at: login screen, mid-fill, final stop page.
4. Pass / partial / fail verdict with reasoning.

If any step needs credentials I haven't given you, stop there and list what's missing — don't guess or improvise.
```

---

## Notes for me (Edward)

Things to hand to the friend out-of-band before he runs this:

| Visa | Secrets needed |
|------|----------------|
| US | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWOCAPTCHA_API_KEY`, optional applicant queue row |
| France | `FV_EMAIL`, `FV_PASSWORD` for the preregistered france-visas.gouv.fr account |
| Australia | `AU_USERNAME`, `AU_PASSWORD`, `AU_TOTP_SECRET` for ImmiAccount; realistic answer map |
| Vietnam | None for auth; realistic VN_E_VISA answer map |

Pre-flight on my end before sharing:
- Confirm the 2captcha account has credit (~$5 covers many runs).
- Confirm the France-Visas dashboard doesn't already have stale drafts.
- Pull together a sample AU and VN answer map (CN passport tourist) so the friend doesn't have to invent one.
