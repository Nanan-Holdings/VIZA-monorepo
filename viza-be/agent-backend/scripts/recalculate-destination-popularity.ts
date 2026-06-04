/**
 * Recalculate destination popularity scores from imported metadata.
 *
 * Example:
 *   npx tsx scripts/recalculate-destination-popularity.ts --batch-size 1000
 */

import {
  createDestinationSupabaseClient,
  parsePositiveInteger,
} from "./travel-destination-import-utils.js";

type DestinationScoreRow = {
  id: string;
  place_type: string | null;
  population: number | null;
  is_featured: boolean | null;
  show_on_home: boolean | null;
};

type CliOptions = {
  batchSize: number;
  dryRun: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { batchSize: 1000, dryRun: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--batch-size") {
      const value = argv[index + 1];
      if (!value) throw new Error("--batch-size requires a number.");
      options.batchSize = parsePositiveInteger(value, options.batchSize);
      index += 1;
      continue;
    }

    if (arg.startsWith("--batch-size=")) {
      options.batchSize = parsePositiveInteger(
        arg.slice("--batch-size=".length),
        options.batchSize
      );
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function popularityFor(row: DestinationScoreRow): number {
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
    beach: 12,
    mountain: 10,
    airport: 8,
    transport_hub: 8,
    town: 5,
  };
  const curationBonus =
    (row.is_featured ? 25 : 0) + (row.show_on_home ? 10 : 0);
  return Math.round(
    (populationScore + (typeBonus[row.place_type ?? ""] ?? 0) + curationBonus) * 100
  ) / 100;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supabase = createDestinationSupabaseClient();
  let from = 0;
  let updated = 0;

  while (true) {
    const to = from + options.batchSize - 1;
    const { data, error } = await supabase
      .from("travel_destinations")
      .select("id, place_type, population, is_featured, show_on_home")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw new Error(`Failed to load destinations: ${error.message}`);
    const rows = (data ?? []) as DestinationScoreRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      const popularity_score = popularityFor(row);
      if (!options.dryRun) {
        const { error: updateError } = await supabase
          .from("travel_destinations")
          .update({
            popularity_score,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (updateError) {
          throw new Error(`Failed to update ${row.id}: ${updateError.message}`);
        }
      }
      updated += 1;
    }

    console.log(`${options.dryRun ? "[dry-run] " : ""}Recalculated ${updated} destinations`);
    from += options.batchSize;
  }

  console.log(`Done. Recalculated ${updated} destinations.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
