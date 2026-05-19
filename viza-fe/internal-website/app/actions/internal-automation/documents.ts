"use server";

import {
  getCustomerAutomationContext,
  listOwnedApplications,
} from "./db";
import {
  buildDocumentReadinessSummary,
  readApplicationAutomationBundles,
} from "./read-model";
import {
  actionErrorMessage,
  actionFail,
  type AutomationActionResult,
  type DocumentReadinessSummary,
} from "./types";

export async function getCustomerDocumentReadiness(input: {
  applicationId?: string;
} = {}): Promise<AutomationActionResult<DocumentReadinessSummary[]>> {
  try {
    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

    const applicationsResult = await listOwnedApplications(
      contextResult.data.adminClient,
      contextResult.data.applicantId,
      input.applicationId,
    );
    if (!applicationsResult.ok) return applicationsResult;

    const bundlesResult = await readApplicationAutomationBundles(
      contextResult.data.adminClient,
      applicationsResult.data,
    );
    if (!bundlesResult.ok) return bundlesResult;

    return {
      ok: true,
      data: bundlesResult.data.map((bundle) =>
        buildDocumentReadinessSummary(
          bundle.application,
          bundle.documents,
          bundle.requirements,
        ),
      ),
    };
  } catch (error) {
    console.error(
      "[getCustomerDocumentReadiness]",
      actionErrorMessage(error, "Unexpected document readiness error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load document readiness.");
  }
}
