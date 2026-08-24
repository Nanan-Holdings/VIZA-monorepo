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

const snapshot = createRequire(import.meta.url)("./official-master.snapshot.json") as Snapshot;

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
  option(entry.code, entry.label, entry.label, entry.code),
);

export const JP_VJW_CITIES_BY_PREFECTURE = Object.fromEntries(
  Object.entries(snapshot.citiesByPrefecture).map(([prefectureCode, cities]) => [
    prefectureCode,
    [...cities],
  ]),
) as Record<string, string[]>;

export const JP_VJW_AIRLINE_OPTIONS = snapshot.airlines.map((entry) =>
  option(entry.iata, entry.label, entry.label, entry.code),
);

export const JP_VJW_EMBARKATION_POINT_OPTIONS = snapshot.embarkationPoints.map((entry) =>
  option(entry.label, entry.label, entry.label, entry.code),
);
