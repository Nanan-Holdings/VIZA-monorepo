import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { setCurrentSubscriptionCancelAtPeriodEnd } from "@/lib/payments/commercial-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return NextResponse.json(await setCurrentSubscriptionCancelAtPeriodEnd(true));
  } catch (error) {
    console.error("[subscription-cancel]", error instanceof Error ? error.message : "Unknown error");
    const t = await getTranslations("subscriptionManagement");
    return NextResponse.json({ error: t("cancelFailed") }, { status: 500 });
  }
}
