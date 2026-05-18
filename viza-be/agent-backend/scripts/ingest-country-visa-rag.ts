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
}

function normalizeCountry(value: string): string {
  return value.trim().toLowerCase();
}

function parseArgs(argv: string[]): CliOptions {
  const countries = new Set<string>();
  let listOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all") continue;

    if (arg === "--list") {
      listOnly = true;
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

async function deleteExistingDocument(document: RagDocument): Promise<void> {
  const { data: existingDocs, error } = await supabase
    .from("visa_documents")
    .select("id")
    .eq("country", document.country)
    .eq("visa_type", document.visaType)
    .eq("document_type", document.documentType)
    .eq("source_url", document.sourceUrl)
    .eq("title", document.title);

  if (error) {
    throw new Error(`Failed to query existing document: ${error.message}`);
  }

  for (const existing of existingDocs ?? []) {
    const id = (existing as { id: string }).id;
    const { error: chunkDeleteError } = await supabase
      .from("visa_chunks")
      .delete()
      .eq("document_id", id);

    if (chunkDeleteError) {
      throw new Error(
        `Failed to delete existing chunks for ${id}: ${chunkDeleteError.message}`
      );
    }

    const { error: documentDeleteError } = await supabase
      .from("visa_documents")
      .delete()
      .eq("id", id);

    if (documentDeleteError) {
      throw new Error(
        `Failed to delete existing document ${id}: ${documentDeleteError.message}`
      );
    }
  }
}

async function ingestDocument(document: RagDocument): Promise<{
  inserted: number;
  embedded: number;
}> {
  await deleteExistingDocument(document);

  const { data: insertedDocument, error: documentError } = await supabase
    .from("visa_documents")
    .insert({
      country: document.country,
      visa_type: document.visaType,
      document_type: document.documentType,
      title: document.title,
      source_url: document.sourceUrl,
    })
    .select("id")
    .single();

  if (documentError || !insertedDocument) {
    throw new Error(
      `Failed to insert document ${document.slug}: ${documentError?.message}`
    );
  }

  const documentId = (insertedDocument as { id: string }).id;
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

async function ingestSeed(seed: CountryRagSeed): Promise<{
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
    const result = await ingestDocument(document);
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

  console.log("Starting country visa RAG ingestion");
  console.log(`Seed directory: ${SEED_DIR}`);
  console.log(`Countries: ${seeds.length}`);
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
    const result = await ingestSeed(seed);
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
