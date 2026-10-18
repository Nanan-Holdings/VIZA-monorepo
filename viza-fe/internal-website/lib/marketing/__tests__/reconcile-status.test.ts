import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { undeliveredPlatforms } from "../automation";

describe("undeliveredPlatforms", () => {
  it("names requested platforms that have neither a post id nor a delivery", () => {
    expect(undeliveredPlatforms(
      { platforms: ["linkedin", "facebook", "instagram", "pinterest"], zernioPosts: { linkedin: "z1", facebook: "kelin:facebook:1" } },
      { pinterest: { status: "failed", requestId: null, postId: null, postUrl: null, error: "rejected" } },
    )).toEqual(["instagram"]);
  });

  it("is empty when every platform has something to reconcile", () => {
    expect(undeliveredPlatforms(
      { platforms: ["linkedin", "instagram"], zernioPosts: { linkedin: "z1", instagram: "kelin:instagram:2" } },
      {},
    )).toEqual([]);
  });
});
