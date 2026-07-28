import { describe, expect, it } from "vitest";
import {
  resolveApplicantProfileForAuthUser,
  type ApplicantProfileIdentityRow,
  type ApplicantProfileIdentityStore,
} from "@/lib/applicant-profile-identity";

function createStore(rows: ApplicantProfileIdentityRow[]): ApplicantProfileIdentityStore {
  return {
    async findByAuthUserId(authUserId) {
      return { profile: rows.find((row) => row.auth_user_id === authUserId) ?? null };
    },
    async findByEmail(email) {
      return {
        profile:
          rows.find((row) => row.email?.toLowerCase() === email.toLowerCase()) ?? null,
      };
    },
    async bindProfileToAuthUser(profileId, authUserId) {
      const row = rows.find((candidate) => candidate.id === profileId);
      if (!row) return { profile: null, error: "Profile not found" };
      row.auth_user_id = authUserId;
      return { profile: row };
    },
  };
}

describe("resolveApplicantProfileForAuthUser", () => {
  it("returns the profile already linked to the auth user", async () => {
    const profile = { id: "profile-1", auth_user_id: "auth-1", email: "user@example.com" };
    const result = await resolveApplicantProfileForAuthUser(createStore([profile]), {
      id: "auth-1",
      email: "user@example.com",
    });

    expect(result).toEqual({ profile, recoveredByEmail: false });
  });

  it("recovers and binds an email-matched profile when auth_user_id is missing", async () => {
    const profile = { id: "profile-1", auth_user_id: null, email: "e1484122@u.nus.edu" };
    const result = await resolveApplicantProfileForAuthUser(createStore([profile]), {
      id: "auth-new",
      email: "E1484122@u.nus.edu",
    });

    expect(result.profile?.id).toBe("profile-1");
    expect(result.profile?.auth_user_id).toBe("auth-new");
    expect(result.recoveredByEmail).toBe(true);
  });

  it("rebinds an email-matched profile when auth_user_id is stale", async () => {
    const profile = { id: "profile-1", auth_user_id: "auth-old", email: "e1484122@u.nus.edu" };
    const result = await resolveApplicantProfileForAuthUser(createStore([profile]), {
      id: "auth-new",
      email: "e1484122@u.nus.edu",
    });

    expect(result.profile?.auth_user_id).toBe("auth-new");
    expect(result.recoveredByEmail).toBe(true);
  });
});
