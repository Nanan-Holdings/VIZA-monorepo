import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AnimatedTabPill } from "../animated-tab-pill";

describe("AnimatedTabPill", () => {
  it("keeps the selected mobile pill visible on a dark header", () => {
    render(
      <AnimatedTabPill
        activeTab="Home"
        isDark
        onTabChange={vi.fn()}
        tabs={[
          { id: "Home", label: "Home" },
          { id: "Application", label: "Application" },
        ]}
        variant="pill"
      />,
    );

    const activeTab = screen.getByRole("button", { name: "Home" });
    expect(activeTab).toHaveAttribute("aria-current", "page");
    expect(activeTab).toHaveClass("bg-white", "border-white", "text-brand-500");

    const inactiveTab = screen.getByRole("button", { name: "Application" });
    expect(inactiveTab).not.toHaveAttribute("aria-current");
    expect(inactiveTab).toHaveClass(
      "bg-transparent",
      "border-[rgba(255,255,255,0.3)]",
      "text-[rgba(255,255,255,0.6)]",
    );
  });
});
