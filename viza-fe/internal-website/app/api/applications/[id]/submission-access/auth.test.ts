import { describe, expect, it } from "vitest";
import { resolveSubmissionAccessPayerAuthUserId } from "./auth";

const owner = {
  id: "profile-owner",
  auth_user_id: "auth-owner",
  dependant_of_user_id: null,
};

describe("resolveSubmissionAccessPayerAuthUserId", () => {
  it("accepts the Supabase session linked to the target owner", () => {
    expect(resolveSubmissionAccessPayerAuthUserId({
      profile: owner,
      groupPayerAuthUserId: null,
      legacySession: null,
      supabaseAuthUserId: "auth-owner",
    })).toBe("auth-owner");
  });

  it("accepts a signed legacy session that owns the target profile", () => {
    expect(resolveSubmissionAccessPayerAuthUserId({
      profile: owner,
      groupPayerAuthUserId: null,
      legacySession: {
        userId: "profile-owner",
        email: "owner@example.invalid",
      },
      supabaseAuthUserId: null,
    })).toBe("auth-owner");
  });

  it("uses the matching Supabase identity when a stale legacy cookie is also present", () => {
    expect(resolveSubmissionAccessPayerAuthUserId({
      profile: owner,
      groupPayerAuthUserId: null,
      legacySession: {
        userId: "profile-stale",
        email: "stale@example.invalid",
      },
      supabaseAuthUserId: "auth-owner",
    })).toBe("auth-owner");
  });

  it("fails closed when neither session owns the target application", () => {
    expect(resolveSubmissionAccessPayerAuthUserId({
      profile: owner,
      groupPayerAuthUserId: null,
      legacySession: {
        userId: "profile-other",
        email: "other@example.invalid",
        authUserId: "auth-other",
      },
      supabaseAuthUserId: "auth-other",
    })).toBeNull();
  });

  it("requires the authoritative group payer for a group application", () => {
    expect(resolveSubmissionAccessPayerAuthUserId({
      profile: owner,
      groupPayerAuthUserId: "auth-payer",
      legacySession: {
        userId: "profile-owner",
        email: "owner@example.invalid",
        authUserId: "auth-owner",
      },
      supabaseAuthUserId: "auth-owner",
    })).toBeNull();
    expect(resolveSubmissionAccessPayerAuthUserId({
      profile: owner,
      groupPayerAuthUserId: "auth-payer",
      legacySession: {
        userId: "profile-payer",
        email: "payer@example.invalid",
        authUserId: "auth-payer",
      },
      supabaseAuthUserId: null,
    })).toBe("auth-payer");
  });
});
