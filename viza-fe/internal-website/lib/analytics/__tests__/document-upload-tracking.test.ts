import { afterEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics/events")>();
  return { ...actual, track };
});

import { uploadApplicationDocumentFromClient } from "@/lib/document-upload-client";

function form(documentType: string) {
  const data = new FormData();
  data.set("applicationId", "3f2b8c1e-9a4d-4c2b-8e1f-0a1b2c3d4e5f");
  data.set("documentType", documentType);
  data.set("file", new File(["x"], "zhang-san-passport.jpg", { type: "image/jpeg" }));
  return data;
}

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  track.mockClear();
});

describe("documents_uploaded tracking", () => {
  it("sends count and type only after a successful upload", async () => {
    mockFetch({ ok: true, storagePath: "a/b.jpg", filename: "zhang-san-passport.jpg" });
    await uploadApplicationDocumentFromClient(form("passport_copy"));
    expect(track).toHaveBeenCalledTimes(1);
    const [name, props] = track.mock.calls[0];
    expect(name).toBe("documents_uploaded");
    expect(props).toMatchObject({ count: 1, doc_types: ["passport_copy"] });
    expect(JSON.stringify(props)).not.toContain("zhang");
    expect(JSON.stringify(props)).not.toContain("3f2b8c1e");
  });

  it("reports free-text document types as other", async () => {
    mockFetch({ ok: true, storagePath: "a/b.jpg", filename: "f.jpg" });
    await uploadApplicationDocumentFromClient(form("Letter from Zhang San's employer"));
    expect(track.mock.calls[0][1]).toMatchObject({ doc_types: ["other"] });
  });

  it("does not track failed uploads", async () => {
    mockFetch({ ok: false, code: "invalid_request", error: "bad" }, 400);
    await uploadApplicationDocumentFromClient(form("passport_copy"));
    expect(track).not.toHaveBeenCalled();
  });
});
