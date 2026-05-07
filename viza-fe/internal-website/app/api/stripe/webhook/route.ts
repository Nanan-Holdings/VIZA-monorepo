import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/with-admin";
import {
  verifyWebhookSignature,
  StripeSignatureError,
} from "@/lib/stripe/client";
import { applyStripeEvent } from "@/lib/stripe/handle-event";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event;
  try {
    event = verifyWebhookSignature(raw, sig);
  } catch (err) {
    if (err instanceof StripeSignatureError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  try {
    const result = await withAdmin(
      "system",
      `api/stripe/webhook:${event.type}`,
      (admin) => applyStripeEvent(admin, event),
    );
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "handler error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
