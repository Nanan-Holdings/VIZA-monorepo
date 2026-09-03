import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, createClient, getClientSessionWithFallback } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  getClientSessionWithFallback: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/client-session", () => ({ getClientSessionWithFallback }));

import { getTeamApplicationContext } from "./application-group";

function query(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

const application = {
  id: "application-id",
  applicant_id: "profile-id",
  group_id: null,
  country: "south_korea",
  visa_type: "KR_E_ARRIVAL_CARD",
  visa_package_id: "package-id",
  status: "draft",
  confirmation_number: null,
  submitted_at: null,
  submission_result: null,
  submission_result_status: null,
  arrival_date: null,
  departure_date: null,
  port_of_entry: null,
  purpose: null,
  accommodation_name: null,
  accommodation_address: null,
};

const profile = {
  id: "profile-id",
  auth_user_id: "auth-user-id",
  dependant_of_user_id: null,
  surname: "Kim",
  given_names: "Mina",
  date_of_birth: "2001-06-22",
  nationality: "KR",
  gender: "F",
  passport_number: "REDACTED",
  passport_expiry_date: "2030-01-01",
};

describe("getTeamApplicationContext", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
    createClient.mockReset();
    getClientSessionWithFallback.mockReset();
  });

  it("loads an explicit application with a signed VIZA client session only", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "profile-id",
      email: "applicant@example.com",
    });

    // The application and its owning profile come back from one query.
    const applicationQuery = query({
      data: { ...application, applicant_profiles: profile },
      error: null,
    });
    const from = vi.fn().mockReturnValue(applicationQuery);
    createAdminClient.mockReturnValue({ from });

    const result = await getTeamApplicationContext("application-id");

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      application: expect.objectContaining({
        id: "application-id",
        country: "south_korea",
        visa_type: "KR_E_ARRIVAL_CARD",
      }),
      profile: expect.objectContaining({
        id: "profile-id",
        surname: "Kim",
        given_names: "Mina",
        date_of_birth: "2001-06-22",
      }),
    }));
    expect(createClient).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
    expect(applicationQuery.eq).toHaveBeenCalledWith("id", "application-id");
  });

  it("falls back to separate reads when the embedded profile is unavailable", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "profile-id",
      email: "applicant@example.com",
    });

    const embedQuery = query({ data: null, error: { message: "embed unsupported" } });
    const applicationQuery = query({ data: application, error: null });
    const profileQuery = query({ data: profile, error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(embedQuery)
      .mockReturnValueOnce(applicationQuery)
      .mockReturnValueOnce(profileQuery);
    createAdminClient.mockReturnValue({ from });

    const result = await getTeamApplicationContext("application-id");

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      application: expect.objectContaining({ id: "application-id" }),
      profile: expect.objectContaining({ id: "profile-id", surname: "Kim" }),
    }));
    expect(profileQuery.eq).toHaveBeenCalledWith("id", "profile-id");
  });

  it("does not authorize a different applicant profile", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "different-profile-id",
      email: "other@example.com",
    });

    // A profile the session does not own falls through to the group-payer
    // check on the original path, which then refuses.
    const embedQuery = query({
      data: { ...application, applicant_profiles: profile },
      error: null,
    });
    const applicationQuery = query({ data: application, error: null });
    const ownerQuery = query({ data: profile, error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(embedQuery)
      .mockReturnValueOnce(applicationQuery)
      .mockReturnValueOnce(ownerQuery);
    createAdminClient.mockReturnValue({ from });

    await expect(getTeamApplicationContext("application-id")).resolves.toEqual({
      ok: false,
      reason: "Unauthorized",
    });
  });

  it("returns an authentication error when neither client session is available", async () => {
    getClientSessionWithFallback.mockResolvedValue(null);

    await expect(getTeamApplicationContext("application-id")).resolves.toEqual({
      ok: false,
      reason: "Not authenticated",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
