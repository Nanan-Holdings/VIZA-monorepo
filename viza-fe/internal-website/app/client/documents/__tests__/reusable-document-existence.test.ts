import { describe, expect, it, vi } from "vitest";

import { loadExistingDocumentPaths } from "../reusable-document-existence";

type ExistsResult = { data: boolean | null; error: unknown };

describe("loadExistingDocumentPaths", () => {
  it("deduplicates exact paths and keeps at most four checks in flight", async () => {
    const started: string[] = [];
    let active = 0;
    let peak = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const exists = vi.fn(async (path: string): Promise<ExistsResult> => {
      started.push(path);
      active += 1;
      peak = Math.max(peak, active);
      await gate;
      active -= 1;
      return { data: true, error: null };
    });

    const loading = loadExistingDocumentPaths(
      [
        "documents/a.pdf",
        " documents/a.pdf ",
        "documents/a.pdf",
        "documents/b.pdf",
        "documents/c.pdf",
        "documents/d.pdf",
        "documents/e.pdf",
        "documents/b.pdf",
      ],
      exists,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(exists).toHaveBeenCalledTimes(4);
    expect(started).toEqual([
      "documents/a.pdf",
      " documents/a.pdf ",
      "documents/b.pdf",
      "documents/c.pdf",
    ]);

    release();
    await expect(loading).resolves.toEqual(
      new Set([
        "documents/a.pdf",
        " documents/a.pdf ",
        "documents/b.pdf",
        "documents/c.pdf",
        "documents/d.pdf",
        "documents/e.pdf",
      ]),
    );
    expect(peak).toBe(4);
    expect(started).toEqual([
      "documents/a.pdf",
      " documents/a.pdf ",
      "documents/b.pdf",
      "documents/c.pdf",
      "documents/d.pdf",
      "documents/e.pdf",
    ]);
  });

  it("omits false and SDK-error responses while retaining successful paths", async () => {
    const exists = vi.fn(async (path: string): Promise<ExistsResult> => {
      if (path === "missing.pdf") return { data: false, error: null };
      if (path === "error.pdf") return { data: null, error: new Error("HEAD failed") };
      return { data: true, error: null };
    });

    await expect(
      loadExistingDocumentPaths(
        ["present.pdf", "missing.pdf", "error.pdf", "present.pdf"],
        exists,
      ),
    ).resolves.toEqual(new Set(["present.pdf"]));
    expect(exists).toHaveBeenCalledTimes(3);
  });

  it("keeps each invocation request-local", async () => {
    let readCount = 0;
    const exists = vi.fn(async (): Promise<ExistsResult> => {
      readCount += 1;
      return { data: readCount === 1, error: null };
    });

    const first = await loadExistingDocumentPaths(["shared.pdf"], exists);
    first.add("only-in-first-result.pdf");
    const second = await loadExistingDocumentPaths(["shared.pdf"], exists);

    expect(first).toEqual(new Set(["shared.pdf", "only-in-first-result.pdf"]));
    expect(second).toEqual(new Set());
    expect(second.has("only-in-first-result.pdf")).toBe(false);
    expect(exists).toHaveBeenCalledTimes(2);
  });

  it("does not call Storage when no paths are provided", async () => {
    const exists = vi.fn(async (): Promise<ExistsResult> => ({ data: true, error: null }));

    await expect(loadExistingDocumentPaths([], exists)).resolves.toEqual(new Set());
    expect(exists).not.toHaveBeenCalled();
  });

  it("stops queued work, drains in-flight checks, and rethrows an undefined rejection", async () => {
    const started: string[] = [];
    const heldResolvers: Array<(value: ExistsResult) => void> = [];
    const exists = vi.fn((path: string): Promise<ExistsResult> => {
      started.push(path);
      if (path === "reject.pdf") return Promise.reject(undefined);
      return new Promise<ExistsResult>((resolve) => {
        heldResolvers.push(resolve);
      });
    });

    let settled = false;
    const loading = loadExistingDocumentPaths(
      ["reject.pdf", "held-1.pdf", "held-2.pdf", "held-3.pdf", "queued.pdf"],
      exists,
    ).catch((error: unknown) => {
      settled = true;
      throw error;
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(started).toEqual(["reject.pdf", "held-1.pdf", "held-2.pdf", "held-3.pdf"]);
    expect(settled).toBe(false);

    for (const resolve of heldResolvers) {
      resolve({ data: true, error: null });
    }

    await expect(loading).rejects.toBeUndefined();
    expect(settled).toBe(true);
    expect(started).not.toContain("queued.pdf");
  });
});
