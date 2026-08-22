export interface PublicCataloguePayload {
  slug: string;
  portalCountry: string;
  name: string;
  city: string;
  flagCode: string;
  type: string;
  visaType: string;
  validity: string;
  image: string;
  tag: "fast" | "evisa";
  featured: boolean;
  pricing: {
    currency: "SGD";
    governmentFeeMinor: number;
    agencyFeeMinor: number;
    firstTimeDiscountMinor: number;
  };
}

export interface CatalogueReadiness {
  blockers: string[];
  warnings: string[];
  evidence: Record<string, unknown>;
}

export function isPublicCataloguePayload(value: unknown): value is PublicCataloguePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const pricing = row.pricing;
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing)) return false;
  const price = pricing as Record<string, unknown>;
  return ["slug", "portalCountry", "name", "city", "flagCode", "type", "visaType", "validity", "image"].every(
    (key) => typeof row[key] === "string",
  ) && (row.tag === "fast" || row.tag === "evisa")
    && typeof row.featured === "boolean"
    && price.currency === "SGD"
    && ["governmentFeeMinor", "agencyFeeMinor", "firstTimeDiscountMinor"].every(
      (key) => Number.isInteger(price[key]) && Number(price[key]) >= 0,
    );
}
