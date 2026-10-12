import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyCallbackSignatureMock = vi.hoisted(() => vi.fn());
const decryptCallbackResourceMock = vi.hoisted(() => vi.fn());
const applyWechatRefundEventMock = vi.hoisted(() => vi.fn());
const withAdminMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/wechatpay/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/wechatpay/client")>();
  return {
    ...original,
    verifyCallbackSignature: verifyCallbackSignatureMock,
    decryptCallbackResource: decryptCallbackResourceMock,
  };
});
vi.mock("@/lib/wechatpay/handle-event", () => ({
  applyWechatRefundEvent: applyWechatRefundEventMock,
}));
vi.mock("@/lib/auth/with-admin", () => ({ withAdmin: withAdminMock }));

import { WechatPaySignatureError } from "@/lib/wechatpay/client";
import { POST } from "./route";

const encryptedBody = JSON.stringify({
  id: "event-refund-1",
  event_type: "REFUND.SUCCESS",
  resource: {
    algorithm: "AEAD_AES_256_GCM",
    ciphertext: "encrypted",
    associated_data: "refund",
    nonce: "123456789012",
  },
});

function signedRequest(body = encryptedBody): Request {
  const callbackHeaders = new Headers({
    "Wechatpay-Signature": "signed-value",
    "Wechatpay-Serial": "platform-serial",
    "Wechatpay-Timestamp": "1788900000",
    "Wechatpay-Nonce": "callback-nonce",
  });
  const request = new Request("https://app.viza.it.com/api/wechat-pay/refund/notify", {
    method: "POST",
    headers: callbackHeaders,
    body,
  });
  // jsdom's Headers and Node's Request use different realms. The production
  // route receives one web-platform realm, so make the test reflect that.
  Object.defineProperty(request, "headers", { value: callbackHeaders });
  return request;
}

describe("WeChat refund notification route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyCallbackSignatureMock.mockResolvedValue(undefined);
    decryptCallbackResourceMock.mockReturnValue({
      refund_id: "wx-refund-1",
      out_refund_no: "viza-refund-1",
      transaction_id: "wx-transaction-1",
      out_trade_no: "wx-order-1",
      status: "SUCCESS",
      amount: { refund: 5_000, total: 8_800, currency: "CNY" },
    });
    applyWechatRefundEventMock.mockResolvedValue({
      kind: "refunded",
      orderId: "order-1",
      partial: true,
    });
    withAdminMock.mockImplementation(
      async (_role: string, _scope: string, callback: (admin: unknown) => unknown) =>
        callback({}),
    );
  });

  it("verifies the signed bytes before decrypting and applying the refund", async () => {
    const response = await POST(signedRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ code: "SUCCESS", message: "OK" });
    expect(verifyCallbackSignatureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        signature: "signed-value",
        serial: "platform-serial",
        timestamp: "1788900000",
        nonce: "callback-nonce",
      }),
      encryptedBody,
    );
    expect(decryptCallbackResourceMock).toHaveBeenCalledOnce();
    expect(applyWechatRefundEventMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ out_refund_no: "viza-refund-1" }),
      "event-refund-1",
    );
  });

  it("rejects a bad signature before decryption or database access", async () => {
    verifyCallbackSignatureMock.mockRejectedValue(
      new WechatPaySignatureError("signature mismatch"),
    );

    const response = await POST(signedRequest());

    expect(response.status).toBe(401);
    expect(decryptCallbackResourceMock).not.toHaveBeenCalled();
    expect(withAdminMock).not.toHaveBeenCalled();
  });

  it("returns failure so WeChat retries when identity reconciliation rejects", async () => {
    applyWechatRefundEventMock.mockRejectedValue(new Error("identity mismatch"));

    const response = await POST(signedRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "FAIL",
      message: "refund callback rejected",
    });
  });
});
