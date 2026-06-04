import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

export type SupabaseAdmin = ReturnType<typeof createDestinationSupabaseClient>;

export type GeoNamesRow = {
  geonamesId: string;
  name: string;
  asciiName: string;
  alternateNames: string[];
  latitude: number | null;
  longitude: number | null;
  featureClass: string;
  featureCode: string;
  countryCode: string;
  admin1Code: string;
  population: number | null;
  timezone: string;
  modifiedAt: string | null;
};

export type TravelDestinationImportRow = {
  canonical_name: string;
  display_name: string;
  normalized_name: string;
  country_code: string | null;
  country_name: string | null;
  region: string | null;
  city: string | null;
  place_type: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  population: number | null;
  popularity_score: number;
  source: string;
  source_updated_at: string | null;
  geonames_id: string | null;
  confidence_score: number;
  is_verified: boolean;
  is_active: boolean;
  is_searchable: boolean;
  show_on_home: boolean;
  is_featured: boolean;
};

export type TravelDestinationAliasImportRow = {
  destination_id?: string;
  alias: string;
  normalized_alias: string;
  language: string | null;
  source: string;
};

export type CliOptions = {
  filePath: string;
  batchSize: number;
  limit: number | null;
  resumeAfter: string | null;
  dryRun: boolean;
};

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export function createDestinationSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function normalizeDestinationName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/ø/g, "o")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseNullableNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    filePath: "",
    batchSize: 1000,
    limit: null,
    resumeAfter: null,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    const [key, inlineValue] = arg.includes("=") ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const value = inlineValue ?? argv[index + 1];
    const consumedNext = inlineValue === undefined;

    if (key === "--file") {
      if (!value) throw new Error("--file requires a path.");
      options.filePath = path.resolve(value);
      if (consumedNext) index += 1;
      continue;
    }

    if (key === "--batch-size") {
      if (!value) throw new Error("--batch-size requires a number.");
      options.batchSize = parsePositiveInteger(value, options.batchSize);
      if (consumedNext) index += 1;
      continue;
    }

    if (key === "--limit") {
      if (!value) throw new Error("--limit requires a number.");
      options.limit = parsePositiveInteger(value, 1);
      if (consumedNext) index += 1;
      continue;
    }

    if (key === "--resume-after") {
      if (!value) throw new Error("--resume-after requires a GeoNames id.");
      options.resumeAfter = value.trim();
      if (consumedNext) index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.filePath) {
    throw new Error("Pass --file <path-to-geonames-dump>.");
  }

  if (!fs.existsSync(options.filePath)) {
    throw new Error(`File not found: ${options.filePath}`);
  }

  return options;
}

export async function* readTsvRows(filePath: string): AsyncGenerator<string[]> {
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const reader = readline.createInterface({
    input: stream,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of reader) {
    if (!line.trim() || line.startsWith("#")) continue;
    yield line.split("\t");
  }
}

export function parseGeoNamesRow(columns: string[]): GeoNamesRow | null {
  if (columns.length < 19) return null;

  const name = columns[1]?.trim();
  const asciiName = columns[2]?.trim() || name;
  if (!columns[0] || !name || !asciiName) return null;

  return {
    geonamesId: columns[0],
    name,
    asciiName,
    alternateNames: (columns[3] ?? "")
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean),
    latitude: parseNullableNumber(columns[4]),
    longitude: parseNullableNumber(columns[5]),
    featureClass: columns[6] ?? "",
    featureCode: columns[7] ?? "",
    countryCode: columns[8] ?? "",
    admin1Code: columns[10] ?? "",
    population: parseNullableNumber(columns[14]),
    timezone: columns[17] ?? "",
    modifiedAt: columns[18] ? `${columns[18]}T00:00:00.000Z` : null,
  };
}

export function classifyGeoNamesPlace(row: GeoNamesRow): string | null {
  const featureCode = row.featureCode.toUpperCase();
  const featureClass = row.featureClass.toUpperCase();

  if (featureClass === "A" && featureCode === "PCLI") return "country";
  if (featureClass === "A") return "region";
  if (featureClass === "P") {
    if (featureCode.includes("PPLA") || featureCode === "PPLC") return "city";
    return row.population && row.population >= 50000 ? "city" : "town";
  }
  if (featureClass === "T" && featureCode.includes("ISL")) return "island";
  if (featureClass === "L" && featureCode.includes("PRK")) return "national_park";
  if (featureClass === "T" && featureCode.includes("MT")) return "mountain";
  if (featureClass === "H") return "natural_feature";
  if (featureClass === "S" && featureCode.includes("AIR")) return "airport";
  if (featureClass === "S") return "landmark";

  return null;
}

export function shouldImportGeoNamesRow(row: GeoNamesRow): boolean {
  const placeType = classifyGeoNamesPlace(row);
  if (!placeType) return false;

  if (placeType === "town") {
    return Boolean(row.population && row.population >= 10000);
  }

  return true;
}

export function calculatePopularityScore(row: GeoNamesRow, placeType: string): number {
  const populationScore = row.population
    ? Math.min(70, Math.log10(Math.max(10, row.population)) * 10)
    : 0;
  const typeBonus: Record<string, number> = {
    country: 40,
    city: 30,
    region: 20,
    island: 18,
    national_park: 18,
    landmark: 14,
    natural_feature: 12,
    mountain: 10,
    airport: 8,
    town: 5,
  };
  const capitalBonus = row.featureCode.toUpperCase() === "PPLC" ? 25 : 0;
  return Math.round((populationScore + (typeBonus[placeType] ?? 0) + capitalBonus) * 100) / 100;
}

export function toDestinationImportRow(row: GeoNamesRow): TravelDestinationImportRow | null {
  const placeType = classifyGeoNamesPlace(row);
  if (!placeType || !shouldImportGeoNamesRow(row)) return null;

  const countryName = row.countryCode
    ? COUNTRY_NAMES.of(row.countryCode.toUpperCase()) ?? null
    : null;

  return {
    canonical_name: row.asciiName,
    display_name: row.name,
    normalized_name: normalizeDestinationName(row.asciiName || row.name),
    country_code: row.countryCode || null,
    country_name: countryName,
    region: row.admin1Code || null,
    city: placeType === "city" || placeType === "town" ? row.asciiName : null,
    place_type: placeType,
    latitude: row.latitude,
    longitude: row.longitude,
    timezone: row.timezone || null,
    population: row.population,
    popularity_score: calculatePopularityScore(row, placeType),
    source: "geonames",
    source_updated_at: row.modifiedAt,
    geonames_id: row.geonamesId,
    confidence_score: 0.95,
    is_verified: true,
    is_active: true,
    is_searchable: true,
    show_on_home: false,
    is_featured: false,
  };
}

export function uniqueAliasesForRow(row: GeoNamesRow): string[] {
  const aliases = [row.name, row.asciiName, ...row.alternateNames]
    .map((alias) => alias.trim())
    .filter((alias) => alias.length >= 2);
  const seen = new Set<string>();
  return aliases.filter((alias) => {
    const normalized = normalizeDestinationName(alias);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
