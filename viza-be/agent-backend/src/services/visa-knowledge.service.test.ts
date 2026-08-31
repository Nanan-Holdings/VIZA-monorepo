import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getSupabaseClient: vi.fn(),
  loggerWarn: vi.fn(),
  rpc: vi.fn(),
  runWithProviderCapacity: vi.fn(),
}));

vi.mock("../db/supabase-client.js", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

vi.mock("../utils/logger.js", () => ({
  Logger: class {
    warn = mocks.loggerWarn;
  },
}));

vi.mock("../utils/provider-capacity.js", () => ({
  runWithProviderCapacity: mocks.runWithProviderCapacity,
}));

type SupabaseResult = {
  data: unknown;
  error: { message: string } | null;
};

function queryBuilder(
  result: (signal: AbortSignal) => Promise<SupabaseResult>,
) {
  const builder = {
    abortSignal: vi.fn(result),
    eq: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    select: vi.fn(),
  };
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  return builder;
}

function waitForAbort(signal: AbortSignal): Promise<SupabaseResult> {
  return new Promise((_resolve, reject) => {
    const rejectForAbort = () => reject(signal.reason);
    if (signal.aborted) rejectForAbort();
    else signal.addEventListener("abort", rejectForAbort, { once: true });
  });
}

function embeddingResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
  };
}

async function importService() {
  return import("./visa-knowledge.service.js");
}

describe("visa knowledge request cancellation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubGlobal("fetch", vi.fn(async () => embeddingResponse()));
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getSupabaseClient.mockReturnValue({
      from: mocks.from,
      rpc: mocks.rpc,
    });
    mocks.runWithProviderCapacity.mockImplementation(
      async function run<T>(
        work: (signal: AbortSignal) => Promise<T>,
        signal?: AbortSignal,
      ): Promise<T> {
        return work(signal ?? new AbortController().signal);
      },
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not start embedding or Supabase work for an already-aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    const { retrieveVisaKnowledge } = await importService();

    await expect(
      retrieveVisaKnowledge({ query: "Singapore requirements", signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(mocks.runWithProviderCapacity).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("aborts an in-flight vector RPC and does not start filtered fallback", async () => {
    const controller = new AbortController();
    const rpcBuilder = queryBuilder(waitForAbort);
    mocks.rpc.mockReturnValue(rpcBuilder);
    const { retrieveVisaKnowledge } = await importService();

    const retrieval = retrieveVisaKnowledge({
      query: "Singapore requirements",
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(retrieval).rejects.toMatchObject({ name: "AbortError" });
    expect(rpcBuilder.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not start Supabase work after an in-flight embedding is cancelled", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) throw new Error("Embedding request signal missing");
          const rejectForAbort = () => reject(signal.reason);
          if (signal.aborted) rejectForAbort();
          else signal.addEventListener("abort", rejectForAbort, { once: true });
        }),
      ),
    );
    const { retrieveVisaKnowledge } = await importService();

    const retrieval = retrieveVisaKnowledge({
      query: "Singapore requirements",
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(retrieval).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not start a broad vector query after the filtered RPC is cancelled", async () => {
    const controller = new AbortController();
    mocks.rpc.mockImplementation(() =>
      queryBuilder(async () => {
        controller.abort();
        return { data: [], error: null };
      }),
    );
    const { retrieveVisaKnowledge } = await importService();

    await expect(
      retrieveVisaKnowledge({
        query: "Singapore requirements",
        intent: "requirements",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not start a broad REST fallback after the filtered request is cancelled", async () => {
    vi.stubEnv("OPENAI_API_KEY", "your_openai_api_key_here");
    const controller = new AbortController();
    const restBuilder = queryBuilder(async () => {
      controller.abort();
      return { data: [], error: null };
    });
    mocks.from.mockReturnValue(restBuilder);
    const { retrieveVisaKnowledge } = await importService();

    await expect(
      retrieveVisaKnowledge({
        query: "Singapore requirements",
        intent: "requirements",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(restBuilder.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("preserves filtered fallback after a non-cancellation vector failure", async () => {
    const controller = new AbortController();
    const rpcBuilder = queryBuilder(async () => ({
      data: null,
      error: { message: "temporary vector failure" },
    }));
    const restBuilder = queryBuilder(async () => ({
      data: [
        {
          id: "chunk-1",
          content: "Official requirement",
          country: "singapore",
          document_type: "requirements",
        },
      ],
      error: null,
    }));
    mocks.rpc.mockReturnValue(rpcBuilder);
    mocks.from.mockReturnValue(restBuilder);
    const { retrieveVisaKnowledge } = await importService();

    await expect(
      retrieveVisaKnowledge({
        query: "Singapore requirements",
        country: "singapore",
        signal: controller.signal,
      }),
    ).resolves.toMatchObject({
      usedEmbedding: false,
      fallbackReason: "vector_search_failed",
      chunks: [{ id: "chunk-1", content: "Official requirement" }],
    });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("does not share user query results across concurrent requests", async () => {
    const controller = new AbortController();
    mocks.rpc.mockImplementation(() =>
      queryBuilder(async () => ({
        data: [{ id: "chunk-1", content: "Official requirement" }],
        error: null,
      })),
    );
    const { retrieveVisaKnowledge } = await importService();

    await Promise.all([
      retrieveVisaKnowledge({ query: "same private query", signal: controller.signal }),
      retrieveVisaKnowledge({ query: "same private query", signal: controller.signal }),
    ]);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});
