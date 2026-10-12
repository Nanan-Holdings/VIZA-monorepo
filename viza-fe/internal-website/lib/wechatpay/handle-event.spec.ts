import { describe, expect, it } from "vitest";
import {
  applyWechatEvent,
  applyWechatRefundEvent,
  type WechatRefundResource,
} from "./handle-event";

function fakeAdmin(initialStatus: string, expectedAmount = 8_800) {
  let status = initialStatus;
  let updates = 0;
  const client = {
    from() {
      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        maybeSingle: async () => ({
          data: {
            id: "order-1",
            status,
            metadata: { checkout_payment: { expected_amount_minor: expectedAmount, currency: "CNY" } },
          },
          error: null,
        }),
        update() {
          return {
            eq: async () => {
              status = "paid";
              updates += 1;
              return { error: null };
            },
          };
        },
      };
      return builder;
    },
  };
  return { client, getStatus: () => status, getUpdates: () => updates };
}

const resource = {
  trade_state: "SUCCESS",
  out_trade_no: "wx-order-1",
  transaction_id: "wx-tx-1",
  success_time: "2026-08-01T00:00:00.000Z",
  amount: { total: 8_800, currency: "CNY" },
};

describe("WeChat commercial payment handler", () => {
  it("does not apply a duplicate success twice", async () => {
    const fake = fakeAdmin("pending");
    const first = await applyWechatEvent(fake.client as never, resource);
    const second = await applyWechatEvent(fake.client as never, resource);
    expect(first).toEqual({ kind: "paid", orderId: "order-1" });
    expect(second).toEqual({ kind: "paid", orderId: "order-1" });
    expect(fake.getStatus()).toBe("paid");
    expect(fake.getUpdates()).toBe(1);
  });

  it("ignores a success that arrives after a refund/dispute", async () => {
    const fake = fakeAdmin("refunded");
    const result = await applyWechatEvent(fake.client as never, resource);
    expect(result.kind).toBe("ignored");
    expect(fake.getUpdates()).toBe(0);
  });

  it("fails closed when the signed callback amount does not match checkout", async () => {
    const fake = fakeAdmin("pending", 9_900);
    await expect(applyWechatEvent(fake.client as never, resource)).rejects.toThrow(/amount\/currency mismatch/);
    expect(fake.getUpdates()).toBe(0);
  });
});

const refundResource: WechatRefundResource = {
  refund_id: "wx-refund-1",
  out_refund_no: "viza_refund_1",
  transaction_id: "wx-tx-1",
  out_trade_no: "wx-order-1",
  status: "SUCCESS",
  success_time: "2026-09-09T00:00:00+08:00",
  amount: { refund: 5_000, total: 8_800, currency: "CNY" },
};

function fakeRefundAdmin(options: {
  failRequestUpdateOnce?: boolean;
  missingRequest?: boolean;
} = {}) {
  let orderStatus = "paid";
  let requestStatus = "approved";
  let requestUpdateFailures = options.failRequestUpdateOnce ? 1 : 0;
  let lineMetadata: Record<string, unknown> = {
    wechat_pay_refund: {
      refund_id: "wx-refund-1",
      out_refund_no: "viza_refund_1",
      transaction_id: "wx-tx-1",
      out_trade_no: "wx-order-1",
      refund_amount_minor: 5_000,
      total_amount_minor: 8_800,
      currency: "CNY",
      status: "PROCESSING",
      callback_applied: false,
    },
  };
  let orderUpdates = 0;
  let lineUpdates = 0;
  let requestUpdates = 0;
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select() { return builder; },
        eq() { return builder; },
        maybeSingle: async () => {
          if (table === "order") return {
              data: {
                id: "order-1",
                application_id: "application-1",
                status: orderStatus,
                currency: "CNY",
                wechat_out_trade_no: "wx-order-1",
                wechat_transaction_id: "wx-tx-1",
                metadata: {
                  checkout_payment: {
                    provider: "wechat",
                    expected_amount_minor: 8_800,
                    currency: "CNY",
                  },
                },
              },
              error: null,
            };
          if (table === "order_line") return {
              data: {
                id: "refund-line-1",
                amount_cents: -5_000,
                currency: "CNY",
                metadata: lineMetadata,
              },
              error: null,
            };
          return {
            data: options.missingRequest
              ? null
              : {
                  id: "refund-request-1",
                  status: requestStatus,
                  stripe_refund_id: "wx-refund-1",
                },
            error: null,
          };
        },
        update(value: Record<string, unknown>) {
          const applyUpdate = () => {
            if (table === "refund_request" && requestUpdateFailures > 0) {
              requestUpdateFailures -= 1;
              return { data: null, error: { message: "temporary write failure" } };
            }
            if (table === "order") {
              orderStatus = value.status as string;
              orderUpdates += 1;
            } else if (table === "order_line") {
              lineMetadata = value.metadata as Record<string, unknown>;
              lineUpdates += 1;
            } else if (table === "refund_request") {
              requestStatus = value.status as string;
              requestUpdates += 1;
            }
            return {
              data: table === "refund_request" ? { id: "refund-request-1" } : null,
              error: null,
            };
          };
          const updateBuilder = {
            eq() {
              return updateBuilder;
            },
            select() {
              return updateBuilder;
            },
            async maybeSingle() {
              return applyUpdate();
            },
            then(resolve: (value: ReturnType<typeof applyUpdate>) => unknown) {
              return Promise.resolve(applyUpdate()).then(resolve);
            },
          };
          return updateBuilder;
        },
      };
      return builder;
    },
  };
  return {
    client,
    getOrderStatus: () => orderStatus,
    getOrderUpdates: () => orderUpdates,
    getLineUpdates: () => lineUpdates,
    getRequestUpdates: () => requestUpdates,
    getRequestStatus: () => requestStatus,
  };
}

describe("WeChat domestic refund handler", () => {
  it("applies a partial refund and accepts a replay without duplicate mutation", async () => {
    const fake = fakeRefundAdmin();
    const first = await applyWechatRefundEvent(
      fake.client as never,
      refundResource,
      "event-1",
    );
    const replay = await applyWechatRefundEvent(
      fake.client as never,
      refundResource,
      "event-1",
    );

    expect(first).toEqual({ kind: "refunded", orderId: "order-1", partial: true });
    expect(replay).toEqual(first);
    expect(fake.getOrderStatus()).toBe("partially_refunded");
    expect(fake.getLineUpdates()).toBe(1);
    expect(fake.getOrderUpdates()).toBe(1);
    expect(fake.getRequestStatus()).toBe("refunded");
    expect(fake.getRequestUpdates()).toBe(1);
  });

  it.each([
    ["merchant refund id", { out_refund_no: "another-refund" }],
    ["merchant order id", { out_trade_no: "another-order" }],
    ["provider transaction id", { transaction_id: "another-transaction" }],
    ["refund amount", { amount: { refund: 4_999, total: 8_800, currency: "CNY" } }],
    ["collected total", { amount: { refund: 5_000, total: 8_801, currency: "CNY" } }],
    ["currency", { amount: { refund: 5_000, total: 8_800, currency: "USD" } }],
  ])("fails closed on a mismatched %s", async (_label, override) => {
    const fake = fakeRefundAdmin();
    await expect(
      applyWechatRefundEvent(fake.client as never, {
        ...refundResource,
        ...override,
      }),
    ).rejects.toThrow(/identity mismatch|not found/);
    expect(fake.getLineUpdates()).toBe(0);
    expect(fake.getOrderUpdates()).toBe(0);
  });

  it("keeps a failed request write retryable and completes on replay", async () => {
    const fake = fakeRefundAdmin({ failRequestUpdateOnce: true });
    await expect(
      applyWechatRefundEvent(fake.client as never, refundResource, "event-1"),
    ).rejects.toThrow("refund request update: temporary write failure");
    expect(fake.getRequestStatus()).toBe("approved");

    await expect(
      applyWechatRefundEvent(fake.client as never, refundResource, "event-1"),
    ).resolves.toEqual({ kind: "refunded", orderId: "order-1", partial: true });
    expect(fake.getRequestStatus()).toBe("refunded");
    expect(fake.getLineUpdates()).toBe(1);
    expect(fake.getOrderUpdates()).toBe(1);
    expect(fake.getRequestUpdates()).toBe(1);
  });

  it("fails for retry when callback correlation has not been stored yet", async () => {
    const fake = fakeRefundAdmin({ missingRequest: true });
    await expect(
      applyWechatRefundEvent(fake.client as never, refundResource, "event-1"),
    ).rejects.toThrow("request correlation was not found");
    expect(fake.getRequestUpdates()).toBe(0);
  });
});
