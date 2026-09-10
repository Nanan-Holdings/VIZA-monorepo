import { describe, expect, it } from "vitest";
import { checkoutBetaParams } from "./beta-params";

describe("checkoutBetaParams", () => {
  it.each(["promo_code", "link_suffix"] as const)("preserves the explicit %s arm", (method) => {
    expect(checkoutBetaParams({ beta: "  invite-value  ", deliveryMethod: method })).toEqual({
      token: "invite-value",
      deliveryMethod: method,
    });
  });

  it("does not infer an A/B arm from an untyped token", () => {
    expect(checkoutBetaParams({ betaToken: "invite-value" })).toEqual({
      token: "invite-value",
      deliveryMethod: "",
    });
  });
});
