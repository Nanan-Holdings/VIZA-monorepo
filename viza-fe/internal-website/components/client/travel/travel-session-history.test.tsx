import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { TravelSessionHistory } from "./travel-session-history";

afterEach(cleanup);

function setup(disabled = false) {
  const callbacks = {
    onNewSession: vi.fn(),
    onSelectSession: vi.fn(),
    onRenameSession: vi.fn(),
    onDeleteSession: vi.fn(),
  };
  render(
    <NextIntlClientProvider locale="en" messages={{ chat: messages.chat }}>
      <TravelSessionHistory
        sessions={[
          {
            id: "tokyo",
            title: "Tokyo holiday",
            updatedAt: "2026-09-12",
            searchText: "Visit Ueno Park",
          },
          {
            id: "paris",
            title: "Paris weekend",
            updatedAt: "2026-09-11",
            searchText: "Visit the Louvre",
          },
        ]}
        activeSessionId="tokyo"
        disabled={disabled}
        {...callbacks}
      />
    </NextIntlClientProvider>
  );
  fireEvent.click(screen.getByTestId("travel-session-toggle"));
  return {
    ...callbacks,
    panel: screen.getByTestId("travel-chat-session-sidebar"),
  };
}

describe("TravelSessionHistory", () => {
  it("searches titles and visible message text, ignoring casing and surrounding spaces", () => {
    const { panel, onSelectSession } = setup();
    const search = within(panel).getByRole("searchbox");
    fireEvent.change(search, { target: { value: "  lOuVrE  " } });
    expect(within(panel).getAllByTestId("travel-session-item")).toHaveLength(1);
    expect(within(panel).getByText("Paris weekend")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "Tokyo" } });
    expect(within(panel).getAllByTestId("travel-session-item")).toHaveLength(1);
    fireEvent.change(search, { target: { value: "no-such-trip" } });
    expect(within(panel).getByRole("status")).toHaveTextContent(
      "No results found"
    );
    expect(onSelectSession).not.toHaveBeenCalled();
  });

  it("selects the matching conversation and closes the panel", () => {
    const { panel, onSelectSession } = setup();
    fireEvent.change(within(panel).getByRole("searchbox"), {
      target: { value: "Louvre" },
    });
    fireEvent.click(
      within(panel).getByRole("button", { name: /Paris weekend Sep/ })
    );
    expect(onSelectSession).toHaveBeenCalledWith("paris");
    expect(
      screen.queryByTestId("travel-chat-session-sidebar")
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("travel-session-toggle"));
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("requires confirmation to delete and supports cancellation", () => {
    const { panel, onDeleteSession } = setup();
    fireEvent.click(
      within(panel).getByRole("button", { name: "Delete Paris weekend" })
    );
    expect(onDeleteSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    expect(onDeleteSession).not.toHaveBeenCalled();
    fireEvent.click(
      within(panel).getByRole("button", { name: "Delete Paris weekend" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm deletion of Paris weekend" })
    );
    expect(onDeleteSession).toHaveBeenCalledOnce();
    expect(onDeleteSession).toHaveBeenCalledWith("paris");
  });

  it("saves an explicit renamed title and starts a new conversation", () => {
    const { panel, onRenameSession, onNewSession } = setup();
    fireEvent.click(
      within(panel).getByRole("button", { name: "Rename Paris weekend" })
    );
    fireEvent.change(screen.getByLabelText("Conversation title"), {
      target: { value: "  Museum weekend  " },
    });
    fireEvent.click(screen.getByTestId("travel-session-save-rename"));
    expect(onRenameSession).toHaveBeenCalledWith("paris", "Museum weekend");
    fireEvent.click(within(panel).getByRole("button", { name: "New chat" }));
    expect(onNewSession).toHaveBeenCalledOnce();
    expect(
      screen.queryByTestId("travel-chat-session-sidebar")
    ).not.toBeInTheDocument();
  });

  it("allows searching while a response is pending but disables changes", () => {
    const { panel, onNewSession, onSelectSession, onDeleteSession } =
      setup(true);
    const search = within(panel).getByRole("searchbox");
    expect(search).toBeEnabled();
    fireEvent.change(search, { target: { value: "Paris" } });
    expect(
      within(panel).getByRole("button", { name: "New chat" })
    ).toBeDisabled();
    for (const button of within(panel).getAllByRole("button", {
      name: /Paris weekend/,
    })) {
      expect(button).toBeDisabled();
    }
    expect(onNewSession).not.toHaveBeenCalled();
    expect(onSelectSession).not.toHaveBeenCalled();
    expect(onDeleteSession).not.toHaveBeenCalled();
  });
});
