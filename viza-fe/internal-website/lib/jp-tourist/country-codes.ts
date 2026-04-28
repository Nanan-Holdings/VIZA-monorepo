// Map a country.name string (as stored by visa_form_fields when
// validationRules.source === "ISO3166-1") to the label used by the MOFA
// "Application for Visa" form's nationality / country-of-birth dropdowns.
//
// MOFA dropdowns use uppercase English country names with a few quirks:
//   - "USA" (not "UNITED STATES")
//   - "VIET NAM" (with a space)
//   - "KOREA" (single entry — MOFA does not split N/S Korea)
//   - "RUSSIA" (not "RUSSIAN FEDERATION")
//   - "TAIWAN" — appears as a top-level entry
//
// Most names map by simple uppercasing. The override table below covers the
// cases that don't. If a name is not found in the dropdown's option list at
// fill time, the renderer falls back to leaving the dropdown blank and the
// caller appends the country name to the form's remarks block.

const OVERRIDES: Record<string, string> = {
  "United States": "USA",
  "United States of America": "USA",
  Vietnam: "VIET NAM",
  "Viet Nam": "VIET NAM",
  Russia: "RUSSIA",
  "Russian Federation": "RUSSIA",
  "South Korea": "KOREA",
  "Korea (Republic of)": "KOREA",
  "Korea, Republic of": "KOREA",
  "North Korea": "KOREA",
  Taiwan: "TAIWAN",
  "Taiwan, Province of China": "TAIWAN",
  "Hong Kong": "HONGKONG（SAR）",
  Macao: "MACAO (SAR)",
  Macau: "MACAO (SAR)",
  Iran: "IRAN",
  "Iran, Islamic Republic of": "IRAN",
  Syria: "SYRIA",
  "Syrian Arab Republic": "SYRIA",
  Bolivia: "BOLIVIA",
  "Bolivia (Plurinational State of)": "BOLIVIA",
  Venezuela: "VENEZUELA",
  "Venezuela (Bolivarian Republic of)": "VENEZUELA",
  Tanzania: "TANZANIA",
  "Tanzania, United Republic of": "TANZANIA",
  Moldova: "MOLDOVA",
  "Moldova, Republic of": "MOLDOVA",
  "Czech Republic": "CZECH REPUBLIC",
  Czechia: "CZECH REPUBLIC",
  Laos: "LAOS",
  "Lao People's Democratic Republic": "LAOS",
  "East Timor": "EAST TIMOR",
  "Timor-Leste": "EAST TIMOR",
  Brunei: "BRUNEI",
  "Brunei Darussalam": "BRUNEI",
  "Côte d'Ivoire": "COTE d' IVOIRE",
  "Cote d'Ivoire": "COTE d' IVOIRE",
  Argentina: "ARGENTINE",
  "Cabo Verde": "CAPE VERDE",
  "Cape Verde": "CAPE VERDE",
  Eswatini: "SWAZILAND",
  Swaziland: "SWAZILAND",
  "North Macedonia": "THE FORMER YUGOSLAV REPUBLIC OF MACEDONIA",
  Macedonia: "THE FORMER YUGOSLAV REPUBLIC OF MACEDONIA",
  "Saint Kitts and Nevis": "SAINT CHRISTOPHER AND NEVIS",
  Palestine: "PALESTINE",
  "Palestine, State of": "PALESTINE",
};

/**
 * Given the value stored in a visa_form_fields country answer (the human-
 * readable country name from country-data-list), return the matching MOFA
 * dropdown option label. Returns null if no match.
 *
 * `availableOptions` is the list of options pulled live from the AcroForm
 * dropdown at render time — we match against it to handle MOFA list drift.
 */
export function mofaCountryLabel(
  countryName: string | null | undefined,
  availableOptions: readonly string[],
): string | null {
  if (!countryName) return null;
  const trimmed = countryName.trim();
  if (!trimmed) return null;

  const candidates = [
    OVERRIDES[trimmed],
    OVERRIDES[trimmed.replace(/^The /i, "")],
    trimmed.toUpperCase(),
  ].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    const match = availableOptions.find((opt) => opt.trim() === candidate);
    if (match) return match;
  }

  // Final fallback: case-insensitive prefix match on uppercase comparison
  const upper = trimmed.toUpperCase();
  const prefixMatch = availableOptions.find((opt) =>
    opt.trim().toUpperCase().startsWith(upper),
  );
  return prefixMatch ?? null;
}
