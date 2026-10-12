import { describe, expect, it, vi } from "vitest";
import {
  loadStatusApplicantProfiles,
  type StatusApplicantProfile,
  type StatusProfileLookupColumn,
} from "./status-profile-lookup";

const profile: StatusApplicantProfile = {
  id: "profile-1",
  email: "applicant@example.com",
  auth_user_id: "auth-1",
};

describe("loadStatusApplicantProfiles", () => {
  it("uses one profile-id read for a current signed client session", async () => {
    const read = vi.fn(async () => ({ rows: [profile], failed: false }));

    const result = await loadStatusApplicantProfiles({
      sessionProfileId: profile.id,
      authUserId: "auth-1",
      authEmail: profile.email,
      read,
    });

    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith("id", profile.id);
    expect(result).toEqual({ profiles: [profile], failed: false, queryCount: 1 });
  });

  it("falls back to auth and email for an older signed session", async () => {
    const calls: Array<[StatusProfileLookupColumn, string]> = [];
    const read = vi.fn(async (column: StatusProfileLookupColumn, value: string) => {
      calls.push([column, value]);
      return {
        rows: column === "auth_user_id" ? [profile] : [],
        failed: false,
      };
    });

    const result = await loadStatusApplicantProfiles({
      sessionProfileId: "stale-profile-id",
      authUserId: "auth-1",
      authEmail: "applicant@example.com",
      read,
    });

    expect(calls).toEqual([
      ["id", "stale-profile-id"],
      ["auth_user_id", "auth-1"],
      ["email", "applicant@example.com"],
    ]);
    expect(result.profiles).toEqual([profile]);
    expect(result.queryCount).toBe(3);
  });

  it("retains all legacy lookup keys when no signed client session exists", async () => {
    const read = vi.fn(async (column: StatusProfileLookupColumn) => ({
      rows: column === "email" ? [profile] : [],
      failed: false,
    }));

    const result = await loadStatusApplicantProfiles({
      sessionProfileId: null,
      authUserId: "auth-1",
      authEmail: "applicant@example.com",
      read,
    });

    expect(read).toHaveBeenCalledTimes(3);
    expect(read).toHaveBeenCalledWith("auth_user_id", "auth-1");
    expect(read).toHaveBeenCalledWith("id", "auth-1");
    expect(read).toHaveBeenCalledWith("email", "applicant@example.com");
    expect(result.profiles).toEqual([profile]);
  });

  it("keeps a failed primary read visible while attempting compatibility fallbacks", async () => {
    const read = vi.fn(async (column: StatusProfileLookupColumn) => ({
      rows: column === "auth_user_id" ? [profile] : [],
      failed: column === "id",
    }));

    const result = await loadStatusApplicantProfiles({
      sessionProfileId: profile.id,
      authUserId: "auth-1",
      authEmail: null,
      read,
    });

    expect(read).toHaveBeenCalledTimes(2);
    expect(result.profiles).toEqual([profile]);
    expect(result.failed).toBe(true);
  });
});
