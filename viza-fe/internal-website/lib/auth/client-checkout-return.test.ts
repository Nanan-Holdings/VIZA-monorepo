import { describe, expect, it } from "vitest";
import {
  betaFromCheckoutUrl,
  openCheckoutBeta,
  removeBetaFromCheckoutUrl,
  sealCheckoutBeta,
} from "./client-checkout-return";
import { checkoutReturnTarget, safeClientReturnTarget } from "./safe-client-return-target";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("client checkout auth return", () => {
  it("allows only feedback and a bounded checkout destination", () => {
    expect(safeClientReturnTarget("/feedback")).toBe("/feedback");
    expect(safeClientReturnTarget("/client/checkout?packageId=p1&applicationId=a1&beta=secret&other=x"))
      .toBe("/client/checkout?packageId=p1&applicationId=a1");
    expect(safeClientReturnTarget("//evil.example/client/checkout")) .toBe("/client/home");
    expect(safeClientReturnTarget("/client/home")) .toBe("/client/home");
  });

  it("extracts beta state while producing a token-free return URL", () => {
    const url = new URL("https://app.viza.test/client/checkout?packageId=p1&beta=one-use&betaDeliveryMethod=link_suffix");
    expect(betaFromCheckoutUrl(url)).toMatchObject({ token: "one-use", deliveryMethod: "link_suffix" });
    const clean = removeBetaFromCheckoutUrl(url);
    expect(clean.toString()).toBe("https://app.viza.test/client/checkout?packageId=p1");
    expect(checkoutReturnTarget(clean)).toBe("/client/checkout?packageId=p1");
  });

  it("round-trips authenticated encrypted state and rejects tampering", async () => {
    const payload = {
      token: "one-use",
      deliveryMethod: "promo_code" as const,
      returnTo: "/client/checkout?packageId=p1",
      expiresAt: Date.now() + 60_000,
    };
    const sealed = await sealCheckoutBeta(payload, KEY);
    expect(sealed).not.toContain(payload.token);
    await expect(openCheckoutBeta(sealed, KEY)).resolves.toEqual(payload);
    await expect(openCheckoutBeta(`${sealed}x`, KEY)).resolves.toBeNull();
  });

  it("rejects expired encrypted state", async () => {
    const sealed = await sealCheckoutBeta({
      token: "expired",
      deliveryMethod: "link_suffix",
      expiresAt: Date.now() - 1,
    }, KEY);
    await expect(openCheckoutBeta(sealed, KEY)).resolves.toBeNull();
  });
});
