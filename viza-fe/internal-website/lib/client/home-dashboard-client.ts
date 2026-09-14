import type {
  ClientHomeApplicationSelectionHint,
  ClientHomeDashboardWithTimelineData,
} from "./home-dashboard-reader.server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDashboard(value: unknown): value is ClientHomeDashboardWithTimelineData {
  if (!isRecord(value)) return false;
  return typeof value.authenticated === "boolean"
    && (value.authEmail === null || typeof value.authEmail === "string")
    && (value.profile === null || isRecord(value.profile))
    && Array.isArray(value.applications)
    && Array.isArray(value.documents)
    && Array.isArray(value.payments)
    && (value.timeline === null || isRecord(value.timeline))
    && (value.timelineApplicationId === null || typeof value.timelineApplicationId === "string")
    && typeof value.timelinePartialData === "boolean"
    && (value.error === undefined || typeof value.error === "string")
    && (value.unavailable === undefined || typeof value.unavailable === "boolean");
}

/** A private, request-scoped read; selection is only a hint to the server. */
export async function fetchClientHomeDashboard(
  selection?: ClientHomeApplicationSelectionHint | null,
  options: { signal?: AbortSignal } = {},
): Promise<ClientHomeDashboardWithTimelineData> {
  const query = new URLSearchParams();
  for (const key of ["applicationId", "country", "visaType"] as const) {
    const value = selection?.[key];
    if (value) query.set(key, value);
  }
  const suffix = query.size ? `?${query.toString()}` : "";
  try {
    const response = await fetch(`/api/client/home-dashboard${suffix}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json" },
      signal: options.signal,
    });
    if (!response.ok || response.redirected) throw new Error("dashboard_read_failed");
    const data: unknown = await response.json();
    if (!isDashboard(data)) throw new Error("dashboard_read_failed");
    return data;
  } catch (error) {
    if (options.signal?.aborted) {
      throw options.signal.reason ?? new DOMException("Dashboard read cancelled", "AbortError");
    }
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw error;
    }
    // Do not expose provider HTML, response bodies or network error details.
    throw new Error("dashboard_read_failed");
  }
}
