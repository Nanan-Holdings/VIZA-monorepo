import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OUTPUT = fileURLToPath(new URL("./official-master.snapshot.json", import.meta.url));

type JsonRecord = Record<string, unknown>;

interface OfficialMasterRecord extends JsonRecord {
  code?: unknown;
  en?: unknown;
  ltr2?: unknown;
  prefecture?: unknown;
  city?: unknown;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractMaster(bundle: string, variableName: string): OfficialMasterRecord[] {
  const match = bundle.match(new RegExp(`\\b${variableName}=JSON\\.parse\\('((?:\\\\.|[^'])*)'\\)`));
  if (!match) throw new Error(`Visit Japan Web master ${variableName} was not found in the bundle.`);

  const decoded = Function(`"use strict"; return '${match[1]}'`)() as string;
  const parsed: unknown = JSON.parse(decoded);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Visit Japan Web master ${variableName} was empty or invalid.`);
  }
  return parsed as OfficialMasterRecord[];
}

function unique<T>(rows: T[], identity: (row: T) => string, listName: string): T[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = identity(row);
    if (!key || seen.has(key)) throw new Error(`Visit Japan Web ${listName} contains an empty or duplicate identity: ${key}`);
    seen.add(key);
  }
  return rows;
}

export function buildOfficialMasterSnapshot(bundle: string, sourceUrl: string, retrievedAt: string) {
  const prefectures = unique(
    extractMaster(bundle, "b9e").map((row) => ({ code: clean(row.code), label: clean(row.en) })),
    (row) => row.code,
    "prefecture master",
  );
  const addressRows = extractMaster(bundle, "I9e");
  const airlines = unique(
    extractMaster(bundle, "h9e").map((row) => ({
      code: clean(row.code),
      iata: clean(row.ltr2),
      label: clean(row.en),
    })),
    (row) => row.iata,
    "airline master",
  );
  const embarkationPoints = unique(
    extractMaster(bundle, "_9e").map((row) => ({ code: clean(row.code), label: clean(row.en) })),
    (row) => row.label,
    "point-of-embarkation master",
  );

  const citiesByPrefecture: Record<string, string[]> = {};
  for (const prefecture of prefectures) {
    const cities = [...new Set(addressRows
      .filter((row) => clean(row.prefecture) === prefecture.label)
      .map((row) => clean(row.city))
      .filter(Boolean))].sort((left, right) => left.localeCompare(right));
    if (cities.length === 0) throw new Error(`Visit Japan Web prefecture ${prefecture.code} has no cities.`);
    citiesByPrefecture[prefecture.code] = cities;
  }

  return {
    metadata: {
      schemaVersion: "VJW-3.16",
      sourceUrl,
      retrievedAt,
      sha256: createHash("sha256").update(bundle).digest("hex"),
      publicationPolicy: "manual-review-required-before-production-update",
    },
    prefectures,
    citiesByPrefecture,
    airlines,
    embarkationPoints,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const bundleIndex = args.indexOf("--bundle");
  const sourceIndex = args.indexOf("--source-url");
  const outputIndex = args.indexOf("--output");
  if (bundleIndex < 0 || !args[bundleIndex + 1]) {
    throw new Error("Usage: --bundle <downloaded official main.js> --source-url <official URL> [--output <path>]");
  }
  const bundlePath = resolve(args[bundleIndex + 1]);
  const sourceUrl = sourceIndex >= 0 && args[sourceIndex + 1]
    ? args[sourceIndex + 1]
    : "https://www.vjw.digital.go.jp/main/main.1dcb51ecdb7a1ed7.js";
  const outputPath = outputIndex >= 0 && args[outputIndex + 1]
    ? resolve(args[outputIndex + 1])
    : DEFAULT_OUTPUT;
  const bundle = await readFile(bundlePath, "utf8");
  const snapshot = buildOfficialMasterSnapshot(bundle, sourceUrl, new Date().toISOString().slice(0, 10));
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Wrote reviewed Visit Japan Web master snapshot to ${outputPath}.`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unknown Visit Japan Web master snapshot failure");
    process.exitCode = 1;
  });
}
