import { describe, expect, it } from "vitest";
import type { CurrentSubscriptionState } from "./commercial-records";
import { localizeSubscriptionState } from "./subscription-display";

const state: CurrentSubscriptionState = {
  recordId: "example", planCode: "pro", planName: "Pro", status: "active",
  statusLabel: "自动续费中", renewalLabel: "旧的日期", paymentMethodLabel: "微信支付",
  amountFen: 34900, countryLimitPerMonth: 14,
  currentPeriodStart: "2026-09-01T00:00:00Z", currentPeriodEnd: "2026-10-01T00:00:00Z",
  cancelAtPeriodEnd: false,
};

describe("subscription display locale", () => {
  it("reformats an existing API snapshot and can switch back without refetching", () => {
    const english = localizeSubscriptionState(state, "en");
    expect(english.statusLabel).toBe("Auto-renewing");
    expect(english.paymentMethodLabel).toBe("WeChat Pay");
    expect(english.renewalLabel).toContain("2026");
    expect(english.renewalLabel).not.toMatch(/\p{Script=Han}/u);
    expect(localizeSubscriptionState(english, "zh").paymentMethodLabel).toBe("微信支付");
    expect(english.recordId).toBe(state.recordId);
    expect(english.amountFen).toBe(state.amountFen);
    expect(state.renewalLabel).toBe("旧的日期");
  });

  it("localizes free and terminal states without stale renewal copy", () => {
    const free = localizeSubscriptionState({ ...state, status: "free", planCode: "free" }, "en");
    expect(free.planName).toBe("VIZA application preview");
    expect(free.renewalLabel).toBe("Not enabled");
    const cancelled = localizeSubscriptionState({ ...state, status: "cancelled" }, "en");
    expect(cancelled.renewalLabel).toContain("Cancelled; expires on");
    const expired = localizeSubscriptionState({ ...state, status: "expired" }, "zh");
    expect(expired.renewalLabel).toBe("已到期，请重新选择方案");
  });
});
