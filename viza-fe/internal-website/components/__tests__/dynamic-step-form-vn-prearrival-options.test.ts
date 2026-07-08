import { describe, expect, it } from "vitest";
import { getPhoneCountryCodeOptions } from "@/components/dynamic-step-form";

describe("Vietnam pre-arrival dynamic form options", () => {
  it("provides selectable phone country codes when the official category is not session-readable", () => {
    const options = getPhoneCountryCodeOptions();

    expect(options.length).toBeGreaterThan(100);
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "+86",
          official_label: "(+86)",
        }),
        expect.objectContaining({
          value: "+65",
          official_label: "(+65)",
        }),
        expect.objectContaining({
          value: "+1",
          official_label: "(+1)",
        }),
      ]),
    );
  });
});
