import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PageBackButton } from "@/components/ui/page-back-button";

const navigation = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

describe("PageBackButton", () => {
  beforeEach(() => {
    navigation.back.mockReset();
    navigation.push.mockReset();
  });

  it("renders a localized accessible label", () => {
    render(<PageBackButton fallbackHref="/client/settings" label="返回设置" />);

    const button = screen.getByRole("button", { name: "返回设置" });

    expect(button).toHaveAttribute("title", "返回设置");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("returns to the previous browser-history entry", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(2);
    render(<PageBackButton fallbackHref="/client/settings" label="返回设置" />);

    fireEvent.click(screen.getByRole("button", { name: "返回设置" }));

    expect(navigation.back).toHaveBeenCalledOnce();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("uses the safe fallback when no previous entry exists", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);
    render(<PageBackButton fallbackHref="/client/settings" label="返回设置" />);

    fireEvent.click(screen.getByRole("button", { name: "返回设置" }));

    expect(navigation.push).toHaveBeenCalledWith("/client/settings");
  });

  it("allows page layouts to extend its styling", () => {
    render(
      <PageBackButton
        fallbackHref="/client/home"
        label="Back home"
        className="mb-4 text-brand-500"
      />,
    );

    expect(screen.getByRole("button", { name: "Back home" })).toHaveClass(
      "mb-4",
      "text-brand-500",
    );
  });
});
