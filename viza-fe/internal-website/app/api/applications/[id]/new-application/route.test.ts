import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, createClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient,
}));

import { createNewUsApplication, normalizeCopiedDs160Answers, POST } from "./route-handler";

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
    createClient.mockReset();
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

  it("restarts an unsigned terminal DS-160 and copies answers plus document references", async () => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "blocked-id",
        applicant_id: "profile-id",
        country: "united_states",
        visa_type: "DS160",
        visa_package_id: "package-id",
        // Older rows may retain this generic status after the live run stops.
        status: "submitted",
        submission_result_status: "action_required",
        submission_result: { country: "US", status: "action_required" },
        confirmation_number: null,
        ds160_application_id: "AAOLD12345",
        ds160_dat_storage_path: "private/old/application.dat",
      },
      error: null,
    });
    const queueQuery = query({
      data: [{
        id: "blocked-queue",
        status: "ds160_blocked",
        // A stopped worker can leave old lease columns on a terminal row.
        locked_by: "old-worker",
        locked_at: "2026-09-28T18:00:00.000Z",
        locked_until: "2026-09-28T18:01:00.000Z",
        official_confirmation_number_encrypted: null,
        official_confirmation_page_url: null,
        live_submitted_at: null,
        ceac_result_payload: { status: "action_required" },
      }],
      error: null,
    });
    const finalFenceQuery = query({ data: [], error: null });
    const submissionJobsQuery = query({ data: [], error: null });
    const sourceAnswersQuery = query({
      data: [
        { field_name: "surname", value_text: "CHEN", value_json: null },
        { field_name: "ds160_application_id", value_text: "AAOLD12345", value_json: null },
        { field_name: "recovery", value_text: "old-checkpoint", value_json: null },
      ],
      error: null,
    });
    const sourceDocumentsQuery = query({
      data: [{
        document_type: "photo",
        storage_path: "application-documents/profile/photo.jpg",
        filename: "photo.jpg",
        status: "validated",
        rejection_reason: null,
      }],
      error: null,
    });
    const existingDraftQuery = query({ data: null, error: null });
    const createQuery = query({ data: { id: "new-draft-id" }, error: null });
    const copyAnswersQuery = query({ data: null, error: null });
    const copyDocumentsQuery = query({ data: null, error: null });
    const from = vi.fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(sourceQuery)
      .mockReturnValueOnce(queueQuery)
      .mockReturnValueOnce(finalFenceQuery)
      .mockReturnValueOnce(submissionJobsQuery)
      .mockReturnValueOnce(sourceAnswersQuery)
      .mockReturnValueOnce(sourceDocumentsQuery)
      .mockReturnValueOnce(existingDraftQuery)
      .mockReturnValueOnce(createQuery)
      .mockReturnValueOnce(copyAnswersQuery)
      .mockReturnValueOnce(copyDocumentsQuery);
    createAdminClient.mockReturnValue({ from });

    await expect(
      createNewUsApplication("user-id", "blocked-id", { intent: "restart_unsigned" }),
    ).resolves.toEqual({
      applicationId: "new-draft-id",
      country: "united_states",
      visaType: "DS160",
      status: 201,
    });

    expect(copyAnswersQuery.insert).toHaveBeenCalledWith([
      {
        application_id: "new-draft-id",
        field_name: "surname",
        value_text: "CHEN",
        value_json: null,
      },
    ]);
    expect(copyDocumentsQuery.insert).toHaveBeenCalledWith([
      {
        application_id: "new-draft-id",
        document_type: "photo",
        storage_path: "application-documents/profile/photo.jpg",
        filename: "photo.jpg",
        status: "validated",
        rejection_reason: null,
      },
    ]);
    expect(createQuery.insert).toHaveBeenCalledWith({
      applicant_id: "profile-id",
      country: "united_states",
      visa_type: "DS160",
      visa_package_id: "package-id",
      status: "draft",
    });
  });

  it("fills an owner-scoped empty restart draft with the source document references", async () => {
    const from = vi.fn()
      .mockReturnValueOnce(query({ data: { id: "profile-id" }, error: null }))
      .mockReturnValueOnce(query({
        data: {
          id: "blocked-id",
          applicant_id: "profile-id",
          country: "united_states",
          visa_type: "DS160",
          visa_package_id: "package-id",
          status: "blockedunsigned",
          submission_result_status: "action_required",
        },
        error: null,
      }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [{ field_name: "surname", value_text: "CHEN", value_json: null }], error: null }))
      .mockReturnValueOnce(query({ data: [{
        document_type: "passport_copy",
        storage_path: "application-documents/profile/passport.pdf",
        filename: "passport.pdf",
        status: "validated",
        rejection_reason: null,
      }], error: null }))
      .mockReturnValueOnce(query({ data: { id: "empty-draft", visa_package_id: "package-id" }, error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: null, error: null }))
      .mockReturnValueOnce(query({ data: null, error: null }))
      .mockReturnValueOnce(query({ data: null, error: null }));
    createAdminClient.mockReturnValue({ from });

    await expect(
      createNewUsApplication("user-id", "blocked-id", { intent: "restart_unsigned" }),
    ).resolves.toMatchObject({ applicationId: "empty-draft", status: 201 });
    expect(from).toHaveBeenCalledTimes(12);
    expect(from.mock.results[11]?.value.insert).toHaveBeenCalledWith([
      {
        application_id: "empty-draft",
        document_type: "passport_copy",
        storage_path: "application-documents/profile/passport.pdf",
        filename: "passport.pdf",
        status: "validated",
        rejection_reason: null,
      },
    ]);
  });

  it("fails closed when a restart has an active queue row", async () => {
    const from = vi.fn()
      .mockReturnValueOnce(query({ data: { id: "profile-id" }, error: null }))
      .mockReturnValueOnce(query({
        data: {
          id: "blocked-id",
          applicant_id: "profile-id",
          country: "united_states",
          visa_type: "DS160",
          status: "blockedunsigned",
          submission_result_status: "action_required",
          submission_result: { country: "US", status: "action_required" },
        },
        error: null,
      }))
      .mockReturnValueOnce(query({ data: [{ status: "processing" }], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }));
    createAdminClient.mockReturnValue({ from });

    await expect(
      createNewUsApplication("user-id", "blocked-id", { intent: "restart_unsigned" }),
    ).resolves.toEqual({
      error: "This DS-160 still has active submission work; wait for it to finish before restarting",
      status: 409,
    });
    expect(from).toHaveBeenCalledTimes(5);
  });

  it("rejects a restart when a final-submission fence exists", async () => {
    const from = vi.fn()
      .mockReturnValueOnce(query({ data: { id: "profile-id" }, error: null }))
      .mockReturnValueOnce(query({
        data: {
          id: "blocked-id",
          applicant_id: "profile-id",
          country: "united_states",
          visa_type: "DS160",
          status: "blockedunsigned",
          submission_result_status: "action_required",
        },
        error: null,
      }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [{ id: "fence-id", state: "started" }], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }));
    createAdminClient.mockReturnValue({ from });

    await expect(
      createNewUsApplication("user-id", "blocked-id", { intent: "restart_unsigned" }),
    ).resolves.toEqual({
      error: "This DS-160 already has a final-submission attempt and cannot be restarted",
      status: 409,
    });
  });

  it("rejects a restart when the source is already officially submitted", async () => {
    const from = vi.fn()
      .mockReturnValueOnce(query({ data: { id: "profile-id" }, error: null }))
      .mockReturnValueOnce(query({
        data: {
          id: "submitted-id",
          applicant_id: "profile-id",
          country: "united_states",
          visa_type: "DS160",
          status: "submitted",
          submission_result_status: "submitted",
          submission_result: { country: "US", status: "submitted", applicationId: "AA00TEST01" },
        },
        error: null,
      }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }));
    createAdminClient.mockReturnValue({ from });

    await expect(
      createNewUsApplication("user-id", "submitted-id", { intent: "restart_unsigned" }),
    ).resolves.toEqual({
      error: "This DS-160 has an official submission result and cannot be restarted",
      status: 409,
    });
  });

  it("does not overwrite a non-empty partial restart draft missing source documents", async () => {
    const from = vi.fn()
      .mockReturnValueOnce(query({ data: { id: "profile-id" }, error: null }))
      .mockReturnValueOnce(query({
        data: {
          id: "blocked-id",
          applicant_id: "profile-id",
          country: "united_states",
          visa_type: "DS160",
          status: "blockedunsigned",
          submission_result_status: "action_required",
        },
        error: null,
      }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [{ field_name: "surname", value_text: "CHEN", value_json: null }], error: null }))
      .mockReturnValueOnce(query({ data: [{
        document_type: "photo",
        storage_path: "source/photo.jpg",
        filename: "photo.jpg",
        status: "validated",
        rejection_reason: null,
      }], error: null }))
      .mockReturnValueOnce(query({ data: { id: "existing-draft", visa_package_id: "package-id" }, error: null }))
      .mockReturnValueOnce(query({ data: [{ field_name: "surname", value_text: "CHEN", value_json: null }], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }));
    createAdminClient.mockReturnValue({ from });

    await expect(
      createNewUsApplication("user-id", "blocked-id", { intent: "restart_unsigned" }),
    ).resolves.toEqual({
      error: "An existing DS-160 draft is incomplete or has different documents; refusing to overwrite it",
      status: 409,
    });
    expect(from).toHaveBeenCalledTimes(10);
  });

  it.each(["pending", "future_processing", "", "submitted"])("rejects an unverified submission job state: %s", async (status) => {
    const from = vi.fn()
      .mockReturnValueOnce(query({ data: { id: "profile-id" }, error: null }))
      .mockReturnValueOnce(query({ data: {
        id: "blocked-id", applicant_id: "profile-id", country: "united_states",
        visa_type: "DS160", status: "submitted", submission_result_status: "action_required",
      }, error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [{ status }], error: null }));
    createAdminClient.mockReturnValue({ from });

    await expect(createNewUsApplication("user-id", "blocked-id", { intent: "restart_unsigned" }))
      .resolves.toMatchObject({ status: 409 });
    expect(from).toHaveBeenCalledTimes(5);
  });

  it("rejects a competing answer copy that changed the restarted draft", async () => {
    const from = vi.fn()
      .mockReturnValueOnce(query({ data: { id: "profile-id" }, error: null }))
      .mockReturnValueOnce(query({ data: {
        id: "blocked-id", applicant_id: "profile-id", country: "united_states",
        visa_type: "DS160", visa_package_id: "package-id", status: "submitted",
        submission_result_status: "action_required",
      }, error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [{ field_name: "surname", value_text: "CHEN", value_json: null }], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: null, error: null }))
      .mockReturnValueOnce(query({ data: { id: "new-draft" }, error: null }))
      .mockReturnValueOnce(query({ data: null, error: { code: "23505", message: "duplicate key" } }))
      .mockReturnValueOnce(query({ data: { id: "new-draft", visa_package_id: "package-id" }, error: null }))
      .mockReturnValueOnce(query({ data: [{ field_name: "surname", value_text: "LI", value_json: null }], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }));
    createAdminClient.mockReturnValue({ from });

    await expect(createNewUsApplication("user-id", "blocked-id", { intent: "restart_unsigned" }))
      .resolves.toEqual({
        error: "The concurrent DS-160 draft has different answers; refusing to overwrite it",
        status: 409,
      });
    expect(from).toHaveBeenCalledTimes(13);
  });

  it("rejects unknown POST intents instead of falling back to submitted-only safety", async () => {
    createClient.mockReturnValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-id" } } })) },
    });
    createAdminClient.mockReturnValue({ from: vi.fn() });

    const response = await POST(
      new Request("http://localhost/api/applications/source/new-application", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "typo" }),
      }),
      { params: Promise.resolve({ id: "source-id" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Unsupported new-application intent" });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
