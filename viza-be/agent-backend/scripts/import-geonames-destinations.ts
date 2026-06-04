/**
 * Import GeoNames allCountries/admin dumps into travel_destinations.
 *
 * Example:
 *   npx tsx scripts/import-geonames-destinations.ts --file D:\data\geonames\allCountries.txt --batch-size 2000
 *   npx tsx scripts/import-geonames-destinations.ts --file D:\data\geonames\allCountries.txt --resume-after 1816670
 */

import {
  createDestinationSupabaseClient,
  parseCliOptions,
  parseGeoNamesRow,
  readTsvRows,
  toDestinationImportRow,
  type TravelDestinationImportRow,
} from "./travel-destination-import-utils.js";

async function flushBatch(
  supabase: ReturnType<typeof createDestinationSupabaseClient>,
  batch: TravelDestinationImportRow[],
  dryRun: boolean
): Promise<void> {
  if (batch.length === 0) return;
  if (dryRun) {
    console.log(`[dry-run] would upsert ${batch.length} travel_destinations rows`);
    return;
  }

  const { error } = await supabase
    .from("travel_destinations")
    .upsert(batch, { onConflict: "geonames_id" });

  if (error) {
    throw new Error(`Failed to upsert destinations: ${error.message}`);
  }
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const supabase = createDestinationSupabaseClient();
  const batch: TravelDestinationImportRow[] = [];
  let seen = 0;
  let imported = 0;
  let skippedUntilResume = Boolean(options.resumeAfter);

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
    const destination = toDestinationImportRow(row);
    if (!destination) continue;

    batch.push(destination);
    imported += 1;

    if (batch.length >= options.batchSize) {
      await flushBatch(supabase, batch.splice(0), options.dryRun);
      console.log(`Processed ${seen} rows, queued ${imported}. Last GeoNames id: ${row.geonamesId}`);
    }

    if (options.limit !== null && imported >= options.limit) break;
  }

  await flushBatch(supabase, batch, options.dryRun);
  console.log(`Done. Processed ${seen} rows and imported ${imported} destinations.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
