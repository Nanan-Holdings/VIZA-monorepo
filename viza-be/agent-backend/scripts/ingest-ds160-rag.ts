/**
 * RAG ingestion: DS-160 knowledge base
 * Parses RAG_CHUNKS.md + APPLICATION_FLOW.md → visa_documents + visa_chunks
 * Run: npm run ingest:ds160-rag
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VAULT_BASE = path.resolve(__dirname, "../../../../../Documents/Vault/Projects/VIZA/DS160");

// ─── Parse RAG_CHUNKS.md ──────────────────────────────────────────────────────
interface RagChunk {
  id: string;
  tags: string[];
  title: string;
  content: string;
}

function parseRagChunks(filePath: string): RagChunk[] {
  const text = fs.readFileSync(filePath, "utf-8");
  const chunkBlocks = text.split(/\n---\n/).filter(Boolean);
  const chunks: RagChunk[] = [];

  for (const block of chunkBlocks) {
    const idMatch = block.match(/\*\*id:\*\*\s*(\S+)/);
    const tagsMatch = block.match(/\*\*tags:\*\*\s*(.+)/);
    const titleMatch = block.match(/\*\*title:\*\*\s*(.+)/);
    const headerMatch = block.match(/^## CHUNK:\s*(\w+)/m);

    if (!idMatch && !headerMatch) continue;

    const id = idMatch?.[1] ?? (headerMatch?.[1] ? `ds160_${headerMatch[1]}` : "unknown");
    const tags = tagsMatch
      ? tagsMatch[1].split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    const title = titleMatch?.[1]?.trim() ?? id;

    // Content: everything after the header lines
    const contentStart = block.indexOf("\n\n");
    const rawContent = contentStart > 0 ? block.slice(contentStart).trim() : block.trim();

    // Strip markdown header lines from content
    const content = rawContent
      .replace(/^\*\*id:\*\*.*$/m, "")
      .replace(/^\*\*tags:\*\*.*$/m, "")
      .replace(/^\*\*title:\*\*.*$/m, "")
      .replace(/^## CHUNK:.*$/m, "")
      .trim();

    if (content.length > 20) {
      chunks.push({ id, tags, title, content });
    }
  }

  return chunks;
}

// ─── Parse APPLICATION_FLOW.md ────────────────────────────────────────────────
function parseApplicationFlow(filePath: string): RagChunk[] {
  const text = fs.readFileSync(filePath, "utf-8");
  return [
    {
      id: "ds160_app_flow_full",
      tags: ["flow", "process", "steps", "end-to-end", "interview", "appointment"],
      title: "US Nonimmigrant Visa Application Flow — Complete Process",
      content: text.trim(),
    },
  ];
}

// ─── OpenAI Embedding ─────────────────────────────────────────────────────────
async function getEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_KEY || OPENAI_KEY === "your_openai_api_key_here") {
    return null; // Deferred — will be null in DB, can backfill later
  }
  try {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000), // API max
      }),
    });
    const data = (await resp.json()) as { data?: Array<{ embedding: number[] }> };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ─── Main Ingest ──────────────────────────────────────────────────────────────
async function ingest() {
  console.log("Starting DS-160 RAG ingestion...\n");

  // 1. Parse source files
  const ragChunks = parseRagChunks(path.join(VAULT_BASE, "RAG_CHUNKS.md"));
  const flowChunks = parseApplicationFlow(path.join(VAULT_BASE, "APPLICATION_FLOW.md"));
  const allChunks = [...ragChunks, ...flowChunks];

  console.log(`Parsed ${ragChunks.length} chunks from RAG_CHUNKS.md`);
  console.log(`Parsed ${flowChunks.length} chunks from APPLICATION_FLOW.md`);
  console.log(`Total: ${allChunks.length} chunks\n`);

  // 2. Upsert visa_document record
  const { data: docData, error: docError } = await supabase
    .from("visa_documents")
    .upsert(
      {
        country: "us",
        visa_type: "DS160",
        document_type: "form_fields",
        title: "DS-160 Nonimmigrant Visa Application — Complete Knowledge Base",
        source_url: "https://ceac.state.gov/genniv/",
      },
      { onConflict: "id" }
    )
    .select("id")
    .single();

  // Try to find existing doc if upsert conflict
  let documentId: string;
  if (docError || !docData) {
    console.log("Checking for existing visa_document...");
    const { data: existing } = await supabase
      .from("visa_documents")
      .select("id")
      .eq("visa_type", "DS160")
      .eq("country", "us")
      .single();
    if (!existing) {
      // Insert fresh
      const { data: inserted, error: insertErr } = await supabase
        .from("visa_documents")
        .insert({
          country: "us",
          visa_type: "DS160",
          document_type: "form_fields",
          title: "DS-160 Nonimmigrant Visa Application — Complete Knowledge Base",
          source_url: "https://ceac.state.gov/genniv/",
        })
        .select("id")
        .single();
      if (insertErr || !inserted) {
        console.error("Failed to create visa_document:", insertErr?.message);
        process.exit(1);
      }
      documentId = inserted.id;
    } else {
      documentId = existing.id;
    }
  } else {
    documentId = docData.id;
  }

  console.log(`Document ID: ${documentId}\n`);

  // 3. Insert chunks with embeddings
  const embedEnabled = !!(OPENAI_KEY && OPENAI_KEY !== "your_openai_api_key_here");
  console.log(`Embeddings: ${embedEnabled ? "enabled (text-embedding-3-small)" : "DISABLED — OPENAI_API_KEY not set, chunks stored without embedding"}\n`);

  let inserted = 0;
  let failed = 0;

  for (const chunk of allChunks) {
    const textForEmbed = `${chunk.title}\n\n${chunk.content}`;
    const embedding = await getEmbedding(textForEmbed);

    const chunkRow: Record<string, unknown> = {
      document_id: documentId,
      country: "us",
      visa_type: "DS160",
      document_type: "form_fields",
      content: `# ${chunk.title}\n\n${chunk.content}`,
    };
    if (embedding) chunkRow.embedding = embedding;

    const { error } = await supabase.from("visa_chunks").insert(chunkRow);

    if (error) {
      console.error(`  ✗ ${chunk.id}: ${error.message}`);
      failed++;
    } else {
      process.stdout.write(`  ✓ ${chunk.id} (${chunk.content.length} chars${embedding ? ", embedded" : ""})\n`);
      inserted++;
    }
  }

  console.log(`\n✅ Ingestion complete:`);
  console.log(`   Inserted: ${inserted} chunks`);
  console.log(`   Failed:   ${failed} chunks`);
  if (!embedEnabled) {
    console.log(`   ⚠️  Set OPENAI_API_KEY in .env and re-run to add embeddings`);
  }
}

ingest().catch((err) => { console.error(err); process.exit(1); });
