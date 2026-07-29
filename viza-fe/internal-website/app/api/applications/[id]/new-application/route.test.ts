import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createNewUsApplication } from "./route";

function query(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  return builder;
}

describe("createNewUsApplication", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
  });

  it("creates a blank draft without copying the submitted application's answers", async () => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "submitted-id",
        applicant_id: "profile-id",
        country: "united_states",
        visa_type: "B1_B2",
        visa_package_id: "package-id",
        status: "submitted",
      },
      error: null,
    });
    const createQuery = query({ data: { id: "new-draft-id" }, error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(sourceQuery)
      .mockReturnValueOnce(createQuery);
    createAdminClient.mockReturnValue({ from });

    const result = await createNewUsApplication("user-id", "submitted-id");

    expect(result).toEqual({
      applicationId: "new-draft-id",
      country: "united_states",
      visaType: "B1_B2",
      status: 201,
    });
    expect(createQuery.insert).toHaveBeenCalledWith({
      applicant_id: "profile-id",
      country: "united_states",
      visa_type: "B1_B2",
      visa_package_id: "package-id",
      status: "draft",
    });
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("does not create a new draft from an unfinished application", async () => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "draft-id",
        applicant_id: "profile-id",
        country: "united_states",
        visa_type: "B1_B2",
        visa_package_id: "package-id",
        status: "draft",
      },
      error: null,
    });
    const from = vi.fn().mockReturnValueOnce(profileQuery).mockReturnValueOnce(sourceQuery);
    createAdminClient.mockReturnValue({ from });

    await expect(createNewUsApplication("user-id", "draft-id")).resolves.toEqual({
      error: "Only a submitted application can be used to start a new application",
      status: 409,
    });
    expect(from).toHaveBeenCalledTimes(2);
  });
});
