import { describe, expect, it } from "vitest";
import {
  shouldBlockClientChildren,
  shouldSkipFormRequestGateForRoute,
} from "../client-layout-gating";

describe("client layout form request gate", () => {
  it("lets explicit Taiwan long-form routes render without the about-me form-request gate", () => {
    const canonical = new URLSearchParams("country=taiwan&visaType=TW_ENTRY_PERMIT");
    const htmlEscaped = new URLSearchParams("country=taiwan&amp;visaType=TW_ENTRY_PERMIT");
    const doubleEscaped = new URLSearchParams("country=taiwan&amp;amp;visaType=TW_ENTRY_PERMIT");

    expect(shouldSkipFormRequestGateForRoute("/client/application/long-form", canonical)).toBe(true);
    expect(shouldSkipFormRequestGateForRoute("/client/application/long-form", htmlEscaped)).toBe(true);
    expect(shouldSkipFormRequestGateForRoute("/client/application/long-form", doubleEscaped)).toBe(true);
  });

  it("keeps the form-request gate for other client routes and non-Taiwan long forms", () => {
    expect(
      shouldSkipFormRequestGateForRoute(
        "/client/application/long-form",
        new URLSearchParams("country=vietnam&visaType=VN_E_VISA"),
      ),
    ).toBe(false);
    expect(
      shouldSkipFormRequestGateForRoute(
        "/client/application",
        new URLSearchParams("country=taiwan&visaType=TW_ENTRY_PERMIT"),
      ),
    ).toBe(false);
  });

  it("renders Taiwan long-form after session validation even before the about-me gate finishes", () => {
    expect(
      shouldBlockClientChildren({
        sessionValid: null,
        formRequestChecked: false,
        skipFormRequestGate: true,
      }),
    ).toBe(true);
    expect(
      shouldBlockClientChildren({
        sessionValid: true,
        formRequestChecked: false,
        skipFormRequestGate: false,
      }),
    ).toBe(true);
    expect(
      shouldBlockClientChildren({
        sessionValid: true,
        formRequestChecked: false,
        skipFormRequestGate: true,
      }),
    ).toBe(false);
  });
});
