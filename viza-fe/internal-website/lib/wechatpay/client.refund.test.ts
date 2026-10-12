import {
  createVerify,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDomesticRefund } from "./client";

const REFUND_PATH = "/v3/refund/domestic/refunds";
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

function setConfiguredEnv(): void {
  vi.stubEnv("WECHAT_PAY_MCH_ID", "1900000109");
  vi.stubEnv("WECHAT_PAY_APP_ID", "wx-test-app");
  vi.stubEnv("WECHAT_PAY_API_V3_KEY", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("WECHAT_PAY_MERCHANT_SERIAL_NO", "TESTSERIAL123");
  vi.stubEnv(
    "WECHAT_PAY_PRIVATE_KEY",
    privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  );
  vi.stubEnv("WECHAT_PAY_NOTIFY_URL", "https://app.viza.it.com/api/wechat/refund");
}

function verifyAuthorization(
  authorization: string,
  body: string,
  verificationKey: KeyObject,
): void {
  expect(authorization).toMatch(/^WECHATPAY2-SHA256-RSA2048 /);
  const fields = Object.fromEntries(
    [...authorization.matchAll(/(mchid|nonce_str|signature|timestamp|serial_no)="([^"]+)"/g)].map(
      ([, key, value]) => [key, value],
    ),
  );
  expect(fields.mchid).toBe("1900000109");
  expect(fields.serial_no).toBe("TESTSERIAL123");
  expect(fields.nonce_str).toMatch(/^[a-f0-9]{32}$/);
  expect(fields.timestamp).toMatch(/^\d+$/);

  const verifier = createVerify("RSA-SHA256");
  verifier.update(
    `POST\n${REFUND_PATH}\n${fields.timestamp}\n${fields.nonce_str}\n${body}\n`,
  );
  expect(verifier.verify(verificationKey, fields.signature, "base64")).toBe(true);
}

describe("createDomesticRefund", () => {
  beforeEach(() => {
    setConfiguredEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("signs and sends exact CNY-fen refund fields to the domestic refund API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          refund_id: "50300007012026090912345678901",
          out_refund_no: "refund_order_42",
          out_trade_no: "viza_order_42",
          status: "PROCESSING",
          amount: { total: 10000, refund: 5000, currency: "CNY" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await createDomesticRefund({
      outTradeNo: "viza_order_42",
      outRefundNo: "refund_order_42",
      refundFen: 5000,
      totalFen: 10000,
      reason: "Customer request",
      notifyUrl: "https://app.viza.it.com/api/wechat/refund-notify",
    });

    expect(response.status).toBe("PROCESSING");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.mch.weixin.qq.com${REFUND_PATH}`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      out_trade_no: "viza_order_42",
      out_refund_no: "refund_order_42",
      reason: "Customer request",
      notify_url: "https://app.viza.it.com/api/wechat/refund-notify",
      amount: { refund: 5000, total: 10000, currency: "CNY" },
    });
    const headers = init.headers as Record<string, string>;
    verifyAuthorization(headers.Authorization, init.body as string, publicKey);
  });

  it("surfaces a non-2xx WeChat response without losing provider context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "INVALID_REQUEST",
            message: "refund exceeds total",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      createDomesticRefund({
        transactionId: "4200000000202609091234567890",
        outRefundNo: "refund_order_43",
        refundFen: 5000,
        totalFen: 10000,
      }),
    ).rejects.toThrow(
      "WeChat Pay /v3/refund/domestic/refunds: 400 INVALID_REQUEST refund exceeds total",
    );
  });

  it("fails closed before fetch when no refund notification URL is configured", async () => {
    vi.stubEnv("WECHAT_PAY_NOTIFY_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createDomesticRefund({
        outTradeNo: "viza_order_44",
        outRefundNo: "refund_order_44",
        refundFen: 2500,
        totalFen: 10000,
      }),
    ).rejects.toThrow("WeChat Pay refund notify URL is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
