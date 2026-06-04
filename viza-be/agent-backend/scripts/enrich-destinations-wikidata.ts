/**
 * Enrich imported destinations from a cached Wikidata JSONL export.
 *
 * Expected JSONL shape:
 *   {"geonames_id":"1816670","wikidata_qid":"Q8646","labels":{"zh":"香港","en":"Hong Kong"},"aliases":["HK"],"latitude":22.3193,"longitude":114.1694}
 *
 * Keep network-heavy SPARQL jobs outside this script; run them as a compliant
 * batch/cached process and feed the result here.
 */

import * as fs from "fs";
import * as readline from "readline";
import {
  createDestinationSupabaseClient,
  normalizeDestinationName,
  parseCliOptions,
} from "./travel-destination-import-utils.js";

type WikidataEnrichmentRow = {
  geonames_id?: string;
  wikidata_qid?: string;
  labels?: Record<string, string>;
  aliases?: string[];
  latitude?: number;
  longitude?: number;
  place_type?: string;
  tourism_score?: number;
};

type DestinationLookupRow = {
  id: string;
  geonames_id: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseEnrichmentLine(line: string): WikidataEnrichmentRow | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isRecord(parsed)) return null;

    const aliases = Array.isArray(parsed.aliases)
      ? parsed.aliases.filter((alias): alias is string => typeof alias === "string")
      : [];
    const labels = isRecord(parsed.labels)
      ? Object.fromEntries(
          Object.entries(parsed.labels).filter((entry): entry is [string, string] => typeof entry[1] === "string")
        )
      : undefined;

    return {
      geonames_id: typeof parsed.geonames_id === "string" ? parsed.geonames_id : undefined,
      wikidata_qid: typeof parsed.wikidata_qid === "string" ? parsed.wikidata_qid : undefined,
      labels,
      aliases,
      latitude: typeof parsed.latitude === "number" ? parsed.latitude : undefined,
      longitude: typeof parsed.longitude === "number" ? parsed.longitude : undefined,
      place_type: typeof parsed.place_type === "string" ? parsed.place_type : undefined,
      tourism_score: typeof parsed.tourism_score === "number" ? parsed.tourism_score : undefined,
    };
  } catch {
    return null;
  }
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const supabase = createDestinationSupabaseClient();
  const stream = fs.createReadStream(options.filePath, { encoding: "utf-8" });
  const reader = readline.createInterface({
    input: stream,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  let seen = 0;
  let updated = 0;

  for await (const line of reader) {
    if (!line.trim()) continue;
    const row = parseEnrichmentLine(line);
    if (!row?.geonames_id) continue;
    seen += 1;

    const { data, error } = await supabase
      .from("travel_destinations")
      .select("id, geonames_id")
      .eq("geonames_id", row.geonames_id)
      .maybeSingle();

    if (error) throw new Error(`Lookup failed for ${row.geonames_id}: ${error.message}`);
    const destination = data as DestinationLookupRow | null;
    if (!destination) continue;

    const displayName = row.labels?.zh ?? row.labels?.en;
    const updatePayload = {
      display_name: displayName,
      normalized_name: displayName ? normalizeDestinationName(displayName) : undefined,
      wikidata_qid: row.wikidata_qid,
      latitude: row.latitude,
      longitude: row.longitude,
      place_type: row.place_type,
      popularity_score: row.tourism_score,
      source: "geonames,wikidata",
      source_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!options.dryRun) {
      const { error: updateError } = await supabase
        .from("travel_destinations")
        .update(updatePayload)
        .eq("id", destination.id);
      if (updateError) {
        throw new Error(`Update failed for ${row.geonames_id}: ${updateError.message}`);
      }

      const aliasRows = [
        ...Object.values(row.labels ?? {}),
        ...(row.aliases ?? []),
      ]
        .map((alias) => alias.trim())
        .filter((alias) => alias.length >= 2)
        .map((alias) => ({
          destination_id: destination.id,
          alias,
          normalized_alias: normalizeDestinationName(alias),
          language: null,
          source: "wikidata",
        }));

      if (aliasRows.length > 0) {
        const { error: aliasError } = await supabase
          .from("travel_destination_aliases")
          .upsert(aliasRows, { onConflict: "destination_id,normalized_alias" });
        if (aliasError) {
          throw new Error(`Alias upsert failed for ${row.geonames_id}: ${aliasError.message}`);
        }
      }
    }

    updated += 1;
    if (options.limit !== null && updated >= options.limit) break;
  }

  console.log(`${options.dryRun ? "[dry-run] " : ""}Scanned ${seen} enrichment rows and updated ${updated} destinations.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
