import type { Page } from "@playwright/test";
import type { FormFieldMapping } from "../form-mappings";
import { ds160PreviousUsTravelMappings } from "../ds160-form-mappings";
import { isDs160EstaNationalityGateVisible } from "../ds160-nationality-gate";
import { waitForAspNetPostback } from "./aspnet";
import { detectPage } from "./pages";

/** Resolve the observed CEAC branch without treating arbitrary missing controls as optional. */
export async function resolvePreviousTravelMappings(
  page: Page,
  mappings: Record<string, FormFieldMapping>,
  answers: Record<string, string>,
): Promise<Record<string, FormFieldMapping>> {
  if (!mappings.vwp_denial || !/^(N|no|false|0)$/i.test(answers.vwp_denial ?? "")) return mappings;
  await waitForAspNetPostback(page, 8_000);
  if ((await detectPage(page)).id !== "previous_us_travel") return mappings;

  // The live CEAC branch observed on 2026-09-18 has these four gates and no
  // ESTA question. A partially loaded page or changed selector is not evidence
  // that a question is inactive. In particular, retain any affirmative answer.
  for (const key of ["has_been_in_us", "has_us_visa", "has_been_refused", "immigrant_petition_filed"]) {
    if (await page.locator(`${ds160PreviousUsTravelMappings[key].selector}`).filter({ visible: true }).count() < 2) return mappings;
  }
  if (await page.locator(mappings.vwp_denial.selector).filter({ visible: true }).count()) return mappings;
  // The saved branch predicts that CEAC must expose ESTA. A missing control in
  // that state is a stale/partial DOM or an official-flow mismatch; preserve
  // the mapping so the runner fails closed instead of silently dropping the
  // applicant's answer.
  if (isDs160EstaNationalityGateVisible(answers)) return mappings;
  const visibleText = await page.locator("body").innerText();
  if (/\bESTA\b|visa waiver|electronic system for travel authorization/i.test(visibleText)) return mappings;

  const active = { ...mappings };
  delete active.vwp_denial;
  return active;
}
