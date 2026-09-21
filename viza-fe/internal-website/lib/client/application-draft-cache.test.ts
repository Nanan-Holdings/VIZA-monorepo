import { beforeEach, describe, expect, it } from "vitest";
import {
  clearApplicationDraftCache,
  clearSavedApplicationDraftCache,
  readApplicationDraftCache,
  syncApplicationDraftCache,
  writeApplicationDraftCache,
  type ApplicationDraftCacheScope,
} from "./application-draft-cache";

const scope: ApplicationDraftCacheScope = {
  applicationId: "application-1",
  profileId: "profile-1",
  country: "united_states",
  visaType: "DS160",
};

beforeEach(() => {
  sessionStorage.clear();
});

describe("application draft cache", () => {
  it("isolates pending patches by application and profile", () => {
    writeApplicationDraftCache(scope, { employer_name: "QA SCHOOL" });

    expect(readApplicationDraftCache(scope)?.answers).toEqual({ employer_name: "QA SCHOOL" });
    expect(readApplicationDraftCache({ ...scope, applicationId: "application-2" })).toBeNull();
    expect(readApplicationDraftCache({ ...scope, profileId: "profile-2" })).toBeNull();
  });

  it("keeps empty tombstones so hidden answers cannot return after refresh", () => {
    writeApplicationDraftCache(scope, {
      other_nationality_country__2: "JPN",
      other_nationality: "no",
    });
    const entry = writeApplicationDraftCache(scope, {
      other_nationality_country__2: "",
    });

    expect(entry?.answers).toEqual({
      other_nationality_country__2: "",
      other_nationality: "no",
    });
  });

  it("caches only the changed fields from a complete step patch", () => {
    syncApplicationDraftCache(
      scope,
      { employer_name: "NEW SCHOOL", ordinary_saved: "SERVER VALUE", removed_row: "" },
      { employer_name: "OLD SCHOOL", ordinary_saved: "SERVER VALUE", removed_row: "OLD ROW" },
    );

    expect(readApplicationDraftCache(scope)?.answers).toEqual({
      employer_name: "NEW SCHOOL",
      removed_row: "",
    });

    syncApplicationDraftCache(
      scope,
      { employer_name: "OLD SCHOOL", removed_row: "OLD ROW" },
      { employer_name: "OLD SCHOOL", removed_row: "OLD ROW" },
    );
    const reverted = readApplicationDraftCache(scope);
    expect(reverted?.answers).toEqual({
      employer_name: "OLD SCHOOL",
      removed_row: "OLD ROW",
    });
    clearSavedApplicationDraftCache(scope, reverted?.answers ?? {}, reverted?.revision);
    expect(readApplicationDraftCache(scope)).toBeNull();
  });

  it("does not clear a newer edit when an older save resolves", () => {
    const queued = writeApplicationDraftCache(scope, { employer_name: "OLD" });
    expect(queued).not.toBeNull();
    writeApplicationDraftCache(scope, { employer_name: "NEW" });

    clearSavedApplicationDraftCache(scope, { employer_name: "OLD" }, queued?.revision);

    expect(readApplicationDraftCache(scope)?.answers).toEqual({ employer_name: "NEW" });
  });

  it("clears only the submitted values and leaves unrelated pending fields", () => {
    const queued = writeApplicationDraftCache(scope, {
      employer_name: "QA SCHOOL",
      marital_status: "M",
    });

    clearSavedApplicationDraftCache(scope, { employer_name: "QA SCHOOL" }, queued?.revision);

    expect(readApplicationDraftCache(scope)?.answers).toEqual({ marital_status: "M" });
  });

  it("removes a scope after its final patch is durably saved", () => {
    const queued = writeApplicationDraftCache(scope, { employer_name: "QA SCHOOL" });
    clearSavedApplicationDraftCache(scope, { employer_name: "QA SCHOOL" }, queued?.revision);
    expect(readApplicationDraftCache(scope)).toBeNull();

    writeApplicationDraftCache(scope, { employer_name: "SHOULD BE CLEARED" });
    clearApplicationDraftCache(scope);
    expect(readApplicationDraftCache(scope)).toBeNull();
  });
});
