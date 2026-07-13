import administrativeUnits from "./administrative-units-legacy.json";

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

function toOption(unit: AdministrativeUnit): VnPrearrivalAdministrativeOption {
  return {
    value: unit.value,
    text: unit.label_en,
    label_en: unit.label_en,
    // The client localizes the Vietnamese official place name for Chinese display.
    label_zh: unit.label_vi,
    official_label: unit.label_en,
    searchText: `${unit.value} ${unit.label_en} ${unit.label_vi}`,
  };
}

const PROVINCES = dataset.provinces.map(toOption);
const WARDS_BY_PROVINCE = Object.fromEntries(
  Object.entries(dataset.wards_by_province).map(([province, wards]) => [
    province,
    (wards ?? []).map(toOption),
  ]),
) as Record<string, VnPrearrivalAdministrativeOption[]>;

export function getVnPrearrivalAdministrativeOptions(
  level: "level1" | "level2",
  provinceCode = "",
): VnPrearrivalAdministrativeOption[] {
  if (level === "level1") return PROVINCES;
  return WARDS_BY_PROVINCE[provinceCode] ?? [];
}
