import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketingDb, MarketingQuery } from "../db";

vi.mock("../publish-check", () => ({ assertLiveMarketingUrl: vi.fn(async () => undefined) }));
vi.mock("../providers/zernio", () => ({ createZernioPosts: vi.fn(), findZernioCompositionPosts: vi.fn(async () => ({})) }));
vi.mock("../providers/upload-post", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../providers/upload-post")>()),
  publishUploadPostImage: vi.fn(),
  publishUploadPostVideo: vi.fn(),
}));

const { publishSocialCompositionById } = await import("../publish");
const { publishUploadPostVideo } = await import("../providers/upload-post");
const { createZernioPosts } = await import("../providers/zernio");

const compositionId = "6f1f8d7a-a3a7-437b-a029-1bb89ababb39";
const blogId = "3358cbf1-2d03-413c-8661-a93f8d019390";
const videoUrl = "https://example.supabase.co/storage/v1/object/public/marketing-public-assets/video/short.mp4";

function compositionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: compositionId, blog_post_id: blogId, short_link_id: "link-1", title: "Short: ETIAS", brief: "ETIAS short",
    destination_url: "https://viza.it.com/blog/etias", media_url: null, document_url: null,
    video_url: videoUrl, video_locale: "en", video_title: "ETIAS explained", status: "draft",
    platforms: ["tiktok", "youtube"], platform_content: { tiktok: "ETIAS is not a visa. Details: {url}", youtube: "ETIAS is not a visa. Details: {url}" },
    zernio_posts: {}, zernio_post_urls: {}, upload_post_posts: {}, scheduled_for: null, last_synced_at: null,
    created_at: "2026-10-16T07:00:00.000Z", updated_at: "2026-10-16T08:00:00.000Z", ...overrides,
  };
}

/* Just enough of the Supabase query builder for publish.ts. */
function fakeDb(row: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = [];
  const db: MarketingDb = {
    from(table: string) {
      let pendingUpdate: Record<string, unknown> | null = null;
      const result = () => {
        if (table === "marketing_social_compositions") return { data: pendingUpdate ? { ...row, ...pendingUpdate } : row, error: null };
        if (table === "marketing_blog_posts") return { data: { status: "published", locale: "en", slug: "etias" }, error: null };
        if (table === "marketing_short_links") return { data: { code: "abc123", active: true }, error: null };
        return { data: null, error: null };
      };
      const query: MarketingQuery = {
        select: () => query, insert: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query,
        update: (values) => { pendingUpdate = values; updates.push(values); return query; },
        maybeSingle: async () => result(), single: async () => result(),
        then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
      };
      return query;
    },
    rpc: async () => ({ data: null, error: null }),
  };
  return { db, updates };
}

beforeEach(() => {
  process.env.VIZA_MARKETING_PUBLIC_BASE_URL = "https://viza.it.com";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("publishing a short", () => {
  it("sends each platform its own caption through the tracked link and never touches Zernio", async () => {
    vi.mocked(publishUploadPostVideo)
      .mockResolvedValueOnce({ status: "pending", postId: null, postUrl: null, requestId: "req-t" })
      .mockResolvedValueOnce({ status: "pending", postId: null, postUrl: null, requestId: "req-y" });
    const { db, updates } = fakeDb(compositionRow());
    const saved = await publishSocialCompositionById({ db, actorId: "actor", compositionId, reason: "ETIAS short" });

    expect(createZernioPosts).not.toHaveBeenCalled();
    expect(publishUploadPostVideo).toHaveBeenCalledTimes(2);
    expect(vi.mocked(publishUploadPostVideo).mock.calls[0][0]).toEqual({
      platform: "tiktok", compositionId, attemptKey: "2026-10-16T08:00:00.000Z",
      caption: "ETIAS is not a visa. Link in bio.", title: "ETIAS explained", videoUrl, locale: "en", scheduledFor: undefined,
    });
    expect(vi.mocked(publishUploadPostVideo).mock.calls[1][0].caption).toBe("ETIAS is not a visa. Details: https://viza.it.com/s/abc123");
    expect(updates[0]).toMatchObject({ status: "publishing" });
    expect(saved.uploadPostPosts.tiktok).toMatchObject({ status: "pending", requestId: "req-t" });
  });

  it("marks a fully scheduled short as scheduled", async () => {
    vi.mocked(publishUploadPostVideo)
      .mockResolvedValueOnce({ status: "scheduled", postId: null, postUrl: null, requestId: null, jobId: "job-t" })
      .mockResolvedValueOnce({ status: "scheduled", postId: null, postUrl: null, requestId: null, jobId: "job-y" });
    const { db, updates } = fakeDb(compositionRow({ scheduled_for: "2026-12-01T10:00:00.000Z" }));
    await publishSocialCompositionById({ db, actorId: "actor", compositionId, reason: "ETIAS short" });
    expect(vi.mocked(publishUploadPostVideo).mock.calls[0][0].scheduledFor).toBe("2026-12-01T10:00:00.000Z");
    expect(updates[0]).toMatchObject({ status: "scheduled", upload_post_posts: { tiktok: { status: "scheduled", jobId: "job-t" }, youtube: { status: "scheduled", jobId: "job-y" } } });
  });

  it("records a platform that refused as failed and the short as partial", async () => {
    vi.mocked(publishUploadPostVideo)
      .mockResolvedValueOnce({ status: "pending", postId: null, postUrl: null, requestId: "req-t" })
      .mockRejectedValueOnce(new Error("youtube is not connected to the configured Upload-Post profile"));
    const { db, updates } = fakeDb(compositionRow());
    await publishSocialCompositionById({ db, actorId: "actor", compositionId, reason: "ETIAS short" });
    expect(updates[0]).toMatchObject({ status: "partial", upload_post_posts: { youtube: { status: "failed", error: "youtube is not connected to the configured Upload-Post profile" } } });
  });

  it("saves nothing when no platform accepts the short", async () => {
    vi.mocked(publishUploadPostVideo).mockRejectedValue(new Error("tiktok is not connected to the configured Upload-Post profile"));
    const { db, updates } = fakeDb(compositionRow());
    await expect(publishSocialCompositionById({ db, actorId: "actor", compositionId, reason: "ETIAS short" })).rejects.toThrow("tiktok is not connected");
    expect(updates).toEqual([]);
  });

  it("retries only the platforms that failed", async () => {
    vi.mocked(publishUploadPostVideo).mockResolvedValueOnce({ status: "pending", postId: null, postUrl: null, requestId: "req-y2" });
    const { db } = fakeDb(compositionRow({
      status: "partial",
      upload_post_posts: {
        tiktok: { status: "pending", requestId: "req-t", postId: null, postUrl: null },
        youtube: { status: "failed", requestId: null, postId: null, postUrl: null, error: "not connected" },
      },
    }));
    await publishSocialCompositionById({ db, actorId: "actor", compositionId, reason: "Retry YouTube" });
    expect(publishUploadPostVideo).toHaveBeenCalledTimes(1);
    expect(vi.mocked(publishUploadPostVideo).mock.calls[0][0].platform).toBe("youtube");
  });
});
