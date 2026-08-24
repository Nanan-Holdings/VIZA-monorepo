import { describe, expect, it } from "vitest";

import { readCapacityTargetMarker } from "./marker";
import { GET } from "./route";

describe("online capacity target marker", () => {
  it("is disabled unless explicitly enabled", () => {
    expect(readCapacityTargetMarker({})).toBeNull();
  });

  it("returns a non-cacheable 404 while disabled", async () => {
    const previous = process.env.ONLINE_CAPACITY_TARGET_ENABLED;
    delete process.env.ONLINE_CAPACITY_TARGET_ENABLED;
    try {
      const response = await GET();
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
    } finally {
      if (previous === undefined) delete process.env.ONLINE_CAPACITY_TARGET_ENABLED;
      else process.env.ONLINE_CAPACITY_TARGET_ENABLED = previous;
    }
  });

  it("derives the exact project ref from the deployed Supabase URL", () => {
    expect(
      readCapacityTargetMarker({
        ONLINE_CAPACITY_TARGET_ENABLED: "true",
        ONLINE_CAPACITY_TARGET_MODE: "staging-only",
        NEXT_PUBLIC_SUPABASE_URL: "https://stagingref1234567890.supabase.co",
      }),
    ).toEqual({
      enabled: true,
      mode: "staging-only",
      projectRef: "stagingref1234567890",
    });
  });

  it("rejects a non-loopback local target", () => {
    expect(() =>
      readCapacityTargetMarker({
        ONLINE_CAPACITY_TARGET_ENABLED: "true",
        ONLINE_CAPACITY_TARGET_MODE: "local-test",
        NEXT_PUBLIC_SUPABASE_URL: "https://stagingref1234567890.supabase.co",
      }),
    ).toThrow(/loopback/i);
  });
});
