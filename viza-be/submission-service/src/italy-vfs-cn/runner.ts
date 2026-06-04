import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser, type Page } from "@playwright/test";
import { artifact } from "../artifact.js";
import { normalizeItVfsAnswers, type ItVfsAnswers } from "./normalize.js";
import { IT_VFS_URLS, IT_VFS_PERSONAL_FIELDS, IT_VFS_TRAVEL_DOC_FIELDS, IT_VFS_CONTACT_FIELDS } from "./selectors.js";
import { loadCanonicalAnswers } from "../queue/answers.js";
import {
  NeedsHumanError,
  RetryableRunnerError,
  type DispatchOutcome,
} from "../queue/types.js";

/**
 * Italy Schengen-via-VFS (China corridor) runner (RUN-IT-001).
 *
 * Builds the structured Annex I answer set (normalize.ts), fills the
 * personal / travel-document / contact sections on visa.vfsglobal.com, and
 * HALTS before appointment booking (which requires manual slot confirmation
 * + government/VFS payment). Best-effort selectors pending live recon.
 *
 * Corridor: residency CN → destination IT (assertCorridorEligible). A
 * non-CN applicant or an incomplete Annex I answer set surfaces as
 * needs_human so the dispatcher / ops can route appropriately.
 */

const BASE_URL = process.env.IT_VFS_CN_PORTAL_URL ?? IT_VFS_URLS.landing;

export interface ItRunInput {
  jobId: string;
  applicationId: string;
  answers: Record<string, string | undefined>;
  residencyCountry?: string;
  headless?: boolean;
}

export interface ItRunResult {
  status: "stopped_before_pay" | "blocked" | "anti_bot_gate" | "needs_human";
  reason: string;
  reachedStep: string;
  artefacts: string[];
}

async function safeFill(page: Page, selector: string, value: string | null): Promise<void> {
  if (!value) return;
  try {
    if (selector.startsWith("select")) {
      await page.selectOption(selector, value, { timeout: 5_000 });
    } else {
      await page.fill(selector, value, { timeout: 5_000 });
    }
  } catch (err) {
    console.warn(`[it-vfs] fill ${selector} failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function fillPersonal(page: Page, a: ItVfsAnswers): Promise<void> {
  const p = a.personal;
  await safeFill(page, IT_VFS_PERSONAL_FIELDS.surname, p.surname);
  await safeFill(page, IT_VFS_PERSONAL_FIELDS.surname_at_birth, p.surnameAtBirth);
  await safeFill(page, IT_VFS_PERSONAL_FIELDS.given_names, p.givenNames);
  await safeFill(page, IT_VFS_PERSONAL_FIELDS.date_of_birth, p.dateOfBirth);
  await safeFill(page, IT_VFS_PERSONAL_FIELDS.place_of_birth_city, p.placeOfBirthCity);
  await safeFill(page, IT_VFS_PERSONAL_FIELDS.place_of_birth_country, p.placeOfBirthCountry);
  await safeFill(page, IT_VFS_PERSONAL_FIELDS.current_nationality, p.currentNationality);
  await safeFill(page, IT_VFS_PERSONAL_FIELDS.sex, p.sex);
  await safeFill(page, IT_VFS_TRAVEL_DOC_FIELDS.travel_document_number, a.travelDocument.number);
  await safeFill(page, IT_VFS_TRAVEL_DOC_FIELDS.travel_document_expiry_date, a.travelDocument.expiryDate);
  await safeFill(page, IT_VFS_CONTACT_FIELDS.email, a.contact.email);
  await safeFill(page, IT_VFS_CONTACT_FIELDS.phone, a.contact.phone);
}

export async function runItRunner(input: ItRunInput): Promise<ItRunResult> {
  let normalized: ItVfsAnswers;
  try {
    normalized = normalizeItVfsAnswers({
      answers: input.answers,
      applicantResidencyCountry: input.residencyCountry ?? input.answers["residency_country"] ?? "CN",
      destinationCountry: "IT",
    });
  } catch (err) {
    // Corridor mismatch or missing Annex I field — needs human routing/data.
    return {
      status: "needs_human",
      reason: err instanceof Error ? err.message : String(err),
      reachedStep: "normalize",
      artefacts: [],
    };
  }

  const browser: Browser = await chromium.launch({ headless: input.headless ?? true });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), "it-har-"));
  const ctx = await browser.newContext({
    locale: "zh-CN",
    recordHar: { path: path.join(tempHar, `it-${input.jobId}.har`), mode: "minimal" },
  });
  const page = await ctx.newPage();
  const artefacts: string[] = [];
  let reachedStep = "landing";

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const title = await page.title().catch(() => "");
    if (/just a moment|attention required|verify you are human/i.test(title)) {
      return { status: "anti_bot_gate", reason: `anti-bot gate: ${title}`, reachedStep, artefacts };
    }

    reachedStep = "personal";
    await fillPersonal(page, normalized);
    try {
      const png = await page.screenshot({ fullPage: true });
      const ref = await artifact.put(input.jobId, "it-step-01-personal.png", png, { contentType: "image/png", upsert: true });
      artefacts.push(ref.path);
    } catch {
      /* best-effort */
    }

    // Halt before appointment booking + VFS/government payment (manual slot confirmation).
    reachedStep = "pre_appointment";
    return {
      status: "stopped_before_pay",
      reason: "halted before appointment booking / VFS payment (manual slot confirmation required)",
      reachedStep,
      artefacts,
    };
  } catch (err) {
    return { status: "blocked", reason: err instanceof Error ? err.message : String(err), reachedStep, artefacts };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

export async function runOne(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
  const answers = await loadCanonicalAnswers(applicationId);
  const result = await runItRunner({ jobId: jobId ?? applicationId, applicationId, answers });
  switch (result.status) {
    case "stopped_before_pay":
      return { outcome: "halted_before_pay", reachedStep: result.reachedStep, artefacts: result.artefacts };
    case "blocked":
    case "anti_bot_gate":
      throw new RetryableRunnerError(`${result.status}: ${result.reason}`);
    case "needs_human":
      throw new NeedsHumanError(result.reason);
    default:
      throw new Error(`unexpected italy status: ${result.status}`);
  }
}
