/**
 * RAG ingestion: country-level visa knowledge seeds.
 * Reads knowledge-base/visa-rag-seeds/countries/*.json -> visa_documents + visa_chunks.
 *
 * Run:
 *   npm run ingest:all-visa-rag
 *   npm run ingest:country-visa-rag -- --country japan
 *   npm run ingest:country-visa-rag -- --countries japan,us,indonesia
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = "text-embedding-3-small";
const SEED_DIR = path.resolve(
  __dirname,
  "../../../knowledge-base/visa-rag-seeds/countries"
);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface RagChunk {
  id: string;
  title: string;
  tags: string[];
  content: string;
}

interface RagDocument {
  slug: string;
  country: string;
  visaType: string;
  documentType: string;
  title: string;
  sourceUrl: string;
  chunks: RagChunk[];
}

interface CountryRagSeed {
  version: string;
  country: string;
  notes: string;
  documents: RagDocument[];
}

interface CliOptions {
  countries: string[];
  listOnly: boolean;
  releaseKey: string;
  dryRun: boolean;
}

function normalizeCountry(value: string): string {
  return value.trim().toLowerCase();
}

function parseArgs(argv: string[]): CliOptions {
  const countries = new Set<string>();
  let listOnly = false;
  let dryRun = false;
  let releaseKey =
    process.env.VISA_KNOWLEDGE_RELEASE_KEY ??
    `staged-${new Date().toISOString().slice(0, 10)}`;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all") continue;

    if (arg === "--list") {
      listOnly = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--release") {
      const value = argv[index + 1]?.trim();
      if (!value) throw new Error("--release requires a value");
      releaseKey = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--release=")) {
      releaseKey = arg.slice("--release=".length).trim();
      if (!releaseKey) throw new Error("--release requires a value");
      continue;
    }

    if (arg === "--country" || arg === "--countries") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      value.split(",").map(normalizeCountry).filter(Boolean).forEach((country) => {
        countries.add(country);
      });
      index += 1;
      continue;
    }

    if (arg.startsWith("--country=") || arg.startsWith("--countries=")) {
      const value = arg.slice(arg.indexOf("=") + 1);
      value.split(",").map(normalizeCountry).filter(Boolean).forEach((country) => {
        countries.add(country);
      });
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    countries: Array.from(countries).sort(),
    listOnly,
    releaseKey,
    dryRun,
  };
}

function listSeedFiles(): string[] {
  return fs
    .readdirSync(SEED_DIR)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()
    .map((fileName) => path.join(SEED_DIR, fileName));
}

function readSeed(filePath: string): CountryRagSeed {
  const raw = fs.readFileSync(filePath, "utf-8");
  const seed = JSON.parse(raw) as CountryRagSeed;
  validateSeed(seed, filePath);
  return seed;
}

function validateSeed(seed: CountryRagSeed, filePath: string): void {
  if (!seed.country || !Array.isArray(seed.documents) || seed.documents.length === 0) {
    throw new Error(`Invalid country seed: ${filePath}`);
  }

  const mismatchedDocument = seed.documents.find(
    (document) => document.country !== seed.country
  );
  if (mismatchedDocument) {
    throw new Error(
      `Seed ${filePath} has document ${mismatchedDocument.slug} with country ${mismatchedDocument.country}, expected ${seed.country}`
    );
  }

  const chunkIds = new Set<string>();
  for (const document of seed.documents) {
    for (const chunk of document.chunks) {
      if (chunkIds.has(chunk.id)) {
        throw new Error(`Duplicate chunk id ${chunk.id} in ${filePath}`);
      }
      chunkIds.add(chunk.id);
    }
  }
}

function resolveSeeds(options: CliOptions): CountryRagSeed[] {
  const seeds = listSeedFiles().map(readSeed);
  const available = new Set(seeds.map((seed) => seed.country));

  for (const country of options.countries) {
    if (!available.has(country)) {
      throw new Error(
        `No country seed found for ${country}. Available: ${Array.from(available)
          .sort()
          .join(", ")}`
      );
    }
  }

  if (options.countries.length === 0) {
    return seeds;
  }

  const requested = new Set(options.countries);
  return seeds.filter((seed) => requested.has(seed.country));
}

async function getEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_KEY || OPENAI_KEY === "your_openai_api_key_here") {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      console.warn(
        `Embedding failed (${response.status}). Check whether this OpenAI project has access to ${EMBEDDING_MODEL}.`
      );
      return null;
    }

    const data = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    return data.data?.[0]?.embedding ?? null;
  } catch (error) {
    console.warn(
      `Embedding request errored: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

function buildChunkContent(document: RagDocument, chunk: RagChunk): string {
  return [
    `# ${chunk.title}`,
    "",
    `Country: ${document.country}`,
    `Visa type: ${document.visaType}`,
    `Document type: ${document.documentType}`,
    `Source: ${document.title}`,
    `Source URL: ${document.sourceUrl}`,
    `Tags: ${chunk.tags.join(", ")}`,
    "",
    chunk.content,
  ].join("\n");
}

function contentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function ensureRelease(releaseKey: string): Promise<string> {
  const { data, error } = await supabase
    .from("visa_knowledge_releases")
    .upsert(
      {
        release_key: releaseKey,
        status: "staged",
        description: "Country seed ingestion; pending data gates and regression tests.",
      },
      { onConflict: "release_key", ignoreDuplicates: true }
    )
    .select("id")
    .single();
  if (!error && data) return (data as { id: string }).id;

  const { data: existing, error: lookupError } = await supabase
    .from("visa_knowledge_releases")
    .select("id")
    .eq("release_key", releaseKey)
    .single();
  if (lookupError || !existing) {
    throw new Error(`Failed to create knowledge release: ${error?.message ?? lookupError?.message}`);
  }
  return (existing as { id: string }).id;
}

async function ingestDocument(
  document: RagDocument,
  seedVersion: string,
  releaseId: string
): Promise<{
  inserted: number;
  embedded: number;
}> {
  const sourceKey = `country:${document.slug}`;
  const { data: existingDocument, error: existingError } = await supabase
    .from("visa_documents")
    .select("id")
    .eq("release_id", releaseId)
    .eq("source_key", sourceKey)
    .maybeSingle();
  if (existingError) {
    throw new Error(`Failed to query ${sourceKey}: ${existingError.message}`);
  }

  const payload = {
    country: document.country,
    visa_type: document.visaType,
    document_type: document.documentType,
    title: document.title,
    source_url: document.sourceUrl,
    source_key: sourceKey,
    ingestion_scope: "country_seed",
    release_id: releaseId,
    status: "staged",
    content_hash: contentHash(document),
    verified_at: new Date(`${seedVersion}T00:00:00.000Z`).toISOString(),
    last_synced_at: new Date().toISOString(),
  };
  const documentRequest = existingDocument
    ? supabase
        .from("visa_documents")
        .update(payload)
        .eq("id", (existingDocument as { id: string }).id)
    : supabase
    .from("visa_documents")
        .insert(payload);
  const { data: insertedDocument, error: documentError } = await documentRequest
    .select("id")
    .single();

  if (documentError || !insertedDocument) {
    throw new Error(
      `Failed to insert document ${document.slug}: ${documentError?.message}`
    );
  }

  const documentId = (insertedDocument as { id: string }).id;
  if (existingDocument) {
    const { error: deleteError } = await supabase
      .from("visa_chunks")
      .delete()
      .eq("document_id", documentId);
    if (deleteError) {
      throw new Error(`Failed to replace chunks for ${sourceKey}: ${deleteError.message}`);
    }
  }
  let inserted = 0;
  let embedded = 0;

  for (const chunk of document.chunks) {
    const content = buildChunkContent(document, chunk);
    const embedding = await getEmbedding(`${chunk.title}\n\n${content}`);
    const row: Record<string, unknown> = {
      document_id: documentId,
      country: document.country,
      visa_type: document.visaType,
      document_type: document.documentType,
      content,
    };

    if (embedding) {
      row.embedding = embedding;
      embedded += 1;
    }

    const { error: chunkError } = await supabase.from("visa_chunks").insert(row);

    if (chunkError) {
      throw new Error(`Failed to insert chunk ${chunk.id}: ${chunkError.message}`);
    }

    inserted += 1;
    process.stdout.write(
      `    - ${chunk.id} (${content.length} chars${embedding ? ", embedded" : ""})\n`
    );
  }

  return { inserted, embedded };
}

async function ingestSeed(seed: CountryRagSeed, releaseId: string): Promise<{
  inserted: number;
  embedded: number;
}> {
  let inserted = 0;
  let embedded = 0;

  console.log(`\nCountry: ${seed.country}`);
  console.log(`Version: ${seed.version}`);
  console.log(`Documents: ${seed.documents.length}`);

  for (const document of seed.documents) {
    console.log(`  Ingesting: ${document.title}`);
    const result = await ingestDocument(document, seed.version, releaseId);
    inserted += result.inserted;
    embedded += result.embedded;
  }

  return { inserted, embedded };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const seeds = resolveSeeds(options);

  if (options.listOnly) {
    console.log(seeds.map((seed) => seed.country).join("\n"));
    return;
  }
  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          releaseKey: options.releaseKey,
          countries: seeds.map((seed) => seed.country),
          documents: seeds.flatMap((seed) =>
            seed.documents.map((document) => `country:${document.slug}`)
          ),
        },
        null,
        2
      )
    );
    return;
  }
  const releaseId = await ensureRelease(options.releaseKey);

  console.log("Starting country visa RAG ingestion");
  console.log(`Seed directory: ${SEED_DIR}`);
  console.log(`Countries: ${seeds.length}`);
  console.log(`Staged release: ${options.releaseKey}`);
  console.log(
    `Embeddings: ${
      OPENAI_KEY && OPENAI_KEY !== "your_openai_api_key_here"
        ? `enabled (${EMBEDDING_MODEL})`
        : "disabled (chunks will still be inserted for filtered fallback)"
    }`
  );

  let totalInserted = 0;
  let totalEmbedded = 0;

  for (const seed of seeds) {
    const result = await ingestSeed(seed, releaseId);
    totalInserted += result.inserted;
    totalEmbedded += result.embedded;
  }

  console.log("\nCountry visa RAG ingestion complete");
  console.log(`Countries ingested: ${seeds.length}`);
  console.log(`Chunks inserted: ${totalInserted}`);
  console.log(`Chunks embedded: ${totalEmbedded}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
