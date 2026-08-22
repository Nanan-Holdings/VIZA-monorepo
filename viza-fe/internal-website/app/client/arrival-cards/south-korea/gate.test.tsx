import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KoreaArrivalCardEligibilityGate } from "./gate";

const completePreflight = vi.fn();
const push = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => "zh-CN",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/actions/visa-application-answers", () => ({
  completeKoreaEArrivalCardPreflight: (input: unknown) => completePreflight(input),
}));

describe("KoreaArrivalCardEligibilityGate", () => {
  beforeEach(() => {
    completePreflight.mockReset();
    push.mockReset();
    window.sessionStorage.clear();
  });

  it("persists a passing preflight and continues in the same application flow", async () => {
    const onComplete = vi.fn();
    completePreflight.mockResolvedValue({
      ok: true,
      applicationId: "kr-application-id",
      completedAt: Date.parse("2026-08-18T00:00:00.000Z"),
      answers: {
        date_of_birth: "1990-01-02",
        kr_eac_eligibility: "needs_declaration",
      },
    });

    render(
      <KoreaArrivalCardEligibilityGate
        applicationId="kr-application-id"
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByLabelText(/需要申报/u));
    fireEvent.change(screen.getByLabelText(/出生日期/u), {
      target: { value: "1990-01-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "继续填写" }));

    await waitFor(() => {
      expect(completePreflight).toHaveBeenCalledWith({
        applicationId: "kr-application-id",
        dateOfBirth: "1990-01-02",
        adultRepresentativeConfirmed: false,
      });
      expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
        applicationId: "kr-application-id",
        answers: expect.objectContaining({ date_of_birth: "1990-01-02" }),
      }));
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps clearly exempt travellers outside application creation", () => {
    render(<KoreaArrivalCardEligibilityGate />);

    fireEvent.click(screen.getByLabelText(/明确豁免/u));
    expect(screen.getByText("无需创建入境卡申请")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "无需创建申请" })).toBeDisabled();
    expect(completePreflight).not.toHaveBeenCalled();
  });

  it("keeps entered answers visible when the save transport fails", async () => {
    completePreflight.mockRejectedValue(new Error("server action digest"));
    render(<KoreaArrivalCardEligibilityGate />);

    fireEvent.click(screen.getByLabelText(/需要申报/u));
    const dateInput = screen.getByLabelText(/出生日期/u);
    fireEvent.change(dateInput, { target: { value: "1990-01-02" } });
    fireEvent.click(screen.getByRole("button", { name: "继续填写" }));

    expect(await screen.findByText(/暂时无法保存资格预检/u)).toBeInTheDocument();
    expect(dateInput).toHaveValue("1990-01-02");
    expect(screen.getByRole("button", { name: "继续填写" })).toBeEnabled();
  });
});
