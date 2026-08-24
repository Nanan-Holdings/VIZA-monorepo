import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startCheckoutForApplication } from "@/app/actions/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeReturnTo(applicationId: string, candidate: string | null): string {
  if (candidate?.startsWith("/client/application")) return candidate;
  return `/client/application/long-form?applicationId=${encodeURIComponent(applicationId)}&step=review`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: applicationId } = await params;
  if (!z.string().uuid().safeParse(applicationId).success) {
    return NextResponse.json({ error: "Invalid application id." }, { status: 400 });
  }
  const returnTo = safeReturnTo(applicationId, request.nextUrl.searchParams.get("returnTo"));
  try {
    const checkout = await startCheckoutForApplication(applicationId, returnTo);
    return NextResponse.redirect(checkout.url, 303);
  } catch (error) {
    console.error("[submission-checkout] checkout failed", {
      applicationId: applicationId.slice(0, 8),
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Submission checkout is temporarily unavailable." },
      { status: 503 },
    );
  }
}
