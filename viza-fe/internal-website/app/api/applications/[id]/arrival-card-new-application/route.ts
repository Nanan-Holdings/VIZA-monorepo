import { NextResponse } from "next/server";
import { getApplicationApiApplicantProfileId } from "@/lib/application-api-auth";
import { createNewArrivalCardApplicationForApplicant } from "@/features/arrival-cards/server/create-new-application";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const applicantProfileId = await getApplicationApiApplicantProfileId();
  if (!applicantProfileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await createNewArrivalCardApplicationForApplicant(applicantProfileId, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    {
      applicationId: result.applicationId,
      country: result.country,
      visaType: result.visaType,
    },
    { status: result.status },
  );
}
