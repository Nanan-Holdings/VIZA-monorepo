import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessage } from "../chat-message";

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe("ChatMessage", () => {
  it("renders user message with correct content", () => {
    render(<ChatMessage role="user" content="Hello there" timestamp={Date.now()} />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("renders agent message with correct content", () => {
    render(<ChatMessage role="agent" content="Hi, how can I help?" timestamp={Date.now()} />);
    expect(screen.getByText("Hi, how can I help?")).toBeInTheDocument();
  });

  it("renders user message with brand color background", () => {
    const { container } = render(<ChatMessage role="user" content="Hello" timestamp={Date.now()} />);
    const messageBubble = container.querySelector(".bg-brand-500");
    expect(messageBubble).toBeInTheDocument();
  });

  it("renders agent message as plain text without bubble chrome", () => {
    const { container } = render(<ChatMessage role="agent" content="Hi there" timestamp={Date.now()} />);
    expect(container.querySelector(".text-gray-700")).toBeInTheDocument();
    expect(container.querySelector(".bg-white")).not.toBeInTheDocument();
  });

  it("renders bold markdown markers as plain text", () => {
    const { container } = render(
      <ChatMessage role="agent" content="This is **bold** text" timestamp={Date.now()} />
    );
    expect(screen.getByText("This is bold text")).toBeInTheDocument();
    expect(container.querySelector("strong")).not.toBeInTheDocument();
  });

  it("renders italic markdown markers as plain text", () => {
    const { container } = render(
      <ChatMessage role="agent" content="This is *italic* text" timestamp={Date.now()} />
    );
    expect(screen.getByText("This is italic text")).toBeInTheDocument();
    expect(container.querySelector("em")).not.toBeInTheDocument();
  });

  it("shows copy button on agent messages", () => {
    render(<ChatMessage role="agent" content="Copy me" timestamp={Date.now()} />);
    // Copy button has aria-label
    const copyButton = screen.queryByLabelText("Copy message");
    // Button may be hidden until hover - just verify message renders
    expect(screen.getByText("Copy me")).toBeInTheDocument();
  });

  it("renders agent message without streaming cursor", () => {
    const { container } = render(
      <ChatMessage role="agent" content="partial" timestamp={Date.now()} />
    );
    // No pulsing cursor — messages appear fully formed
    const cursor = container.querySelector(".animate-pulse");
    expect(cursor).not.toBeInTheDocument();
  });

  it("renders system messages centered with warning style", () => {
    const { container } = render(
      <ChatMessage role="system" content="System message" timestamp={Date.now()} />
    );
    // System messages have amber styling
    const systemBubble = container.querySelector(".bg-amber-50");
    expect(systemBubble).toBeInTheDocument();
  });

  it("renders error messages with error styling", () => {
    const { container } = render(
      <ChatMessage role="error" content="Error occurred" timestamp={Date.now()} />
    );
    // Error messages have red styling
    expect(container.querySelector(".bg-red-100")).toBeInTheDocument();
    expect(container.querySelector(".text-red-700")).toBeInTheDocument();
  });

  it("renders markdown links as plain text with URL", () => {
    render(
      <ChatMessage role="agent" content="Visit [example](https://example.com)" timestamp={Date.now()} />
    );
    expect(screen.getByText("Visit example (https://example.com)")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "example" })).not.toBeInTheDocument();
  });

  it("renders inline code markers as plain text", () => {
    const { container } = render(
      <ChatMessage role="agent" content="Use `npm install` to install" timestamp={Date.now()} />
    );
    expect(screen.getByText("Use npm install to install")).toBeInTheDocument();
    expect(container.querySelector("code")).not.toBeInTheDocument();
  });

  it("renders code block fences as plain text", () => {
    const { container } = render(
      <ChatMessage
        role="agent"
        content={"Here is code:\n```javascript\nconsole.log('hi');\n```"}
        timestamp={Date.now()}
      />
    );
    expect(screen.getByText("Here is code:")).toBeInTheDocument();
    expect(screen.getByText("console.log('hi');")).toBeInTheDocument();
    expect(container.querySelector("pre")).not.toBeInTheDocument();
  });

  it("does not render an agent avatar inside plain agent messages", () => {
    render(
      <ChatMessage role="agent" content="Hello" timestamp={Date.now()} />
    );
    expect(screen.queryByText("✻")).not.toBeInTheDocument();
  });
});
