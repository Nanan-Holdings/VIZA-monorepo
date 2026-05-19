import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInput } from "../chat-input";

describe("ChatInput", () => {
  it("renders textarea", () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders send button", () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls onSend when Enter pressed", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("clears input after sending", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input.value).toBe("");
  });

  it("does not send on Shift+Enter (newline)", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send while IME composition is active", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "你好" } });
    fireEvent.keyDown(input, {
      key: "Enter",
      isComposing: true,
    });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send on legacy IME Enter keyCode", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "你好" } });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("clears draft on Escape", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Draft message" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.value).toBe("");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends on Ctrl+Enter", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("sends on Cmd+Enter (Mac)", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });

    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("does not send empty message", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables textarea when disabled prop is true", () => {
    render(<ChatInput onSend={vi.fn()} disabled={true} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("disables send button when input is empty", () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("enables send button when input has content", () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hello" } });
    const button = screen.getByRole("button");
    expect(button).not.toBeDisabled();
  });

  it("sends when send button is clicked", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hello" } });

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("has default placeholder text", () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByPlaceholderText("Ask anything...")).toBeInTheDocument();
  });

  it("allows custom placeholder", () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} placeholder="Custom placeholder" />);
    expect(screen.getByPlaceholderText("Custom placeholder")).toBeInTheDocument();
  });

  it("shows connecting state when isConnecting is true", () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} isConnecting />);
    // Button should have "Connecting..." aria-label
    expect(screen.getByLabelText("Connecting...")).toBeInTheDocument();
  });

  it("has aria-label on textarea", () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByLabelText("Message input")).toBeInTheDocument();
  });
});
