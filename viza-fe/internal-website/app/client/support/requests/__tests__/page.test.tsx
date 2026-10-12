import { act, cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";
import type { SupportTicketRow } from "@/app/actions/support";
import SupportRequestsPage from "../page";

const mocks = vi.hoisted(() => ({ listMyTickets: vi.fn() }));
vi.mock("@/app/actions/support", () => ({ listMyTickets: mocks.listMyTickets }));

const ticket: SupportTicketRow = {
  id: "ticket-one",
  applicant_id: "applicant-one",
  application_id: null,
  subject: "Fixture request",
  body: "Fixture request body",
  status: "unresolved",
  priority: "p2",
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
};

function page(locale: "en" | "zh") {
  return (
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={{ supportCenter: (locale === "en" ? en : zh).supportCenter }}
    >
      <SupportRequestsPage />
    </NextIntlClientProvider>
  );
}

describe("support request loading", () => {
  beforeEach(() => { mocks.listMyTickets.mockReset(); });
  afterEach(cleanup);

  it("keeps the same pending load across locale changes and renders current-language data", async () => {
    let finish!: (result: { rows: SupportTicketRow[] }) => void;
    mocks.listMyTickets.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { rerender } = render(page("en"));
    rerender(page("zh"));
    rerender(page("en"));
    rerender(page("zh"));
    expect(mocks.listMyTickets).toHaveBeenCalledTimes(1);
    await act(async () => finish({ rows: [ticket] }));
    expect(screen.getByText(ticket.subject)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: zh.supportCenter.requestsPage.title })).toBeInTheDocument();
    rerender(page("en"));
    expect(screen.getByText(ticket.subject)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: en.supportCenter.requestsPage.title })).toBeInTheDocument();
    expect(mocks.listMyTickets).toHaveBeenCalledTimes(1);
  });

  it.each(["result", "rejection"])("localizes a %s failure without issuing another load", async (kind) => {
    if (kind === "result") mocks.listMyTickets.mockResolvedValue({ error: "private service detail" });
    else mocks.listMyTickets.mockRejectedValue(new Error("private service detail"));
    const { rerender } = render(page("en"));
    expect(await screen.findByText(en.supportCenter.requestsPage.error)).toBeInTheDocument();
    rerender(page("zh"));
    expect(screen.getByText(zh.supportCenter.requestsPage.error)).toBeInTheDocument();
    expect(screen.queryByText("private service detail")).not.toBeInTheDocument();
    expect(mocks.listMyTickets).toHaveBeenCalledTimes(1);
  });

  it("ignores a late failure after unmount and loads again for a fresh page mount", async () => {
    let fail!: (error: Error) => void;
    mocks.listMyTickets.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
    const first = render(page("en"));
    first.unmount();
    mocks.listMyTickets.mockResolvedValue({ rows: [ticket] });
    render(page("en"));
    await act(async () => fail(new Error("late request failure")));
    expect(await screen.findByText(ticket.subject)).toBeInTheDocument();
    expect(screen.queryByText(en.supportCenter.requestsPage.error)).not.toBeInTheDocument();
    expect(mocks.listMyTickets).toHaveBeenCalledTimes(2);
  });
});
