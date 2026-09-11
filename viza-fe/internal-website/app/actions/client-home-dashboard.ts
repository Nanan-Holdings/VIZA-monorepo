"use server";

import {
  loadClientHomeDashboard,
  recordHomeDashboardReadOutcome,
  type ClientHomeApplicationSelectionHint,
  type ClientHomeDashboardData,
  type ClientHomeDashboardWithTimelineData,
} from "@/lib/client/home-dashboard-reader.server";
import { withPortalReadTrace } from "@/lib/observability/portal-read";

export type {
  ClientHomeApplicationSelectionHint,
  ClientHomeDashboardData,
  ClientHomeDashboardWithTimelineData,
} from "@/lib/client/home-dashboard-reader.server";

export async function getClientHomeDashboardData(): Promise<ClientHomeDashboardData> {
  return withPortalReadTrace("home", async () => {
    const result = await loadClientHomeDashboard();
    recordHomeDashboardReadOutcome(result);
    return result.data;
  });
}

/**
 * One authenticated Home read containing the compact dashboard and the
 * selected application's customer-safe timeline projection.
 */
export async function getClientHomeDashboardWithTimeline(
  selection?: ClientHomeApplicationSelectionHint | null,
): Promise<ClientHomeDashboardWithTimelineData> {
  return withPortalReadTrace("home", async () => {
    const result = await loadClientHomeDashboard({
      includeTimeline: true,
      selection,
    });
    recordHomeDashboardReadOutcome(result);
    return {
      ...result.data,
      timeline: result.timeline,
      timelineApplicationId: result.timelineApplicationId,
      timelinePartialData: result.timelinePartialData,
    };
  });
}
