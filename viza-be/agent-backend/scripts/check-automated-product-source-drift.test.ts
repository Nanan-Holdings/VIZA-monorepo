import { describe, expect, it } from "vitest";
import {
  checkOfficialSource,
  normalizeOfficialText,
  readOfficialSourceManifest,
  runSourceDriftCheck,
} from "./check-automated-product-source-drift";

describe("automated-product official source drift checker", () => {
  it("normalizes visible text and ignores script/style noise", () => {
    expect(normalizeOfficialText("<html><body> Visit   Japan Web <script>noise</script></body></html>")).toBe("visit japan web");
  });

  it("keeps a reviewed manifest for both products", () => {
    const manifest = readOfficialSourceManifest();
    expect(manifest.sources.map((source) => source.product_code)).toEqual([
      "JP_VISIT_JAPAN_WEB",
      "JP_VISIT_JAPAN_WEB",
      "JP_VISIT_JAPAN_WEB",
      "KE_ETA",
      "KE_ETA",
      "KE_ETA",
      "KE_ETA",
      "KE_ETA",
    ]);
    expect(manifest.sources.every((source) => source.expected_sha256.length === 64)).toBe(true);
  });

  it("reports hash and required-text drift without writing anything", async () => {
    const source = readOfficialSourceManifest().sources[0];
    const result = await checkOfficialSource(source, async () => ({
      status: 200,
      text: async () => "<html><body>changed page</body></html>",
    }), new Date("2026-08-20T00:00:00.000Z"));
    expect(result.reviewNeeded).toBe(true);
    expect(result.reasons).toContain("content_hash_changed");
    expect(result.reasons.some((reason) => reason.startsWith("required_text_missing:"))).toBe(true);
  });

  it("supports country-scoped weekly checks", async () => {
    const manifest = readOfficialSourceManifest();
    const results = await runSourceDriftCheck(manifest, new Set(["kenya"]), async () => ({
      status: 200,
      text: async () => "<html><body>approved Electronic Travel Authorisation Standard eTA $30</body></html>",
    }));
    expect(results).toHaveLength(5);
    expect(results.every((result) => result.country === "kenya")).toBe(true);
  });
});
