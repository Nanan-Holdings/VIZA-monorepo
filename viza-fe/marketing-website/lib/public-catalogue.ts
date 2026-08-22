import "server-only";
import { portalUrl } from "@/lib/utils";

export interface CataloguePricing {
  currency: "SGD";
  governmentFeeMinor: number;
  agencyFeeMinor: number;
  firstTimeDiscountMinor: number;
}

export interface PublishedCatalogueEntry {
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
  pricing: CataloguePricing;
  version: number;
  publishedAt: string;
}

function validEntry(value: unknown): value is PublishedCatalogueEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const pricing = row.pricing;
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing)) return false;
  const price = pricing as Record<string, unknown>;
  return ["slug", "portalCountry", "name", "city", "flagCode", "type", "visaType", "validity", "image", "publishedAt"].every(
    (key) => typeof row[key] === "string",
  ) && (row.tag === "fast" || row.tag === "evisa")
    && typeof row.featured === "boolean"
    && Number.isInteger(row.version)
    && price.currency === "SGD"
    && ["governmentFeeMinor", "agencyFeeMinor", "firstTimeDiscountMinor"].every(
      (key) => Number.isInteger(price[key]) && Number(price[key]) >= 0,
    );
}

export async function getPublishedCatalogue(): Promise<PublishedCatalogueEntry[]> {
  // A missing portal URL is a deployment/configuration failure. Fail closed so
  // a local build or broken environment cannot accidentally advertise a stale
  // hard-coded country as purchasable.
  if (!process.env.NEXT_PUBLIC_PORTAL_URL) return [];
  try {
    const response = await fetch(portalUrl("/api/public/catalogue"), {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return [];
    const body = await response.json() as { ok?: unknown; entries?: unknown };
    if (body.ok !== true || !Array.isArray(body.entries)) return [];
    return body.entries.filter(validEntry);
  } catch {
    return [];
  }
}
