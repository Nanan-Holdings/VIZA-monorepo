import { afterEach, describe, expect, it } from "vitest";
import type { WizardStep } from "@/types/visa-form-fields";
import { readCachedFormSteps, writeCachedFormSteps } from "./form-steps-cache";

const steps = [{ stepNumber: 1, stepName: "Personal", fields: [] }] as unknown as WizardStep[];

describe("form steps cache", () => {
  afterEach(() => window.localStorage.clear());

  it("returns the saved schema for the same visa type and country", () => {
    writeCachedFormSteps("DS160", "united_states", steps, 1_000);
    expect(readCachedFormSteps("ds160", "United_States", 2_000)).toEqual(steps);
    expect(readCachedFormSteps("DS160", "japan", 2_000)).toBeNull();
  });

  it("ignores copies older than a week and never stores an empty schema", () => {
    writeCachedFormSteps("DS160", "united_states", steps, 0);
    expect(readCachedFormSteps("DS160", "united_states", 8 * 24 * 60 * 60 * 1000)).toBeNull();
    writeCachedFormSteps("JP_VISA", "japan", [], 0);
    expect(window.localStorage.length).toBe(1);
  });

  it("treats unreadable storage as no cache", () => {
    window.localStorage.setItem("viza:form-steps:v1:DS160:united_states", "{not json");
    expect(readCachedFormSteps("DS160", "united_states")).toBeNull();
  });
});
