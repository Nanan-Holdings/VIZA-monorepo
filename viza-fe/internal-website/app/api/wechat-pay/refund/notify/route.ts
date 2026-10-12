import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/with-admin";
import {
  decryptCallbackResource,
  readCallbackHeaders,
  verifyCallbackSignature,
  WechatPaySignatureError,
} from "@/lib/wechatpay/client";
import {
  applyWechatRefundEvent,
  type WechatRefundResource,
} from "@/lib/wechatpay/handle-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RefundNotification {
  id?: string;
  event_type?: string;
  resource?: {
    algorithm: string;
    ciphertext: string;
    associated_data?: string;
    nonce: string;
  };
}

function failure(message: string, status: number) {
  return NextResponse.json({ code: "FAIL", message }, { status });
}

export async function POST(request: Request) {
  const raw = await request.text();
  try {
    await verifyCallbackSignature(readCallbackHeaders(request.headers), raw);
  } catch (error) {
    if (error instanceof WechatPaySignatureError) {
      return failure(error.message, 401);
    }
    console.error("[wechat-refund] signature verification failed", error);
    return failure("signature verification failed", 500);
  }

  let notification: RefundNotification;
  try {
    notification = JSON.parse(raw) as RefundNotification;
  } catch {
    return failure("invalid JSON", 400);
  }
  if (notification.event_type !== "REFUND.SUCCESS") {
    return failure("unsupported refund event", 400);
  }
  if (!notification.resource) {
    return failure("missing resource", 400);
  }

  let resource: WechatRefundResource;
  try {
    resource = decryptCallbackResource(
      notification.resource,
    ) as unknown as WechatRefundResource;
  } catch (error) {
    console.error("[wechat-refund] resource decryption failed", error);
    return failure("resource decryption failed", 400);
  }

  try {
    await withAdmin(
      "system",
      `api/wechat-pay/refund/notify:${notification.id ?? "unknown"}`,
      (admin) => applyWechatRefundEvent(admin, resource, notification.id),
    );
    return NextResponse.json({ code: "SUCCESS", message: "OK" });
  } catch (error) {
    console.error("[wechat-refund] callback rejected", error);
    return failure("refund callback rejected", 500);
  }
}
