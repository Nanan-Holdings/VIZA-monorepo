import { beforeEach, describe, expect, it, vi } from "vitest";

const withAdminMock = vi.hoisted(() => vi.fn());
const createRefundMock = vi.hoisted(() => vi.fn());
const createDomesticRefundMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/with-admin", () => ({ withAdmin: withAdminMock }));
vi.mock("@/lib/stripe/client", () => ({ createRefund: createRefundMock }));
vi.mock("@/lib/wechatpay/client", () => ({
  createDomesticRefund: createDomesticRefundMock,
}));
vi.mock("@/lib/pricing", () => ({
  pricingFor: vi.fn(() => ({ govtFeeChannel: "viza_passthrough" })),
}));

import { refundOrderLines } from "./refunds";

function wechatOrder(metadataOverride?: Record<string, unknown>) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    application_id: "application-1",
    applicant_id: "applicant-1",
    status: "paid",
    currency: "CNY",
    stripe_payment_intent_id: null,
    wechat_out_trade_no: "wx-order-1",
    wechat_transaction_id: "wx-transaction-1",
    metadata: metadataOverride ?? {
      checkout_payment: {
        provider: "wechat",
        expected_amount_minor: 8_800,
        currency: "CNY",
      },
    },
  };
}

function fakeAdmin(options: {
  order?: ReturnType<typeof wechatOrder>;
  priorRefunds?: Array<Record<string, unknown>>;
} = {}) {
  const inserted: Array<Record<string, unknown>> = [];
  const order = options.order ?? wechatOrder();
  return {
    inserted,
    client: {
      from(table: string) {
        let operation = "select";
        let usedIn = false;
        const builder: Record<string, unknown> = {
          select() { return builder; },
          eq() { return builder; },
          in() { usedIn = true; return builder; },
          insert(value: Record<string, unknown>) {
            operation = "insert";
            inserted.push(value);
            return builder;
          },
          maybeSingle: async () => ({
            data: table === "order" ? order : null,
            error: null,
          }),
          single: async () => ({
            data: table === "applications"
              ? { country: "china", visa_type: "tourist" }
              : null,
            error: null,
          }),
          then(resolve: (value: unknown) => unknown) {
            if (operation === "insert") {
              return Promise.resolve({ error: null }).then(resolve);
            }
            const data = table === "order_line"
              ? (usedIn
                  ? [{ id: "line-agency", kind: "agency", amount_cents: 5_000 }]
                  : (options.priorRefunds ?? []))
              : null;
            return Promise.resolve({ data, error: null }).then(resolve);
          },
        };
        return builder;
      },
    },
  };
}

describe("refundOrderLines WeChat transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "WECHAT_PAY_REFUND_NOTIFY_URL",
      "https://app.viza.it.com/api/wechat-pay/refund/notify",
    );
    createDomesticRefundMock.mockImplementation(async (input) => ({
      refund_id: "wx-refund-1",
      out_refund_no: input.outRefundNo,
      out_trade_no: "wx-order-1",
      transaction_id: "wx-transaction-1",
      status: "PROCESSING",
      amount: { refund: input.refundFen, total: input.totalFen, currency: "CNY" },
    }));
    withAdminMock.mockImplementation(
      async (_role: string, _scope: string, callback: (admin: unknown) => unknown) =>
        callback(currentAdmin),
    );
  });

  let currentAdmin: unknown;

  it("uses the stored collected fen total and a deterministic merchant refund id", async () => {
    const first = fakeAdmin();
    currentAdmin = first.client;
    const firstOutput = await refundOrderLines(first.client ? wechatOrder().id : "", ["line-agency"]);
    const firstRequest = createDomesticRefundMock.mock.calls[0][0];

    vi.clearAllMocks();
    const second = fakeAdmin();
    currentAdmin = second.client;
    createDomesticRefundMock.mockImplementation(async (input) => ({
      refund_id: "wx-refund-2",
      out_refund_no: input.outRefundNo,
      out_trade_no: "wx-order-1",
      transaction_id: "wx-transaction-1",
      status: "PROCESSING",
      amount: { refund: input.refundFen, total: input.totalFen, currency: "CNY" },
    }));
    withAdminMock.mockImplementation(
      async (_role: string, _scope: string, callback: (admin: unknown) => unknown) =>
        callback(currentAdmin),
    );
    await refundOrderLines(wechatOrder().id, ["line-agency"]);
    const secondRequest = createDomesticRefundMock.mock.calls[0][0];

    expect(firstRequest).toMatchObject({
      transactionId: "wx-transaction-1",
      refundFen: 5_000,
      totalFen: 8_800,
      notifyUrl: "https://app.viza.it.com/api/wechat-pay/refund/notify",
    });
    expect(firstRequest.outRefundNo).toBe(secondRequest.outRefundNo);
    expect(firstRequest.outRefundNo).toMatch(/^viza_[a-f0-9]{32}_[a-f0-9]{20}$/);
    expect(firstOutput).toMatchObject({ refundedCents: 5_000, currency: "CNY" });
    expect(first.inserted[0]).toMatchObject({
      kind: "refund",
      amount_cents: -5_000,
      currency: "CNY",
      metadata: {
        wechat_pay_refund: {
          total_amount_minor: 8_800,
          callback_applied: false,
        },
      },
    });
    expect(createRefundMock).not.toHaveBeenCalled();
  });

  it("subtracts already-reserved refunds so the provider total cannot be over-refunded", async () => {
    const admin = fakeAdmin({
      priorRefunds: [{
        id: "older-refund",
        amount_cents: -7_000,
        currency: "CNY",
        metadata: { wechat_pay_refund: { out_refund_no: "another-refund" } },
      }],
    });
    currentAdmin = admin.client;

    const output = await refundOrderLines(wechatOrder().id, ["line-agency"]);

    expect(createDomesticRefundMock).toHaveBeenCalledWith(
      expect.objectContaining({ refundFen: 1_800, totalFen: 8_800 }),
    );
    expect(output.refundedCents).toBe(1_800);
    expect(admin.inserted[0]).toMatchObject({ amount_cents: -1_800 });
  });

  it("fails closed when stored WeChat collection metadata is incomplete", async () => {
    const admin = fakeAdmin({
      order: wechatOrder({
        checkout_payment: { provider: "wechat", currency: "CNY" },
      }),
    });
    currentAdmin = admin.client;

    await expect(
      refundOrderLines(wechatOrder().id, ["line-agency"]),
    ).rejects.toThrow("Stored WeChat collection metadata is incomplete");
    expect(createDomesticRefundMock).not.toHaveBeenCalled();
  });
});
