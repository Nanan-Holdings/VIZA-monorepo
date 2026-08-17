import { describe, expect, it } from "vitest";
import {
  buildClientLoginUrlWithNext,
  getSafeClientLoginNext,
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

  it("rejects external, non-client, and auth-loop destinations", () => {
    expect(getSafeClientLoginNext("https://evil.example/client/home")).toBeNull();
    expect(getSafeClientLoginNext("/admin")).toBeNull();
    expect(getSafeClientLoginNext("/client/login?next=/client/home")).toBeNull();
    expect(getSafeClientLoginNext("//evil.example/client/home")).toBeNull();
  });
});
