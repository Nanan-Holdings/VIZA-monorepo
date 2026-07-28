import { describe, expect, it } from "vitest";

import {
  resolveAuthenticatedUserId,
} from "@/lib/auth/get-authenticated-user";
import {
  chooseApplicantProfileForAuthSession,
} from "@/lib/client-session";

describe("applicant identity resolution", () => {
  it("returns applicant profile id instead of auth user id when a profile exists", async () => {
    expect(
      await resolveAuthenticatedUserId({
        authUserId: "auth-user-1",
        userRowId: null,
        applicantProfileId: "profile-1",
      }),
    ).toBe("profile-1");
  });

  it("allows email recovery only for an unlinked matching applicant profile", () => {
    expect(
      chooseApplicantProfileForAuthSession({
        authUserId: "auth-user-1",
        emailMatches: [{ id: "profile-1", auth_user_id: null }],
      }),
    ).toEqual({ action: "link", profileId: "profile-1" });
  });

  it("refuses to steal an email-matched profile linked to a different auth user", () => {
    expect(
      chooseApplicantProfileForAuthSession({
        authUserId: "auth-user-1",
        emailMatches: [{ id: "profile-1", auth_user_id: "auth-user-2" }],
      }),
    ).toEqual({ action: "conflict" });
  });
});
