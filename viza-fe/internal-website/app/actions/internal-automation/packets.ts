"use server";

import {
  getCustomerAutomationContext,
  getOwnedApplication,
} from "./db";
import {
  buildPacketStateSummary,
  readApplicationAutomationBundles,
} from "./read-model";
import {
  actionErrorMessage,
  actionFail,
  actionOk,
  type AutomationActionResult,
  type PacketStateSummary,
} from "./types";

export async function getCustomerPacketState(input: {
  applicationId: string;
}): Promise<AutomationActionResult<PacketStateSummary>> {
  try {
    if (!input.applicationId) {
      return actionFail("VALIDATION_ERROR", "applicationId is required.");
    }

    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

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
      return actionFail("NOT_FOUND", "Packet state was not found.");
    }

    return actionOk(buildPacketStateSummary(bundle.application, bundle.packets));
  } catch (error) {
    console.error(
      "[getCustomerPacketState]",
      actionErrorMessage(error, "Unexpected packet state error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load packet state.");
  }
}
