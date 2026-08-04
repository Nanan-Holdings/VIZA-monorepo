import { createHash } from "crypto";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { VISA_SERVICE_COUNTRIES } from "../src/config/visa-destination-registry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const releaseKey = process.argv[2]?.trim();
if (!releaseKey) {
  throw new Error("Usage: npm run stage:visa-rag-supplements -- <release-key>");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openAiKey = process.env.OPENAI_API_KEY;
if (!url || !key || !openAiKey || openAiKey === "your_openai_api_key_here") {
  throw new Error("Supabase credentials and OPENAI_API_KEY are required");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const seedDirectory = path.resolve(
  __dirname,
  "../../../knowledge-base/visa-rag-seeds/countries"
);
const passportCountries = ["CHN", "SGP", "GBR", "USA", "CAN", "AUS", "NZL"];

type SourceChunk = {
  content: string;
  country: string;
  visa_type: string;
  document_type: string;
  embedding: string | number[] | null;
};

type SourceDocument = {
  id: string;
  country: string;
  visa_type: string;
  document_type: string;
  title: string;
  source_url: string;
  source_key: string;
  visa_chunks: SourceChunk[];
};

type CountrySeed = {
  version: string;
  country: string;
  documents: Array<{ sourceUrl: string }>;
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function createEmbedding(text: string): Promise<number[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text.slice(0, 8000),
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };
      const embedding = body.data?.[0]?.embedding;
      if (!embedding || embedding.length !== 1536) {
        throw new Error(`Expected 1536 dimensions, received ${embedding?.length ?? 0}`);
      }
      return embedding;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(1_000 * 2 ** (attempt - 1));
    }
  }
  throw new Error(
    `Unable to create required embedding: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

function loadCountrySeeds(): Map<string, CountrySeed> {
  const seeds = new Map<string, CountrySeed>();
  for (const fileName of fs.readdirSync(seedDirectory)) {
    if (!fileName.endsWith(".json")) continue;
    const seed = JSON.parse(
      fs.readFileSync(path.join(seedDirectory, fileName), "utf8")
    ) as CountrySeed;
    seeds.set(seed.country, seed);
  }
  return seeds;
}

async function getStagedReleaseId(): Promise<string> {
  const { data, error } = await supabase
    .from("visa_knowledge_releases")
    .select("id")
    .eq("release_key", releaseKey)
    .eq("status", "staged")
    .single();
  if (error || !data) throw new Error(`Staged release not found: ${releaseKey}`);
  return (data as { id: string }).id;
}

async function stageEntryRules(releaseId: string): Promise<number> {
  const seeds = loadCountrySeeds();
  const rows: Array<Record<string, unknown>> = [];

  for (const country of VISA_SERVICE_COUNTRIES) {
    const seed = seeds.get(country);
    const sourceUrl = seed?.documents[0]?.sourceUrl;
    if (!seed || !sourceUrl) throw new Error(`Missing official seed source for ${country}`);

    for (const passportCountry of passportCountries) {
      const isSingaporeChina = country === "singapore" && passportCountry === "CHN";
      const ruleKey = `${country}:${passportCountry}:ordinary:tourism:${seed.version}`;
      const conditions = isSingaporeChina
        ? {
            sgac_window: "within 3 days before arrival, including arrival day",
            excluded_purposes: ["work", "study", "journalism", "long_stay"],
          }
        : {
            reason:
              "Passport-specific eligibility has not yet been confirmed from an official source; the adviser must not infer an outcome.",
          };
      rows.push({
        rule_key: ruleKey,
        release_id: releaseId,
        status: "staged",
        destination_country: country,
        passport_country_iso3: passportCountry,
        passport_type: "ordinary",
        trip_purpose: "tourism",
        max_stay_days: isSingaporeChina ? 30 : null,
        outcome: isSingaporeChina ? "visa_exempt" : "unknown",
        visa_type: null,
        arrival_card_types: isSingaporeChina ? ["SG_ARRIVAL_CARD"] : [],
        conditions_json: conditions,
        source_url: isSingaporeChina
          ? "https://www.ica.gov.sg/news-and-publications/newsroom/media-release/mutual-30-day-visa-exemption-arrangement-between-singapore-and-the-people-s-republic-of-china"
          : sourceUrl,
        effective_from: isSingaporeChina ? "2024-02-09" : null,
        verified_at: new Date(`${seed.version}T00:00:00.000Z`).toISOString(),
        content_hash: hash({ ruleKey, conditions, sourceUrl }),
      });
    }
  }

  const { error: deleteError } = await supabase
    .from("visa_entry_rules")
    .delete()
    .eq("release_id", releaseId);
  if (deleteError) throw new Error(deleteError.message);
  for (let offset = 0; offset < rows.length; offset += 100) {
    const { error } = await supabase.from("visa_entry_rules").insert(rows.slice(offset, offset + 100));
    if (error) throw new Error(error.message);
  }
  const { error: releaseError } = await supabase
    .from("visa_knowledge_releases")
    .update({ expected_entry_rule_count: rows.length })
    .eq("id", releaseId);
  if (releaseError) throw new Error(releaseError.message);
  return rows.length;
}

async function loadActiveSupplements(): Promise<SourceDocument[]> {
  const { data, error } = await supabase
    .from("visa_documents")
    .select(
      "id,country,visa_type,document_type,title,source_url,source_key,visa_chunks(content,country,visa_type,document_type,embedding),visa_knowledge_releases!inner(status)"
    )
    .eq("visa_knowledge_releases.status", "active")
    .in("document_type", ["photo_requirements", "form_fields"]);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SourceDocument[];
}

async function stageSupplement(
  releaseId: string,
  document: SourceDocument
): Promise<{ chunks: number; generatedEmbeddings: number }> {
  const sourceKey =
    document.document_type === "photo_requirements"
      ? `photo:${document.country}:${document.visa_type}`
      : `ds160:${document.source_key || document.id}`;
  const now = new Date().toISOString();
  const payload = {
    country: document.country,
    visa_type: document.visa_type,
    document_type: document.document_type,
    title: document.title,
    source_url: document.source_url,
    source_key: sourceKey,
    ingestion_scope:
      document.document_type === "photo_requirements" ? "photo_seed" : "ds160_seed",
    release_id: releaseId,
    status: "staged",
    content_hash: hash(document),
    verified_at: now,
    last_synced_at: now,
  };
  const { data: existing, error: lookupError } = await supabase
    .from("visa_documents")
    .select("id")
    .eq("release_id", releaseId)
    .eq("source_key", sourceKey)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  const request = existing
    ? supabase.from("visa_documents").update(payload).eq("id", (existing as { id: string }).id)
    : supabase.from("visa_documents").insert(payload);
  const { data: staged, error } = await request.select("id").single();
  if (error || !staged) throw new Error(error?.message ?? `Unable to stage ${sourceKey}`);
  const documentId = (staged as { id: string }).id;
  const { error: chunkDeleteError } = await supabase
    .from("visa_chunks")
    .delete()
    .eq("document_id", documentId);
  if (chunkDeleteError) throw new Error(chunkDeleteError.message);

  let generatedEmbeddings = 0;
  for (const chunk of document.visa_chunks) {
    const embedding = chunk.embedding ?? (await createEmbedding(chunk.content));
    if (!chunk.embedding) generatedEmbeddings += 1;
    const { error: chunkError } = await supabase.from("visa_chunks").insert({
      document_id: documentId,
      country: chunk.country,
      visa_type: chunk.visa_type,
      document_type: chunk.document_type,
      content: chunk.content,
      embedding,
    });
    if (chunkError) throw new Error(chunkError.message);
  }
  return { chunks: document.visa_chunks.length, generatedEmbeddings };
}

async function main(): Promise<void> {
  await createEmbedding("VIZA staged supplement connectivity check");
  const releaseId = await getStagedReleaseId();
  const supplements = await loadActiveSupplements();
  let chunkCount = 0;
  let generatedEmbeddingCount = 0;
  for (const document of supplements) {
    const result = await stageSupplement(releaseId, document);
    chunkCount += result.chunks;
    generatedEmbeddingCount += result.generatedEmbeddings;
  }
  const ruleCount = await stageEntryRules(releaseId);
  console.log(
    JSON.stringify({
      releaseKey,
      supplementalDocuments: supplements.length,
      supplementalChunks: chunkCount,
      generatedEmbeddings: generatedEmbeddingCount,
      entryRules: ruleCount,
    })
  );
}

await main();
