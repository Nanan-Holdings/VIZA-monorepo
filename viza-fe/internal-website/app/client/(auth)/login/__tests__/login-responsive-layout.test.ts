import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const loginPageSource = readFileSync(
  join(process.cwd(), "app/client/(auth)/login/page.tsx"),
  "utf8"
);

describe("client login responsive layout", () => {
  it("lets the login panel use the full mobile width without horizontal scroll", () => {
    expect(loginPageSource).toContain("min-h-[100svh]");
    expect(loginPageSource).toContain("w-full");
    expect(loginPageSource).toContain("overflow-x-hidden");
    expect(loginPageSource).toContain("max-w-[545px]");
    expect(loginPageSource).toContain("lg:w-[45%]");
  });

  it("hides the decorative globe until desktop width", () => {
    expect(loginPageSource).toContain("hidden flex-1");
    expect(loginPageSource).toContain("lg:flex");
  });
});
