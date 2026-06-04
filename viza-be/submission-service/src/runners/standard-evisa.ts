import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser, type Page } from "@playwright/test";
import { artifact } from "../artifact.js";
import { loadCanonicalAnswers } from "../queue/answers.js";
import { routingFor, policyFor, collectorFor, feeCentsFor } from "../payment-routing.js";
import { solveCaptcha } from "../captcha/index.js";
import {
  NeedsHumanError,
  RetryableRunnerError,
  type DispatchOutcome,
} from "../queue/types.js";

/**
 * Shared standard-e-Visa runner core (RUN-CORE-001).
 *
 * Consolidates the fill + halt-before-pay + payment-routing + recon +
 * retry/backoff + captcha-hook logic that the per-country e-Visa runners
 * (CA/TR/TH/AE and beyond) all share. Each country file is a thin wrapper
 * around `makeStandardEvisaRunner` + `standardFieldMappings`.
 */

/* ----------------------------- date transforms ----------------------------- */
export function isoToDmySlash(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
export function isoToDmyDash(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
}

/* ------------------------------- field mapping ------------------------------ */
export interface StdFieldMapping {
  canonicalKey: string;
  selector: string;
  transform?: (value: string) => string;
  required?: boolean;
  kind?: "input" | "select";
}
export interface MappedField {
  selector: string;
  value: string;
  kind: "input" | "select";
}

/** The common 10-field personal/passport/travel set shared across e-Visa portals. */
export function standardFieldMappings(dateFn: (v: string) => string): StdFieldMapping[] {
  return [
    { canonicalKey: "surname", selector: 'input[name="surname"]', required: true },
    { canonicalKey: "given_names", selector: 'input[name="given_names"]', required: true },
    { canonicalKey: "email", selector: 'input[name="email"]', required: true },
    { canonicalKey: "phone", selector: 'input[name="phone"]' },
    { canonicalKey: "date_of_birth", selector: 'input[name="date_of_birth"]', transform: dateFn, required: true },
    { canonicalKey: "nationality", selector: 'select[name="nationality"]', kind: "select", required: true },
    { canonicalKey: "passport_number", selector: 'input[name="passport_number"]', required: true },
    { canonicalKey: "passport_expiry_date", selector: 'input[name="passport_expiry"]', transform: dateFn, required: true },
    { canonicalKey: "passport_issuing_country", selector: 'select[name="passport_issuing_country"]', kind: "select" },
    { canonicalKey: "intended_arrival_date", selector: 'input[name="arrival_date"]', transform: dateFn },
  ];
}

export function mapAnswers(mappings: StdFieldMapping[], answers: Record<string, string>): MappedField[] {
  const out: MappedField[] = [];
  for (const m of mappings) {
    const raw = answers[m.canonicalKey];
    if (raw == null || raw === "") continue;
    out.push({ selector: m.selector, value: m.transform ? m.transform(raw) : raw, kind: m.kind ?? "input" });
  }
  return out;
}

export function missingRequired(mappings: StdFieldMapping[], answers: Record<string, string>): string[] {
  return mappings
    .filter((m) => m.required && (answers[m.canonicalKey] == null || answers[m.canonicalKey] === ""))
    .map((m) => m.canonicalKey);
}

/* --------------------------- recon retry/backoff ---------------------------- */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 1000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw lastErr;
}

export interface ReconField {
  tag: string;
  name: string;
  id: string;
  type: string;
  placeholder: string;
}
export async function discoverFields(page: Page): Promise<ReconField[]> {
  return page.$$eval("input, select, textarea", (els) =>
    els.map((el) => {
      const e = el as HTMLInputElement;
      return { tag: e.tagName.toLowerCase(), name: e.name, id: e.id, type: e.type, placeholder: e.placeholder };
    }),
  );
}

/* ------------------------------- captcha hook ------------------------------- */
/**
 * RUN-CORE-001 captcha hook: detect a reCAPTCHA v2 widget on the page and
 * solve it via 2captcha. Best-effort — returns the token (to be injected by
 * the portal-specific step) or null when no captcha / no API key / failure.
 */
export async function detectAndSolveCaptcha(page: Page): Promise<string | null> {
  if (!process.env.TWOCAPTCHA_API_KEY) return null;
  const sitekey = await page
    .locator("[data-sitekey], .g-recaptcha")
    .first()
    .getAttribute("data-sitekey")
    .catch(() => null);
  if (!sitekey) return null;
  try {
    const res = await solveCaptcha({ type: "recaptcha-v2", pageUrl: page.url(), siteKey: sitekey });
    return res.text;
  } catch (err) {
    console.warn(`[captcha] solve failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/* ------------------------------- runner factory ----------------------------- */
export interface StdRunnerConfig {
  /** Artefact filename prefix, e.g. "ca". */
  cc: string;
  /** Canonical country code for payment-routing, e.g. "canada". */
  country: string;
  baseUrlEnv: string;
  baseUrlDefault: string;
  defaultVisaType: string;
  mappings: StdFieldMapping[];
  locale?: string;
}

export interface StdRunResult {
  status: "stopped_before_pay" | "blocked" | "anti_bot_gate" | "needs_human";
  reason: string;
  reachedStep: string;
  artefacts: string[];
}

export interface StdRunInput {
  jobId: string;
  applicationId: string;
  answers: Record<string, string>;
  visaType?: string;
  headless?: boolean;
}

export function makeStandardEvisaRunner(cfg: StdRunnerConfig): {
  runRunner: (input: StdRunInput) => Promise<StdRunResult>;
  runOne: (applicationId: string, jobId?: string) => Promise<DispatchOutcome>;
} {
  const baseUrl = process.env[cfg.baseUrlEnv] ?? cfg.baseUrlDefault;

  async function runRunner(input: StdRunInput): Promise<StdRunResult> {
    const missing = missingRequired(cfg.mappings, input.answers);
    if (missing.length > 0) {
      return { status: "needs_human", reason: `missing required answers: ${missing.join(", ")}`, reachedStep: "validation", artefacts: [] };
    }

    const browser: Browser = await chromium.launch({ headless: input.headless ?? true });
    const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), `${cfg.cc}-har-`));
    const ctx = await browser.newContext({
      locale: cfg.locale ?? "en-US",
      recordHar: { path: path.join(tempHar, `${cfg.cc}-${input.jobId}.har`), mode: "minimal" },
    });
    const page = await ctx.newPage();
    const artefacts: string[] = [];
    let reachedStep = "landing";

    try {
      await withRetry(() => page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 }));
      const title = await page.title().catch(() => "");
      if (/just a moment|attention required/i.test(title)) {
        return { status: "anti_bot_gate", reason: `anti-bot gate: ${title}`, reachedStep, artefacts };
      }

      reachedStep = "form";
      for (const f of mapAnswers(cfg.mappings, input.answers)) {
        try {
          if (f.kind === "select") await page.selectOption(f.selector, f.value, { timeout: 5_000 });
          else await page.fill(f.selector, f.value, { timeout: 5_000 });
        } catch (err) {
          console.warn(`[${cfg.cc}] fill ${f.selector} failed: ${err instanceof Error ? err.message : err}`);
        }
      }

      // Best-effort captcha solve (token injection is portal-specific).
      await detectAndSolveCaptcha(page);

      try {
        const png = await page.screenshot({ fullPage: true });
        const ref = await artifact.put(input.jobId, `${cfg.cc}-step-01-form.png`, png, { contentType: "image/png", upsert: true });
        artefacts.push(ref.path);
      } catch {
        /* best-effort */
      }

      reachedStep = "pre_payment";
      const visaType = input.visaType ?? cfg.defaultVisaType;
      const routing = routingFor(cfg.country, visaType);
      const reason = `halted before payment; policy=${policyFor(routing.mechanism)} collector=${collectorFor(routing.mechanism)} fee=${feeCentsFor(cfg.country, visaType) ?? "?"}c`;
      return { status: "stopped_before_pay", reason, reachedStep, artefacts };
    } catch (err) {
      return { status: "blocked", reason: err instanceof Error ? err.message : String(err), reachedStep, artefacts };
    } finally {
      await ctx.close();
      await browser.close();
    }
  }

  async function runOne(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
    const answers = await loadCanonicalAnswers(applicationId);
    const result = await runRunner({ jobId: jobId ?? applicationId, applicationId, answers });
    switch (result.status) {
      case "stopped_before_pay":
        return { outcome: "halted_before_pay", reachedStep: result.reachedStep, artefacts: result.artefacts };
      case "blocked":
      case "anti_bot_gate":
        throw new RetryableRunnerError(`${result.status}: ${result.reason}`);
      case "needs_human":
        throw new NeedsHumanError(result.reason);
      default:
        throw new Error(`unexpected ${cfg.cc} status: ${result.status}`);
    }
  }

  return { runRunner, runOne };
}
