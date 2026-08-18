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
    order: vi.fn(() => builder),
    insert: vi.fn((_values: unknown) => builder),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const successfulSubmissionResult = {
  country: "VN",
  visaType: "VN_PREARRIVAL_DECLARATION",
  status: "submitted",
  submitted: true,
};

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
        submission_result: successfulSubmissionResult,
      },
      error: null,
    });
    const existingQuery = query({ data: [], error: null });
    const createQuery = query({ data: { id: "new-application-id" }, error: null });
    const answersQuery = query({ data: [], error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(sourceQuery)
      .mockReturnValueOnce(existingQuery)
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

  it("reuses an existing ongoing draft instead of violating the uniqueness index", async () => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "source-id",
        applicant_id: "profile-id",
        country: "malaysia",
        visa_type: "MY_MDAC_ARRIVAL_CARD",
        visa_package_id: "package-id",
        submission_result: {
          ...successfulSubmissionResult,
          country: "MY",
          visaType: "MY_MDAC_ARRIVAL_CARD",
        },
      },
      error: null,
    });
    const existingQuery = query({
      data: [{
        id: "existing-draft-id",
        country: "malaysia",
        visa_type: "MY_MDAC_ARRIVAL_CARD",
        status: "draft",
        submission_result_status: null,
        result_status: null,
        submission_result: null,
      }],
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(sourceQuery)
      .mockReturnValueOnce(existingQuery);
    createAdminClient.mockReturnValue({ from });

    await expect(createNewArrivalCardApplication("user-id", "source-id")).resolves.toEqual({
      applicationId: "existing-draft-id",
      country: "malaysia",
      visaType: "MY_MDAC_ARRIVAL_CARD",
      status: 200,
    });
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("recovers the concurrently-created draft after a unique-index race", async () => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "source-id",
        applicant_id: "profile-id",
        country: "malaysia",
        visa_type: "MY_MDAC_ARRIVAL_CARD",
        visa_package_id: "package-id",
        submission_result: {
          ...successfulSubmissionResult,
          country: "MY",
          visaType: "MY_MDAC_ARRIVAL_CARD",
        },
      },
      error: null,
    });
    const noExistingQuery = query({ data: [], error: null });
    const createQuery = query({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const concurrentQuery = query({
      data: [{
        id: "concurrent-draft-id",
        country: "malaysia",
        visa_type: "MY_MDAC_ARRIVAL_CARD",
        status: "draft",
        submission_result_status: null,
        result_status: null,
        submission_result: null,
      }],
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(sourceQuery)
      .mockReturnValueOnce(noExistingQuery)
      .mockReturnValueOnce(createQuery)
      .mockReturnValueOnce(concurrentQuery);
    createAdminClient.mockReturnValue({ from });

    await expect(createNewArrivalCardApplication("user-id", "source-id")).resolves.toEqual({
      applicationId: "concurrent-draft-id",
      country: "malaysia",
      visaType: "MY_MDAC_ARRIVAL_CARD",
      status: 200,
    });
  });

  it("does not open another application before the current one succeeds", async () => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "source-id",
        applicant_id: "profile-id",
        country: "malaysia",
        visa_type: "MY_MDAC_ARRIVAL_CARD",
        visa_package_id: "package-id",
        submission_result: null,
      },
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(sourceQuery);
    createAdminClient.mockReturnValue({ from });

    await expect(createNewArrivalCardApplication("user-id", "source-id")).resolves.toEqual({
      error: "The previous arrival-card application must be successfully submitted before starting another.",
      status: 409,
    });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("copies only stable identity and passport answers for Korea repeat applications", async () => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const sourceQuery = query({
      data: {
        id: "source-id",
        applicant_id: "profile-id",
        country: "south_korea",
        visa_type: "KR_E_ARRIVAL_CARD",
        visa_package_id: "package-id",
        submission_result: {
          country: "KR",
          visaType: "KR_E_ARRIVAL_CARD",
          status: "submitted",
          mode: "live_assisted",
          provider: "korea_e_arrival_card_live",
          applicationId: "source-id",
          submitted: true,
          issueNumber: "KR-12345",
          portalUrl: "https://www.e-arrivalcard.go.kr/portal/check",
          confirmationPdfStoragePath: "applications/korea/confirmation.pdf",
        },
      },
      error: null,
    });
    const existingQuery = query({ data: [], error: null });
    const createQuery = query({ data: { id: "new-application-id" }, error: null });
    const answersQuery = query({
      data: [
        { field_name: "full_name", value_text: "Traveller", value_json: null },
        { field_name: "passport_number", value_text: "P123", value_json: null },
        { field_name: "occupation", value_text: "Student", value_json: null },
        { field_name: "email_address", value_text: "traveller@example.com", value_json: null },
        { field_name: "stay_address_en", value_text: "Seoul", value_json: null },
        { field_name: "kr_eac_eligibility", value_text: "needs_declaration", value_json: null },
      ],
      error: null,
    });
    const copyAnswersQuery = query({ data: null, error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(sourceQuery)
      .mockReturnValueOnce(existingQuery)
      .mockReturnValueOnce(createQuery)
      .mockReturnValueOnce(answersQuery)
      .mockReturnValueOnce(copyAnswersQuery);
    createAdminClient.mockReturnValue({ from });

    await expect(createNewArrivalCardApplication("user-id", "source-id")).resolves.toMatchObject({
      applicationId: "new-application-id",
      status: 201,
    });

    expect(answersQuery.in).toHaveBeenCalledWith("field_name", [
      "full_name",
      "full_name_zh",
      "full_name_en",
      "first_name",
      "middle_name",
      "last_name",
      "suffix",
      "passport_number",
      "passport_expiry_date",
      "passport_issue_date",
      "passport_issuing_authority",
      "passport_issuing_country",
      "sex",
      "gender",
      "date_of_birth",
      "nationality",
      "citizenship",
      "place_of_birth_country",
      "country_of_birth",
    ]);
    expect(copyAnswersQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({ field_name: "full_name" }),
      expect.objectContaining({ field_name: "passport_number" }),
    ]);
    expect(copyAnswersQuery.insert).not.toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ field_name: "occupation" }),
      expect.objectContaining({ field_name: "email_address" }),
      expect.objectContaining({ field_name: "stay_address_en" }),
      expect.objectContaining({ field_name: "kr_eac_eligibility" }),
    ]));
  });
});
