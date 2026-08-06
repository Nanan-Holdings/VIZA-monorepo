import { describe, expect, it } from "vitest";
import { applyWechatEvent } from "./handle-event";

function fakeAdmin(initialStatus: string) {
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
        maybeSingle: async () => ({ data: { id: "order-1", status }, error: null }),
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
});
