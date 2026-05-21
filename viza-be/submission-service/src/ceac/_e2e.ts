/**
 * End-to-end live test harness for the DS-160 CEAC autofill pipeline.
 *
 * Chains the full live flow:
 *   1. startCeacSession — stealth browser + location select + CAPTCHA solve
 *   2. handleConfirmApplicationPage — Privacy Act + Application ID + security Q
 *   3. orchestrateFill — page-by-page DS-160 fill to Sign and Submit
 *
 * Uses a sample answer payload so the run does not depend on Supabase. The
 * goal is to prove the autofill pipeline reaches either `handoff_ready` or a
 * well-classified failure on a real CEAC session.
 *
 * Usage:
 *   npx tsx src/ceac/_e2e.ts
 *
 * Writes artifacts (screenshots, .dat) to ./e2e-out/
 */
import { config } from "dotenv";
import * as path from "node:path";
import * as fs from "node:fs";
// Load agent-backend/.env.local first (authoritative source for Supabase
// creds in this monorepo), then submission-service/.env for local overrides.
config({ path: path.join(__dirname, "../../../agent-backend/.env.local") });
config({ path: path.join(__dirname, "../../.env") });

import { startCeacSession } from "./session";
import { handleConfirmApplicationPage } from "./confirm-application";
import { detectPage } from "./pages";
import { orchestrateFill } from "./orchestrator";
import { createRecoveryTracker } from "./artifacts";
import { TEST_DS160_ANSWERS, TEST_DS160_PROFILE } from "./test-ds160-fixture";
import { loadAnswersForApplication } from "./answer-loader";

const OUT_DIR = path.join(__dirname, "../../e2e-out");

// A representative sample answer payload. Keys match the DS-160 seed-script
// field names (see seed-ds160-form-fields.ts). The orchestrator fills only
// keys present in the per-page mapping; missing keys are skipped silently.
//
// Source of truth lives in src/ceac/test-ds160-fixture.ts — re-exported here
// as SAMPLE_ANSWERS / SAMPLE_PROFILE for back-compat with the original e2e
// harness. When CEAC_TEST_APPLICATION_ID is set, we instead pull answers
// from Supabase via the answer-loader.
async function resolveAnswerSource(
  log: (msg: string) => void,
): Promise<{ answers: Record<string, string>; profile: Record<string, unknown> }> {
  const supabaseAppId = process.env.CEAC_TEST_APPLICATION_ID?.trim();
  if (supabaseAppId) {
    log(`Loading answers from Supabase for application ${supabaseAppId}`);
    const loaded = await loadAnswersForApplication(supabaseAppId);
    log(`  pulled ${Object.keys(loaded.answers).length} answer rows`);
    return loaded;
  }
  log(`Using hardcoded TEST_DS160_ANSWERS fixture (no CEAC_TEST_APPLICATION_ID)`);
  return { answers: TEST_DS160_ANSWERS, profile: TEST_DS160_PROFILE };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const runId = `e2e-${Date.now()}`;
  const tracker = createRecoveryTracker({ runId });
  const log = (msg: string) => console.log(`[e2e] ${msg}`);

  log(`Starting end-to-end live run ${runId}`);
  log(`Output dir: ${OUT_DIR}`);

  const { answers: SAMPLE_ANSWERS, profile: SAMPLE_PROFILE } = await resolveAnswerSource(log);

  // Bootstrap with retry on SessionTimedOut. CEAC's anti-bot sometimes
  // invalidates a stealth context the moment we click START, even with
  // a correct CAPTCHA. Fresh browser context per attempt is the only
  // recovery. Cap at 5 attempts to keep the run bounded.
  const t0 = Date.now();
  let session: Awaited<ReturnType<typeof startCeacSession>> | null = null;
  let lastErr: unknown;
  // HEADLESS toggle: set CEAC_HEADLESS=0 to watch the browser live.
  // Default stays headless for CI / background cron runs.
  const headless = process.env.CEAC_HEADLESS !== "0";
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      session = await startCeacSession({
        headless,
        acceptDownloads: true,
        runId: `${runId}-boot${attempt}`,
      });
      break;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      log(`Bootstrap attempt ${attempt}/5 failed: ${msg.slice(0, 140)}`);
      // Retry on SessionTimedOut (anti-bot), CAPTCHA exhaustion (bad
      // streak of wrong solves), or transient network errors (CEAC
      // sometimes rate-limit-resets the connection). All recover via a
      // fresh browser context. Back off between attempts to let CEAC's
      // anti-bot heuristics cool.
      const retryable =
        /SessionTimedOut/i.test(msg) ||
        /CAPTCHA solve failed/i.test(msg) ||
        /Failed to load CEAC start page/i.test(msg) ||
        /ERR_CONNECTION_RESET|ERR_NETWORK_CHANGED|ERR_NAME_NOT_RESOLVED/i.test(msg);
      if (!retryable) throw err;
      const backoffMs = Math.min(60_000, 5_000 * attempt * attempt);
      log(`  backing off ${Math.round(backoffMs / 1000)}s before next attempt`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  if (!session) throw lastErr;
  log(`Session bootstrap OK in ${Date.now() - t0}ms`);
  log(`  url=${session.page.url()}`);
  log(`  captcha attempts=${session.captchaSolve?.telemetry.length ?? 0}`);

  try {
    // Step 2: Confirm Application page (Privacy Act + security Q)
    const confirm = await handleConfirmApplicationPage(session.page, {
      securityAnswer: "VIZATEST",
      securityQuestionValue: "3",
    });
    log(`ConfirmApplication OK — applicationId=${confirm.applicationId}`);
    log(`  security Q: ${confirm.securityQuestionText}`);
    log(`  post-continue url=${confirm.postContinueUrl}`);

    // Dump the new surface
    const probe = await detectPage(session.page);
    log(`After Continue — detected page: ${probe.id} (heading=${JSON.stringify(probe.heading)})`);
    await session.page.screenshot({
      path: path.join(OUT_DIR, `post-confirm.png`),
      fullPage: true,
    });

    // Step 3: orchestrateFill. Pass recovery credentials so a mid-fill
    // SessionTimedOut triggers auto-resume instead of a hard failure.
    // CEAC_TEST_PHOTO can point to a JPEG to walk through upload_photo
    // and continue to Sign and Submit; without it, we stop at
    // upload_photo with handoff_ready (back-compat for runs without a
    // photo).
    const photoPath = process.env.CEAC_TEST_PHOTO?.trim();
    if (photoPath) log(`Using photo file: ${photoPath}`);
    log(`Starting orchestrateFill...`);
    const { result, datArtifact, sectionCoverage } = await orchestrateFill(session, {
      answers: SAMPLE_ANSWERS,
      profile: SAMPLE_PROFILE,
      tracker,
      runId,
      outputDir: OUT_DIR,
      recoveryCredentials: {
        applicationId: confirm.applicationId,
        surnameFirstFive: (SAMPLE_ANSWERS.surname || "TESTER").slice(0, 5).toUpperCase(),
        yearOfBirth: SAMPLE_ANSWERS.date_of_birth_year || "1990",
        securityAnswer: confirm.securityAnswer,
      },
      photo: photoPath ? { kind: "path", path: photoPath } : undefined,
    });

    log(`orchestrateFill returned`);
    log(`  status=${result.status}`);
    log(`  applicationId=${result.applicationId ?? "(none)"}`);
    log(`  datArtifact=${datArtifact?.path ?? "(none)"}`);
    log(`  sections filled: [${sectionCoverage.filled.join(", ")}]`);
    log(`  sections skipped: [${sectionCoverage.skipped.join(", ")}]`);

    // On failure, dump the page HTML and all input/select/radio IDs so
    // we can adjust mappings without another live round-trip (which
    // consumes a 2captcha solve + a CEAC session).
    if (result.status !== "handoff_ready") {
      try {
        const html = await session.page.content();
        fs.writeFileSync(path.join(OUT_DIR, "failure-page.html"), html);
        const dom = await session.page.evaluate(`
          (function() {
            function list(sel) {
              var out = [];
              var ns = document.querySelectorAll(sel);
              for (var i = 0; i < ns.length; i++) {
                out.push({ id: ns[i].id, name: ns[i].name, type: ns[i].type || '', value: ns[i].value || '' });
              }
              return out;
            }
            function submitsVisible() {
              var out = [];
              var ss = document.querySelectorAll('input[type="submit"]');
              for (var i = 0; i < ss.length; i++) {
                var s = ss[i];
                var style = window.getComputedStyle(s);
                var visible = style.display !== 'none' && style.visibility !== 'hidden';
                var rect = s.getBoundingClientRect();
                var inViewport = rect.width > 0 && rect.height > 0;
                out.push({
                  id: s.id, name: s.name, value: s.value,
                  className: s.className, visible: visible, inViewport: inViewport,
                });
              }
              return out;
            }
            return {
              heading: (document.querySelector('h2, .SubHead') || {}).textContent || '',
              radios: list('input[type="radio"]'),
              checkboxes: list('input[type="checkbox"]'),
              selects: list('select'),
              textInputs: list('input[type="text"], input:not([type])'),
              submits: submitsVisible(),
            };
          })()
        `);
        fs.writeFileSync(path.join(OUT_DIR, "failure-dom.json"), JSON.stringify(dom, null, 2));
        log(`  diag: wrote failure-page.html and failure-dom.json`);
      } catch (e) {
        log(`  diag dump failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    fs.writeFileSync(
      path.join(OUT_DIR, "result.json"),
      JSON.stringify({ confirm, result, sectionCoverage }, null, 2),
    );
    log(`Wrote result.json`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[e2e] FAILED: ${msg}`);
    try {
      await session.page.screenshot({
        path: path.join(OUT_DIR, `failure.png`),
        fullPage: true,
      });
    } catch { /* best effort */ }
    process.exitCode = 1;
  } finally {
    await session.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
