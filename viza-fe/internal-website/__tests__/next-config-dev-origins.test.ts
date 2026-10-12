import { describe, expect, it } from "vitest";
import config from "../next.config";

describe("next dev origins", () => {
  it("allows the documented 127.0.0.1 client URL to call dev endpoints", () => {
    expect(config).toMatchObject({
      allowedDevOrigins: expect.arrayContaining([
        "127.0.0.1",
        "127.0.0.1:3000",
        "localhost",
        "http://127.0.0.1:3000",
      ]),
    });
  });

  it("allows only the isolated map document to be framed by the same origin", async () => {
    const rules = await config.headers?.();
    const baseline = rules?.find((rule) => rule.source === "/:path*");
    const map = rules?.find((rule) => rule.source === "/travel-map");
    expect(baseline?.headers).toEqual(expect.arrayContaining([
      { key: "X-Frame-Options", value: "DENY" },
      expect.objectContaining({ key: "Content-Security-Policy", value: expect.stringContaining("frame-ancestors 'none'") }),
    ]));
    expect(map?.headers).toEqual(expect.arrayContaining([
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      expect.objectContaining({ key: "Content-Security-Policy", value: expect.stringContaining("frame-ancestors 'self'") }),
    ]));
  });
});
