import { describe, it, expect } from "vitest";
import { encodeReqId, orderIdFromReqId } from "./reqid";

const ORDER_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("photonpay reqid correlation", () => {
  it("round-trips the order id through encode/decode", () => {
    const reqId = encodeReqId(ORDER_ID, "abc123");
    expect(reqId.length).toBeLessThan(64);
    expect(orderIdFromReqId(reqId)).toBe(ORDER_ID);
  });

  it("decodes different attempt nonces to the same order id", () => {
    expect(orderIdFromReqId(encodeReqId(ORDER_ID, "n1"))).toBe(ORDER_ID);
    expect(orderIdFromReqId(encodeReqId(ORDER_ID, "n2"))).toBe(ORDER_ID);
  });

  it("returns null for a reqId whose prefix is not a UUID", () => {
    expect(orderIdFromReqId("not-a-uuid~123")).toBeNull();
    expect(orderIdFromReqId("")).toBeNull();
  });
});
