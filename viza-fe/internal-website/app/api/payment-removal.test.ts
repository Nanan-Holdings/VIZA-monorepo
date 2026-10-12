import { describe, expect, it } from "vitest";
import { GET as officialFeeStatus } from "./applications/[id]/official-fee/status/route";
import { GET as submissionCheckout } from "./applications/[id]/submission-checkout/route";
import { POST as officialFeeAuthorize } from "./applications/[id]/official-fee/authorize/route";
import { POST as officialFeePay } from "./applications/[id]/official-fee/pay/route";
import { POST as simulatePaid } from "./dev/simulate-paid/route";
import { POST as provisioningWorker } from "./payment-provisioning/worker/route";
import { POST as airwallexIntent } from "./payments/airwallex/create-intent/route";
import { POST as airwallexConfirm } from "./payments/airwallex/[paymentId]/confirm-method/route";
import { GET as airwallexStatus } from "./payments/airwallex/[paymentId]/status/route";
import { POST as alipayNotify } from "./payments/alipay/notify/route";
import { POST as airwallexBind } from "./payments/bind/airwallex-card/route";
import { POST as airwallexBindComplete } from "./payments/bind/airwallex-card/[bindingId]/complete/route";
import { POST as walletBind } from "./payments/bind/qr/route";
import { GET as walletBindStatus } from "./payments/bind/status/[bindingId]/route";
import { POST as stripeBind } from "./payments/bind/stripe-card/route";
import { GET as paymentStatus } from "./payments/status/[paymentId]/route";
import { POST as paymentsStripeWebhook } from "./payments/stripe/webhook/route";
import { POST as paymentsWechatNotify } from "./payments/wechat/notify/route";
import { POST as stripeCheckout } from "./stripe/checkout/route";
import { POST as stripePayoutWebhook } from "./stripe/payout-webhook/route";
import { POST as stripeWebhook } from "./stripe/webhook/route";
import { POST as subscriptionCancel } from "./subscription/cancel/route";
import { GET as subscriptionCurrent } from "./subscription/current/route";
import { POST as subscriptionResume } from "./subscription/resume/route";
import { POST as wechatNotify } from "./wechat-pay/notify/route";
import { GET as wechatStatus } from "./wechat-pay/status/[orderId]/route";
import { POST as airwallexWebhook } from "./webhooks/airwallex/route";
import { POST as photonpayWebhook } from "./webhooks/photonpay/route";
import { POST as photonpayFunding } from "./webhooks/photonpay/funding/route";
import { GET as orderReceipt } from "./orders/[id]/receipt/route";

const retiredRoutes = [
  officialFeeStatus,
  submissionCheckout,
  officialFeeAuthorize,
  officialFeePay,
  simulatePaid,
  provisioningWorker,
  airwallexIntent,
  airwallexConfirm,
  airwallexStatus,
  alipayNotify,
  airwallexBind,
  airwallexBindComplete,
  walletBind,
  walletBindStatus,
  stripeBind,
  paymentStatus,
  paymentsStripeWebhook,
  paymentsWechatNotify,
  stripeCheckout,
  stripePayoutWebhook,
  stripeWebhook,
  subscriptionCancel,
  subscriptionCurrent,
  subscriptionResume,
  wechatNotify,
  wechatStatus,
  airwallexWebhook,
  photonpayWebhook,
  photonpayFunding,
  orderReceipt,
];

describe("retired payment routes", () => {
  it.each(retiredRoutes)("returns a stable 410 response", async (handler) => {
    const response = await handler();
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({
      code: "payment_removed",
      error: "Payment processing has been removed.",
    });
  });
});

describe("retired Airwallex authorization callback", () => {
  it("always declines using the provider callback schema", async () => {
    const response = await (await import("./webhooks/airwallex/remote-authorization/route")).POST(
      new Request("https://example.test/api/webhooks/airwallex/remote-authorization", {
        method: "POST",
        body: JSON.stringify({ card_transaction_event_id: "evt-123" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      card_transaction_event_id: "evt-123",
      response_status: "DECLINED",
      status_reason: "PAYMENT_REMOVED: payment processing has been removed",
    });
  });
});
