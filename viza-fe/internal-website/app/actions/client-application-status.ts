"use server";

import {
  getClientStatusData,
  type StatusApplication,
} from "@/app/client/status/status-data";

export interface ClientApplicationStatusesResult {
  authenticated: boolean;
  partialData: boolean;
  applications: StatusApplication[];
}

export async function getClientApplicationStatuses(): Promise<ClientApplicationStatusesResult> {
  const data = await getClientStatusData();
  return {
    authenticated: data.authenticated,
    partialData: data.partialData,
    applications: data.detailApplications,
  };
}

export async function getClientApplicationStatus(
  applicationId: string,
): Promise<StatusApplication | null> {
  if (!applicationId.trim()) return null;
  const data = await getClientStatusData();
  if (!data.authenticated) return null;
  return data.detailApplications.find((application) => application.id === applicationId) ?? null;
}
