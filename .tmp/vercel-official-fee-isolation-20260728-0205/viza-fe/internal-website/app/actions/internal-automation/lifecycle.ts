"use server";

import {
  getCustomerAutomationContext,
  listOwnedApplications,
} from "./db";
import {
  buildCustomerStatusSummary,
  buildLifecycleSummary,
  readApplicantNotifications,
  readApplicationAutomationBundles,
  readDataRightsRequests,
} from "./read-model";
import {
  actionErrorMessage,
  actionFail,
  type AutomationActionResult,
  type CustomerStatusSummary,
  type LifecycleSummary,
} from "./types";

export async function getCustomerLifecycleSummaries(input: {
  applicationId?: string;
} = {}): Promise<AutomationActionResult<LifecycleSummary[]>> {
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
      data: bundlesResult.data.map(buildLifecycleSummary),
    };
  } catch (error) {
    console.error(
      "[getCustomerLifecycleSummaries]",
      actionErrorMessage(error, "Unexpected lifecycle summary error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load lifecycle summaries.");
  }
}

export async function getCustomerStatusSummary(input: {
  applicationId?: string;
} = {}): Promise<AutomationActionResult<CustomerStatusSummary>> {
  try {
    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

    const applicationsResult = await listOwnedApplications(
      contextResult.data.adminClient,
      contextResult.data.applicantId,
      input.applicationId,
    );
    if (!applicationsResult.ok) return applicationsResult;

    const [bundlesResult, notificationsResult, dataRightsResult] = await Promise.all([
      readApplicationAutomationBundles(
        contextResult.data.adminClient,
        applicationsResult.data,
      ),
      readApplicantNotifications(
        contextResult.data.adminClient,
        contextResult.data.applicantId,
      ),
      readDataRightsRequests(
        contextResult.data.adminClient,
        contextResult.data.applicantId,
      ),
    ]);

    if (!bundlesResult.ok) return bundlesResult;
    if (!notificationsResult.ok) return notificationsResult;
    if (!dataRightsResult.ok) return dataRightsResult;

    return {
      ok: true,
      data: buildCustomerStatusSummary({
        applicantId: contextResult.data.applicantId,
        bundles: bundlesResult.data,
        notifications: notificationsResult.data,
        dataRightsRequests: dataRightsResult.data,
      }),
    };
  } catch (error) {
    console.error(
      "[getCustomerStatusSummary]",
      actionErrorMessage(error, "Unexpected customer status error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load customer status.");
  }
}
