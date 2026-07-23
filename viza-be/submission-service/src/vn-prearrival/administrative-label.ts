import bundledAdministrativeCatalog from "./data/administrative-units-legacy.json";

type AdministrativeItem = {
  value?: string;
  label_en?: string;
};

type AdministrativeCatalog = {
  provinces?: AdministrativeItem[];
  wards_by_province?: Record<string, AdministrativeItem[] | undefined>;
};

const administrativeCatalog = bundledAdministrativeCatalog as AdministrativeCatalog;

export function officialAdministrativeLabel(
  source: "province" | "ward",
  value: string,
  parent = "",
): string {
  if (!value) return value;
  if (source === "province") {
    return administrativeCatalog.provinces?.find((item) => item.value === value)?.label_en ?? value;
  }
  return administrativeCatalog.wards_by_province?.[parent]
    ?.find((item) => item.value === value)?.label_en ?? value;
}
