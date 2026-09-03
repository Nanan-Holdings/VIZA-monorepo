import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SEARCHABLE_VISA_DESTINATIONS } from "@/lib/visa-destinations";
import { shouldUseRagVisitorIntakeFallback } from "@/lib/rag-visitor-intake-form";
import { resolveVisaFormSchemaVisaType } from "@/lib/visa-form-schema-aliases";

const { createAdminClient, getClientSessionWithFallback, loadDocumentCenterData } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getClientSessionWithFallback: vi.fn(),
  loadDocumentCenterData: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/client-session", () => ({ getClientSessionWithFallback }));
vi.mock("@/app/client/documents/actions", () => ({ loadDocumentCenterData }));

import {
  loadAssistantDocumentReadiness,
  loadAssistantSchema,
  requireOwnedApplication,
} from "./server-context";
import { clearStaticVisaMetadataCache } from "@/lib/static-visa-metadata-cache";

function adminWithFormRows(rows: Array<Record<string, unknown>>): SupabaseClient {
  const result = { data: rows, error: null };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.then = (
    resolve: (value: typeof result) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient;
}

describe("requireOwnedApplication", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
    getClientSessionWithFallback.mockReset();
  });

  it("locks mutations but allows read-only history after a reliable success", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "profile-id",
      authUserId: "auth-user-id",
      email: "applicant@example.test",
    });
    const application = {
      id: "application-id",
      applicant_id: "profile-id",
      country: "malaysia",
      visa_type: "MY_MDAC_ARRIVAL_CARD",
      submitted_at: "2026-08-18T00:00:00.000Z",
      submission_result_status: "submitted",
      submission_result: {
        country: "MY",
        visaType: "MY_MDAC_ARRIVAL_CARD",
        status: "submitted",
        submitted: true,
      },
    };
    const applicationQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          ...application,
          applicant_profiles: {
            id: "profile-id",
            auth_user_id: "auth-user-id",
            dependant_of_user_id: null,
          },
        },
        error: null,
      }),
    };
    const admin = { from: vi.fn(() => applicationQuery) };
    createAdminClient.mockReturnValue({
      from: admin.from,
    });

    await expect(requireOwnedApplication("application-id")).resolves.toEqual({
      status: 409,
      error: "The form assistant is read-only after a successful submission. Start another application to continue.",
    });

    await expect(requireOwnedApplication("application-id", {
      allowSuccessfulSubmission: true,
    })).resolves.toMatchObject({
      formAssistantReadOnly: true,
      application: { id: "application-id" },
    });
    expect(admin.from).toHaveBeenCalledTimes(2);
    expect(admin.from).toHaveBeenNthCalledWith(1, "applications");
    expect(admin.from).toHaveBeenNthCalledWith(2, "applications");
    expect(applicationQuery.select).toHaveBeenCalledWith(expect.stringContaining(
      "applicant_profiles(id, auth_user_id, dependant_of_user_id)",
    ));
  });

  it("uses one ownership query per concurrent authenticated request", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "profile-id",
      authUserId: "auth-user-id",
      email: "applicant@example.test",
    });
    const applicationQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "application-id",
          applicant_id: "profile-id",
          country: "singapore",
          visa_type: "SG_ARRIVAL_CARD",
          submitted_at: null,
          submission_result_status: null,
          submission_result: null,
          applicant_profiles: [{
            id: "profile-id",
            auth_user_id: "auth-user-id",
            dependant_of_user_id: null,
          }],
        },
        error: null,
      }),
    };
    const admin = { from: vi.fn(() => applicationQuery) };
    createAdminClient.mockReturnValue(admin);

    const results = await Promise.all(Array.from({ length: 100 }, () => (
      requireOwnedApplication("application-id")
    )));

    expect(results.every((result) => !("status" in result))).toBe(true);
    expect(admin.from).toHaveBeenCalledTimes(100);
    expect(applicationQuery.maybeSingle).toHaveBeenCalledTimes(100);
  });

  it("keeps a fail-closed compatibility fallback for missing embeds", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "profile-id",
      authUserId: "auth-user-id",
    });
    const embeddedQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Could not find a relationship between applications and applicant_profiles" },
      }),
    };
    const fallbackApplicationQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "application-id",
          applicant_id: "profile-id",
          country: "singapore",
          visa_type: "SG_ARRIVAL_CARD",
          submitted_at: null,
          submission_result_status: null,
          submission_result: null,
        },
      }),
    };
    const fallbackProfileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "profile-id",
          auth_user_id: "auth-user-id",
          dependant_of_user_id: null,
        },
      }),
    };
    const admin = {
      from: vi.fn()
        .mockReturnValueOnce(embeddedQuery)
        .mockReturnValueOnce(fallbackApplicationQuery)
        .mockReturnValueOnce(fallbackProfileQuery),
    };
    createAdminClient.mockReturnValue(admin);

    await expect(requireOwnedApplication("application-id")).resolves.toMatchObject({
      application: { id: "application-id" },
    });
    expect(admin.from.mock.calls.map(([table]) => table)).toEqual([
      "applications",
      "applications",
      "applicant_profiles",
    ]);
  });

  it("retries the embedded owner without a legacy dependant column", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "profile-id",
      authUserId: "auth-user-id",
    });
    const missingColumnQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "column applicant_profiles.dependant_of_user_id does not exist" },
      }),
    };
    const compatibleEmbeddedQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "application-id",
          applicant_id: "profile-id",
          country: "singapore",
          visa_type: "SG_ARRIVAL_CARD",
          submitted_at: null,
          submission_result_status: null,
          submission_result: null,
          applicant_profiles: {
            id: "profile-id",
            auth_user_id: "auth-user-id",
          },
        },
        error: null,
      }),
    };
    const admin = {
      from: vi.fn()
        .mockReturnValueOnce(missingColumnQuery)
        .mockReturnValueOnce(compatibleEmbeddedQuery),
    };
    createAdminClient.mockReturnValue(admin);

    await expect(requireOwnedApplication("application-id")).resolves.toMatchObject({
      application: { id: "application-id" },
    });
    expect(admin.from).toHaveBeenCalledTimes(2);
    expect(compatibleEmbeddedQuery.select).toHaveBeenCalledWith(expect.stringContaining(
      "applicant_profiles(id, auth_user_id)",
    ));
  });

  it("preserves dependant ownership through the embedded relation", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "parent-profile-id",
      authUserId: "parent-auth-id",
    });
    const applicationQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "application-id",
          applicant_id: "dependant-profile-id",
          country: "singapore",
          visa_type: "SG_ARRIVAL_CARD",
          submitted_at: null,
          submission_result_status: null,
          submission_result: null,
          applicant_profiles: {
            id: "dependant-profile-id",
            auth_user_id: "dependant-auth-id",
            dependant_of_user_id: "parent-auth-id",
          },
        },
        error: null,
      }),
    };
    createAdminClient.mockReturnValue({ from: vi.fn(() => applicationQuery) });

    await expect(requireOwnedApplication("application-id")).resolves.toMatchObject({
      application: { applicant_id: "dependant-profile-id" },
    });
  });

  it("rejects an embedded profile owned by another user", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "requester-profile-id",
      authUserId: "requester-auth-id",
    });
    const applicationQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "application-id",
          applicant_id: "other-profile-id",
          country: "singapore",
          visa_type: "SG_ARRIVAL_CARD",
          submitted_at: null,
          submission_result_status: null,
          submission_result: null,
          applicant_profiles: {
            id: "other-profile-id",
            auth_user_id: "other-auth-id",
            dependant_of_user_id: null,
          },
        },
        error: null,
      }),
    };
    createAdminClient.mockReturnValue({ from: vi.fn(() => applicationQuery) });

    await expect(requireOwnedApplication("application-id")).resolves.toEqual({
      status: 403,
      error: "Unauthorized",
    });
  });

  it("fails closed without compatibility retries on an ordinary query error", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "profile-id",
      authUserId: "auth-user-id",
    });
    const applicationQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "temporary database timeout" },
      }),
    };
    const admin = { from: vi.fn(() => applicationQuery) };
    createAdminClient.mockReturnValue(admin);

    await expect(requireOwnedApplication("application-id")).resolves.toEqual({
      status: 404,
      error: "Application not found",
    });
    expect(admin.from).toHaveBeenCalledTimes(1);
  });
});

describe("loadAssistantSchema", () => {
  beforeEach(() => {
    clearStaticVisaMetadataCache();
  });

  it.each([
    ["germany", "tourist_evisa"],
    ["canada", "visitor_visa_or_evisa"],
    ["japan", "short_term_tourism_evisa"],
  ])("uses the same DB-free visitor intake fallback as the form for %s %s", async (country, visaType) => {
    const steps = await loadAssistantSchema(adminWithFormRows([]), country, visaType);

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.flatMap((step) => step.fields).map((field) => field.fieldName)).toEqual(
      expect.arrayContaining(["full_name", "passport_number", "arrival_date"]),
    );
  });

  it("loads an assistant schema for every current DB-free selectable form", async () => {
    const fallbackProducts = SEARCHABLE_VISA_DESTINATIONS
      .map((destination) => ({
        ...destination,
        schemaVisaType: resolveVisaFormSchemaVisaType(destination.visaType, destination.country),
      }))
      .filter((destination) => shouldUseRagVisitorIntakeFallback(destination.schemaVisaType));

    expect(fallbackProducts.length).toBeGreaterThan(20);
    const results = await Promise.all(fallbackProducts.map(async (product) => ({
      product,
      steps: await loadAssistantSchema(
        adminWithFormRows([]),
        product.country,
        product.visaType,
      ),
    })));

    expect(results.filter(({ steps }) => steps.length === 0).map(({ product }) => product.id)).toEqual([]);
  });

  it("does not invent a fallback for a normalized product whose reviewed schema is missing", async () => {
    expect(await loadAssistantSchema(
      adminWithFormRows([]),
      "united_states",
      "DS160",
    )).toEqual([]);
  });

  it("preserves a product-owned DB schema", async () => {
    const steps = await loadAssistantSchema(adminWithFormRows([{
      id: "field-id",
      visa_type: "SG_ARRIVAL_CARD",
      field_name: "full_name",
      field_label: "Full name",
      field_type: "text",
      is_required: true,
      step_number: 1,
      step_name: "Traveller",
      display_order: 1,
      placeholder: null,
      validation_rules: { label_zh: "护照姓名" },
      options: [{ value: "passport", text: "Passport" }],
      conditional_logic: { depends_on: "identity_type", equals: "passport" },
    }]), "singapore", "SG_ARRIVAL_CARD");

    expect(steps).toHaveLength(1);
    expect(steps[0]?.fields[0]).toMatchObject({
      fieldName: "full_name",
      visaType: "SG_ARRIVAL_CARD",
    });
  });

  it("coalesces one hundred concurrent assistant schema reads", async () => {
    const admin = adminWithFormRows([{
      id: "field-id",
      visa_type: "SG_ARRIVAL_CARD",
      field_name: "full_name",
      field_label: "Full name",
      field_type: "text",
      is_required: true,
      step_number: 1,
      step_name: "Traveller",
      display_order: 1,
      placeholder: null,
      validation_rules: { label_zh: "护照姓名" },
      options: [{ value: "passport", text: "Passport" }],
      conditional_logic: { depends_on: "identity_type", equals: "passport" },
    }]);

    const results = await Promise.all(Array.from({ length: 100 }, () => (
      loadAssistantSchema(admin, "singapore", "SG_ARRIVAL_CARD")
    )));

    expect(admin.from).toHaveBeenCalledTimes(1);
    expect(results.every((steps) => steps[0]?.fields[0]?.fieldName === "full_name")).toBe(true);

    results[0]!.push({ stepNumber: 99, stepName: "Mutation", fields: [] });
    results[0]![0]!.fields[0]!.options![0] = "mutated";
    results[0]![0]!.fields[0]!.conditionalLogic!.equals = "mutated";
    const warm = await loadAssistantSchema(admin, "singapore", "SG_ARRIVAL_CARD");
    expect(admin.from).toHaveBeenCalledTimes(1);
    expect(warm).toHaveLength(1);
    expect(warm[0]?.fields[0]?.options?.[0]).toMatchObject({ value: "passport" });
    expect(warm[0]?.fields[0]?.conditionalLogic).toMatchObject({ equals: "passport" });
  });

  it("retries an empty assistant schema on the next request", async () => {
    const admin = adminWithFormRows([]);

    await loadAssistantSchema(admin, "united_states", "DS160");
    await loadAssistantSchema(admin, "united_states", "DS160");

    expect(admin.from).toHaveBeenCalledTimes(2);
  });
});

describe("loadAssistantDocumentReadiness", () => {
  beforeEach(() => {
    loadDocumentCenterData.mockReset();
  });

  it("does not invent generic uploads for Visit Japan Web", async () => {
    await expect(loadAssistantDocumentReadiness({
      applicationId: "jp-application-id",
      country: "japan",
      visaType: "JP_VISIT_JAPAN_WEB",
    })).resolves.toEqual({
      documentCollectionComplete: true,
      missingDocumentCount: 0,
      missingDocuments: [],
    });
    expect(loadDocumentCenterData).not.toHaveBeenCalled();
  });
});
