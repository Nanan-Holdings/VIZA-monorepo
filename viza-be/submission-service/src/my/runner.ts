import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser } from "@playwright/test";
import { artifact } from "../artifact.js";
import { fillMyForm } from "./fillers.js";
import { missingRequired } from "./field-mappings.js";
import { loadCanonicalAnswers } from "../queue/answers.js";
import { routingFor, policyFor, collectorFor, feeCentsFor } from "../payment-routing.js";
import {
  NeedsHumanError,
  RetryableRunnerError,
  type DispatchOutcome,
} from "../queue/dispatch.js";

/**
 * Malaysia eVISA/MDAC runner (RUN-MY-001).
 *
 * Submit/halt policy: Malaysia eVISA is online-pay (runner_escrow_card /
 * VIZA collects). Until escrow-card payment is integrated the runner fills
 * and HALTS before the government payment step. Best-effort selectors
 * pending recon (form-recon.ts + DATA-001).
 */

const BASE_URL = process.env.MY_PORTAL_URL ?? "https://malaysiavisa.imi.gov.my";

export interface MyRunInput {
  jobId: string;
  applicationId: string;
  answers: Record<string, string>;
  visaType?: string;
  headless?: boolean;
}

export interface MyRunResult {
  status: "stopped_before_pay" | "blocked" | "anti_bot_gate" | "needs_human";
  reason: string;
  reachedStep: string;
  artefacts: string[];
}

export async function runMyRunner(input: MyRunInput): Promise<MyRunResult> {
  const missing = missingRequired(input.answers);
  if (missing.length > 0) {
    return { status: "needs_human", reason: `missing required answers: ${missing.join(", ")}`, reachedStep: "validation", artefacts: [] };
  }

  const browser: Browser = await chromium.launch({ headless: input.headless ?? true });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), "my-har-"));
  const ctx = await browser.newContext({
    locale: "en-US",
    recordHar: { path: path.join(tempHar, `my-${input.jobId}.har`), mode: "minimal" },
  });
  const page = await ctx.newPage();
  const artefacts: string[] = [];
  let reachedStep = "landing";

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const title = await page.title().catch(() => "");
    if (/just a moment|attention required/i.test(title)) {
      return { status: "anti_bot_gate", reason: `anti-bot gate: ${title}`, reachedStep, artefacts };
    }

    reachedStep = "form";
    await fillMyForm(page, input.answers);
    try {
      const png = await page.screenshot({ fullPage: true });
      const ref = await artifact.put(input.jobId, "my-step-01-form.png", png, { contentType: "image/png", upsert: true });
      artefacts.push(ref.path);
    } catch {
      /* best-effort */
    }

    reachedStep = "pre_payment";
    const visaType = input.visaType ?? "MY_TOURIST_E_VISA";
    const routing = routingFor("malaysia", visaType);
    const reason = `halted before payment; policy=${policyFor(routing.mechanism)} collector=${collectorFor(routing.mechanism)} fee=${feeCentsFor("malaysia", visaType) ?? "?"}c`;
    return { status: "stopped_before_pay", reason, reachedStep, artefacts };
  } catch (err) {
    return { status: "blocked", reason: err instanceof Error ? err.message : String(err), reachedStep, artefacts };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

export async function runOne(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
  const answers = await loadCanonicalAnswers(applicationId);
  const result = await runMyRunner({ jobId: jobId ?? applicationId, applicationId, answers });
  switch (result.status) {
    case "stopped_before_pay":
      return { outcome: "halted_before_pay", reachedStep: result.reachedStep, artefacts: result.artefacts };
    case "blocked":
    case "anti_bot_gate":
      throw new RetryableRunnerError(`${result.status}: ${result.reason}`);
    case "needs_human":
      throw new NeedsHumanError(result.reason);
    default:
      throw new Error(`unexpected malaysia status: ${result.status}`);
  }
}
