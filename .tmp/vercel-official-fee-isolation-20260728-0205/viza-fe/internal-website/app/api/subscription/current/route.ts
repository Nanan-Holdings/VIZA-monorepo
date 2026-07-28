import { NextResponse } from "next/server";
import { getCurrentSubscriptionForCurrentUser } from "@/lib/payments/commercial-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getCurrentSubscriptionForCurrentUser());
  } catch (error) {
    console.error("[subscription-current]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to load subscription." }, { status: 500 });
  }
}
