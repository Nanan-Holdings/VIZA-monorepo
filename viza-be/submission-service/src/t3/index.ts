/**
 * Tier-3 country prefill runners (AUTO-T3-*).
 *
 * Each country exports `run<CC>Prefill(input)` over the shared
 * runGenericPrefill harness. The fillForm callback per country
 * holds country-specific selector + ordering; the rest (artefact
 * capture, anti-bot detection, HAR export) is shared.
 */

import type { Page } from "@playwright/test";
import { runGenericPrefill, gFill, gClick, type GenericRunInput, type GenericRunResult } from "../generic/prefill.js";

export interface CommonAnswers {
  surname: string;
  given_names: string;
  date_of_birth: string;
  nationality: string;
  passport_number: string;
  passport_expiry_date: string;
  passport_issuing_country: string;
  email: string;
  phone: string;
  intended_arrival_date: string;
  occupation?: string;
  intended_departure_date?: string;
  visit_purpose?: string;
}

const APPLY_OPENERS = [
  'a:has-text("Apply")',
  'a:has-text("Start")',
  'button:has-text("Apply now")',
  'a[href*="apply"]',
];

/** Standard personal-info fill block used by most Tier-3 portals. */
async function fillStandardPersonalInfo(page: Page, a: CommonAnswers): Promise<string> {
  await gFill(page, 'input[name="given_names"]', a.given_names);
  await gFill(page, 'input[name="first_name"]', a.given_names);
  await gFill(page, 'input[name="surname"]', a.surname);
  await gFill(page, 'input[name="last_name"]', a.surname);
  await gFill(page, 'input[name="email"]', a.email);
  await gFill(page, 'input[name="phone"]', a.phone);
  await gFill(page, 'input[name="date_of_birth"]', a.date_of_birth);
  await gFill(page, 'input[name="dob"]', a.date_of_birth);
  await gFill(page, 'select[name="nationality"]', a.nationality);
  await gFill(page, 'input[name="passport_number"]', a.passport_number);
  await gFill(page, 'input[name="passport_expiry"]', a.passport_expiry_date);
  await gFill(page, 'input[name="arrival_date"]', a.intended_arrival_date);
  await gFill(page, 'input[name="departure_date"]', a.intended_departure_date);
  await gFill(page, 'select[name="visit_purpose"]', a.visit_purpose);
  await gFill(page, 'input[name="occupation"]', a.occupation);
  await gClick(page, ['button:has-text("Continue")', 'button:has-text("Next")']);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  return "review";
}

/* ------------------- Per-country exports ------------------- */

export const ID_BASE = process.env.ID_PORTAL_URL ?? "https://evisa.imigrasi.go.id";
export async function runIdPrefill(input: GenericRunInput<CommonAnswers>): Promise<GenericRunResult> {
  return runGenericPrefill(
    { cc: "id", baseUrl: ID_BASE, applyOpener: APPLY_OPENERS, fillForm: fillStandardPersonalInfo },
    input,
  );
}

export const EG_BASE = process.env.EG_PORTAL_URL ?? "https://visa2egypt.gov.eg";
export async function runEgPrefill(input: GenericRunInput<CommonAnswers>): Promise<GenericRunResult> {
  return runGenericPrefill(
    { cc: "eg", baseUrl: EG_BASE, applyOpener: APPLY_OPENERS, fillForm: fillStandardPersonalInfo },
    input,
  );
}

export const IT_BASE = process.env.IT_VFS_CN_PORTAL_URL ?? "https://visa.vfsglobal.com/chn/zh/ita";
export async function runItPrefill(input: GenericRunInput<CommonAnswers>): Promise<GenericRunResult> {
  return runGenericPrefill(
    {
      cc: "it",
      baseUrl: IT_BASE,
      locale: "zh-CN",
      applyOpener: ['a:has-text("Apply Now")', 'a:has-text("立即申请")', ...APPLY_OPENERS],
      fillForm: fillStandardPersonalInfo,
    },
    input,
  );
}

export const TH_BASE = process.env.TH_PORTAL_URL ?? "https://www.thaievisa.go.th";
export async function runThPrefill(input: GenericRunInput<CommonAnswers>): Promise<GenericRunResult> {
  return runGenericPrefill(
    { cc: "th", baseUrl: TH_BASE, applyOpener: APPLY_OPENERS, fillForm: fillStandardPersonalInfo },
    input,
  );
}

export const MY_BASE = process.env.MY_PORTAL_URL ?? "https://evisa.imi.gov.my";
export async function runMyPrefill(input: GenericRunInput<CommonAnswers>): Promise<GenericRunResult> {
  return runGenericPrefill(
    { cc: "my", baseUrl: MY_BASE, applyOpener: APPLY_OPENERS, fillForm: fillStandardPersonalInfo },
    input,
  );
}

export const NZ_BASE = process.env.NZ_PORTAL_URL ?? "https://www.immigration.govt.nz/eta";
export async function runNzPrefill(input: GenericRunInput<CommonAnswers>): Promise<GenericRunResult> {
  return runGenericPrefill(
    { cc: "nz", baseUrl: NZ_BASE, applyOpener: APPLY_OPENERS, fillForm: fillStandardPersonalInfo },
    input,
  );
}

export const RU_BASE = process.env.RU_PORTAL_URL ?? "https://electronic-visa.kdmid.ru";
export async function runRuPrefill(input: GenericRunInput<CommonAnswers>): Promise<GenericRunResult> {
  return runGenericPrefill(
    { cc: "ru", baseUrl: RU_BASE, applyOpener: APPLY_OPENERS, fillForm: fillStandardPersonalInfo },
    input,
  );
}

export const TR_BASE = process.env.TR_PORTAL_URL ?? "https://www.evisa.gov.tr";
export async function runTrPrefill(input: GenericRunInput<CommonAnswers>): Promise<GenericRunResult> {
  return runGenericPrefill(
    { cc: "tr", baseUrl: TR_BASE, applyOpener: APPLY_OPENERS, fillForm: fillStandardPersonalInfo },
    input,
  );
}

export const AE_BASE = process.env.AE_PORTAL_URL ?? "https://smartservices.icp.gov.ae";
export async function runAePrefill(input: GenericRunInput<CommonAnswers>): Promise<GenericRunResult> {
  return runGenericPrefill(
    { cc: "ae", baseUrl: AE_BASE, applyOpener: APPLY_OPENERS, fillForm: fillStandardPersonalInfo },
    input,
  );
}

export const CA_ETA_BASE = process.env.CA_PORTAL_URL ?? "https://onlineservices-servicesenligne.cic.gc.ca/eapp/welcome.do";
export async function runCaEtaPrefill(input: GenericRunInput<CommonAnswers>): Promise<GenericRunResult> {
  return runGenericPrefill(
    {
      cc: "ca-eta",
      baseUrl: CA_ETA_BASE,
      applyOpener: ['a:has-text("Apply for an eTA")', ...APPLY_OPENERS],
      fillForm: fillStandardPersonalInfo,
    },
    input,
  );
}

export const MV_BASE = process.env.MV_PORTAL_URL ?? "https://imuga.immigration.gov.mv";
export async function runMvPrefill(input: GenericRunInput<CommonAnswers>): Promise<GenericRunResult> {
  return runGenericPrefill(
    { cc: "mv", baseUrl: MV_BASE, applyOpener: APPLY_OPENERS, fillForm: fillStandardPersonalInfo },
    input,
  );
}

export const PH_ETRAVEL_BASE = process.env.PH_PORTAL_URL ?? "https://etravel.gov.ph";
export async function runPhEtravelPrefill(input: GenericRunInput<CommonAnswers>): Promise<GenericRunResult> {
  return runGenericPrefill(
    { cc: "ph-etravel", baseUrl: PH_ETRAVEL_BASE, applyOpener: APPLY_OPENERS, fillForm: fillStandardPersonalInfo },
    input,
  );
}
