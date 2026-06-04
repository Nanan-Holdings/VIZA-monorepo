/**
 * Import aliases from the GeoNames alternate names column.
 *
 * Run after import-geonames-destinations so geonames_id can be resolved.
 */

import {
  createDestinationSupabaseClient,
  normalizeDestinationName,
  parseCliOptions,
  parseGeoNamesRow,
  readTsvRows,
  uniqueAliasesForRow,
  type TravelDestinationAliasImportRow,
} from "./travel-destination-import-utils.js";

type DestinationLookupRow = {
  id: string;
  geonames_id: string | null;
};

type AliasRow = TravelDestinationAliasImportRow & {
  destination_id: string;
};

async function fetchDestinationIds(
  supabase: ReturnType<typeof createDestinationSupabaseClient>,
  geonamesIds: string[]
): Promise<Map<string, string>> {
  if (geonamesIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("travel_destinations")
    .select("id, geonames_id")
    .in("geonames_id", geonamesIds);

  if (error) {
    throw new Error(`Failed to fetch destination ids: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as DestinationLookupRow[])
      .filter((row) => row.geonames_id)
      .map((row) => [row.geonames_id as string, row.id])
  );
}

async function flushAliases(
  supabase: ReturnType<typeof createDestinationSupabaseClient>,
  aliases: AliasRow[],
  dryRun: boolean
): Promise<void> {
  if (aliases.length === 0) return;
  if (dryRun) {
    console.log(`[dry-run] would upsert ${aliases.length} aliases`);
    return;
  }

  const { error } = await supabase
    .from("travel_destination_aliases")
    .upsert(aliases, { onConflict: "destination_id,normalized_alias" });

  if (error) {
    throw new Error(`Failed to upsert aliases: ${error.message}`);
  }
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const supabase = createDestinationSupabaseClient();
  const pending = new Map<string, string[]>();
  let seen = 0;
  let aliasCount = 0;
  let skippedUntilResume = Boolean(options.resumeAfter);

  async function flushPending(): Promise<void> {
    const geonamesIds = Array.from(pending.keys());
    const destinationIds = await fetchDestinationIds(supabase, geonamesIds);
    const aliases: AliasRow[] = [];

    pending.forEach((rawAliases, geonamesId) => {
      const destinationId = destinationIds.get(geonamesId);
      if (!destinationId) return;

      rawAliases.forEach((alias) => {
        aliases.push({
          destination_id: destinationId,
          alias,
          normalized_alias: normalizeDestinationName(alias),
          language: null,
          source: "geonames",
        });
      });
    });

    await flushAliases(supabase, aliases, options.dryRun);
    aliasCount += aliases.length;
    pending.clear();
  }

  for await (const columns of readTsvRows(options.filePath)) {
    const row = parseGeoNamesRow(columns);
    if (!row) continue;

    if (skippedUntilResume) {
      if (row.geonamesId === options.resumeAfter) {
        skippedUntilResume = false;
      }
      continue;
    }

    seen += 1;
    const aliases = uniqueAliasesForRow(row);
    if (aliases.length > 0) {
      pending.set(row.geonamesId, aliases);
    }

    if (pending.size >= options.batchSize) {
      await flushPending();
      console.log(`Processed ${seen} rows, imported ${aliasCount} aliases. Last GeoNames id: ${row.geonamesId}`);
    }

    if (options.limit !== null && seen >= options.limit) break;
  }

  await flushPending();
  console.log(`Done. Processed ${seen} rows and imported ${aliasCount} aliases.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
