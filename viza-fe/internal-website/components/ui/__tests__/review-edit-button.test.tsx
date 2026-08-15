import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewEditButton } from "@/components/ui/review-edit-button";

describe("ReviewEditButton", () => {
  it("keeps its background transparent and darkens only the icon color on hover", () => {
    render(<ReviewEditButton label="Edit personal information" />);

    const button = screen.getByRole("button", { name: "Edit personal information" });

    expect(button).toHaveClass(
      "bg-transparent",
      "text-brand-500",
      "hover:bg-transparent",
      "hover:text-brand-700",
    );
    expect(button).not.toHaveClass("hover:bg-brand-50");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("runs the supplied review edit action", () => {
    const onClick = vi.fn();
    render(<ReviewEditButton label="Edit passport" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit passport" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
