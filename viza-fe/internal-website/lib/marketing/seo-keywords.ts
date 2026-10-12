import rawKeywords from "@/content/seo-keywords.json";

export interface MeasuredKeyword { keyword: string; averageMonthlySearches: number | null }

export function measuredKeywords(): MeasuredKeyword[] {
  const value: unknown = rawKeywords;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const keyword = typeof row.keyword === "string" ? row.keyword.trim() : "";
    if (!keyword) return [];
    const volume = typeof row.averageMonthlySearches === "number" && Number.isFinite(row.averageMonthlySearches) && row.averageMonthlySearches >= 0 ? row.averageMonthlySearches : null;
    return [{ keyword, averageMonthlySearches: volume }];
  });
}

export function measuredKeyword(value: string): MeasuredKeyword | null {
  const normalized = value.trim().toLocaleLowerCase("en");
  return measuredKeywords().find((item) => item.keyword.toLocaleLowerCase("en") === normalized) ?? null;
}
