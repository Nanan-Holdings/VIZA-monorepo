/**
 * RAG ingestion: U.S. visitor visa knowledge base
 * Reads knowledge-base/us-visa-rag.json -> visa_documents + visa_chunks.
 *
 * Run:
 *   npm run ingest:us-visa-rag
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

interface RagSource {
  version: string;
  notes: string;
  documents: RagDocument[];
}

function readSource(): RagSource {
  const sourcePath = path.resolve(__dirname, "../../../knowledge-base/us-visa-rag.json");
  const raw = fs.readFileSync(sourcePath, "utf-8");
  return JSON.parse(raw) as RagSource;
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
      `  - ${chunk.id} (${content.length} chars${embedding ? ", embedded" : ""})\n`
    );
  }

  return { inserted, embedded };
}

async function main(): Promise<void> {
  const source = readSource();
  console.log("Starting U.S. visa RAG ingestion");
  console.log(`Source version: ${source.version}`);
  console.log(`Documents: ${source.documents.length}`);
  console.log(
    `Embeddings: ${
      OPENAI_KEY && OPENAI_KEY !== "your_openai_api_key_here"
        ? `enabled (${EMBEDDING_MODEL})`
        : "disabled (chunks will still be inserted for filtered fallback)"
    }\n`
  );

  let totalInserted = 0;
  let totalEmbedded = 0;

  for (const document of source.documents) {
    console.log(`Ingesting: ${document.title}`);
    const result = await ingestDocument(document);
    totalInserted += result.inserted;
    totalEmbedded += result.embedded;
  }

  console.log("\nU.S. visa RAG ingestion complete");
  console.log(`Chunks inserted: ${totalInserted}`);
  console.log(`Chunks embedded: ${totalEmbedded}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
