import { NextResponse } from "next/server";

export const PAYMENT_REMOVED_CODE = "payment_removed";
export const PAYMENT_REMOVED_MESSAGE = "Payment processing has been removed.";

/**
 * Shared response for every retired payment endpoint.
 *
 * Keeping this response stable lets stale clients fail closed without
 * exposing provider configuration or running any payment side effects.
 */
export function paymentRemovedResponse(): NextResponse {
  return NextResponse.json(
    {
      code: PAYMENT_REMOVED_CODE,
      error: PAYMENT_REMOVED_MESSAGE,
      message: PAYMENT_REMOVED_MESSAGE,
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
