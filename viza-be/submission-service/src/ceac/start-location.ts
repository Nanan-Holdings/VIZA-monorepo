import {
  CEAC_DS160_LOCATION_OPTIONS,
  CEAC_DS160_LOCATION_OPTION_COUNT,
} from "./start-location-options";

export {
  CEAC_DS160_LOCATION_OPTIONS,
  CEAC_DS160_LOCATION_OPTION_COUNT,
} from "./start-location-options";

const CEAC_LOCATION_CODES = new Set<string>(
  CEAC_DS160_LOCATION_OPTIONS.map(([code]) => code),
);

/** Legacy VIZA labels retained for existing applicant drafts. */
const CEAC_LEGACY_LOCATION_ALIASES: Readonly<Record<string, string>> = {
  "CHINA, BEIJING": "BEJ",
  BEIJING: "BEJ",
  "CHINA, GUANGZHOU": "GUZ",
  GUANGZHOU: "GUZ",
  "CHINA, SHANGHAI": "SHG",
  SHANGHAI: "SHG",
  "CHINA, SHENYANG": "SNY",
  SHENYANG: "SNY",
  "CHINA, WUHAN": "WUH",
  WUHAN: "WUH",
};

type LocationAlias = string | null;

function addLocationAlias(
  aliases: Map<string, LocationAlias>,
  rawAlias: string,
  code: string,
): void {
  const alias = rawAlias.trim().toUpperCase();
  if (!alias) return;
  const existing = aliases.get(alias);
  if (existing === undefined) {
    aliases.set(alias, code);
  } else if (existing !== code) {
    // An unqualified city name is legal only when it identifies one CEAC
    // option. Preserve an explicit ambiguity marker instead of guessing.
    aliases.set(alias, null);
  }
}

const CEAC_LOCATION_ALIASES = (() => {
  const aliases = new Map<string, LocationAlias>();
  for (const [code, label] of CEAC_DS160_LOCATION_OPTIONS) {
    // The official label is the primary bilingual/legacy value accepted by
    // VIZA drafts (for example, "SINGAPORE, SINGAPORE").
    addLocationAlias(aliases, label, code);

    // CEAC labels are COUNTRY, CITY, so retain a city-only alias only when
    // the current official option list makes that city unambiguous.
    const comma = label.indexOf(",");
    addLocationAlias(aliases, comma >= 0 ? label.slice(comma + 1) : label, code);
  }
  for (const [alias, code] of Object.entries(CEAC_LEGACY_LOCATION_ALIASES)) {
    addLocationAlias(aliases, alias, code);
  }
  return aliases;
})();

export function resolveCeacStartLocationCode(answers: Record<string, string>): string {
  const candidate = [
    answers.consular_post,
    answers.embassy_or_consulate,
    answers.location_where_applying_for_visa,
  ].find((value) => value?.trim());

  if (!candidate) {
    throw new Error(
      "DS-160 consular post is missing. Return to VIZA and choose the U.S. embassy or consulate where you plan to apply.",
    );
  }

  const normalized = candidate.trim().toUpperCase();
  const code = CEAC_LOCATION_CODES.has(normalized)
    ? normalized
    : CEAC_LOCATION_ALIASES.get(normalized) ?? "";
  if (!code || !CEAC_LOCATION_CODES.has(code)) {
    throw new Error(
      `Unsupported DS-160 consular post "${candidate}". Choose one of the ${CEAC_DS160_LOCATION_OPTION_COUNT} official CEAC locations.`,
    );
  }

  return code;
}
