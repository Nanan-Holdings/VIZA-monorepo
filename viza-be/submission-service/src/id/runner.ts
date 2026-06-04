import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser, type Page } from "@playwright/test";
import { artifact } from "../artifact.js";
import { mapIdAnswers, missingRequired } from "./field-mappings.js";
import { loadCanonicalAnswers } from "../queue/answers.js";
import { routingFor, policyFor, collectorFor, feeCentsFor } from "../payment-routing.js";
import {
  NeedsHumanError,
  RetryableRunnerError,
  type DispatchOutcome,
} from "../queue/dispatch.js";

/**
 * Indonesia e-Visa runner (RUN-ID-001) — the marketing flagship.
 *
 * Drives evisa.imigrasi.go.id from the canonical answer set, filling the
 * personal/passport/travel fields (src/id/field-mappings.ts) and HALTING
 * before the government payment step (Indonesia collects via VIZA — see
 * RUN-ID-002 / payment-routing). Per-step PNG + HAR captured under
 * jobs/<jobId>/id-step-NN-*.
 *
 * ⚠️ Selectors are best-effort pending a live recon harvest; the fill is
 * defensive (best-effort, never throws on a missing field) so an
 * unrecon'd portal degrades to a `blocked` outcome rather than a crash.
 */

const BASE_URL = process.env.ID_PORTAL_URL ?? "https://evisa.imigrasi.go.id";

export interface IdRunInput {
  jobId: string;
  applicationId: string;
  answers: Record<string, string>;
  /** Indonesia package; defaults to the launched B211A. */
  visaType?: string;
  headless?: boolean;
}

export interface IdRunResult {
  status: "stopped_before_pay" | "blocked" | "anti_bot_gate" | "needs_human";
  reason: string;
  reachedStep: string;
  artefacts: string[];
}

async function safeFill(page: Page, selector: string, value: string, kind: "input" | "select"): Promise<void> {
  try {
    if (kind === "select") {
      await page.selectOption(selector, value, { timeout: 5_000 });
    } else {
      await page.fill(selector, value, { timeout: 5_000 });
    }
  } catch (err) {
    console.warn(`[id] fill ${selector} failed: ${err instanceof Error ? err.message : err}`);
  }
}

export async function runIdRunner(input: IdRunInput): Promise<IdRunResult> {
  const missing = missingRequired(input.answers);
  if (missing.length > 0) {
    return {
      status: "needs_human",
      reason: `missing required answers: ${missing.join(", ")}`,
      reachedStep: "validation",
      artefacts: [],
    };
  }

  const browser: Browser = await chromium.launch({ headless: input.headless ?? true });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), "id-har-"));
  const harPath = path.join(tempHar, `id-${input.jobId}.har`);
  const ctx = await browser.newContext({ locale: "en-US", recordHar: { path: harPath, mode: "minimal" } });
  const page = await ctx.newPage();
  const artefacts: string[] = [];
  let reachedStep = "landing";

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    // Anti-bot gate check (Cloudflare "Just a moment...").
    const title = await page.title().catch(() => "");
    if (/just a moment|attention required/i.test(title)) {
      return { status: "anti_bot_gate", reason: `anti-bot gate: ${title}`, reachedStep, artefacts };
    }

    reachedStep = "form";
    for (const f of mapIdAnswers(input.answers)) {
      await safeFill(page, f.selector, f.value, f.kind);
    }

    try {
      const png = await page.screenshot({ fullPage: true });
      const ref = await artifact.put(input.jobId, `id-step-01-form.png`, png, {
        contentType: "image/png",
        upsert: true,
      });
      artefacts.push(ref.path);
    } catch {
      /* screenshot best-effort */
    }

    // RUN-ID-002: respect the payment-routing decision. Indonesia is
    // runner_escrow_card (VIZA collects, govt fee 15000c for B211A), so the
    // policy is "collect" — but escrow-card payment is not yet integrated,
    // so we still halt at the pay step and record the intended collector.
    reachedStep = "pre_payment";
    const visaType = input.visaType ?? "B211A";
    const routing = routingFor("indonesia", visaType);
    const policy = policyFor(routing.mechanism);
    const collector = collectorFor(routing.mechanism);
    const feeCents = feeCentsFor("indonesia", visaType);
    const reason =
      policy === "collect"
        ? `halted before payment; policy=collect collector=${collector} fee=${feeCents ?? "?"}c (escrow-card payment pending integration)`
        : `halted before government payment; policy=${policy} collector=${collector}`;
    return { status: "stopped_before_pay", reason, reachedStep, artefacts };
  } catch (err) {
    return {
      status: "blocked",
      reason: err instanceof Error ? err.message : String(err),
      reachedStep,
      artefacts,
    };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

/**
 * Dispatch entrypoint (QUE-001 contract). Loads canonical answers and runs
 * the Indonesia flow, mapping the result to a DispatchOutcome.
 */
export async function runOne(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
  const answers = await loadCanonicalAnswers(applicationId);
  const result = await runIdRunner({
    jobId: jobId ?? applicationId,
    applicationId,
    answers,
  });
  switch (result.status) {
    case "stopped_before_pay":
      return { outcome: "halted_before_pay", reachedStep: result.reachedStep, artefacts: result.artefacts };
    case "blocked":
    case "anti_bot_gate":
      throw new RetryableRunnerError(`${result.status}: ${result.reason}`);
    case "needs_human":
      throw new NeedsHumanError(result.reason);
    default:
      throw new Error(`unexpected id status: ${result.status}`);
  }
}
