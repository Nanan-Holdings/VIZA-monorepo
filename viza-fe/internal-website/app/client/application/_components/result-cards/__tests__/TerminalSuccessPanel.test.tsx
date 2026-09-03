import { render, screen } from "@testing-library/react";
import { Download } from "@phosphor-icons/react";
import { describe, expect, it } from "vitest";
import { ActionButton } from "@/components/ui/action-button";
import { SubmissionStatePanel, TerminalSuccessPanel } from "@/components/ui/submission-result-panel";

describe("TerminalSuccessPanel", () => {
  it("renders each success fact and artifact action once", () => {
    render(
      <TerminalSuccessPanel
        title="Application submitted"
        summary="The official portal confirmed your registration."
        reference="SG-123456"
        referenceLabel="Official reference"
        artifacts={<p>Official confirmation PDF saved</p>}
        primaryAction={<ActionButton size="sm"><Download />Download PDF</ActionButton>}
        secondaryActions={<ActionButton size="sm" variant="outline">Open official portal</ActionButton>}
      />,
    );

    expect(screen.getByText("Application submitted")).toBeInTheDocument();
    expect(screen.getAllByText("SG-123456")).toHaveLength(1);
    expect(screen.getAllByText("Official confirmation PDF saved")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Download PDF/u })).toHaveClass("h-[38px]");
    expect(screen.getByRole("button", { name: "Open official portal" })).toHaveClass("!border-[#e5e7eb]");
  });

  it("accepts localized Chinese content and optional regions", () => {
    render(
      <TerminalSuccessPanel
        title="提交成功"
        reference="PH-2026-001"
        referenceLabel="官方参考号"
        primaryAction={<ActionButton size="sm">下载凭证</ActionButton>}
      />,
    );

    expect(screen.getByText("提交成功")).toBeInTheDocument();
    expect(screen.getByText("官方参考号")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载凭证" })).toBeInTheDocument();
  });

  it.each([
    ["pending", "Processing submission"],
    ["action-required", "Official action required"],
    ["failure", "Submission failed"],
  ] as const)("renders the shared %s state shell", (state, title) => {
    render(
      <SubmissionStatePanel
        state={state}
        title={title}
        summary="One localized status fact."
        actions={<ActionButton size="sm">Take action</ActionButton>}
      />,
    );

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(document.querySelector(`[data-submission-state="${state}"]`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take action" })).toHaveClass("h-[38px]");
  });
});
