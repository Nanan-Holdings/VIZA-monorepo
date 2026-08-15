import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser } from "@playwright/test";
import { artifact } from "../artifact.js";
import { fillSaForm } from "./fillers.js";
import { missingRequired } from "./field-mappings.js";
import { loadCanonicalAnswers } from "../queue/answers.js";
import { createManagedPaymentHooks } from "../official-fee/managed-payment-hooks.js";
import {
  unavailableManagedPaymentBoundary,
  type ManagedPaymentHooks,
} from "../runners/managed-payment-boundary.js";
import { softTranslationGate } from "../runners/standard-evisa.js";
import {
  NeedsHumanError,
  RetryableRunnerError,
  type DispatchOutcome,
} from "../queue/types.js";

/**
 * Saudi Arabia e-Visa runner (RUN-SA-001) — built from scratch.
 *
 * Fills the Saudi e-Visa portal from canonical answers and HALTS before the
 * government payment step. The current recon has no evidenced payment
 * controls, so the managed-card boundary ends in staff review without issuing
 * a card.
 */

const BASE_URL = process.env.SA_PORTAL_URL ?? "https://visa.visitsaudi.com";

export interface SaRunInput {
  jobId: string;
  applicationId: string;
  answers: Record<string, string>;
  visaType?: string;
  headless?: boolean;
  paymentHooks?: ManagedPaymentHooks;
}

export interface SaRunResult {
  status: "managed_payment_adapter_unavailable" | "blocked" | "anti_bot_gate" | "needs_human";
  reason: string;
  reachedStep: string;
  artefacts: string[];
}

export async function runSaRunner(input: SaRunInput): Promise<SaRunResult> {
  const missing = missingRequired(input.answers);
  if (missing.length > 0) {
    return { status: "needs_human", reason: `missing required answers: ${missing.join(", ")}`, reachedStep: "validation", artefacts: [] };
  }

  softTranslationGate("saudi_arabia", input.answers); // RUN-CORE-007 (non-fatal)
  const browser: Browser = await chromium.launch({ headless: input.headless ?? true });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), "sa-har-"));
  const ctx = await browser.newContext({
    locale: "en-US",
    recordHar: { path: path.join(tempHar, `sa-${input.jobId}.har`), mode: "minimal" },
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
    await fillSaForm(page, input.answers);
    try {
      const png = await page.screenshot({ fullPage: true });
      const ref = await artifact.put(input.jobId, "sa-step-01-form.png", png, { contentType: "image/png", upsert: true });
      artefacts.push(ref.path);
    } catch {
      /* best-effort */
    }

    reachedStep = "pre_payment";
    const visaType = input.visaType ?? "SA_E_VISA";
    const payment = await unavailableManagedPaymentBoundary({
      country: "saudi_arabia",
      visaType,
      hooks: input.paymentHooks,
    });
    return {
      status: payment.status,
      reason: payment.reason,
      reachedStep: "managed_payment_review_required",
      artefacts,
    };
  } catch (err) {
    return { status: "blocked", reason: err instanceof Error ? err.message : String(err), reachedStep, artefacts };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

export async function runOne(
  applicationId: string,
  jobId?: string,
  paymentHooks?: ManagedPaymentHooks,
): Promise<DispatchOutcome> {
  const answers = await loadCanonicalAnswers(applicationId);
  const result = await runSaRunner({
    jobId: jobId ?? applicationId,
    applicationId,
    answers,
    paymentHooks: paymentHooks ?? createManagedPaymentHooks({
      applicationId,
      workerId: jobId ?? applicationId,
      country: "saudi_arabia",
      visaType: "SA_E_VISA",
    }),
  });
  switch (result.status) {
    case "managed_payment_adapter_unavailable":
      return { outcome: "halted_before_pay", reachedStep: result.reachedStep, artefacts: result.artefacts };
    case "blocked":
    case "anti_bot_gate":
      throw new RetryableRunnerError(`${result.status}: ${result.reason}`);
    case "needs_human":
      throw new NeedsHumanError(result.reason);
    default:
      throw new Error(`unexpected saudi status: ${result.status}`);
  }
}
