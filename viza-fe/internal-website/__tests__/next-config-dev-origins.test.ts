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
});
