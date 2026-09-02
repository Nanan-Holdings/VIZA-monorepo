import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BoundedSingleFlightCache } from "@/lib/static-visa-metadata-cache";
import type { FormAssistantSource } from "@/types/form-assistant";
import { getFormAssistantFallbackSources } from "./constants";

const FORM_ASSISTANT_KNOWLEDGE_CACHE_MAX_ENTRIES = 64;
const FORM_ASSISTANT_KNOWLEDGE_CACHE_TTL_MS = 60_000;
const FORM_ASSISTANT_ACTIVE_RELEASE_CACHE_TTL_MS = 5_000;

type CachedApplicationKnowledge = {
  context: string;
  sources: ReadonlyArray<Readonly<FormAssistantSource>>;
};

type ReleaseRow = {
  id: string;
};

type DocumentRow = {
  id: string;
  title: string | null;
  source_url: string | null;
};

type ChunkRow = {
  content: string;
};

const applicationKnowledgeCache =
  new BoundedSingleFlightCache<CachedApplicationKnowledge>(
    FORM_ASSISTANT_KNOWLEDGE_CACHE_MAX_ENTRIES,
    FORM_ASSISTANT_KNOWLEDGE_CACHE_TTL_MS,
  );
const activeReleaseCache = new BoundedSingleFlightCache<ReleaseRow>(
  FORM_ASSISTANT_KNOWLEDGE_CACHE_MAX_ENTRIES,
  FORM_ASSISTANT_ACTIVE_RELEASE_CACHE_TTL_MS,
);

class UncacheableKnowledgeError extends Error {
  constructor(readonly knowledge: CachedApplicationKnowledge) {
    super("Form assistant knowledge is not ready");
  }
}

function cloneSources(
  sources: ReadonlyArray<Readonly<FormAssistantSource>>,
): FormAssistantSource[] {
  return sources.map((source) => ({ ...source }));
}

function cloneKnowledge(
  knowledge: CachedApplicationKnowledge,
): { context: string; sources: FormAssistantSource[] } {
  return {
    context: knowledge.context,
    sources: cloneSources(knowledge.sources),
  };
}

function knowledgeCacheKey(params: {
  releaseId: string;
  releaseKey: string;
  country: string;
  visaType: string;
}): string {
  return JSON.stringify([
    "form-assistant-knowledge-v1",
    params.releaseId,
    params.releaseKey.trim(),
    params.country.trim().toLowerCase(),
    params.visaType.trim().toUpperCase(),
  ]);
}

function releaseCacheKey(releaseKey: string): string {
  return JSON.stringify(["form-assistant-active-release-v1", releaseKey.trim()]);
}

async function loadActiveRelease(
  admin: SupabaseClient,
  releaseKey: string,
): Promise<ReleaseRow> {
  const releaseResponse = await admin
    .from("visa_knowledge_releases")
    .select("id")
    .eq("release_key", releaseKey)
    .eq("status", "active")
    .maybeSingle();
  if (releaseResponse.error || !releaseResponse.data) {
    // Missing and failed lookups remain immediately retryable. A short
    // success-only cache bounds promotion staleness to five seconds.
    throw new Error("Form assistant active knowledge release is unavailable");
  }
  return releaseResponse.data as ReleaseRow;
}

async function loadUncachedApplicationKnowledge(params: {
  admin: SupabaseClient;
  releaseId: string;
  releaseKey: string;
  country: string;
  visaType: string;
  fallbackSources: FormAssistantSource[];
}): Promise<CachedApplicationKnowledge> {
  const documentResponse = await params.admin
    .from("visa_documents")
    .select("id, title, source_url")
    .eq("release_id", params.releaseId)
    .ilike("country", params.country)
    .ilike("visa_type", params.visaType)
    .limit(5);
  if (documentResponse.error) {
    throw new Error("Form assistant knowledge document lookup failed");
  }
  const documents = (documentResponse.data ?? []) as DocumentRow[];
  const documentIds = documents.map((document) => document.id);
  if (documentIds.length === 0) {
    throw new UncacheableKnowledgeError({
      context: "",
      sources: cloneSources(params.fallbackSources),
    });
  }

  const chunkResponse = await params.admin
    .from("visa_chunks")
    .select("content, document_type")
    .in("document_id", documentIds)
    .in("document_type", ["form_requirements", "requirements", "process", "faq"])
    .limit(8);
  if (chunkResponse.error) {
    throw new Error("Form assistant knowledge chunk lookup failed");
  }
  const chunks = (chunkResponse.data ?? []) as ChunkRow[];
  const sources = documents
    .map((document) => ({
      title: document.title || "Official source",
      url: document.source_url,
    }))
    .filter((source, index, list) => list.findIndex(
      (item) => item.url === source.url && item.title === source.title,
    ) === index);

  const knowledge = {
    context: chunks.map((chunk) => chunk.content.slice(0, 900)).join("\n\n"),
    sources: sources.length > 0 ? sources : cloneSources(params.fallbackSources),
  };
  if (chunks.length === 0) {
    throw new UncacheableKnowledgeError(knowledge);
  }
  return knowledge;
}

export async function loadApplicationKnowledge(params: {
  admin: SupabaseClient;
  releaseKey: string | null;
  country: string;
  visaType: string;
}): Promise<{ context: string; sources: FormAssistantSource[] }> {
  const fallbackSources = getFormAssistantFallbackSources(params.country, params.visaType);
  const releaseKey = params.releaseKey?.trim();
  if (!releaseKey) {
    return { context: "", sources: cloneSources(fallbackSources) };
  }

  try {
    const release = await activeReleaseCache.getOrCreate(
      releaseCacheKey(releaseKey),
      () => loadActiveRelease(params.admin, releaseKey),
    );
    const result = await applicationKnowledgeCache.getOrCreate(
      knowledgeCacheKey({ ...params, releaseId: release.value.id, releaseKey }),
      () => loadUncachedApplicationKnowledge({
        ...params,
        releaseId: release.value.id,
        releaseKey,
        fallbackSources,
      }),
    );
    return cloneKnowledge(result.value);
  } catch (error) {
    if (error instanceof UncacheableKnowledgeError) {
      return cloneKnowledge(error.knowledge);
    }
    // Preserve the assistant's availability while ensuring a transient database
    // failure is never retained in the shared cache.
    return { context: "", sources: cloneSources(fallbackSources) };
  }
}

export function clearFormAssistantKnowledgeCacheForTests(): void {
  applicationKnowledgeCache.clear();
  activeReleaseCache.clear();
}
