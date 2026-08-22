import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TDAC_OFFICIAL_RESIDENCE_COUNTRY_ENTRIES,
  TDAC_OFFICIAL_RESIDENCE_REGIONS_BY_COUNTRY,
} from "./tdac-official-dropdowns.generated";

const CLDR_RELEASE = "release-48-2";
const CLDR_RAW_ROOT = `https://raw.githubusercontent.com/unicode-org/cldr/${CLDR_RELEASE}/common`;
const GOOGLE_TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single";
const OUTPUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "residence-region-translations.zh.json",
);

const CURATED_TRANSLATIONS: Record<string, string> = {
  "ALB:HAS DISTRICT": "哈斯区",
  "ALB:MALËSI E MADHE DISTRICT": "大马莱西亚区",
  "AZE:GƏDƏBƏY": "凯达贝克区",
  "CZE:PLZEŇ-JIH": "比尔森南县",
  "CZE:PLZEŇSKÝ KRAJ": "比尔森州",
  "DZA:BORDJ BAJI MOKHTAR": "博尔吉巴吉穆赫塔尔省",
  "FRO:SUÐUROY": "南岛",
  "GBR:ARDS": "阿兹",
  "GUM:INARAJAN (INALÅHAN)": "伊纳拉汉",
  "GUM:SANTA RITA (SÅNTA RITA-SUMAI)": "圣丽塔-苏迈",
  "GUM:TALOFOFO (TALO'FO'FO)": "塔洛福福",
  "GUM:UMATAC (HUMÅTAK)": "胡马塔克",
  "IDN:DKI JAKARTA": "雅加达首都特区",
  "MAR:DAKHLA-OUED ED-DAHAB (EH)": "达赫拉-黄金谷地大区（西撒哈拉）",
  "MAR:FAHS-ANJRA": "法赫斯-安吉拉大区",
  "MAR:GUELMIM-OUED NOUN (EH-PARTIAL)": "盖勒敏-农河大区（西撒哈拉部分）",
  "MAR:LAÂYOUNE-SAKIA EL HAMRA (EH-PARTIAL)": "阿尤恩-萨基亚-阿姆拉大区（西撒哈拉部分）",
  "MLT:ŻEBBUĠ MALTA": "扎布格",
  "OMN:AL BATINAH NORTH": "北巴提奈省",
  "OMN:ASH SHARQIYAH NORTH": "北东部省",
  "OMN:ASH SHARQIYAH SOUTH": "南东部省",
  "PAN:EMBERÁ-WOUNAAN COMARCA": "恩贝拉-沃南自治区",
  "SVN:MUNICIPALITY OF APAČE": "阿帕切市",
  "SVN:SVETI JURIJ OB ŠČAVNICI MUNICIPALITY": "什恰夫尼察河畔圣尤里市",
  "TTO:PENAL-DEBE REGIONAL CORPORATION": "皮纳尔-德贝区域公司",
  "VNM:ĐÀ NẴNG": "岘港",
};

type TranslationFile = {
  _meta: {
    generated_at: string;
    official_option_source: string;
    standardized_translation_source: string;
    fallback_translation_source: string;
    option_count: number;
    cldr_match_count: number;
    fallback_count: number;
  };
  translations: Record<string, Record<string, string>>;
};

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    );
}

function parseSubdivisionNames(xml: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of xml.matchAll(
    /<subdivision type="([^"]+)"[^>]*>([^<]+)<\/subdivision>/g,
  )) {
    const [, code, label] = match;
    if (code && label) values.set(code, decodeXml(label));
  }
  return values;
}

function parseAlpha3ToAlpha2(xml: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of xml.matchAll(
    /<territoryCodes type="([A-Z]{2})"[^>]*alpha3="([A-Z]{3})"/g,
  )) {
    const [, alpha2, alpha3] = match;
    if (alpha2 && alpha3) values.set(alpha3, alpha2);
  }
  return values;
}

function normalizedName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function normalizedAdministrativeName(value: string): string {
  return normalizedName(value)
    .replace(
      /\b(PROVINCES?|REGIONS?|DISTRICTS?|COUNT(?:Y|IES)|PARISH(?:ES)?|GOVERNORATES?|CANTONS?|DEPARTMENTS?|MUNICIPALIT(?:Y|IES)|PREFECTURES?|STATES?|TERRITORY|AREA|OBLAST|KRAI|REPUBLIC|AUTONOMOUS|ADMINISTRATIVE|FEDERAL|CAPITAL|METROPOLITAN|INSULAR|ISLANDS?)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function hasChinese(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  return response.text();
}

async function translateBatch(
  values: string[],
  sourceLanguage: "auto" | "zh-TW",
): Promise<string[]> {
  if (values.length === 0) return [];
  const url = new URL(GOOGLE_TRANSLATE_URL);
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sourceLanguage);
  url.searchParams.set("tl", "zh-CN");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", values.join("\n"));

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) {
      const body = await response.json() as Array<unknown>;
      const segments = Array.isArray(body[0]) ? body[0] as Array<unknown> : [];
      const translated = segments
        .map((segment) =>
          Array.isArray(segment) && typeof segment[0] === "string" ? segment[0] : "",
        )
        .join("")
        .split("\n")
        .map((value) => value.trim());
      if (translated.length === values.length) return translated;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }

  if (values.length === 1) {
    throw new Error(`Unable to translate TDAC residence label: ${values[0]}`);
  }
  const midpoint = Math.ceil(values.length / 2);
  return [
    ...await translateBatch(values.slice(0, midpoint), sourceLanguage),
    ...await translateBatch(values.slice(midpoint), sourceLanguage),
  ];
}

async function translateInChunks(
  values: string[],
  sourceLanguage: "auto" | "zh-TW",
  chunkSize = 30,
): Promise<string[]> {
  const translated: string[] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    translated.push(
      ...await translateBatch(values.slice(index, index + chunkSize), sourceLanguage),
    );
  }
  return translated;
}

async function main(): Promise<void> {
  const [englishXml, chineseXml, supplementalXml] = await Promise.all([
    fetchText(`${CLDR_RAW_ROOT}/subdivisions/en.xml`),
    fetchText(`${CLDR_RAW_ROOT}/subdivisions/zh.xml`),
    fetchText(`${CLDR_RAW_ROOT}/supplemental/supplementalData.xml`),
  ]);
  const englishNames = parseSubdivisionNames(englishXml);
  const chineseNames = parseSubdivisionNames(chineseXml);
  const alpha3ToAlpha2 = parseAlpha3ToAlpha2(supplementalXml);
  const standardized = new Map<string, string>();

  for (const [countryCode, labels] of Object.entries(
    TDAC_OFFICIAL_RESIDENCE_REGIONS_BY_COUNTRY,
  )) {
    const alpha2 = alpha3ToAlpha2.get(countryCode)?.toLowerCase();
    if (!alpha2) continue;
    const subdivisions = [...englishNames.entries()]
      .filter(([code]) => code.startsWith(alpha2))
      .flatMap(([code, english]) => {
        const chinese = chineseNames.get(code);
        return chinese && hasChinese(chinese) && !/[A-Za-z]{3}/.test(chinese)
          ? [{ english, chinese }]
          : [];
      });

    for (const label of labels) {
      const exact = subdivisions.filter(
        (item) => normalizedName(item.english) === normalizedName(label),
      );
      const candidates = exact.length > 0
        ? exact
        : subdivisions.filter(
            (item) =>
              normalizedAdministrativeName(item.english) ===
              normalizedAdministrativeName(label),
          );
      if (candidates.length === 1 && candidates[0]) {
        standardized.set(`${countryCode}:${label}`, candidates[0].chinese);
      }
    }
  }

  const standardizedValues = [...new Set(standardized.values())];
  const simplifiedValues = await translateInChunks(standardizedValues, "zh-TW");
  const simplifiedByOriginal = new Map(
    standardizedValues.map((value, index) => [value, simplifiedValues[index] ?? value]),
  );

  const missingKeys: Array<{ countryCode: string; label: string }> = [];
  for (const [countryCode, labels] of Object.entries(
    TDAC_OFFICIAL_RESIDENCE_REGIONS_BY_COUNTRY,
  )) {
    for (const label of labels) {
      if (!standardized.has(`${countryCode}:${label}`)) {
        missingKeys.push({ countryCode, label });
      }
    }
  }
  const countryNames = new Map(
    TDAC_OFFICIAL_RESIDENCE_COUNTRY_ENTRIES.map((item) => [item.code, item.label]),
  );
  const fallbackLabels = missingKeys.map(
    (item) => `${item.label}, ${countryNames.get(item.countryCode) ?? item.countryCode}`,
  );
  const fallbackTranslations = await translateInChunks(fallbackLabels, "auto", 15);
  const unresolvedIndexes = fallbackTranslations.flatMap((value, index) =>
    hasChinese(value) ? [] : [index],
  );
  const contextualTranslations = await translateInChunks(
    unresolvedIndexes.map((index) => {
      const item = missingKeys[index];
      return `${item?.label ?? ""}, ${countryNames.get(item?.countryCode ?? "") ?? item?.countryCode ?? ""}`;
    }),
    "auto",
    15,
  );
  unresolvedIndexes.forEach((fallbackIndex, contextualIndex) => {
    fallbackTranslations[fallbackIndex] =
      contextualTranslations[contextualIndex] ?? fallbackTranslations[fallbackIndex] ?? "";
  });

  const translations: Record<string, Record<string, string>> = {};
  let optionCount = 0;
  for (const [countryCode, labels] of Object.entries(
    TDAC_OFFICIAL_RESIDENCE_REGIONS_BY_COUNTRY,
  )) {
    translations[countryCode] = {};
    for (const label of labels) {
      optionCount += 1;
      const standardizedValue = standardized.get(`${countryCode}:${label}`);
      if (standardizedValue) {
        translations[countryCode][label] =
          simplifiedByOriginal.get(standardizedValue) ?? standardizedValue;
        continue;
      }
      const fallbackIndex = missingKeys.findIndex(
        (item) => item.countryCode === countryCode && item.label === label,
      );
      const fallback = fallbackTranslations[fallbackIndex]?.trim() ?? "";
      if (!hasChinese(fallback)) {
        throw new Error(
          `Fallback translation did not produce Chinese for ${countryCode}:${label}: ${fallback}`,
        );
      }
      translations[countryCode][label] = fallback;
    }
  }
  for (const [key, translation] of Object.entries(CURATED_TRANSLATIONS)) {
    const separator = key.indexOf(":");
    const countryCode = key.slice(0, separator);
    const label = key.slice(separator + 1);
    if (!translations[countryCode]?.[label]) {
      throw new Error(`Curated TDAC residence translation no longer matches: ${key}`);
    }
    translations[countryCode][label] = translation;
  }

  const output: TranslationFile = {
    _meta: {
      generated_at: new Date().toISOString(),
      official_option_source: "Thailand Immigration Bureau TDAC API audit",
      standardized_translation_source: `Unicode CLDR ${CLDR_RELEASE}`,
      fallback_translation_source: "Google Translate zh-CN geographic-name fallback",
      option_count: optionCount,
      cldr_match_count: optionCount - missingKeys.length,
      fallback_count: missingKeys.length,
    },
    translations,
  };
  writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(
    `Generated ${optionCount} TDAC residence translations ` +
      `(${optionCount - missingKeys.length} CLDR, ${missingKeys.length} fallback) -> ${OUTPUT}`,
  );
}

main();
