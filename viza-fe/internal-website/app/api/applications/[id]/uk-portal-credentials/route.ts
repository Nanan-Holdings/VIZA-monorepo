import { NextResponse } from "next/server";
import { getApplicationApiApplicantProfileId } from "@/lib/application-api-auth";

export const dynamic = "force-dynamic";

/**
 * UKVI credentials are runner-only operational secrets. VIZA completes the
 * official payment on the applicant's behalf, so no customer workflow may
 * recover a portal password or force-resume URL from this API.
 */
export async function GET(): Promise<Response> {
  const profileId = await getApplicationApiApplicantProfileId();
  if (!profileId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      error: "UK portal credentials are managed by VIZA and are not customer-accessible",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
