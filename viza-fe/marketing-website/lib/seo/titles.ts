/**
 * Destination page titles and descriptions. Pure functions with no alias
 * imports, so scripts/og.mjs and scripts/check-copy.mjs can load this file.
 *
 * Title patterns (SEO plan, Phase B):
 *   embassy visa:  "{Country} Visa from Singapore: Fees and How to Apply | VIZA"
 *   e-visa:        "{Country} e-Visa: Requirements and How to Apply | VIZA"
 *   Chinese:       "新加坡办理{国家}签证：材料、费用与流程 | VIZA"
 * Titles stay at 60 characters or fewer: a long country name steps down to a
 * shorter wording rather than being cut mid-word.
 */
import type { CountryMeta } from "../countries";

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** Countries whose visa is applied for online as an e-visa (card tag "fast" in lib/countries.ts). */
export function isEvisa(country: Pick<CountryMeta, "tag">): boolean {
  return country.tag === "fast";
}

const len = (s: string) => [...s].length;

function firstThatFits(options: string[]): string {
  return options.find((o) => len(o) <= TITLE_MAX) ?? options[options.length - 1];
}

export function destinationTitle(country: Pick<CountryMeta, "tag">, name: string, locale: string): string {
  if (locale.toLowerCase().startsWith("zh")) {
    return firstThatFits([
      `新加坡办理${name}签证：材料、费用与流程 | VIZA`,
      `新加坡办理${name}签证：材料与流程 | VIZA`,
      `新加坡办理${name}签证 | VIZA`,
    ]);
  }
  if (isEvisa(country)) {
    return firstThatFits([
      `${name} e-Visa: Requirements and How to Apply | VIZA`,
      `${name} e-Visa: Requirements and Steps | VIZA`,
      `${name} e-Visa from Singapore | VIZA`,
      `${name} e-Visa | VIZA`,
    ]);
  }
  return firstThatFits([
    `${name} Visa from Singapore: Fees and How to Apply | VIZA`,
    `${name} Visa from Singapore: Fees and Steps | VIZA`,
    `${name} Visa from Singapore | VIZA`,
    `${name} Visa | VIZA`,
  ]);
}

export function destinationDescription(
  country: Pick<CountryMeta, "tag" | "validity">,
  name: string,
  locale: string,
): string {
  if (locale.toLowerCase().startsWith("zh")) {
    return isEvisa(country)
      ? `在新加坡办理${name}电子签证：所需材料、政府费用和办理时间。VIZA 的服务免费，每份申请提交前都由顾问核对。`
      : `在新加坡办理${name}签证：所需材料、政府费用和办理时间。VIZA 的服务免费，每份申请提交前都由顾问核对。`;
  }
  const text = isEvisa(country)
    ? `${name} e-visa requirements, government fee and processing time for people living in Singapore. VIZA is free and an advisor checks every form.`
    : `${name} visa for people living in Singapore: documents, government fee and processing time. VIZA is free and an advisor checks every form.`;
  return text;
}
