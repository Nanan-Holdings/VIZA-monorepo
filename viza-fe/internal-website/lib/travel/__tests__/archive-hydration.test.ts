import { describe, expect, it } from "vitest";
import { shouldHydrateRemoteTravelArchive } from "@/lib/travel/archive-hydration";

describe("Travel archive hydration", () => {
  it("restores a durable archive when this device has no local archive", () => {
    expect(
      shouldHydrateRemoteTravelArchive({
        localArchivePresent: false,
        localChangedDuringHydration: false,
        localUpdatedAt: 200,
        remoteUpdatedAt: 100,
      })
    ).toBe(true);
  });

  it("uses a newer durable archive when both archives exist", () => {
    expect(
      shouldHydrateRemoteTravelArchive({
        localArchivePresent: true,
        localChangedDuringHydration: false,
        localUpdatedAt: 100,
        remoteUpdatedAt: 200,
      })
    ).toBe(true);
  });

  it("keeps a newer local archive", () => {
    expect(
      shouldHydrateRemoteTravelArchive({
        localArchivePresent: true,
        localChangedDuringHydration: false,
        localUpdatedAt: 200,
        remoteUpdatedAt: 100,
      })
    ).toBe(false);
  });

  it("never replaces input created while remote hydration was pending", () => {
    expect(
      shouldHydrateRemoteTravelArchive({
        localArchivePresent: false,
        localChangedDuringHydration: true,
        localUpdatedAt: 100,
        remoteUpdatedAt: 200,
      })
    ).toBe(false);
  });
});
