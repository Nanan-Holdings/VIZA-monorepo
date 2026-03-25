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

  it("renders Labs AI avatar", () => {
    render(<ThinkingIndicator />);
    expect(screen.getByText("✻")).toBeInTheDocument();
  });
});
