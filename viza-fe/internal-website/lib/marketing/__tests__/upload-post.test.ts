import { afterEach, describe, expect, it, vi } from "vitest";
import { checkUploadPostJob, publishUploadPostImage, uploadPostReadiness } from "../providers/upload-post";

const original = { ...process.env };
const imageUrl = "https://viza.it.com/cover.jpg";
const destinationUrl = "https://viza.it.com/blog/visa-update";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function configured() {
  process.env.UPLOAD_POST_API_KEY = "test-key";
  process.env.UPLOAD_POST_USER = "viza-profile";
  process.env.UPLOAD_POST_PINTEREST_BOARD_ID = "board-123";
}

afterEach(() => {
  process.env = { ...original };
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Upload-Post adapter", () => {
  it("requires an explicit VIZA profile and Pinterest board before any request", async () => {
    delete process.env.UPLOAD_POST_API_KEY;
    delete process.env.UPLOAD_POST_USER;
    delete process.env.UPLOAD_POST_PINTEREST_BOARD_ID;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(uploadPostReadiness("pinterest")).toEqual({ connected: false, missing: ["UPLOAD_POST_API_KEY", "UPLOAD_POST_USER", "UPLOAD_POST_PINTEREST_BOARD_ID"] });
    await expect(publishUploadPostImage({ platform: "pinterest", title: "Update", caption: "Read", imageUrl, destinationUrl })).rejects.toThrow("UPLOAD_POST_API_KEY");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses the configured profile and generic title for Instagram's caption", async () => {
    configured();
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ profiles: [{ username: "other", social_accounts: { instagram: true } }, { username: "viza-profile", social_accounts: { instagram: true } }] }))
      .mockResolvedValueOnce(json({ success: true, results: { instagram: { success: true, post_id: "ig-123", url: "https://www.instagram.com/p/abc/" } } }));
    const result = await publishUploadPostImage({ platform: "instagram", title: "Article title", caption: "Full caption", imageUrl });
    expect(result).toEqual({ status: "published", postId: "ig-123", postUrl: "https://www.instagram.com/p/abc/", requestId: null });
    const form = fetchSpy.mock.calls[1][1]?.body as FormData;
    expect(form.get("user")).toBe("viza-profile");
    expect(form.get("title")).toBe("Full caption");
    expect(form.get("instagram_title")).toBe("Full caption");
    expect(form.get("photos[]")).toBe(imageUrl);
  });

  it("waits for an asynchronous Pinterest job and returns the pin URL", async () => {
    configured();
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ profiles: [{ username: "viza-profile", social_accounts: { pinterest: true } }] }))
      .mockResolvedValueOnce(json({ success: true, request_id: "req-1" }))
      .mockResolvedValueOnce(json({ status: "completed", results: [{ platform: "pinterest", success: true, platform_post_id: "123456", post_url: destinationUrl }] }));
    vi.useFakeTimers();
    const pending = publishUploadPostImage({ platform: "pinterest", title: "Visa update", caption: "Read more", imageUrl, destinationUrl });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await pending).toEqual({ status: "published", postId: "123456", postUrl: "https://www.pinterest.com/pin/123456/", requestId: "req-1" });
    const form = fetchSpy.mock.calls[1][1]?.body as FormData;
    expect(form.get("pinterest_board_id")).toBe("board-123");
    expect(form.get("pinterest_link")).toBe(destinationUrl);
  });

  it("rejects non-HTTPS media before looking up the profile", async () => {
    configured();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(publishUploadPostImage({ platform: "instagram", title: "Update", caption: "Read", imageUrl: "http://example.com/cover.jpg" })).rejects.toThrow("HTTPS");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("checks an existing job once without creating another post", async () => {
    configured();
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ status: "processing", results: [] }))
      .mockResolvedValueOnce(json({ status: "failed", results: [{ platform: "instagram", success: false, error_message: "Image rejected" }] }))
      .mockResolvedValueOnce(json({ status: "completed", results: [{ platform: "pinterest", success: true, platform_post_id: "987654", post_url: destinationUrl }] }));

    expect(await checkUploadPostJob("req-1", "instagram")).toEqual({ status: "pending", postId: null, postUrl: null, requestId: "req-1" });
    expect(await checkUploadPostJob("req-2", "instagram")).toEqual({ status: "failed", postId: null, postUrl: null, requestId: "req-2", error: "Image rejected" });
    expect(await checkUploadPostJob("req-3", "pinterest")).toEqual({ status: "published", postId: "987654", postUrl: "https://www.pinterest.com/pin/987654/", requestId: "req-3" });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls.every(([url, init]) => String(url).includes("/uploadposts/status") && !init?.method)).toBe(true);
  });
});
