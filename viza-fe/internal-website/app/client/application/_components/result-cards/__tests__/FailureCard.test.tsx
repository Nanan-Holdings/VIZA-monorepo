import type { ComponentType } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FailureCard } from "../FailureCard";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

describe("FailureCard", () => {
  it("collects a one-time Vietnam payment card before live-assisted retry", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    const TestFailureCard = FailureCard as ComponentType<Record<string, unknown>>;

    render(
      <TestFailureCard
        applicationId="app-vn"
        errorMessage="Form filled but registration code element not found on review screen."
        retryModes={[{ mode: "live_assisted", label: "提交" }]}
        onRetry={onRetry}
        requiresVietnamPaymentCard
      />,
    );

    fireEvent.change(screen.getByLabelText("银行卡号"), { target: { value: "4111111111111111" } });
    fireEvent.change(screen.getByLabelText("有效期"), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("持卡人姓名（可选）"), { target: { value: "VIZA TEST" } });
    fireEvent.click(screen.getByRole("button", { name: /提交/u }));

    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledWith("live_assisted", {
        pan: "4111111111111111",
        expiry: "12/30",
        cvv: "123",
        holderName: "VIZA TEST",
      });
    });
  });

  it("collects missing Vietnam relative table fields before retry", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    const TestFailureCard = FailureCard as ComponentType<Record<string, unknown>>;

    render(
      <TestFailureCard
        applicationId="app-vn"
        errorMessage="Official Vietnam e-Visa portal fill blocked submission: relatives_in_vietnam[1]: Relatives in Viet Nam row 1 is incomplete: Date of birth, Nationality, Relationship."
        retryModes={[{ mode: "live_assisted", label: "提交" }]}
        onRetry={onRetry}
        requiresVietnamPaymentCard
      />,
    );

    fireEvent.change(screen.getByLabelText("银行卡号"), { target: { value: "4111111111111111" } });
    fireEvent.change(screen.getByLabelText("有效期"), { target: { value: "12/30" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("在越亲属出生日期"), { target: { value: "1988-02-03" } });
    fireEvent.change(screen.getByLabelText("在越亲属国籍"), { target: { value: "China" } });
    fireEvent.change(screen.getByLabelText("与在越亲属关系"), { target: { value: "Friend" } });
    fireEvent.click(screen.getByRole("button", { name: /提交/u }));

    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledWith(
        "live_assisted",
        {
          pan: "4111111111111111",
          expiry: "12/30",
          cvv: "123",
          holderName: "",
        },
        {
          relative_date_of_birth: "1988-02-03",
          relative_nationality: "China",
          relative_relationship: "Friend",
        },
      );
    });
  });
});
