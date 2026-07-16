import { describe, expect, it } from "vitest";
import { isLocalTestSessionAllowed } from "./availability";

describe("isLocalTestSessionAllowed", () => {
  it.each(["127.0.0.1:3000", "localhost:3000"])(
    "allows an explicitly enabled development request from %s",
    (host) => {
      expect(
        isLocalTestSessionAllowed({
          host,
          nodeEnv: "development",
          enabled: "true",
        })
      ).toBe(true);
    }
  );

  it.each([
    { host: "viza.example", nodeEnv: "development", enabled: "true" },
    { host: "localhost:3000", nodeEnv: "production", enabled: "true" },
    { host: "localhost:3000", nodeEnv: "development", enabled: "false" },
    { host: null, nodeEnv: "development", enabled: "true" },
  ])("rejects non-local or non-development configuration %#", (configuration) => {
    expect(isLocalTestSessionAllowed(configuration)).toBe(false);
  });
});
