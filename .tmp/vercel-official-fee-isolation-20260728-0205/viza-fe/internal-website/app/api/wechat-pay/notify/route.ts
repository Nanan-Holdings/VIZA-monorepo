import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/with-admin";
import {
  readCallbackHeaders,
  verifyCallbackSignature,
  decryptCallbackResource,
  WechatPaySignatureError,
} from "@/lib/wechatpay/client";
import { applyWechatEvent } from "@/lib/wechatpay/handle-event";
import { runPostPaidSideEffects } from "@/lib/checkout/post-paid";

export const dynamic = "force-dynamic";

/**
 * WeChat Pay v3 async notification handler.
 *
 * Mirrors the Stripe webhook handler (`app/api/stripe/webhook/route.ts`):
 *   1. Verify signature with the platform cert advertised in
 *      `Wechatpay-Serial`.
 *   2. AES-256-GCM decrypt the encrypted resource.
 *   3. Apply the event (idempotent on `wechat_out_trade_no`).
 *   4. On `kind === "paid"` fire post-paid side-effects: magic-link
 *      email + runner enqueue. Errors are logged but never fail the
 *      ack — WeChat retries 8× on non-SUCCESS responses, so we want
 *      strict idempotency above all.
 *   5. Respond {code:"SUCCESS", message:"OK"} per WeChat Pay spec.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const headers = readCallbackHeaders(req.headers);
  try {
    await verifyCallbackSignature(headers, raw);
  } catch (err) {
    if (err instanceof WechatPaySignatureError) {
      return NextResponse.json(
        { code: "FAIL", message: err.message },
        { status: 401 },
      );
    }
    throw err;
  }

  let parsed: {
    id?: string;
    event_type?: string;
    resource_type?: string;
    resource?: {
      algorithm: string;
      ciphertext: string;
      associated_data?: string;
      nonce: string;
    };
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { code: "FAIL", message: "invalid JSON" },
      { status: 400 },
    );
  }
  if (!parsed.resource) {
    return NextResponse.json(
      { code: "FAIL", message: "missing resource" },
      { status: 400 },
    );
  }

  let decrypted;
  try {
    decrypted = decryptCallbackResource(parsed.resource);
  } catch (err) {
    const message = err instanceof Error ? err.message : "decrypt error";
    return NextResponse.json(
      { code: "FAIL", message },
      { status: 400 },
    );
  }

  try {
    const result = await withAdmin(
      "system",
      `api/wechat-pay/notify:${parsed.event_type ?? "unknown"}`,
      (admin) => applyWechatEvent(admin, decrypted),
    );

    if (result.kind === "paid") {
      // Fire-and-forget post-paid side-effects (magic-link mail + runner
      // enqueue), shared with the guest card rail. Both are idempotent.
      runPostPaidSideEffects(result.orderId, "wechat");
    }

    return NextResponse.json({ code: "SUCCESS", message: "OK" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "handler error";
    console.error("[wechat-pay] handler failed", err);
    return NextResponse.json({ code: "FAIL", message }, { status: 500 });
  }
}
