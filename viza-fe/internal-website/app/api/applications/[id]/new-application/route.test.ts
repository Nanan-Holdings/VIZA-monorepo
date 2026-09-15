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
    update: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    or: vi.fn(() => builder),
    limit: vi.fn(() => builder),
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

  it.each(["submitted", "processing"])("creates a draft from the official submitted result when application status is %s", async (status) => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "submitted-id",
        applicant_id: "profile-id",
        country: "united_states",
        visa_type: "B1_B2",
        visa_package_id: "package-id",
        status,
        submission_result_status: "submitted",
        submission_result: { country: "US", status: "submitted", applicationId: "AA00TEST01" },
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
    const existingDraftQuery = query({ data: null, error: null });
    const from = vi.fn().mockReturnValueOnce(profileQuery).mockReturnValueOnce(sourceQuery);
    from.mockReturnValueOnce(sourceAnswersQuery).mockReturnValueOnce(existingDraftQuery).mockReturnValueOnce(createQuery).mockReturnValueOnce(copyAnswersQuery);
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
    expect(from).toHaveBeenCalledTimes(6);
  });

  it.each(["draft", "stopped_at_sign"])("does not create a new draft from an unfinished %s result", async (status) => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "draft-id",
        applicant_id: "profile-id",
        country: "united_states",
        visa_type: "B1_B2",
        visa_package_id: "package-id",
        status: "draft",
        submission_result_status: status,
        submission_result: { country: "US", status, applicationId: "AA00TEST01" },
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

  it("does not reuse a QA placeholder draft when starting the next DS-160", async () => {
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
      data: [{ field_name: "surname", value_text: "CHEN", value_json: null }],
      error: null,
    });
    const qaDraftResult = {
      data: { id: "qa-placeholder-id", visa_package_id: null, purpose: "VIZA_PLACEHOLDER_DRY_RUN" },
      error: null,
    };
    const existingDraftQuery = query(qaDraftResult);
    existingDraftQuery.maybeSingle.mockImplementation(async () => (
      existingDraftQuery.or.mock.calls.length > 0 ? { data: null, error: null } : qaDraftResult
    ));
    const createQuery = query({ data: { id: "new-draft-id" }, error: null });
    const copyQuery = query({ data: null, error: null });
    const from = vi.fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(sourceQuery)
      .mockReturnValueOnce(sourceAnswersQuery)
      .mockReturnValueOnce(existingDraftQuery)
      .mockReturnValueOnce(createQuery)
      .mockReturnValueOnce(copyQuery);
    createAdminClient.mockReturnValue({ from });

    await expect(createNewUsApplication("user-id", "submitted-id")).resolves.toEqual({
      applicationId: "new-draft-id",
      country: "united_states",
      visaType: "B1_B2",
      status: 201,
    });
    expect(existingDraftQuery.or).toHaveBeenCalledWith("purpose.is.null,purpose.neq.VIZA_PLACEHOLDER_DRY_RUN");
    expect(existingDraftQuery.update).not.toHaveBeenCalled();
    expect(createQuery.insert).toHaveBeenCalledWith({
      applicant_id: "profile-id",
      country: "united_states",
      visa_type: "B1_B2",
      visa_package_id: "package-id",
      status: "draft",
    });
  });

  it.each([false, true])("reopens an existing draft and preserves existing answers: %s", async (hasAnswers) => {
    const existingDraftQuery = query({ data: { id: "existing-draft", visa_package_id: null }, error: null });
    const existingAnswersQuery = query({ data: hasAnswers ? [{ field_name: "surname" }] : [], error: null });
    const packageUpdateQuery = query({ data: null, error: null });
    const copyQuery = query({ data: null, error: null });
    const from = vi.fn()
      .mockReturnValueOnce(query({ data: { id: "profile-id" }, error: null }))
      .mockReturnValueOnce(query({ data: {
        id: "submitted-id", applicant_id: "profile-id", country: "united_states", visa_type: "DS160", visa_package_id: "source-package", status: "submitted",
      }, error: null }))
      .mockReturnValueOnce(query({ data: [{ field_name: "surname", value_text: "CHEN", value_json: null }], error: null }))
      .mockReturnValueOnce(existingDraftQuery)
      .mockReturnValueOnce(existingAnswersQuery)
      .mockReturnValueOnce(packageUpdateQuery)
      .mockReturnValueOnce(copyQuery);
    createAdminClient.mockReturnValue({ from });
    const result = await createNewUsApplication("user-id", "submitted-id");
    expect(result).toMatchObject({ applicationId: "existing-draft", status: hasAnswers ? 200 : 201 });
    expect(existingDraftQuery.insert).not.toHaveBeenCalled();
    expect(existingDraftQuery.or).toHaveBeenCalledWith("purpose.is.null,purpose.neq.VIZA_PLACEHOLDER_DRY_RUN");
    expect(packageUpdateQuery.update).toHaveBeenCalledWith({
      visa_package_id: "source-package",
      updated_at: expect.any(String),
    });
    expect(packageUpdateQuery.eq).toHaveBeenCalledWith("id", "existing-draft");
    expect(packageUpdateQuery.eq).toHaveBeenCalledWith("applicant_id", "profile-id");
    expect(packageUpdateQuery.is).toHaveBeenCalledWith("visa_package_id", null);
    if (hasAnswers) expect(copyQuery.insert).not.toHaveBeenCalled();
    else expect(copyQuery.insert).toHaveBeenCalledWith([
      { application_id: "existing-draft", field_name: "surname", value_text: "CHEN", value_json: null },
    ]);
  });

  it("does not overwrite an existing package when reopening a non-empty draft", async () => {
    const existingDraftQuery = query({ data: { id: "existing-draft", visa_package_id: "existing-package" }, error: null });
    const from = vi.fn()
      .mockReturnValueOnce(query({ data: { id: "profile-id" }, error: null }))
      .mockReturnValueOnce(query({ data: {
        id: "submitted-id", applicant_id: "profile-id", country: "united_states", visa_type: "DS160", visa_package_id: "source-package", status: "submitted",
      }, error: null }))
      .mockReturnValueOnce(query({ data: [{ field_name: "surname", value_text: "CHEN", value_json: null }], error: null }))
      .mockReturnValueOnce(existingDraftQuery)
      .mockReturnValueOnce(query({ data: [{ field_name: "surname" }], error: null }));
    createAdminClient.mockReturnValue({ from });

    await expect(createNewUsApplication("user-id", "submitted-id")).resolves.toMatchObject({
      applicationId: "existing-draft",
      status: 200,
    });
    expect(existingDraftQuery.update).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(5);
  });

  it("rejects a submitted-result source owned by another applicant", async () => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "submitted-id",
        applicant_id: "different-profile-id",
        country: "united_states",
        visa_type: "B1_B2",
        status: "submitted",
      },
      error: null,
    });
    const from = vi.fn().mockReturnValueOnce(profileQuery).mockReturnValueOnce(sourceQuery);
    createAdminClient.mockReturnValue({ from });

    await expect(createNewUsApplication("user-id", "submitted-id")).resolves.toEqual({
      error: "Forbidden",
      status: 403,
    });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("reuses the owner draft after a concurrent unique-application race", async () => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "submitted-id",
        applicant_id: "profile-id",
        country: "united_states",
        visa_type: "B1_B2",
        visa_package_id: "package-id",
        status: "processing",
        submission_result_status: "submitted",
        submission_result: { country: "US", status: "submitted", applicationId: "AA00TEST01" },
      },
      error: null,
    });
    const sourceAnswersQuery = query({
      data: [{ field_name: "surname", value_text: "CHEN", value_json: null }],
      error: null,
    });
    const initialDraftQuery = query({ data: null, error: null });
    const createQuery = query({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    const concurrentDraftQuery = query({ data: { id: "concurrent-draft-id", visa_package_id: null }, error: null });
    const concurrentAnswersQuery = query({ data: [], error: null });
    const concurrentPackageUpdateQuery = query({ data: null, error: null });
    const copyQuery = query({ data: null, error: null });
    const from = vi.fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(sourceQuery)
      .mockReturnValueOnce(sourceAnswersQuery)
      .mockReturnValueOnce(initialDraftQuery)
      .mockReturnValueOnce(createQuery)
      .mockReturnValueOnce(concurrentDraftQuery)
      .mockReturnValueOnce(concurrentAnswersQuery)
      .mockReturnValueOnce(concurrentPackageUpdateQuery)
      .mockReturnValueOnce(copyQuery);
    createAdminClient.mockReturnValue({ from });

    await expect(createNewUsApplication("user-id", "submitted-id")).resolves.toEqual({
      applicationId: "concurrent-draft-id",
      country: "united_states",
      visaType: "B1_B2",
      status: 201,
    });
    expect(copyQuery.insert).toHaveBeenCalledWith([
      {
        application_id: "concurrent-draft-id",
        field_name: "surname",
        value_text: "CHEN",
        value_json: null,
      },
    ]);
    expect(concurrentPackageUpdateQuery.update).toHaveBeenCalledWith({
      visa_package_id: "package-id",
      updated_at: expect.any(String),
    });
    expect(initialDraftQuery.or).toHaveBeenCalledWith("purpose.is.null,purpose.neq.VIZA_PLACEHOLDER_DRY_RUN");
    expect(concurrentDraftQuery.or).toHaveBeenCalledWith("purpose.is.null,purpose.neq.VIZA_PLACEHOLDER_DRY_RUN");
  });

  it("returns a server error when a unique-application race cannot be re-read", async () => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "submitted-id",
        applicant_id: "profile-id",
        country: "united_states",
        visa_type: "B1_B2",
        status: "submitted",
      },
      error: null,
    });
    const sourceAnswersQuery = query({
      data: [{ field_name: "surname", value_text: "CHEN", value_json: null }],
      error: null,
    });
    const initialDraftQuery = query({ data: null, error: null });
    const createQuery = query({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const concurrentDraftQuery = query({ data: null, error: null });
    const from = vi.fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(sourceQuery)
      .mockReturnValueOnce(sourceAnswersQuery)
      .mockReturnValueOnce(initialDraftQuery)
      .mockReturnValueOnce(createQuery)
      .mockReturnValueOnce(concurrentDraftQuery);
    createAdminClient.mockReturnValue({ from });

    await expect(createNewUsApplication("user-id", "submitted-id")).resolves.toEqual({
      error: "Could not create a new application",
      status: 500,
    });
    expect(from).toHaveBeenCalledTimes(6);
  });
});
