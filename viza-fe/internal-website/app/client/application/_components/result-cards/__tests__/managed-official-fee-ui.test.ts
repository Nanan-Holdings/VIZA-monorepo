import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const longFormSource = readFileSync(
  resolve(process.cwd(), "app/client/application/long-form/page.tsx"),
  "utf8",
);
const failureCardSource = readFileSync(
  resolve(
    process.cwd(),
    "app/client/application/_components/result-cards/FailureCard.tsx",
  ),
  "utf8",
);

describe("managed official-fee UI guardrail", () => {
  it("does not collect applicant card credentials in the application form", () => {
    expect(longFormSource).not.toContain('autoComplete="cc-number"');
    expect(longFormSource).not.toContain('autoComplete="cc-csc"');
    expect(longFormSource).not.toContain("One-time official payment card");
    expect(longFormSource).not.toContain("本次官方付款银行卡");
  });

  it("starts the VIZA-managed card path without applicant PAN or CVV", () => {
    expect(longFormSource).toContain(
      'JSON.stringify({ paymentMethod: "viza_managed_virtual_card" })',
    );
  });

  it("does not collect card credentials when a portal payment retry fails", () => {
    expect(failureCardSource).not.toContain('autoComplete="cc-number"');
    expect(failureCardSource).not.toContain('autoComplete="cc-csc"');
    expect(failureCardSource).not.toContain("Enter the card number");
    expect(failureCardSource).toContain("VIZA will handle the official payment");
  });
});
