import { NextResponse } from "next/server";
import { setCurrentSubscriptionCancelAtPeriodEnd } from "@/lib/payments/commercial-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return NextResponse.json(await setCurrentSubscriptionCancelAtPeriodEnd(true));
  } catch (error) {
    console.error("[subscription-cancel]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to cancel subscription." }, { status: 500 });
  }
}
