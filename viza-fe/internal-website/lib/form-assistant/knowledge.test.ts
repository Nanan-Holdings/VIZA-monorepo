import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearFormAssistantKnowledgeCacheForTests,
  loadApplicationKnowledge,
} from "./knowledge";

function createAdmin(options?: {
  releaseResponses?: Array<{
    data: { id: string } | null;
    error: { message: string } | null;
  }>;
  documentResponses?: Array<{
    data: Array<{ id: string; title: string | null; source_url: string | null }>;
    error: { message: string } | null;
  }>;
}) {
  const releaseMaybeSingle = vi.fn()
    .mockResolvedValue({ data: { id: "release-id" }, error: null });
  for (const response of options?.releaseResponses ?? []) {
    releaseMaybeSingle.mockResolvedValueOnce(response);
  }

  const releaseBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: releaseMaybeSingle,
  };
  releaseBuilder.select.mockReturnValue(releaseBuilder);
  releaseBuilder.eq.mockReturnValue(releaseBuilder);

  const documentResponse = {
    data: [{ id: "document-id", title: "Official guide", source_url: "https://official.example/guide" }],
    error: null,
  };
  const documentLimit = vi.fn().mockResolvedValue(documentResponse);
  for (const response of options?.documentResponses ?? []) {
    documentLimit.mockResolvedValueOnce(response);
  }
  const documentBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    limit: documentLimit,
  };
  documentBuilder.select.mockReturnValue(documentBuilder);
  documentBuilder.eq.mockReturnValue(documentBuilder);
  documentBuilder.ilike.mockReturnValue(documentBuilder);

  const chunkResponse = {
    data: [{ content: "Reviewed public requirement", document_type: "requirements" }],
    error: null,
  };
  const chunkBuilder = {
    select: vi.fn(),
    in: vi.fn(),
    limit: vi.fn().mockResolvedValue(chunkResponse),
  };
  chunkBuilder.select.mockReturnValue(chunkBuilder);
  chunkBuilder.in.mockReturnValue(chunkBuilder);

  const from = vi.fn((table: string) => {
    if (table === "visa_knowledge_releases") return releaseBuilder;
    if (table === "visa_documents") return documentBuilder;
    if (table === "visa_chunks") return chunkBuilder;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    admin: { from } as unknown as SupabaseClient,
    chunkBuilder,
    documentBuilder,
    from,
    releaseMaybeSingle,
  };
}

describe("form assistant public knowledge cache", () => {
  beforeEach(() => {
    vi.useRealTimers();
    clearFormAssistantKnowledgeCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces one hundred cold callers into three Supabase reads", async () => {
    const mocks = createAdmin();
    const params = {
      admin: mocks.admin,
      releaseKey: "release-2026-09",
      country: "Singapore",
      visaType: "SG_ARRIVAL_CARD",
    };

    const results = await Promise.all(
      Array.from({ length: 100 }, () => loadApplicationKnowledge(params)),
    );

    expect(results.every((result) => result.context === "Reviewed public requirement")).toBe(true);
    expect(mocks.releaseMaybeSingle).toHaveBeenCalledTimes(1);
    expect(mocks.documentBuilder.limit).toHaveBeenCalledTimes(1);
    expect(mocks.chunkBuilder.limit).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledTimes(3);
  });

  it("normalizes public product keys without sharing mutable source arrays", async () => {
    const mocks = createAdmin();
    const first = await loadApplicationKnowledge({
      admin: mocks.admin,
      releaseKey: "release-2026-09",
      country: "Singapore",
      visaType: "sg_arrival_card",
    });
    first.sources.push({ title: "Caller mutation", url: null });

    const second = await loadApplicationKnowledge({
      admin: mocks.admin,
      releaseKey: "release-2026-09",
      country: " singapore ",
      visaType: "SG_ARRIVAL_CARD",
    });

    expect(second.sources).toEqual([
      { title: "Official guide", url: "https://official.example/guide" },
    ]);
    expect(mocks.releaseMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it("keeps countries, products, and releases in separate cache entries", async () => {
    const mocks = createAdmin();
    const variants = [
      { releaseKey: "release-a", country: "Singapore", visaType: "SG_ARRIVAL_CARD" },
      { releaseKey: "release-a", country: "Malaysia", visaType: "MY_MDAC_ARRIVAL_CARD" },
      { releaseKey: "release-a", country: "Singapore", visaType: "SG_E_VISA" },
      { releaseKey: "release-b", country: "Singapore", visaType: "SG_ARRIVAL_CARD" },
    ];

    await Promise.all(variants.map((variant) => loadApplicationKnowledge({
      admin: mocks.admin,
      ...variant,
    })));

    expect(mocks.releaseMaybeSingle).toHaveBeenCalledTimes(2);
    expect(mocks.documentBuilder.limit).toHaveBeenCalledTimes(4);
    expect(mocks.chunkBuilder.limit).toHaveBeenCalledTimes(4);
  });

  it("revalidates the active release after five seconds while reusing public content", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const mocks = createAdmin();
    const params = {
      admin: mocks.admin,
      releaseKey: "release-2026-09",
      country: "Singapore",
      visaType: "SG_ARRIVAL_CARD",
    };

    await loadApplicationKnowledge(params);
    vi.setSystemTime(new Date(6_000));
    const refreshedGate = await loadApplicationKnowledge(params);

    expect(refreshedGate.context).toBe("Reviewed public requirement");
    expect(mocks.releaseMaybeSingle).toHaveBeenCalledTimes(2);
    expect(mocks.documentBuilder.limit).toHaveBeenCalledTimes(1);
    expect(mocks.chunkBuilder.limit).toHaveBeenCalledTimes(1);
  });

  it("stops serving a deactivated release at the five-second freshness boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const mocks = createAdmin();
    const params = {
      admin: mocks.admin,
      releaseKey: "release-2026-09",
      country: "Singapore",
      visaType: "SG_ARRIVAL_CARD",
    };

    await loadApplicationKnowledge(params);
    mocks.releaseMaybeSingle.mockResolvedValue({ data: null, error: null });
    vi.setSystemTime(new Date(4_999));
    const stillFresh = await loadApplicationKnowledge(params);
    vi.setSystemTime(new Date(5_000));
    const deactivated = await loadApplicationKnowledge(params);

    expect(stillFresh.context).toBe("Reviewed public requirement");
    expect(deactivated.context).toBe("");
    expect(deactivated.sources).toHaveLength(1);
    expect(mocks.releaseMaybeSingle).toHaveBeenCalledTimes(2);
    expect(mocks.documentBuilder.limit).toHaveBeenCalledTimes(1);
  });

  it("does not retain a transient database failure", async () => {
    const mocks = createAdmin({
      releaseResponses: [
        { data: null, error: { message: "temporarily unavailable" } },
        { data: { id: "release-id" }, error: null },
      ],
    });
    const params = {
      admin: mocks.admin,
      releaseKey: "release-2026-09",
      country: "Singapore",
      visaType: "SG_ARRIVAL_CARD",
    };

    const degraded = await loadApplicationKnowledge(params);
    const recovered = await loadApplicationKnowledge(params);

    expect(degraded.context).toBe("");
    expect(degraded.sources).toHaveLength(1);
    expect(recovered.context).toBe("Reviewed public requirement");
    expect(mocks.releaseMaybeSingle).toHaveBeenCalledTimes(2);
  });

  it("does not retain an incomplete release with no documents", async () => {
    const mocks = createAdmin({
      documentResponses: [
        { data: [], error: null },
        {
          data: [{
            id: "document-id",
            title: "Official guide",
            source_url: "https://official.example/guide",
          }],
          error: null,
        },
      ],
    });
    const params = {
      admin: mocks.admin,
      releaseKey: "release-2026-09",
      country: "Singapore",
      visaType: "SG_ARRIVAL_CARD",
    };

    const incomplete = await loadApplicationKnowledge(params);
    const recovered = await loadApplicationKnowledge(params);

    expect(incomplete.context).toBe("");
    expect(recovered.context).toBe("Reviewed public requirement");
    expect(mocks.releaseMaybeSingle).toHaveBeenCalledTimes(1);
    expect(mocks.documentBuilder.limit).toHaveBeenCalledTimes(2);
    expect(mocks.chunkBuilder.limit).toHaveBeenCalledTimes(1);
  });

  it("does not query Supabase or cache user-scoped data without a release key", async () => {
    const mocks = createAdmin();

    const result = await loadApplicationKnowledge({
      admin: mocks.admin,
      releaseKey: null,
      country: "Singapore",
      visaType: "SG_ARRIVAL_CARD",
    });

    expect(result.context).toBe("");
    expect(result.sources).toHaveLength(1);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
