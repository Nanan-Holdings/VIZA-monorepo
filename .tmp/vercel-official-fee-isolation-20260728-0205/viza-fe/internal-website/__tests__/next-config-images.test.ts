import nextConfig from "../next.config";
import { describe, expect, it } from "vitest";

describe("next image remote hosts", () => {
  it("allows Wikimedia Commons Special:FilePath travel images", () => {
    const remotePatterns = nextConfig.images?.remotePatterns ?? [];

    expect(remotePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: "https",
          hostname: "commons.wikimedia.org",
        }),
      ]),
    );
  });
});
