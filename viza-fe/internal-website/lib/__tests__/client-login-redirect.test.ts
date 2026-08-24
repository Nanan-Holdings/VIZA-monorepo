import { describe, expect, it } from "vitest";
import {
  buildClientLoginPathWithNext,
  buildClientLoginUrlWithNext,
  getSafeClientLoginNext,
  resolveClientPostLoginDestination,
} from "../client-login-redirect";

describe("client login redirect", () => {
  it("preserves the Philippines eTravel arrival-card entry through login", () => {
    const login = buildClientLoginUrlWithNext(
      "https://app.viza.it.com/client/arrival-cards/philippines"
    );

    expect(login.pathname).toBe("/client/login");
    expect(login.searchParams.get("next")).toBe(
      "/client/arrival-cards/philippines"
    );
    expect(getSafeClientLoginNext(login.searchParams.get("next"))).toBe(
      "/client/arrival-cards/philippines"
    );
  });

  it("preserves the Philippines eTravel long-form product route through login", () => {
    const target =
      "/client/application/long-form?country=philippines&visaType=PH_ETRAVEL_ARRIVAL_CARD&skipFormCheck=true";
    const login = buildClientLoginUrlWithNext(`https://app.viza.it.com${target}`);

    expect(login.searchParams.get("next")).toBe(target);
    expect(getSafeClientLoginNext(login.searchParams.get("next"))).toBe(target);
  });

  it("keeps Taiwan long-form routes mapped to Taiwan", () => {
    const target =
      "/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT";
    const login = buildClientLoginUrlWithNext(`https://app.viza.it.com${target}`);

    expect(login.searchParams.get("next")).toBe(target);
    expect(getSafeClientLoginNext(login.searchParams.get("next"))).toBe(target);
  });

  it("preserves application hash anchors through the login next parameter", () => {
    const target = "/client/application#start-new-application";
    const login = buildClientLoginUrlWithNext(`https://app.viza.it.com${target}`);

    expect(login.searchParams.get("next")).toBe(target);
    expect(resolveClientPostLoginDestination(login.searchParams)).toBe(target);
  });

  it("restores long-form path, query, and a browser-retained hash after login", () => {
    const target =
      "/client/application/long-form?country=taiwan&visaType=TW_ENTRY_PERMIT";
    const loginPath = buildClientLoginPathWithNext(target);
    const login = new URL(loginPath, "https://app.viza.it.com");

    expect(login.pathname).toBe("/client/login");
    expect(login.searchParams.get("next")).toBe(target);
    expect(resolveClientPostLoginDestination(login.searchParams, "#documents")).toBe(
      `${target}#documents`
    );
  });

  it("does not let unsafe post-login destinations override the client home fallback", () => {
    const external = new URLSearchParams({
      next: "https://evil.example/client/application",
    });
    const authLoop = new URLSearchParams({
      returnTo: "/client/login?next=/client/application",
    });

    expect(resolveClientPostLoginDestination(external, "#start")).toBe("/client/home");
    expect(resolveClientPostLoginDestination(authLoop)).toBe("/client/home");
  });

  it("rejects external, non-client, and auth-loop destinations", () => {
    expect(getSafeClientLoginNext("https://evil.example/client/home")).toBeNull();
    expect(getSafeClientLoginNext("/admin")).toBeNull();
    expect(getSafeClientLoginNext("/client/login?next=/client/home")).toBeNull();
    expect(getSafeClientLoginNext("//evil.example/client/home")).toBeNull();
  });
});
