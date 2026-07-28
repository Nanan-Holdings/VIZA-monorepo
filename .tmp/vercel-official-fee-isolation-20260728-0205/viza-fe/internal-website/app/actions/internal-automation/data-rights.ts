"use server";

import { revalidatePath } from "next/cache";
import {
  getAdminAutomationContext,
  getCustomerAutomationContext,
  type DataPrivacyRequestRow,
} from "./db";
import {
  readDataRightsRequests,
  summarizeDataRightsRequest,
} from "./read-model";
import {
  actionErrorMessage,
  actionFail,
  actionOk,
  type AutomationActionResult,
  type DataRightsRequestSummary,
} from "./types";

const OPEN_DATA_RIGHTS_STATUSES = ["requested", "pending", "processing"];

export async function getCustomerDataRightsRequests(): Promise<
  AutomationActionResult<DataRightsRequestSummary[]>
> {
  try {
    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

    const requestsResult = await readDataRightsRequests(
      contextResult.data.adminClient,
      contextResult.data.applicantId,
    );
    if (!requestsResult.ok) return requestsResult;

    return actionOk(requestsResult.data.map(summarizeDataRightsRequest));
  } catch (error) {
    console.error(
      "[getCustomerDataRightsRequests]",
      actionErrorMessage(error, "Unexpected data-rights read error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load data-rights requests.");
  }
}

export async function submitCustomerDataRightsRequest(input: {
  requestType: string;
  notes?: string;
}): Promise<AutomationActionResult<DataRightsRequestSummary>> {
  try {
    const requestType = input.requestType?.trim();
    if (!requestType) {
      return actionFail("VALIDATION_ERROR", "requestType is required.");
    }

    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

    const existingResult = await readDataRightsRequests(
      contextResult.data.adminClient,
      contextResult.data.applicantId,
    );
    if (!existingResult.ok) return existingResult;

    const existing = existingResult.data.find(
      (request) =>
        request.request_type === requestType &&
        OPEN_DATA_RIGHTS_STATUSES.includes(request.status),
    );

    if (existing) {
      return actionOk(summarizeDataRightsRequest(existing));
    }

    const { data, error } = await contextResult.data.adminClient
      .from<DataPrivacyRequestRow>("data_privacy_requests")
      .insert({
        applicant_id: contextResult.data.applicantId,
        request_type: requestType,
        status: "requested",
        notes: input.notes?.trim() || null,
      })
      .select("id, applicant_id, request_type, status, notes, fulfilled_at, created_at, updated_at")
      .single();

    if (error || !data) {
      return actionFail("DB_ERROR", "Could not submit data-rights request.");
    }

    revalidatePath("/client/settings");
    revalidatePath("/admin/applications");

    return actionOk(summarizeDataRightsRequest(data));
  } catch (error) {
    console.error(
      "[submitCustomerDataRightsRequest]",
      actionErrorMessage(error, "Unexpected data-rights submit error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not submit data-rights request.");
  }
}

export async function getAdminDataRightsRequests(input: {
  applicantId?: string;
  status?: string;
  limit?: number;
} = {}): Promise<AutomationActionResult<DataRightsRequestSummary[]>> {
  try {
    const contextResult = await getAdminAutomationContext();
    if (!contextResult.ok) return contextResult;

    const limit =
      input.limit && Number.isInteger(input.limit) && input.limit > 0
        ? Math.min(input.limit, 500)
        : 100;
    let query = contextResult.data.adminClient
      .from<DataPrivacyRequestRow>("data_privacy_requests")
      .select("id, applicant_id, request_type, status, notes, fulfilled_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (input.applicantId?.trim()) {
      query = query.eq("applicant_id", input.applicantId.trim());
    }
    if (input.status?.trim()) {
      query = query.eq("status", input.status.trim());
    }

    const { data, error } = await query;
    if (error) {
      return actionFail("DB_ERROR", "Could not load data-rights requests.");
    }

    return actionOk((data ?? []).map(summarizeDataRightsRequest));
  } catch (error) {
    console.error(
      "[getAdminDataRightsRequests]",
      actionErrorMessage(error, "Unexpected admin data-rights read error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load data-rights requests.");
  }
}
