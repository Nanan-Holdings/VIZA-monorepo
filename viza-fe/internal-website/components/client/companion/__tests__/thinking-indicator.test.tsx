import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThinkingIndicator } from "../thinking-indicator";

describe("ThinkingIndicator", () => {
  it("renders three animated dots", () => {
    const { container } = render(<ThinkingIndicator />);
    const dots = container.querySelectorAll(".animate-bounce");
    expect(dots.length).toBe(3);
  });

  it("has loading aria-label", () => {
    render(<ThinkingIndicator />);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("applies custom className to the loading indicator", () => {
    render(<ThinkingIndicator className="mt-2" />);
    expect(screen.getByLabelText("Loading")).toHaveClass("mt-2");
  });
});
