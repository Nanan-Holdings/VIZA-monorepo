import { createRequire } from "node:module";

export interface JpVjwOfficialOption {
  value: string;
  code: string;
  text: string;
  label_zh: string;
  label_en: string;
  official_label: string;
}

interface Snapshot {
  metadata: {
    schemaVersion: string;
    sourceUrl: string;
    retrievedAt: string;
    sha256: string;
    publicationPolicy: string;
  };
  prefectures: Array<{ code: string; label: string }>;
  citiesByPrefecture: Record<string, string[]>;
  airlines: Array<{ code: string; iata: string; label: string }>;
  embarkationPoints: Array<{ code: string; label: string }>;
}

interface ChineseTranslationSnapshot {
  prefectures: Record<string, string>;
  citiesByPrefecture: Record<string, Record<string, string>>;
  airlines: Record<string, string>;
  embarkationPoints: Record<string, string>;
}

const snapshot = createRequire(import.meta.url)("./official-master.snapshot.json") as Snapshot;
const translations = createRequire(import.meta.url)("./option-translations.zh.json") as ChineseTranslationSnapshot;

function option(value: string, officialLabel: string, labelZh = officialLabel, code = value): JpVjwOfficialOption {
  return {
    value,
    code,
    text: officialLabel,
    label_zh: labelZh,
    label_en: officialLabel,
    official_label: officialLabel,
  };
}

export const JP_VJW_OFFICIAL_MASTER_SOURCE = snapshot.metadata;

export const JP_VJW_NATIONALITY_OPTIONS = [
  option("CHN", "China", "中国", "CHN"),
];

export const JP_VJW_PREFECTURE_OPTIONS = snapshot.prefectures.map((entry) =>
  option(entry.code, entry.label, translations.prefectures[entry.code] ?? "日本都道府县", entry.code),
);

export const JP_VJW_CITIES_BY_PREFECTURE = Object.fromEntries(
  Object.entries(snapshot.citiesByPrefecture).map(([prefectureCode, cities]) => [
    prefectureCode,
    cities.map((city) => option(
      city,
      city,
      translations.citiesByPrefecture[prefectureCode]?.[city] ?? "日本市区町村",
      city,
    )),
  ]),
) as Record<string, JpVjwOfficialOption[]>;

export const JP_VJW_AIRLINE_OPTIONS = snapshot.airlines.map((entry) =>
  option(
    entry.iata,
    entry.label,
    `${translations.airlines[entry.iata] ?? "航空公司"}（${entry.iata}）`,
    entry.code,
  ),
);

export const JP_VJW_EMBARKATION_POINT_OPTIONS = snapshot.embarkationPoints.map((entry) =>
  option(
    entry.label,
    entry.label,
    translations.embarkationPoints[entry.label] ?? "出发城市 / 港口",
    entry.code,
  ),
);
