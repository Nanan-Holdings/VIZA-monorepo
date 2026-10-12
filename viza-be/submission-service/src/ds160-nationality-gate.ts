/**
 * CEAC DS-160 nationality gates shared by the runner's branch policy and
 * previous-travel mapping resolver.
 *
 * The set is copied from the live CEAC observation recorded on 2026-09-21.
 * It is intentionally kept independent of the frontend package so the
 * submission service cannot accidentally use browser-only aliases or logic.
 */

import { DS160_COUNTRY_LABELS } from "./ds160-country-catalog";
import { DS160_ISO_COUNTRY_ALIASES } from "./ds160-country-aliases";

export const DS160_ESTA_NATIONALITY_CODES: ReadonlySet<string> = new Set([
  "ANDO", "ASTL", "AUST", "BELG", "BRNI", "CZEC", "DEN", "EST", "ETH",
  "FIN", "FRAN", "GER", "GRC", "HUNG", "ICLD", "IRE", "ITLY", "JPN",
  "KOR", "LATV", "LCHT", "LITH", "LXM", "MLTA", "MON", "NETH", "NZLD",
  "NORW", "PORT", "SMAR", "SING", "SVK", "SVN", "SPN", "SWDN", "SWTZ",
  "GRBR",
]);

function normalizeNationalityToken(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const OBSERVED_COUNTRY_ALIASES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(DS160_COUNTRY_LABELS).flatMap(([code, labels]) => [
    [normalizeNationalityToken(code), code],
    ...labels.map(label => [normalizeNationalityToken(label), code]),
  ]),
);

const NATIONALITY_ALIASES: Readonly<Record<string, string>> = {
  ...OBSERVED_COUNTRY_ALIASES,
  ...DS160_ISO_COUNTRY_ALIASES,
  // The CEAC catalog uses four-letter codes for these countries. Keep common
  // ISO codes and legacy localized labels usable for older saved rows.
  AD: "ANDO", AND: "ANDO", ANDORRA: "ANDO",
  AU: "ASTL", AUS: "ASTL", AUSTRALIA: "ASTL",
  AT: "AUST", AUT: "AUST", AUSTRIA: "AUST",
  BE: "BELG", BEL: "BELG", BELGIUM: "BELG",
  BN: "BRNI", BRN: "BRNI", BRUNEI: "BRNI",
  CZ: "CZEC", CZE: "CZEC", CZECHIA: "CZEC", CZECHREPUBLIC: "CZEC",
  DK: "DEN", DNK: "DEN", DENMARK: "DEN",
  EE: "EST", ESTONIA: "EST",
  ET: "ETH", ETHIOPIA: "ETH",
  FI: "FIN", FINLAND: "FIN",
  FR: "FRAN", FRA: "FRAN", FRANCE: "FRAN",
  DE: "GER", DEU: "GER", GERMANY: "GER",
  GR: "GRC", GRC: "GRC", GREECE: "GRC",
  HU: "HUNG", HUN: "HUNG", HUNGARY: "HUNG",
  IS: "ICLD", ISL: "ICLD", ICELAND: "ICLD",
  IE: "IRE", IRL: "IRE", IRELAND: "IRE",
  IT: "ITLY", ITA: "ITLY", ITALY: "ITLY",
  JP: "JPN", JPN: "JPN", JAPAN: "JPN",
  KR: "KOR", KOR: "KOR", SOUTHKOREA: "KOR", KOREAREPUBLICOFSOUTH: "KOR", KOREAREPUBLICOF: "KOR",
  LV: "LATV", LVA: "LATV", LATVIA: "LATV",
  LI: "LCHT", LIE: "LCHT", LIECHTENSTEIN: "LCHT",
  LT: "LITH", LTU: "LITH", LITHUANIA: "LITH",
  LU: "LXM", LUX: "LXM", LUXEMBOURG: "LXM",
  MT: "MLTA", MLT: "MLTA", MALTA: "MLTA",
  MC: "MON", MCO: "MON", MONACO: "MON",
  NL: "NETH", NLD: "NETH", NETHERLANDS: "NETH",
  NZ: "NZLD", NZL: "NZLD", NEWZEALAND: "NZLD",
  NO: "NORW", NOR: "NORW", NORWAY: "NORW",
  PT: "PORT", PRT: "PORT", PORTUGAL: "PORT",
  SM: "SMAR", SMR: "SMAR", SANMARINO: "SMAR",
  SG: "SING", SGP: "SING", SINGAPORE: "SING",
  SK: "SVK", SVK: "SVK", SLOVAKIA: "SVK",
  SI: "SVN", SVN: "SVN", SLOVENIA: "SVN",
  ES: "SPN", ESP: "SPN", SPAIN: "SPN",
  SE: "SWDN", SWE: "SWDN", SWEDEN: "SWDN",
  CH: "SWTZ", CHE: "SWTZ", SWITZERLAND: "SWTZ",
  GB: "GRBR", GBR: "GRBR", UK: "GRBR", UNITEDKINGDOM: "GRBR",
  CN: "CHIN", CHN: "CHIN", CHINA: "CHIN", 中国: "CHIN",
  CA: "CAN", CANADA: "CAN",
  BRA: "BRZL", 日本: "JPN",
  BRASIL: "BRZL", 巴西: "BRZL",
  加拿大: "CAN",
};

/** Resolve a saved country code, ISO alias, or official English label. */
export function resolveDs160NationalityCode(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const token = normalizeNationalityToken(value);
  return NATIONALITY_ALIASES[token] ?? token;
}

/** Normalize a country value for cross-field equality checks. */
export function canonicalizeDs160Nationality(value: string | undefined): string | null {
  return resolveDs160NationalityCode(value);
}

/**
 * Normalize any known CEAC country value while preserving unknown text for a
 * later validation error.  This is shared by derivation and preflight so raw
 * ISO aliases and localized legacy values cannot diverge between those paths.
 */
export function normalizeDs160CountryValue(value: string): string {
  const resolved = resolveDs160NationalityCode(value);
  return resolved && Object.prototype.hasOwnProperty.call(DS160_COUNTRY_LABELS, resolved)
    ? resolved
    : value;
}

export function isDs160Affirmative(value: string | undefined): boolean {
  const token = value?.trim().toUpperCase().replace(/[\s-]+/gu, "_");
  return token === "YES" || token === "Y" || token === "TRUE" || token === "1" || token === "是";
}

/**
 * Return whether CEAC should expose its ESTA/VWP question for these answers.
 * Permanent residence is intentionally excluded: live CEAC kept the question
 * hidden for a Japan permanent-resident branch when other nationality was No.
 */
export function isDs160EstaNationalityGateVisible(
  answers: Readonly<Record<string, string | undefined>>,
): boolean {
  const primary = resolveDs160NationalityCode(
    answers.nationality_country ?? answers.nationality ?? answers.current_nationality,
  );
  if (primary && DS160_ESTA_NATIONALITY_CODES.has(primary)) return true;

  if (!isDs160Affirmative(answers.other_nationality)) return false;
  return Object.entries(answers)
    .filter(([key]) => /^other_nationality_country(?:__\d+)?$/u.test(key))
    .some(([, value]) => {
      const code = resolveDs160NationalityCode(value);
      return code !== null && DS160_ESTA_NATIONALITY_CODES.has(code);
    });
}

/** A saved affirmative ESTA answer must never be silently discarded. */
export function hasDs160HistoricEstaAffirmative(
  answers: Readonly<Record<string, string | undefined>>,
): boolean {
  return isDs160Affirmative(answers.vwp_denial);
}
