import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Browser } from "@playwright/test";
import { loadUSAppointmentRunnerConfig, processUSAppointmentJob } from "../runner";
import { PlaywrightUSVisaSchedulingPortalClient } from "../usvisascheduling-portal";
import {
  PLACEHOLDER_CONFIRMATION_REFERENCE, PLACEHOLDER_DS160_REFERENCE, PLACEHOLDER_SLOT,
} from "./placeholder-data";
import { startPlaceholderPortal } from "./placeholder-portal";
import { PlaceholderAppointmentRepository } from "./placeholder-repository";

/** Real Playwright + production runner, with every HTTP request fulfilled locally. */
export async function runUSAppointmentPlaceholderFlow(options: { headed?: boolean } = {}) {
  const outputDirectory = resolve("output/playwright/us-appointment-placeholder", new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(outputDirectory, { recursive: true });
  const portal = await startPlaceholderPortal();
  const repository = new PlaceholderAppointmentRepository();
  const steps: string[] = [];
  const blockedOrigins: string[] = [];
  const proxyErrors: string[] = [];
  let interceptedRequests = 0;
  let isolationProbePassed = false;
  let transportProbePassed = false;
  let expectedTransportDenials = 0;
  // Deliberately construct config from an empty environment. Never load .env,
  // Browserbase/CDP, saved sessions, real email or a Supabase repository.
  const config = {
    ...loadUSAppointmentRunnerConfig({}), enabled: true, playwrightEnabled: true,
    baseUrl: "https://www.usvisascheduling.com/en-US/",
    typingDelayMinMs: 0, typingDelayMaxMs: 0,
  };
  let browser: Browser | null = null;
  try {
    // Transport-level backstop: the loopback fixture is not a forward proxy.
    // Any HTTP request escaping Playwright interception fails locally.
    browser = await chromium.launch({ headless: !options.headed, proxy: { server: portal.origin } });
    const transportContext = await browser.newContext({ serviceWorkers: "block" });
    try {
      const transportPage = await transportContext.newPage();
      const deniedBefore = portal.snapshot().counts.proxyDenied ?? 0;
      await assert.rejects(() => transportPage.goto("https://transport-isolation-probe.invalid/", { timeout: 5_000 }));
      assert.ok((portal.snapshot().counts.proxyDenied ?? 0) > deniedBefore, "The loopback proxy must deny un-intercepted HTTPS.");
      // A fresh page avoids the asynchronous chrome-error navigation after a
      // failed HTTPS tunnel. Absolute-form HTTP proxy traffic must also fail.
      const httpProbe = await transportContext.newPage();
      const deniedAfterHttps = portal.snapshot().counts.proxyDenied ?? 0;
      const httpResponse = await httpProbe.goto("http://transport-isolation-probe.invalid/en-US/signup", { timeout: 5_000 });
      assert.equal(httpResponse?.status(), 502);
      assert.ok((portal.snapshot().counts.proxyDenied ?? 0) > deniedAfterHttps);
      expectedTransportDenials = portal.snapshot().counts.proxyDenied ?? 0;
      transportProbePassed = true;
    } finally { await transportContext.close(); }
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 960 } });
    const interceptedOrigin = new URL(config.baseUrl).origin;
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== interceptedOrigin) {
        blockedOrigins.push(url.origin);
        await route.abort("blockedbyclient");
        return;
      }
      interceptedRequests += 1;
      try {
        // Fixed loopback target + manual redirects: never forward to an external host.
        const response = await fetch(`${portal.origin}${url.pathname}${url.search}`, {
          method: request.method(), body: request.postData() ?? undefined,
          headers: { "content-type": request.headers()["content-type"] ?? "application/x-www-form-urlencoded" },
          redirect: "manual", signal: AbortSignal.timeout(10_000),
        });
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => { headers[key] = value; });
        delete headers["content-encoding"];
        delete headers["content-length"];
        if (response.status >= 300 && response.status < 400 && headers.location) {
          const destination = new URL(headers.location, request.url());
          assert.equal(destination.origin, interceptedOrigin);
          // Native redirect chains can skip a route handler. A document navigation
          // creates a fresh intercepted request and preserves the visible path.
          const next = JSON.stringify(destination.href).replace(/</g, "\\u003c");
          await route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><p>SIMULATION — local navigation</p><script>location.replace(${next})</script>` });
          return;
        }
        await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
      } catch {
        proxyErrors.push("loopback_fixture_request_failed");
        await route.abort("failed");
      }
    });
    // Negative control proves unexpected requests are blocked without DNS/network.
    const probe = await context.newPage();
    await probe.goto("https://external-isolation-probe.invalid/").catch(() => undefined);
    await probe.close();
    assert.deepEqual(blockedOrigins, ["https://external-isolation-probe.invalid"]);
    isolationProbePassed = true;
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    await page.goto(config.baseUrl);
    assert.ok(interceptedRequests > 0, "Fixture entry must be intercepted before the runner starts.");
    const client = new PlaywrightUSVisaSchedulingPortalClient(config, { page });
    const record = async (step: string) => {
      steps.push(step);
      await page.screenshot({ path: resolve(outputDirectory, `${String(steps.length).padStart(2, "0")}-${step}.png`), fullPage: true });
      console.log(`[SIMULATION] ${step}`);
    };
    const process = async () => processUSAppointmentJob(structuredClone(repository.job), repository, config, client);
    const report = () => ({
      simulation: true, officialBooked: false, productionDatabaseWrites: 0,
      coverage: {
        production: ["registration", "email_verification", "login", "profile", "applicant_details", "slot_observation", "approval_gate", "confirmation_capture", "status_check"],
        simulatedOnly: ["email_delivery", "visa_options", "document_delivery", "fee_payment", "VIZA_user_actions", "persistence", "official_responses"],
      },
      network: { mode: "loopback_proxy_and_request_interception", interceptedRequests, isolationProbePassed, transportProbePassed, expectedTransportDenials, blockedOrigins, proxyErrors },
      steps, jobStatus: repository.job.status, transitions: repository.transitions,
      pagePath: new URL(page.url()).pathname,
      applicationStates: repository.applicationStates,
      accountVerified: repository.credentials.emailVerified === true,
      manualActions: repository.manualActions.map((action) => ({ type: action.action_type, completed: action.completed, gate: action.metadata_redacted_json.gate_type ?? null })),
      auditEvents: repository.auditEvents.map((event) => ({ type: event.event_type, errorCode: event.metadata_redacted_json.error_code ?? null })),
      slotCount: repository.slots.length,
      confirmationCount: repository.confirmations.length,
      simulatedConfirmationReference: repository.confirmations[0]?.confirmation_number ?? null,
      statusResult: repository.statusChecks[0]?.status ?? null,
      portal: portal.snapshot(),
    });
    try {
      await process();
      assert.equal(repository.credentials.emailVerified, true, "Production registration must return both proofs.");
      assert.equal(new URL(page.url()).pathname, "/en-US/fixture-visa-options/", JSON.stringify(report()));
      await record("registration-profile-applicant-details");

      // These pages are deliberately fixture-only until their live DOM is observed.
      await page.locator("#fixture-post").selectOption("Beijing");
      await page.locator("#fixture-visa-class").selectOption("B1/B2");
      await page.locator("#fixture-ds160").fill(PLACEHOLDER_DS160_REFERENCE);
      await page.locator("#fixture-visa-next").click();
      await page.waitForURL("**/fixture-delivery/");
      await record("simulated-visa-options");
      await page.locator("#fixture-delivery-method").selectOption("courier");
      await page.locator("#fixture-delivery-next").click();
      await page.waitForURL("**/fixture-payment/");
      await record("simulated-delivery");
      await page.locator("#fixture-pay").click();
      await page.waitForURL("**/fixture-calendar/");
      await record("simulated-fee-payment");

      await repository.resume("appointment_payment_completed");
      await process();
      assert.equal(repository.job.status, "appointment_slot_selection_required", JSON.stringify(report()));
      assert.equal(repository.slots.length, 1);
      assert.equal(repository.slots[0].appointment_date, PLACEHOLDER_SLOT.appointment_date);
      assert.equal(repository.slots[0].appointment_time, PLACEHOLDER_SLOT.appointment_time);
      await record("production-slot-observation");
      repository.selectSlot(0);

      // Book intent without a completed approval must produce a gate and zero bookings.
      await repository.resume("appointment_booked");
      await process();
      assert.equal(repository.job.status, "appointment_final_confirmation_required");
      assert.equal(repository.confirmations.length, 0);
      assert.equal(portal.snapshot().counts.book ?? 0, 0);
      await record("approval-required-no-booking");
      repository.approveSelectedSlot();
      const approval = await fetch(`${portal.origin}/fixture/approve-final`, { method: "POST", signal: AbortSignal.timeout(10_000) });
      assert.equal(approval.ok, true);
      await repository.resume("appointment_booked");
      await process();
      assert.equal(repository.job.status, "appointment_confirmation_captured", JSON.stringify(report()));
      assert.equal(repository.confirmations[0]?.confirmation_number, PLACEHOLDER_CONFIRMATION_REFERENCE);
      assert.equal(portal.snapshot().counts.book, 1);
      await record("production-confirmation-capture");

      assert.equal(await process(), "skipped", "Completed jobs must not be booked again.");
      await assert.rejects(() => client.captureConfirmation({ ...repository.job, status: "appointment_booked" }, repository.selectedSlot!), /prepared/i);
      assert.equal(portal.snapshot().counts.book, 1);
      steps.push("duplicate-booking-prevented");
      await repository.resume("appointment_status_check_in_progress");
      await process();
      assert.equal(repository.job.status, "appointment_status_checked", JSON.stringify(report()));
      assert.equal(repository.statusChecks[0]?.status, "appointment_exists");
      await record("production-status-check");
      assert.equal(proxyErrors.length, 0);
      assert.equal(blockedOrigins.length, 1, "Only the intentional isolation probe may request an external origin.");
      assert.equal(portal.snapshot().counts.proxyDenied, expectedTransportDenials, "No request in the appointment flow may escape interception.");
      const result = { passed: true, ...report() };
      await writeFile(resolve(outputDirectory, "result.json"), JSON.stringify(result, null, 2));
      return { outputDirectory, result };
    } catch (error) {
      await page.screenshot({ path: resolve(outputDirectory, "failure.png"), fullPage: true }).catch(() => undefined);
      await writeFile(resolve(outputDirectory, "result.json"), JSON.stringify({ passed: false, ...report() }, null, 2));
      console.error(`SIMULATION diagnostics: ${outputDirectory}`);
      throw error;
    } finally {
      await client.close();
    }
  } finally {
    try { await browser?.close(); }
    finally { await portal.close(); }
  }
}
