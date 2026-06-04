import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser } from "@playwright/test";
import { artifact } from "../artifact.js";
import { fillEgForm } from "./fillers.js";
import { missingRequired } from "./field-mappings.js";
import { loadCanonicalAnswers } from "../queue/answers.js";
import { routingFor, policyFor, collectorFor, feeCentsFor } from "../payment-routing.js";
import {
  NeedsHumanError,
  RetryableRunnerError,
  type DispatchOutcome,
} from "../queue/types.js";

/**
 * Egypt e-Visa runner (RUN-EG-001) — promoted from recon-only stub.
 * Fills visa2egypt.gov.eg from canonical answers and halts before the
 * government-payment step (Egypt = runner_escrow_card / VIZA collects;
 * escrow-card payment pending integration). Best-effort selectors pending
 * recon (src/egypt/form-recon.ts + DATA-001).
 */

const BASE_URL = process.env.EG_PORTAL_URL ?? "https://visa2egypt.gov.eg";

export interface EgRunInput {
  jobId: string;
  applicationId: string;
  answers: Record<string, string>;
  visaType?: string;
  headless?: boolean;
}

export interface EgRunResult {
  status: "stopped_before_pay" | "blocked" | "anti_bot_gate" | "needs_human";
  reason: string;
  reachedStep: string;
  artefacts: string[];
}

export async function runEgRunner(input: EgRunInput): Promise<EgRunResult> {
  const missing = missingRequired(input.answers);
  if (missing.length > 0) {
    return { status: "needs_human", reason: `missing required answers: ${missing.join(", ")}`, reachedStep: "validation", artefacts: [] };
  }

  const browser: Browser = await chromium.launch({ headless: input.headless ?? true });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), "eg-har-"));
  const ctx = await browser.newContext({
    locale: "en-US",
    recordHar: { path: path.join(tempHar, `eg-${input.jobId}.har`), mode: "minimal" },
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
    await fillEgForm(page, input.answers);
    try {
      const png = await page.screenshot({ fullPage: true });
      const ref = await artifact.put(input.jobId, "eg-step-01-form.png", png, { contentType: "image/png", upsert: true });
      artefacts.push(ref.path);
    } catch {
      /* best-effort */
    }

    reachedStep = "pre_payment";
    const visaType = input.visaType ?? "EG_E_VISA";
    const routing = routingFor("egypt", visaType);
    const policy = policyFor(routing.mechanism);
    const collector = collectorFor(routing.mechanism);
    const feeCents = feeCentsFor("egypt", visaType);
    const reason =
      policy === "collect"
        ? `halted before payment; policy=collect collector=${collector} fee=${feeCents ?? "?"}c (escrow-card payment pending integration)`
        : `halted before government payment; policy=${policy} collector=${collector}`;
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
  const result = await runEgRunner({ jobId: jobId ?? applicationId, applicationId, answers });
  switch (result.status) {
    case "stopped_before_pay":
      return { outcome: "halted_before_pay", reachedStep: result.reachedStep, artefacts: result.artefacts };
    case "blocked":
    case "anti_bot_gate":
      throw new RetryableRunnerError(`${result.status}: ${result.reason}`);
    case "needs_human":
      throw new NeedsHumanError(result.reason);
    default:
      throw new Error(`unexpected egypt status: ${result.status}`);
  }
}
