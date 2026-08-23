import { describe, expect, it } from "vitest";
import { getRecentApplicationTarget } from "./recent-application-target";
import type { ApplicationListItem } from "@/app/client/status/applications-list";

function record(overrides: Partial<ApplicationListItem["records"][number]>) {
  return {
    selectionKey: overrides.selectionKey ?? "record",
    applicationId: overrides.applicationId ?? "app",
    packageId: overrides.packageId ?? "package",
    visaLabel: overrides.visaLabel ?? "Visa",
    stateLabel: overrides.stateLabel ?? "Draft",
    tone: overrides.tone ?? "brand",
    progressPercent: overrides.progressPercent ?? 0,
    country: overrides.country ?? "taiwan",
    visaType: overrides.visaType ?? "TW_ENTRY_PERMIT",
    continueHref: overrides.continueHref ?? "/continue",
    detailHref: overrides.detailHref ?? "/detail",
    ongoing: overrides.ongoing ?? true,
    createdAt: overrides.createdAt ?? null,
    updatedAt: overrides.updatedAt ?? null,
    submittedAt: overrides.submittedAt ?? null,
  } satisfies ApplicationListItem["records"][number];
}

function item(records: ApplicationListItem["records"]): ApplicationListItem {
  return {
    key: "taiwan",
    countryKey: "taiwan",
    flag: "🇹🇼",
    countryLabel: "Taiwan",
    visaLabel: "Taiwan entry permit",
    stateLabel: "Draft",
    tone: "brand",
    progressPercent: 0,
    continueHref: records[0]?.continueHref ?? "/client/application",
    country: "taiwan",
    visaType: "TW_ENTRY_PERMIT",
    destinationId: "taiwan-entry-permit",
    records,
  };
}

describe("getRecentApplicationTarget", () => {
  it("continues the latest non-terminal application", () => {
    const target = getRecentApplicationTarget([
      item([
        record({
          selectionKey: "terminal-newer",
          applicationId: "terminal-newer",
          ongoing: false,
          updatedAt: "2026-08-20T10:00:00.000Z",
          detailHref: "/terminal-detail",
        }),
        record({
          selectionKey: "ongoing-older",
          applicationId: "ongoing-older",
          ongoing: true,
          updatedAt: "2026-08-10T10:00:00.000Z",
          continueHref: "/ongoing-continue",
        }),
      ]),
    ]);

    expect(target).toEqual({
      labelMode: "continue",
      href: "/ongoing-continue",
      applicationId: "ongoing-older",
    });
  });

  it("views the latest terminal application when all records are terminal", () => {
    const target = getRecentApplicationTarget([
      item([
        record({
          selectionKey: "created",
          applicationId: "created",
          ongoing: false,
          createdAt: "2026-08-01T10:00:00.000Z",
          detailHref: "/created-detail",
        }),
        record({
          selectionKey: "submitted",
          applicationId: "submitted",
          ongoing: false,
          submittedAt: "2026-08-21T10:00:00.000Z",
          detailHref: "/submitted-detail",
        }),
      ]),
    ]);

    expect(target).toEqual({
      labelMode: "view",
      href: "/submitted-detail",
      applicationId: "submitted",
    });
  });

  it("starts a new application when there are no real application records", () => {
    expect(getRecentApplicationTarget([])).toEqual({
      labelMode: "start",
      href: "#start-new-application",
      applicationId: null,
    });
  });
});
