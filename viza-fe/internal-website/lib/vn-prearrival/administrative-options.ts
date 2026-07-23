import administrativeUnits from "./administrative-units-legacy.json";
import administrativeNames from "./official-administrative-names.zh-CN.json";

export type VnPrearrivalAdministrativeOption = {
  value: string;
  text: string;
  label_en: string;
  label_zh: string;
  official_label: string;
  searchText: string;
};

type AdministrativeUnit = {
  value: string;
  label_en: string;
  label_vi: string;
};

const dataset = administrativeUnits as {
  provinces: AdministrativeUnit[];
  wards_by_province: Record<string, AdministrativeUnit[] | undefined>;
};

const names = administrativeNames as {
  provinces: Record<string, string | undefined>;
  wards: Record<string, string | undefined>;
};

function normalizeSearchAlias(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toOption(
  unit: AdministrativeUnit,
  labelZh: string | undefined,
): VnPrearrivalAdministrativeOption {
  if (!labelZh) {
    throw new Error(
      `Missing code-keyed Chinese Vietnam administrative name for ${unit.value}`,
    );
  }
  return {
    value: unit.value,
    text: unit.label_en,
    label_en: unit.label_en,
    label_zh: labelZh,
    official_label: unit.label_en,
    searchText: [
      unit.value,
      unit.label_en,
      unit.label_vi,
      labelZh,
      normalizeSearchAlias(unit.label_en),
      normalizeSearchAlias(unit.label_vi),
    ].join(" "),
  };
}

const PROVINCES = dataset.provinces.map((unit) =>
  toOption(unit, names.provinces[unit.value]),
);
const WARDS_BY_PROVINCE = Object.fromEntries(
  Object.entries(dataset.wards_by_province).map(([province, wards]) => [
    province,
    (wards ?? []).map((unit) => toOption(unit, names.wards[unit.value])),
  ]),
) as Record<string, VnPrearrivalAdministrativeOption[]>;

export function getVnPrearrivalAdministrativeOptions(
  level: "level1" | "level2",
  provinceCode = "",
): VnPrearrivalAdministrativeOption[] {
  if (level === "level1") return PROVINCES;
  return WARDS_BY_PROVINCE[provinceCode] ?? [];
}
