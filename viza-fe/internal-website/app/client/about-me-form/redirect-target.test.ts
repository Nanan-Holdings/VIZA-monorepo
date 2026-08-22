import { describe, expect, it } from "vitest";
import {
  getAboutMeRedirectTarget,
  isRetiredAboutMeRoute,
} from "./redirect-target";

describe("isRetiredAboutMeRoute", () => {
  it.each([
    "/client/about-me-form",
    "/client/about-me-form/",
    "/client/about-me-form/legacy",
  ])("matches the retired questionnaire route %s", (pathname) => {
    expect(isRetiredAboutMeRoute(pathname)).toBe(true);
  });

  it.each([
    "/client/about",
    "/client/application/long-form",
    "/client/about-me-former",
  ])("does not match another client route %s", (pathname) => {
    expect(isRetiredAboutMeRoute(pathname)).toBe(false);
  });
});

describe("getAboutMeRedirectTarget", () => {
  it("returns the original internal client route", () => {
    expect(
      getAboutMeRedirectTarget("/client/application/long-form?country=vietnam"),
    ).toBe("/client/application/long-form?country=vietnam");
  });

  it("uses the first value when the query parameter is repeated", () => {
    expect(
      getAboutMeRedirectTarget([
        "/client/application/long-form",
        "/client/home",
      ]),
    ).toBe("/client/application/long-form");
  });

  it.each([
    undefined,
    "https://example.com/client/home",
    "//example.com/client/home",
    "/client/about-me-form",
    "/client/about-me-form?returnTo=/client/home",
  ])("falls back for an unsafe or looping target: %s", (value) => {
    expect(getAboutMeRedirectTarget(value)).toBe("/client/application");
  });
});
