import { describe, expect, it, vi } from "vitest";
import {
  loadStatusStorageUrls,
  type StatusStorageTarget,
} from "./status-storage-urls";

type SignedEntry = {
  path: string | null;
  signedUrl: string | null;
  error: string | null;
};

type SignedBatchResponse = {
  data: SignedEntry[] | null;
  error: unknown;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function signedEntries(bucket: string, paths: string[]): SignedEntry[] {
  return paths.map((path) => ({
    path,
    signedUrl: `https://signed.example.test/${bucket}/${path}`,
    error: null,
  }));
}

function batchResult(bucket: string, paths: string[]): SignedBatchResponse {
  return { data: signedEntries(bucket, paths), error: null };
}

describe("loadStatusStorageUrls", () => {
  it("deduplicates targets while keeping buckets separate", async () => {
    const signBatch = vi.fn(async (bucket: string, paths: string[]) =>
      batchResult(bucket, paths));
    const targets: StatusStorageTarget[] = [
      { bucket: "application-documents", path: "receipt.pdf" },
      { bucket: "application-documents", path: "receipt.pdf" },
      { bucket: "application-documents", path: "packet.zip" },
      { bucket: "submission-artifacts", path: "receipt.pdf" },
    ];

    const urls = await loadStatusStorageUrls(targets, signBatch);

    expect(signBatch).toHaveBeenCalledTimes(2);
    expect(signBatch).toHaveBeenNthCalledWith(
      1,
      "application-documents",
      ["receipt.pdf", "packet.zip"],
      3_600,
    );
    expect(signBatch).toHaveBeenNthCalledWith(
      2,
      "submission-artifacts",
      ["receipt.pdf"],
      3_600,
    );
    expect(urls.get("application-documents")?.size).toBe(2);
    expect(urls.get("submission-artifacts")?.get("receipt.pdf")).toBe(
      "https://signed.example.test/submission-artifacts/receipt.pdf",
    );
  });

  it("splits one bucket into batches of at most one hundred paths", async () => {
    const signBatch = vi.fn(async (bucket: string, paths: string[]) =>
      batchResult(bucket, paths));
    const targets = Array.from({ length: 205 }, (_, index) => ({
      bucket: "application-results",
      path: `result-${index}.pdf`,
    }));

    const urls = await loadStatusStorageUrls(targets, signBatch);

    expect(signBatch).toHaveBeenCalledTimes(3);
    expect(signBatch.mock.calls.map((call) => call[1].length)).toEqual([100, 100, 5]);
    expect(urls.get("application-results")?.get("result-204.pdf")).toBeDefined();
  });

  it("omits entry failures, malformed paths, and failed batches without retrying", async () => {
    const signBatch = vi.fn(async (bucket: string, paths: string[]) => {
      if (bucket === "failed-bucket") {
        throw new Error("synthetic signing failure");
      }
      return {
        data: [
          { path: paths[0] ?? null, signedUrl: "https://signed.example.test/ok", error: null },
          { path: paths[1] ?? null, signedUrl: null, error: "missing object" },
          { path: "unrequested.txt", signedUrl: "https://signed.example.test/wrong", error: null },
        ],
        error: null,
      } satisfies SignedBatchResponse;
    });
    const targets: StatusStorageTarget[] = [
      { bucket: "application-results", path: "ok.pdf" },
      { bucket: "application-results", path: "missing.pdf" },
      { bucket: "failed-bucket", path: "never-signed.pdf" },
    ];

    const urls = await loadStatusStorageUrls(targets, signBatch);

    expect(signBatch).toHaveBeenCalledTimes(2);
    expect(urls.get("application-results")).toEqual(
      new Map([["ok.pdf", "https://signed.example.test/ok"]]),
    );
    expect(urls.has("failed-bucket")).toBe(false);
  });

  it("keeps at most two batches in flight for each loader invocation", async () => {
    let active = 0;
    let maximumActive = 0;
    let callCount = 0;
    const releaseFirstBatches = createDeferred<void>();
    const signBatch = vi.fn(async (bucket: string, paths: string[]) => {
      callCount += 1;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      if (callCount <= 2) await releaseFirstBatches.promise;
      active -= 1;
      return batchResult(bucket, paths);
    });
    const targets = Array.from({ length: 205 }, (_, index) => ({
      bucket: "application-results",
      path: `result-${index}.pdf`,
    }));

    const pending = loadStatusStorageUrls(targets, signBatch);
    await Promise.resolve();
    await Promise.resolve();
    expect(signBatch).toHaveBeenCalledTimes(2);
    expect(maximumActive).toBe(2);

    releaseFirstBatches.resolve();
    await pending;
    expect(signBatch).toHaveBeenCalledTimes(3);
    expect(maximumActive).toBe(2);
  });

  it("keeps concurrent loader invocations isolated", async () => {
    const firstSignBatch = vi.fn(async (bucket: string, paths: string[]) => ({
      data: signedEntries("first-" + bucket, paths),
      error: null,
    }));
    const secondSignBatch = vi.fn(async (bucket: string, paths: string[]) => ({
      data: signedEntries("second-" + bucket, paths),
      error: null,
    }));
    const targets: StatusStorageTarget[] = [
      { bucket: "application-results", path: "result.pdf" },
    ];

    const [first, second] = await Promise.all([
      loadStatusStorageUrls(targets, firstSignBatch),
      loadStatusStorageUrls(targets, secondSignBatch),
    ]);

    expect(first.get("application-results")?.get("result.pdf")).toBe(
      "https://signed.example.test/first-application-results/result.pdf",
    );
    expect(second.get("application-results")?.get("result.pdf")).toBe(
      "https://signed.example.test/second-application-results/result.pdf",
    );
    expect(firstSignBatch).toHaveBeenCalledOnce();
    expect(secondSignBatch).toHaveBeenCalledOnce();
  });
});
