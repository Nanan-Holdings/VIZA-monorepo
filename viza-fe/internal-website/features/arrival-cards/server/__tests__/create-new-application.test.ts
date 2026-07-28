import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}));

import { createNewArrivalCardApplication } from "../create-new-application";

function query(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  return builder;
}

describe("createNewArrivalCardApplication", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
  });

  it("creates a new Vietnam Pre-Arrival draft instead of rejecting its visa type", async () => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "source-id",
        applicant_id: "profile-id",
        country: "vietnam",
        visa_type: "VN_PREARRIVAL_DECLARATION",
        visa_package_id: "package-id",
      },
      error: null,
    });
    const createQuery = query({ data: { id: "new-application-id" }, error: null });
    const answersQuery = query({ data: [], error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(sourceQuery)
      .mockReturnValueOnce(createQuery)
      .mockReturnValueOnce(answersQuery);
    createAdminClient.mockReturnValue({ from });

    const result = await createNewArrivalCardApplication("user-id", "source-id");

    expect(result).toEqual({
      applicationId: "new-application-id",
      country: "vietnam",
      visaType: "VN_PREARRIVAL_DECLARATION",
      status: 201,
    });
    expect(createQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        country: "vietnam",
        visa_type: "VN_PREARRIVAL_DECLARATION",
        status: "draft",
      }),
    );
  });
});
