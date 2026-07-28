import { NextResponse } from "next/server";
import { setCurrentSubscriptionCancelAtPeriodEnd } from "@/lib/payments/commercial-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return NextResponse.json(await setCurrentSubscriptionCancelAtPeriodEnd(false));
  } catch (error) {
    console.error("[subscription-resume]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to resume subscription." }, { status: 500 });
  }
}
