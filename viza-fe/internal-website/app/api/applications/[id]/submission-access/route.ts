import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  APPLICATION_PAYMENT_REQUIRED,
  evaluateSubmissionAccess,
  submissionAccessHttpBody,
} from "@/lib/payments/submission-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  returnTo: z.string().max(2048).optional(),
});

function safeReturnTo(applicationId: string, candidate: string | undefined): string {
  if (candidate?.startsWith("/client/application")) return candidate;
  return `/client/application/long-form?applicationId=${encodeURIComponent(applicationId)}&step=review`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: applicationId } = await params;
  if (!z.string().uuid().safeParse(applicationId).success) {
    return NextResponse.json({ error: "Invalid application id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission access request." }, { status: 400 });
  }
  const returnTo = safeReturnTo(applicationId, parsed.data.returnTo);
  const admin = createAdminClient();
  const { data: application, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, purpose, group_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError) {
    return NextResponse.json({ error: "Unable to load application." }, { status: 500 });
  }
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  const { data: profile } = await admin
    .from("applicant_profiles")
    .select("auth_user_id, dependant_of_user_id")
    .eq("id", application.applicant_id)
    .maybeSingle();
  let groupPayerId: string | null = null;
  if (application.group_id) {
    const { data: group } = await admin
      .from("application_group")
      .select("payer_user_id")
      .eq("id", application.group_id)
      .maybeSingle();
    groupPayerId = group?.payer_user_id ? String(group.payer_user_id) : null;
  }
  const ownerId = groupPayerId ?? profile?.auth_user_id ?? profile?.dependant_of_user_id;
  if (!profile || ownerId !== user.id) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  try {
    const decision = await evaluateSubmissionAccess(admin, applicationId, {
      payerAuthUserId: user.id,
      lockHighAccess: true,
      returnTo,
    });
    if (decision.status === "ready") {
      return NextResponse.json({ ok: true, decision });
    }
    if (decision.status === "review_required") {
      return NextResponse.json(
        {
          ...submissionAccessHttpBody(decision),
          code: "application_payment_review_required",
        },
        { status: 409 },
      );
    }

    const checkoutUrl = new URL(
      `/api/applications/${encodeURIComponent(applicationId)}/submission-checkout`,
      request.nextUrl.origin,
    );
    checkoutUrl.searchParams.set("returnTo", returnTo);
    const checkoutDecision = {
      ...decision,
      checkoutUrl: checkoutUrl.toString(),
    };
    return NextResponse.json(
      {
        ...submissionAccessHttpBody(checkoutDecision),
        code: APPLICATION_PAYMENT_REQUIRED,
      },
      { status: 402 },
    );
  } catch (error) {
    console.error("[submission-access] evaluation failed", {
      applicationId: applicationId.slice(0, 8),
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "Submission payment eligibility is temporarily unavailable.",
        code: "submission_access_unavailable",
      },
      { status: 503 },
    );
  }
}
