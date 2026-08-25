import { NextResponse } from "next/server";
import { getApplicationApiApplicantProfileId } from "@/lib/application-api-auth";

export const dynamic = "force-dynamic";

/**
 * Applicant-side Taiwan portal takeover is retired. Historical handoff rows
 * remain available to operations as internal diagnostics, but this customer
 * boundary must never return an official URL or Browserbase session address.
 */
export async function GET(): Promise<Response> {
  const profileId = await getApplicationApiApplicantProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "台湾申请现由 VIZA 在后台提交，请返回申请最终核对页完成授权。",
      code: "taiwan_handoff_retired",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
