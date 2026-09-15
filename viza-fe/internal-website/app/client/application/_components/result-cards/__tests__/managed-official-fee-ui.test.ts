import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const longFormSource = source("app/client/application/long-form/page.tsx");
const failureCardSource = source(
  "app/client/application/_components/result-cards/FailureCard.tsx",
);
const vietnamCardSource = source(
  "app/client/application/_components/result-cards/VnResultCard.tsx",
);
const ukCardSource = source(
  "app/client/application/_components/result-cards/UkResultCard.tsx",
);

describe("payment-free result and application UI", () => {
  it("does not collect applicant card credentials or start an official fee request", () => {
    expect(longFormSource).not.toContain('autoComplete="cc-number"');
    expect(longFormSource).not.toContain('autoComplete="cc-csc"');
    expect(longFormSource).not.toContain("One-time official payment card");
    expect(longFormSource).not.toContain("本次官方付款银行卡");
    expect(longFormSource).not.toContain("/official-fee/pay");
    expect(longFormSource).not.toContain("viza_managed_virtual_card");
  });

  it("keeps failure handling focused on retry and application support", () => {
    expect(failureCardSource).not.toContain('autoComplete="cc-number"');
    expect(failureCardSource).not.toContain('autoComplete="cc-csc"');
    expect(failureCardSource).not.toContain("Enter the card number");
    expect(failureCardSource).not.toContain("VIZA will handle the official payment");
  });

  it("maps legacy fee checkpoints to neutral attention copy without network calls", () => {
    for (const cardSource of [vietnamCardSource, ukCardSource]) {
      expect(cardSource).not.toContain("/official-fee/status");
      expect(cardSource).not.toContain("/official-fee/pay");
      expect(cardSource).not.toContain("viza_managed_virtual_card");
      expect(cardSource).not.toContain("limited virtual card");
      expect(cardSource).toContain("automated payment has been removed");
    }
  });
});
