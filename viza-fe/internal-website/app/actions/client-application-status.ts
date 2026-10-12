"use server";

import {
  getClientStatusData,
  isValidClientStatusApplicationId,
  type StatusApplication,
} from "@/app/client/status/status-data";

export interface ClientApplicationStatusesResult {
  authenticated: boolean;
  partialData: boolean;
  applications: StatusApplication[];
  unavailable?: boolean;
}

export async function getClientApplicationStatuses(): Promise<ClientApplicationStatusesResult> {
  const data = await getClientStatusData();
  return {
    authenticated: data.authenticated,
    partialData: data.partialData,
    applications: data.detailApplications,
    ...(data.unavailable ? { unavailable: true } : {}),
  };
}

export async function getClientApplicationStatus(
  applicationId: string,
): Promise<StatusApplication | null> {
  const normalizedApplicationId = applicationId.trim();
  if (!isValidClientStatusApplicationId(normalizedApplicationId)) return null;
  const data = await getClientStatusData({ applicationId: normalizedApplicationId });
  if (data.unavailable) throw new Error("Client status is temporarily unavailable");
  if (!data.authenticated) return null;
  return data.detailApplications.find((application) => application.id === normalizedApplicationId) ?? null;
}
