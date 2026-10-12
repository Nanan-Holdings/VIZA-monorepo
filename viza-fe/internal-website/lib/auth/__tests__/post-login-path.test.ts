import { describe, expect, it } from "vitest";

import { getPostLoginPath, loginPathReturningTo } from "@/lib/auth/post-login-path";

describe("getPostLoginPath", () => {
  it("defaults to the client home", () => {
    expect(getPostLoginPath(null)).toBe("/client/home");
    expect(getPostLoginPath("")).toBe("/client/home");
  });

  it("keeps the feedback form and application routes", () => {
    expect(getPostLoginPath("/feedback")).toBe("/feedback");
    expect(getPostLoginPath("/client/application")).toBe("/client/application");
    expect(getPostLoginPath("/client/application?country=vietnam&visaType=VN_E_VISA")).toBe(
      "/client/application?country=vietnam&visaType=VN_E_VISA",
    );
    expect(getPostLoginPath("/client/application/long-form?country=japan")).toBe(
      "/client/application/long-form?country=japan",
    );
  });

  it("rejects other paths and off-site targets", () => {
    expect(getPostLoginPath("/admin")).toBe("/client/home");
    expect(getPostLoginPath("/client/applications-evil")).toBe("/client/home");
    expect(getPostLoginPath("https://evil.example/client/application")).toBe("/client/home");
    expect(getPostLoginPath("//evil.example/client/application")).toBe("/client/home");
    expect(getPostLoginPath("/client/application//evil.example")).toBe("/client/home");
    expect(getPostLoginPath("/client/application\\evil")).toBe("/client/home");
  });
});

describe("loginPathReturningTo", () => {
  it("encodes an allowed return target", () => {
    expect(loginPathReturningTo("/client/application?country=vietnam&visaType=VN_E_VISA")).toBe(
      "/client/login?returnTo=%2Fclient%2Fapplication%3Fcountry%3Dvietnam%26visaType%3DVN_E_VISA",
    );
  });

  it("drops a disallowed target", () => {
    expect(loginPathReturningTo("/client/settings")).toBe("/client/login");
  });
});
