import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/with-admin";
import {
  verifyWebhookSignature,
  StripeSignatureError,
} from "@/lib/stripe/client";
import { applyStripeEvent } from "@/lib/stripe/handle-event";
import { mailReceiptOnPaid } from "@/app/actions/receipts";
import { enqueueRunnerJob } from "@/lib/queue/enqueue";

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
    if (result.kind === "paid") {
      // PAY-005: email the receipt. Don't fail the webhook if Resend
      // hiccups — Stripe would re-deliver the event and we'd re-mail.
      mailReceiptOnPaid(result.orderId).catch((err) => {
        console.error("[receipts] mailReceiptOnPaid failed", err);
      });
      // INFRA-002: enqueue the runner_job for this application.
      // Idempotent on application_id — re-deliveries reuse the queued row.
      withAdmin("system", "api/stripe/webhook:enqueue-paid", async (admin) => {
        const { data: order } = await admin
          .from("order")
          .select("application_id")
          .eq("id", result.orderId)
          .maybeSingle();
        if (!order?.application_id) return;
        const { data: app } = await admin
          .from("applications")
          .select("country")
          .eq("id", order.application_id)
          .maybeSingle();
        if (!app?.country) return;
        await enqueueRunnerJob(order.application_id, app.country, {
          correlationId: `stripe:${result.orderId}`,
        });
      }).catch((err) => {
        console.error("[queue] enqueueRunnerJob on paid failed", err);
      });
    }
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "handler error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
