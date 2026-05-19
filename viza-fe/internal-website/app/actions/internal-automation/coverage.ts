"use server";

import {
  getCustomerAutomationContext,
  getOwnedApplication,
  type CustomerAutomationContext,
  type DocumentRequirementRow,
  type VisaPackageRow,
} from "./db";
import {
  buildCoverageSummary,
  readApplicationAutomationBundles,
} from "./read-model";
import {
  actionErrorMessage,
  actionFail,
  actionOk,
  type AutomationActionResult,
  type AutomationCoverageSummary,
} from "./types";

interface UserPackageAssignmentRow extends Record<string, unknown> {
  id: string;
}

async function readCoverageForPackage(params: {
  context: CustomerAutomationContext;
  visaPackageId: string;
}): Promise<AutomationActionResult<AutomationCoverageSummary>> {
  const { data: assignment, error: assignmentError } = await params.context.adminClient
    .from<UserPackageAssignmentRow>("user_packages")
    .select("id")
    .eq("auth_user_id", params.context.userId)
    .eq("visa_package_id", params.visaPackageId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (assignmentError) {
    return actionFail("DB_ERROR", "Could not verify package assignment.");
  }
  if (!assignment) {
    return actionFail("FORBIDDEN", "Package coverage is not assigned to this account.");
  }

  const [{ data: packageRow, error: packageError }, { data: requirements, error: requirementError }] =
    await Promise.all([
      params.context.adminClient
        .from<VisaPackageRow>("visa_packages")
        .select(
          "id, country, visa_type, name, description, price_cents, currency, is_active, metadata, created_at, updated_at",
        )
        .eq("id", params.visaPackageId)
        .maybeSingle(),
      params.context.adminClient
        .from<DocumentRequirementRow>("document_requirements")
        .select(
          "id, visa_package_id, country, visa_type, requirement_key, label_en, label_zh, description, required, sort_order, metadata, created_at, updated_at",
        )
        .eq("visa_package_id", params.visaPackageId)
        .order("sort_order", { ascending: true }),
    ]);

  if (packageError || requirementError) {
    return actionFail("DB_ERROR", "Could not load package coverage.");
  }
  if (!packageRow) {
    return actionFail("NOT_FOUND", "Visa package was not found.");
  }

  return actionOk(
    buildCoverageSummary({
      visaPackage: packageRow,
      country: packageRow.country,
      visaType: packageRow.visa_type,
      requirements: requirements ?? [],
    }),
  );
}

export async function getCustomerCoverage(input: {
  applicationId?: string;
  visaPackageId?: string;
  country?: string;
  visaType?: string;
} = {}): Promise<AutomationActionResult<AutomationCoverageSummary[]>> {
  try {
    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

    if (input.applicationId) {
      const applicationResult = await getOwnedApplication(
        contextResult.data.adminClient,
        contextResult.data.applicantId,
        input.applicationId,
      );
      if (!applicationResult.ok) return applicationResult;

      const bundlesResult = await readApplicationAutomationBundles(
        contextResult.data.adminClient,
        [applicationResult.data],
      );
      if (!bundlesResult.ok) return bundlesResult;

      const bundle = bundlesResult.data[0];
      if (!bundle) {
        return actionFail("NOT_FOUND", "Coverage state was not found.");
      }

      return actionOk([
        buildCoverageSummary({
          visaPackage: bundle.visaPackage,
          application: bundle.application,
          country: bundle.application.country,
          visaType: bundle.application.visa_type,
          requirements: bundle.requirements,
        }),
      ]);
    }

    if (input.visaPackageId) {
      const coverageResult = await readCoverageForPackage({
        context: contextResult.data,
        visaPackageId: input.visaPackageId,
      });
      if (!coverageResult.ok) return coverageResult;
      return actionOk([coverageResult.data]);
    }

    if (input.country?.trim() && input.visaType?.trim()) {
      const country = input.country.trim();
      const visaType = input.visaType.trim();
      const [{ data: packageRows, error: packageError }, { data: requirements, error: requirementError }] =
        await Promise.all([
          contextResult.data.adminClient
            .from<VisaPackageRow>("visa_packages")
            .select(
              "id, country, visa_type, name, description, price_cents, currency, is_active, metadata, created_at, updated_at",
            )
            .eq("country", country)
            .eq("visa_type", visaType)
            .eq("is_active", true)
            .limit(1),
          contextResult.data.adminClient
            .from<DocumentRequirementRow>("document_requirements")
            .select(
              "id, visa_package_id, country, visa_type, requirement_key, label_en, label_zh, description, required, sort_order, metadata, created_at, updated_at",
            )
            .eq("country", country)
            .eq("visa_type", visaType)
            .order("sort_order", { ascending: true }),
        ]);

      if (packageError || requirementError) {
        return actionFail("DB_ERROR", "Could not load coverage.");
      }

      const visaPackage = packageRows?.[0] ?? null;
      return actionOk([
        buildCoverageSummary({
          visaPackage,
          country,
          visaType,
          requirements: requirements ?? [],
        }),
      ]);
    }

    return actionFail(
      "VALIDATION_ERROR",
      "applicationId, visaPackageId, or country and visaType are required.",
    );
  } catch (error) {
    console.error(
      "[getCustomerCoverage]",
      actionErrorMessage(error, "Unexpected coverage read error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load coverage.");
  }
}
