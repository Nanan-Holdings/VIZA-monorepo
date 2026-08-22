import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVE_APPLICATION_SELECTION_STORAGE_KEY,
  buildActiveApplicationFormHref,
  getActiveApplicationFormHref,
  isOngoingApplicationState,
  readActiveApplicationSelection,
  setActiveApplicationSelection,
} from "./active-application-selection";
import { buildApplicationHref } from "./application-progress";

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

  it("builds the Application tab href from the active selection instead of stale form history", () => {
    const selection = {
      applicationId: "taiwan-application",
      packageId: "taiwan-package",
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
      href: "/client/home",
    };

    setActiveApplicationSelection(selection);

    expect(buildActiveApplicationFormHref(selection)).toBe(
      "/client/application/long-form?applicationId=taiwan-application&country=taiwan&visaType=TW_ENTRY_PERMIT",
    );
    expect(getActiveApplicationFormHref()).toBe(
      "/client/application/long-form?applicationId=taiwan-application&country=taiwan&visaType=TW_ENTRY_PERMIT",
    );
  });

  it("repairs a stale country paired with a dedicated Philippines product", () => {
    const selection = setActiveApplicationSelection({
      applicationId: "misrouted-philippines-application",
      packageId: null,
      country: "vietnam",
      visaType: "PH_ETRAVEL_DEPARTURE_CARD",
      href: "/client/home",
    });

    expect(selection?.country).toBe("philippines");
    expect(selection && buildActiveApplicationFormHref(selection)).toBe(
      "/client/application/long-form?applicationId=misrouted-philippines-application&country=philippines&visaType=PH_ETRAVEL_DEPARTURE_CARD",
    );
  });

  it("keeps the exact application id in the Home application card href", () => {
    expect(
      buildApplicationHref({
        id: "taiwan-application",
        status: "in_progress",
        country: "taiwan",
        visa_type: "TW_ENTRY_PERMIT",
        visa_package_id: "taiwan-package",
        submission_result_status: null,
        submitted_at: null,
        created_at: "2026-08-15T00:00:00.000Z",
        updated_at: null,
      }),
    ).toBe(
      "/client/application/long-form?applicationId=taiwan-application&country=taiwan&visaType=TW_ENTRY_PERMIT",
    );
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
