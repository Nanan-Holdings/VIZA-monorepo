import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVE_APPLICATION_SELECTION_STORAGE_KEY,
  isOngoingApplicationState,
  readActiveApplicationSelection,
  setActiveApplicationSelection,
} from "./active-application-selection";

describe("active application selection", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => [...values.keys()][index] ?? null,
        get length() { return values.size; },
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      } satisfies Storage,
    });
  });

  it("preserves the exact application id for otherwise identical visas", () => {
    setActiveApplicationSelection({
      applicationId: "application-two",
      packageId: "package-one",
      country: "thailand",
      visaType: "tdac",
      href: "/client/application/long-form?applicationId=application-two",
    });

    expect(readActiveApplicationSelection()).toMatchObject({
      applicationId: "application-two",
      packageId: "package-one",
      country: "thailand",
    });
  });

  it("discards malformed stored state", () => {
    window.localStorage.setItem(ACTIVE_APPLICATION_SELECTION_STORAGE_KEY, "not-json");
    expect(readActiveApplicationSelection()).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_APPLICATION_SELECTION_STORAGE_KEY)).toBeNull();
  });

  it("keeps submitted work selectable but excludes terminal outcomes", () => {
    expect(isOngoingApplicationState("submitted")).toBe(true);
    expect(isOngoingApplicationState("approved")).toBe(false);
    expect(isOngoingApplicationState("rejected")).toBe(false);
    expect(isOngoingApplicationState("cancelled")).toBe(false);
  });
});
