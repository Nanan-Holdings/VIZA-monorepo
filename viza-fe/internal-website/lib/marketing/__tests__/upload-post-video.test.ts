import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelUploadPostSchedule,
  checkUploadPostJob,
  publishUploadPostVideo,
  refreshUploadPostDeliveries,
  uploadPostConnectedPlatforms,
  uploadPostVideoVisibility,
  type UploadPostVideoInput,
} from "../providers/upload-post";

const original = { ...process.env };
const videoUrl = "https://example.supabase.co/storage/v1/object/public/marketing-public-assets/video/2026/10/u/short.mp4";
const compositionId = "6f1f8d7a-a3a7-437b-a029-1bb89ababb39";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function profile(accounts: Record<string, unknown>) {
  return json({ profiles: [{ username: "viza-profile", social_accounts: accounts }] });
}

function configured(visibility?: string) {
  process.env.UPLOAD_POST_API_KEY = "test-key";
  process.env.UPLOAD_POST_USER = "viza-profile";
  if (visibility) process.env.UPLOAD_POST_VIDEO_VISIBILITY = visibility;
  else delete process.env.UPLOAD_POST_VIDEO_VISIBILITY;
}

function short(overrides: Partial<UploadPostVideoInput> = {}): UploadPostVideoInput {
  return {
    platform: "tiktok", compositionId, attemptKey: "2026-10-16T08:00:00.000Z",
    caption: "ETIAS is not a visa. Link in bio.", title: "ETIAS explained in 30 seconds",
    videoUrl, locale: "en", ...overrides,
  };
}

function sentForm(spy: { mock: { calls: unknown[][] } }, call = 1): FormData {
  return (spy.mock.calls[call][1] as RequestInit).body as FormData;
}

afterEach(() => {
  process.env = { ...original };
  vi.restoreAllMocks();
});

describe("Upload-Post shorts", () => {
  it("stays private unless public is set exactly", () => {
    configured();
    expect(uploadPostVideoVisibility()).toBe("private");
    process.env.UPLOAD_POST_VIDEO_VISIBILITY = "pubic";
    expect(uploadPostVideoVisibility()).toBe("private");
    process.env.UPLOAD_POST_VIDEO_VISIBILITY = " Public ";
    expect(uploadPostVideoVisibility()).toBe("public");
  });

  it("posts a private, AI-labelled TikTok by URL and tracks it by its own request id", async () => {
    configured();
    const spy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(profile({ tiktok: { display_name: "viza" } }))
      .mockResolvedValueOnce(json({ success: true, message: "Upload initiated successfully in background.", request_id: "server-req" }));
    const result = await publishUploadPostVideo(short());
    expect(result).toEqual({ status: "pending", postId: null, postUrl: null, requestId: "server-req" });

    const [url, init] = spy.mock.calls[1];
    expect(String(url)).toBe("https://api.upload-post.com/api/upload");
    expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toBe(`viza:${compositionId}:tiktok:2026-10-16T08:00:00.000Z`);
    const form = sentForm(spy);
    expect(form.getAll("platform[]")).toEqual(["tiktok"]);
    expect(form.get("video")).toBe(videoUrl);
    expect(form.get("tiktok_title")).toBe("ETIAS is not a visa. Link in bio.");
    expect(form.get("is_aigc")).toBe("true");
    expect(form.get("privacy_level")).toBe("SELF_ONLY");
    expect(form.get("brand_organic_toggle")).toBeNull();
    expect(form.get("async_upload")).toBe("true");
    expect(String(form.get("request_id"))).toMatch(/^viza_tiktok_[0-9a-f-]{36}$/);
    expect(form.get("external_id")).toBe(compositionId);
    expect(form.get("scheduled_date")).toBeNull();
  });

  it("posts public TikToks with the own-brand disclosure and no privacy override", async () => {
    configured("public");
    const spy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(profile({ tiktok: true }))
      .mockResolvedValueOnce(json({ success: true, request_id: "req-1" }));
    await publishUploadPostVideo(short());
    const form = sentForm(spy);
    expect(form.get("privacy_level")).toBeNull();
    expect(form.get("brand_organic_toggle")).toBe("true");
    expect(form.get("is_aigc")).toBe("true");
  });

  it("refuses an Instagram Reel while shorts are private, before calling the provider", async () => {
    configured();
    const spy = vi.spyOn(globalThis, "fetch");
    await expect(publishUploadPostVideo(short({ platform: "instagram" }))).rejects.toThrow(/no private Reels/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("sends a public Reel with Instagram's AI label", async () => {
    configured("public");
    const spy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(profile({ instagram: true }))
      .mockResolvedValueOnce(json({ success: true, results: { instagram: { success: true, url: "https://www.instagram.com/reel/abc/", post_id: "ig-1" } } }));
    const result = await publishUploadPostVideo(short({ platform: "instagram" }));
    expect(result).toMatchObject({ status: "published", postId: "ig-1", postUrl: "https://www.instagram.com/reel/abc/" });
    const form = sentForm(spy);
    expect(form.get("media_type")).toBe("REELS");
    expect(form.get("instagram_title")).toBe("ETIAS is not a visa. Link in bio.");
    expect(form.get("is_ai_generated")).toBe("true");
  });

  it("sends a private YouTube Short with its own title, language and synthetic-media flag", async () => {
    configured();
    const spy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(profile({ youtube: true }))
      .mockResolvedValueOnce(json({ success: true, request_id: "req-yt" }));
    await publishUploadPostVideo(short({ platform: "youtube", locale: "zh-CN", caption: "ETIAS 不是签证。https://viza.it.com/s/abc" }));
    const form = sentForm(spy);
    expect(form.get("title")).toBe("ETIAS explained in 30 seconds");
    expect(form.get("youtube_title")).toBe("ETIAS explained in 30 seconds");
    expect(form.get("youtube_description")).toBe("ETIAS 不是签证。https://viza.it.com/s/abc");
    expect(form.get("privacyStatus")).toBe("private");
    expect(form.get("containsSyntheticMedia")).toBe("true");
    expect(form.get("defaultLanguage")).toBe("zh-CN");
    expect(form.get("defaultAudioLanguage")).toBe("zh-CN");
  });

  it("hands a scheduled short to Upload-Post's scheduler and keeps the job id", async () => {
    configured();
    const when = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const spy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(profile({ tiktok: true }))
      .mockResolvedValueOnce(json({ success: true, job_id: "job_abc123", scheduled_date: when.toISOString() }, 202));
    const result = await publishUploadPostVideo(short({ scheduledFor: when.toISOString() }));
    expect(result).toEqual({ status: "scheduled", postId: null, postUrl: null, requestId: null, jobId: "job_abc123" });
    const form = sentForm(spy);
    expect(form.get("scheduled_date")).toBe(when.toISOString().replace(/\.\d{3}Z$/, "Z"));
    expect(form.get("async_upload")).toBeNull();
  });

  it("refuses a schedule that has already passed", async () => {
    configured();
    const spy = vi.spyOn(globalThis, "fetch");
    await expect(publishUploadPostVideo(short({ scheduledFor: new Date(Date.now() - 1000).toISOString() }))).rejects.toThrow(/has passed/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not post when the profile has no account for the platform", async () => {
    configured();
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(profile({ instagram: true, pinterest: true }));
    await expect(publishUploadPostVideo(short())).rejects.toThrow("tiktok is not connected");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("keeps the request pending when the upload response is lost", async () => {
    configured();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(profile({ tiktok: true }))
      .mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
    const result = await publishUploadPostVideo(short());
    expect(result.status).toBe("pending");
    expect(result.requestId).toMatch(/^viza_tiktok_/);
  });

  it("surfaces the provider's reason when it rejects the upload", async () => {
    configured();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(profile({ tiktok: true }))
      .mockResolvedValueOnce(json({ success: false, message: "TikTok uploads are not available on the Free plan." }, 403));
    await expect(publishUploadPostVideo(short())).rejects.toThrow("(403): TikTok uploads are not available on the Free plan.");
  });

  it("reads which channels the profile has connected, and treats an outage as none", async () => {
    configured();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(profile({ instagram: true, tiktok: { username: "viza" }, youtube: null }))
      .mockRejectedValueOnce(new Error("network"));
    expect(await uploadPostConnectedPlatforms()).toEqual(["instagram", "tiktok"]);
    expect(await uploadPostConnectedPlatforms()).toEqual([]);
  });
});

describe("Upload-Post short status", () => {
  it("reads a scheduled job that has not run as still scheduled", async () => {
    configured();
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ job_id: "job_1", status: "pending", results: [] }));
    expect(await checkUploadPostJob("job_1", "tiktok", "job")).toEqual({ status: "scheduled", postId: null, postUrl: null, requestId: null, jobId: "job_1" });
    expect(String(spy.mock.calls[0][0])).toContain("/uploadposts/status?job_id=job_1");
  });

  it("publishes a job once it has run, keeping the job id", async () => {
    configured();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ job_id: "job_2", status: "completed", results: [{ platform: "youtube", status: "completed", success: true, video_id: "yt123", post_url: "https://www.youtube.com/shorts/yt123" }] }));
    expect(await checkUploadPostJob("job_2", "youtube", "job")).toEqual({ status: "published", postId: "yt123", postUrl: "https://www.youtube.com/shorts/yt123", requestId: null, jobId: "job_2" });
  });

  it("fails a platform Upload-Post skipped for want of an account", async () => {
    configured();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ status: "completed", results: [{ platform: "tiktok", success: false, skipped: true, status: "skipped" }] }));
    expect(await checkUploadPostJob("req-9", "tiktok")).toMatchObject({ status: "failed", error: "tiktok is not connected to the configured Upload-Post profile" });
  });

  it("keeps a TikTok that fell back to the inbox, without inventing a URL", async () => {
    configured();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ status: "completed", results: [{ platform: "tiktok", success: true, post_id: "v_inbox_file~123", post_url: "Video sent to Inbox (No Public URL)", fallback_to_inbox: true }] }));
    expect(await checkUploadPostJob("req-10", "tiktok")).toEqual({ status: "published", postId: "v_inbox_file~123", postUrl: null, requestId: "req-10" });
  });

  it("treats a retryable platform result as still pending", async () => {
    configured();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ status: "in_progress", results: [{ platform: "youtube", status: "retryable", success: false }] }));
    expect(await checkUploadPostJob("req-11", "youtube")).toEqual({ status: "pending", postId: null, postUrl: null, requestId: "req-11" });
  });

  it("refreshes pending and scheduled deliveries and leaves settled ones alone", async () => {
    configured();
    const spy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ status: "completed", results: [{ platform: "tiktok", success: true, post_id: "tt1", post_url: "https://www.tiktok.com/@viza/video/1" }] }))
      .mockResolvedValueOnce(json({ job_id: "job_y", status: "pending", results: [] }));
    const next = await refreshUploadPostDeliveries({
      tiktok: { status: "pending", requestId: "req-t", postId: null, postUrl: null },
      youtube: { status: "scheduled", requestId: null, jobId: "job_y", postId: null, postUrl: null },
      instagram: { status: "published", requestId: "req-i", postId: "ig", postUrl: "https://www.instagram.com/reel/x/" },
    });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(next.tiktok).toEqual({ status: "published", requestId: "req-t", jobId: null, postId: "tt1", postUrl: "https://www.tiktok.com/@viza/video/1", error: null });
    expect(next.youtube).toEqual({ status: "scheduled", requestId: null, jobId: "job_y", postId: null, postUrl: null, error: null });
    expect(next.instagram?.status).toBe("published");
  });

  it("cancels a scheduled job with a DELETE", async () => {
    configured();
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ success: true, message: "Job job_3 cancelled and assets deleted." }));
    await cancelUploadPostSchedule("job_3");
    expect(String(spy.mock.calls[0][0])).toBe("https://api.upload-post.com/api/uploadposts/schedule/job_3");
    expect(spy.mock.calls[0][1]?.method).toBe("DELETE");
  });
});
