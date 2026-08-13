import { describe, expect, it } from "vitest";
import { readApplicationRouteParam } from "@/lib/client/application-route-params";

describe("readApplicationRouteParam", () => {
  it("reads normal Taiwan long-form query parameters", () => {
    const params = new URLSearchParams("country=taiwan&visaType=TW_ENTRY_PERMIT");

    expect(readApplicationRouteParam(params, "country")).toBe("taiwan");
    expect(readApplicationRouteParam(params, "visaType", "visa_type")).toBe("TW_ENTRY_PERMIT");
  });

  it("recovers visaType when a copied URL keeps the HTML-escaped ampersand", () => {
    const params = new URLSearchParams("country=taiwan&amp;visaType=TW_ENTRY_PERMIT");

    expect(readApplicationRouteParam(params, "country")).toBe("taiwan");
    expect(readApplicationRouteParam(params, "visaType", "visa_type")).toBe("TW_ENTRY_PERMIT");
  });

  it("recovers visaType when the ampersand was escaped more than once", () => {
    const params = new URLSearchParams("country=taiwan&amp;amp;visaType=TW_ENTRY_PERMIT");

    expect(readApplicationRouteParam(params, "country")).toBe("taiwan");
    expect(readApplicationRouteParam(params, "visaType", "visa_type")).toBe("TW_ENTRY_PERMIT");
  });

  it("supports snake_case aliases and ignores blank values", () => {
    const params = new URLSearchParams("visaType=+&amp;amp;visa_type=TW_ENTRY_PERMIT");

    expect(readApplicationRouteParam(params, "visaType", "visa_type")).toBe("TW_ENTRY_PERMIT");
    expect(readApplicationRouteParam(params, "missing")).toBeNull();
  });
});
