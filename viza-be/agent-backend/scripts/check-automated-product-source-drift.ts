import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

export interface OfficialSourceManifestEntry {
  id: string;
  country: "japan" | "kenya";
  product_code: "JP_VISIT_JAPAN_WEB" | "KE_ETA";
  url: string;
  expected_status: number;
  expected_sha256: string;
  required_text: string[];
}

interface OfficialSourceManifest {
  version: string;
  sources: OfficialSourceManifestEntry[];
}

export interface SourceDriftFinding {
  id: string;
  country: OfficialSourceManifestEntry["country"];
  productCode: OfficialSourceManifestEntry["product_code"];
  url: string;
  reviewNeeded: true;
  reasons: string[];
  observedStatus: number | null;
  observedSha256: string | null;
  checkedAt: string;
}

export interface SourceCheckResult {
  id: string;
  country: OfficialSourceManifestEntry["country"];
  productCode: OfficialSourceManifestEntry["product_code"];
  url: string;
  reviewNeeded: boolean;
  reasons: string[];
  observedStatus: number | null;
  observedSha256: string | null;
  checkedAt: string;
}

export interface SourceFetchResponse {
  status: number;
  text(): Promise<string>;
}

export type SourceFetch = (
  input: string,
  init?: RequestInit,
) => Promise<SourceFetchResponse>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const OFFICIAL_SOURCE_MANIFEST_PATH = path.join(
  __dirname,
  "automated-products",
  "official-source-manifest.json",
);

export function normalizeOfficialText(html: string): string {
  const $ = cheerio.load(html);
  $("script,style,noscript,svg,template").remove();
  return $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizedIncludes(text: string, expected: string): boolean {
  return text.includes(normalizeOfficialText(expected));
}

export async function checkOfficialSource(
  source: OfficialSourceManifestEntry,
  fetchSource: SourceFetch = fetch,
  now = new Date(),
): Promise<SourceCheckResult> {
  const reasons: string[] = [];
  let observedStatus: number | null = null;
  let observedSha256: string | null = null;

  try {
    const response = await fetchSource(source.url, {
      redirect: "follow",
      headers: { "user-agent": "VIZA-official-source-drift-check/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    observedStatus = response.status;
    const body = await response.text();
    const normalized = normalizeOfficialText(body);
    observedSha256 = sha256(normalized);

    if (observedStatus !== source.expected_status) {
      reasons.push(`http_status_changed:${source.expected_status}->${observedStatus}`);
    }
    if (normalized.length === 0) {
      reasons.push("empty_normalized_body");
    }
    if (source.expected_sha256 && observedSha256 !== source.expected_sha256) {
      reasons.push("content_hash_changed");
    }
    for (const assertion of source.required_text) {
      if (!normalizedIncludes(normalized, assertion)) {
        reasons.push(`required_text_missing:${assertion}`);
      }
    }
  } catch (error) {
    reasons.push(
      `fetch_failed:${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    id: source.id,
    country: source.country,
    productCode: source.product_code,
    url: source.url,
    reviewNeeded: reasons.length > 0,
    reasons,
    observedStatus,
    observedSha256,
    checkedAt: now.toISOString(),
  };
}

export function readOfficialSourceManifest(
  manifestPath = OFFICIAL_SOURCE_MANIFEST_PATH,
): OfficialSourceManifest {
  const value = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as OfficialSourceManifest;
  if (!value.version || !Array.isArray(value.sources) || value.sources.length === 0) {
    throw new Error("Official source manifest must contain a version and sources");
  }
  return value;
}

function parseArgs(argv: string[]): { countries: Set<string>; json: boolean } {
  const countries = new Set<string>();
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--weekly") continue;
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--country" || arg === "--countries") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      value.split(",").map((country) => country.trim().toLowerCase()).filter(Boolean).forEach((country) => countries.add(country));
      index += 1;
      continue;
    }
    if (arg.startsWith("--country=") || arg.startsWith("--countries=")) {
      arg.slice(arg.indexOf("=") + 1).split(",").map((country) => country.trim().toLowerCase()).filter(Boolean).forEach((country) => countries.add(country));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { countries, json };
}

export async function runSourceDriftCheck(
  manifest: OfficialSourceManifest,
  countries: Set<string> = new Set(),
  fetchSource: SourceFetch = fetch,
): Promise<SourceCheckResult[]> {
  const sources = manifest.sources.filter(
    (source) => countries.size === 0 || countries.has(source.country),
  );
  const results: SourceCheckResult[] = [];
  for (const source of sources) {
    results.push(await checkOfficialSource(source, fetchSource));
  }
  return results;
}

async function main(): Promise<void> {
  const { countries, json } = parseArgs(process.argv.slice(2));
  const manifest = readOfficialSourceManifest();
  const results = await runSourceDriftCheck(manifest, countries);
  const reviewNeeded = results.filter((result) => result.reviewNeeded);

  // This is deliberately a read-only monitor. It reports review-needed
  // findings and never edits the manifest, RAG seeds, database, or rules.
  if (json) {
    console.log(JSON.stringify({ manifestVersion: manifest.version, reviewNeeded }, null, 2));
  } else if (reviewNeeded.length === 0) {
    console.log(`No official-source drift detected (${results.length} sources checked).`);
  } else {
    console.log(`review-needed: ${reviewNeeded.length} of ${results.length} official sources`);
    for (const finding of reviewNeeded) {
      console.log(`- ${finding.id}: ${finding.reasons.join(", ")}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
