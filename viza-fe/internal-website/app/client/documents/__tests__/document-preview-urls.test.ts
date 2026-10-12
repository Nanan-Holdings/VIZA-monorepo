import { describe, expect, it, vi } from "vitest";

import { loadDocumentPreviewUrls } from "../document-preview-urls";

describe("loadDocumentPreviewUrls", () => {
  it("signs unique non-empty paths in one batch", async () => {
    const createSignedUrls = vi.fn(async () => ({
      data: [
        { error: null, path: "applications/a/passport.pdf", signedUrl: "https://storage.test/passport" },
        { error: null, path: "applications/a/photo.jpg", signedUrl: "https://storage.test/photo" },
      ],
      error: null,
    }));

    const urls = await loadDocumentPreviewUrls(
      [
        "applications/a/passport.pdf",
        "",
        "applications/a/passport.pdf",
        "applications/a/photo.jpg",
      ],
      createSignedUrls,
    );

    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith(
      ["applications/a/passport.pdf", "applications/a/photo.jpg"],
      60 * 60,
    );
    expect(Object.fromEntries(urls)).toEqual({
      "applications/a/passport.pdf": "https://storage.test/passport",
      "applications/a/photo.jpg": "https://storage.test/photo",
    });
  });

  it("keeps successful previews when another path fails", async () => {
    const urls = await loadDocumentPreviewUrls(
      ["applications/a/passport.pdf", "applications/a/missing.pdf"],
      async () => ({
        data: [
          { error: null, path: "applications/a/passport.pdf", signedUrl: "https://storage.test/passport" },
          { error: "Object not found", path: "applications/a/missing.pdf", signedUrl: "" },
        ],
        error: null,
      }),
    );

    expect(Object.fromEntries(urls)).toEqual({
      "applications/a/passport.pdf": "https://storage.test/passport",
    });
  });

  it("returns no previews when the batch request fails", async () => {
    const urls = await loadDocumentPreviewUrls(
      ["applications/a/passport.pdf"],
      async () => ({ data: null, error: { message: "Storage unavailable" } }),
    );

    expect(urls.size).toBe(0);
  });

  it("returns no previews when the batch request rejects", async () => {
    const urls = await loadDocumentPreviewUrls(
      ["applications/a/passport.pdf"],
      async () => {
        throw new Error("Network unavailable");
      },
    );

    expect(urls.size).toBe(0);
  });

  it("does not call storage when no paths need signing", async () => {
    const createSignedUrls = vi.fn();

    const urls = await loadDocumentPreviewUrls(["", "   "], createSignedUrls);

    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(urls.size).toBe(0);
  });
});
