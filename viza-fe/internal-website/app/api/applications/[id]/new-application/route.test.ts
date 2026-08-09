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

import { createNewUsApplication, normalizeCopiedDs160Answers } from "./route-handler";

function query(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

describe("createNewUsApplication", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
  });

  it("adds canonical DS-160 fields when a submitted application uses legacy aliases", () => {
    expect(
      normalizeCopiedDs160Answers([
        { field_name: "has_other_names", value_text: "no", value_json: null },
        { field_name: "has_other_phone", value_text: "no", value_json: null },
        { field_name: "has_other_emails", value_text: "yes", value_json: null },
      ]),
    ).toEqual([
      { field_name: "has_other_names", value_text: "no", value_json: null },
      { field_name: "has_other_phone", value_text: "no", value_json: null },
      { field_name: "has_other_emails", value_text: "yes", value_json: null },
      { field_name: "other_names_used", value_text: "no", value_json: null },
      { field_name: "has_other_phones", value_text: "no", value_json: null },
    ]);
  });

  it("creates a new draft with the submitted application's saved answers", async () => {
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
    const sourceAnswersQuery = query({
      data: [
        {
          field_name: "surname",
          value_text: "CHEN",
          value_json: null,
        },
        {
          field_name: "other_names_used",
          value_text: "no",
          value_json: null,
        },
      ],
      error: null,
    });
    const createQuery = query({ data: { id: "new-draft-id" }, error: null });
    const copyAnswersQuery = query({ data: null, error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(sourceQuery)
      .mockReturnValueOnce(sourceAnswersQuery)
      .mockReturnValueOnce(createQuery)
      .mockReturnValueOnce(copyAnswersQuery);
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
    expect(copyAnswersQuery.insert).toHaveBeenCalledWith([
      {
        application_id: "new-draft-id",
        field_name: "surname",
        value_text: "CHEN",
        value_json: null,
      },
      {
        application_id: "new-draft-id",
        field_name: "other_names_used",
        value_text: "no",
        value_json: null,
      },
    ]);
    expect(from).toHaveBeenCalledTimes(5);
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
