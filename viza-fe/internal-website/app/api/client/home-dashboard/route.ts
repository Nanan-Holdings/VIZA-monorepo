import { NextResponse } from "next/server";
import {
  createClientHomeDashboardFailureResult,
  loadClientHomeDashboard,
  normalizeClientHomeApplicationSelectionHint,
  recordHomeDashboardReadOutcome,
  toClientHomeDashboardWithTimelineData,
  type ClientHomeApplicationSelectionHint,
  type ClientHomeDashboardWithTimelineData,
} from "@/lib/client/home-dashboard-reader.server";
import {
  recordPortalReadOutcome,
  withPortalReadTrace,
} from "@/lib/observability/portal-read";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE_READ_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

function selectionFromRequest(request: Request): ClientHomeApplicationSelectionHint | undefined {
  try {
    const url = new URL(request.url);
    return normalizeClientHomeApplicationSelectionHint({
      applicationId: url.searchParams.get("applicationId"),
      country: url.searchParams.get("country"),
      visaType: url.searchParams.get("visaType"),
    });
  } catch {
    // A malformed URL is equivalent to a missing best-effort browser hint.
    return undefined;
  }
}

function dashboardResponse(
  result: Parameters<typeof toClientHomeDashboardWithTimelineData>[0],
): NextResponse<ClientHomeDashboardWithTimelineData> {
  return NextResponse.json(toClientHomeDashboardWithTimelineData(result), {
    status: 200,
    headers: PRIVATE_READ_HEADERS,
  });
}

/**
 * Read the same authenticated Home aggregate as the legacy Server Action.
 * Authentication and ownership remain inside the shared server-only reader;
 * the query values below are selection hints only and are never authority.
 */
export async function GET(request: Request): Promise<Response> {
  return withPortalReadTrace("home", async () => {
    let result;
    try {
      result = await loadClientHomeDashboard(
        {
          includeTimeline: true,
          selection: selectionFromRequest(request),
        },
        request.signal,
      );
    } catch {
      result = createClientHomeDashboardFailureResult();
    }

    // Preserve cancellation telemetry when the upstream Route Handler signal
    // wins while the typed reader is settling its safe unavailable DTO.
    if (request.signal.aborted) recordPortalReadOutcome("cancelled");
    else recordHomeDashboardReadOutcome(result);
    return dashboardResponse(result);
  });
}
