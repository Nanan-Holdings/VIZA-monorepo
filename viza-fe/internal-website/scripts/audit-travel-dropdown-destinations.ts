import * as fs from "node:fs";
import * as path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
import {
  getDropdownDestinationContracts,
  normalizeDestinationSearchText,
  type TravelDestinationContract,
} from "../lib/travel/destination-contracts";

type AuditRow = {
  City: string;
  Country: string;
  "Destination row": string;
  Coordinates: string;
  "Cover image": string;
  "Attraction count": number;
  "Attraction images": string;
  "Data quality": string;
  "Missing fields": string;
};

type TypedSupabaseClient = SupabaseClient<Database>;

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

function createSupabaseAdminClient(): TypedSupabaseClient | null {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hasCoordinates(destination: TravelDestinationContract): boolean {
  return (
    typeof destination.latitude === "number" &&
    Number.isFinite(destination.latitude) &&
    typeof destination.longitude === "number" &&
    Number.isFinite(destination.longitude)
  );
}

function localAssetExists(imageUrl: string | null | undefined): boolean {
  if (!imageUrl?.startsWith("/")) return Boolean(imageUrl);
  const publicPath = path.resolve(process.cwd(), "public", imageUrl.slice(1));
  return fs.existsSync(publicPath);
}

async function destinationRowExists(
  supabase: TypedSupabaseClient | null,
  destination: TravelDestinationContract
): Promise<boolean | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("travel_destinations")
    .select("id")
    .eq("normalized_name", normalizeDestinationSearchText(destination.canonicalName))
    .eq("country_code", destination.countryCode)
    .maybeSingle();

  if (error) {
    console.warn(
      `DB check skipped for ${destination.nameEn}: ${error.message}`
    );
    return null;
  }

  return Boolean(data);
}

function missingCoreFields(destination: TravelDestinationContract): string[] {
  const missing = new Set<string>(destination.missingFields);
  if (!destination.canonicalName) missing.add("canonical_name");
  if (!destination.nameEn || !destination.nameZh) missing.add("localized_names");
  if (!destination.countryCode) missing.add("country_code");
  if (!hasCoordinates(destination)) missing.add("coordinates");
  if (!destination.timezone) missing.add("timezone");
  if (!destination.coverImage || !localAssetExists(destination.coverImage.imageUrl)) {
    missing.add("cover_image");
  }
  if (destination.attractions.length < 3) missing.add("attractions");
  return Array.from(missing);
}

async function main() {
  const strict = process.argv.includes("--strict");
  const requireDb = process.argv.includes("--require-db");
  const supabase = createSupabaseAdminClient();
  const contracts = getDropdownDestinationContracts();
  const rows: AuditRow[] = [];
  const failures: string[] = [];

  if (requireDb && !supabase) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for --require-db."
    );
  }

  for (const destination of contracts) {
    const rowExists = await destinationRowExists(supabase, destination);
    const attractionImageCount = destination.attractions.filter(
      (item) => item.image && localAssetExists(item.image.imageUrl)
    ).length;
    const missing = missingCoreFields(destination);
    if (requireDb && rowExists !== true) missing.push("database_row");
    if (missing.length > 0) {
      failures.push(`${destination.nameEn}: ${missing.join(", ")}`);
    }

    rows.push({
      City: destination.nameEn,
      Country: destination.countryNameEn,
      "Destination row":
        rowExists === null ? "not checked" : rowExists ? "yes" : "missing",
      Coordinates: hasCoordinates(destination) ? "yes" : "missing",
      "Cover image":
        destination.coverImage && localAssetExists(destination.coverImage.imageUrl)
          ? "yes"
          : "missing",
      "Attraction count": destination.attractions.length,
      "Attraction images": `${attractionImageCount}/${destination.attractions.length}`,
      "Data quality": destination.dataQuality,
      "Missing fields": missing.length ? missing.join(", ") : "-",
    });
  }

  console.table(rows);
  console.log(`Audited ${rows.length} dropdown destinations.`);

  if (!supabase) {
    console.warn(
      "Database credentials were not available; destination-row checks were skipped."
    );
  }

  if (failures.length > 0) {
    console.warn(`Coverage warnings:\n- ${failures.join("\n- ")}`);
    if (strict || requireDb) {
      process.exitCode = 1;
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
