import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const getClientInboxOverview = vi.fn();
const getClientInboxMessage = vi.fn();
const setInboxMessageRead = vi.fn();
const setInboxMessageStarred = vi.fn();
const setInboxMessageArchived = vi.fn();
const markAllInboxRead = vi.fn();
const queueInboxReply = vi.fn();
const flagInboxEmailForConsultant = vi.fn();
const ensureInboxAiSummary = vi.fn();
const ensureInboxTranslation = vi.fn();
const listInboxAttachments = vi.fn();
const alertToast = vi.fn();

vi.mock("@/app/actions/inbox", () => ({
  getClientInboxOverview: (...args: unknown[]) => getClientInboxOverview(...args),
  getClientInboxMessage: (...args: unknown[]) => getClientInboxMessage(...args),
  setInboxMessageRead: (...args: unknown[]) => setInboxMessageRead(...args),
  setInboxMessageStarred: (...args: unknown[]) => setInboxMessageStarred(...args),
  setInboxMessageArchived: (...args: unknown[]) =>
    setInboxMessageArchived(...args),
  markAllInboxRead: (...args: unknown[]) => markAllInboxRead(...args),
  queueInboxReply: (...args: unknown[]) => queueInboxReply(...args),
  flagInboxEmailForConsultant: (...args: unknown[]) =>
    flagInboxEmailForConsultant(...args),
  ensureInboxAiSummary: (...args: unknown[]) => ensureInboxAiSummary(...args),
  ensureInboxTranslation: (...args: unknown[]) => ensureInboxTranslation(...args),
  listInboxAttachments: (...args: unknown[]) => listInboxAttachments(...args),
}));

vi.mock("@/components/ui/alert-toast", () => ({
  alertToast: (...args: unknown[]) => alertToast(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

type Messages = Record<string, unknown>;

function resolveMessage(namespace: string, key: string): string {
  const path = `${namespace}.${key}`.split(".");
  let cursor: unknown = enMessages as Messages;
  for (const part of path) {
    if (typeof cursor !== "object" || cursor === null) return path.join(".");
    cursor = (cursor as Messages)[part];
  }
  return typeof cursor === "string" ? cursor : path.join(".");
}

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => {
    const t = (key: string, values?: Record<string, unknown>) => {
      let message = resolveMessage(namespace, key);
      if (values) {
        if (message.includes("{count, plural")) {
          const count = Number(values.count ?? 0);
          message =
            count === 1 ? `1 conversation` : `${count} conversations`;
        }
        for (const [name, value] of Object.entries(values)) {
          message = message.replaceAll(`{${name}}`, String(value));
        }
      }
      return message;
    };
    return t;
  },
}));

const ITEMS = [
  {
    id: "m1",
    from_addr: "Consulate General of Indonesia <visa.singapore@kemlu.go.id>",
    subject: "B211A application BX-2291884 — additional document required",
    received_at: "2026-08-29T01:24:00.000Z",
    snippet: "Please provide a bank statement covering the last three months.",
    read: false,
    starred: false,
    archived: false,
    category: "documents",
    needsAction: true,
    hasOriginal: true,
    attachmentCount: 1,
  },
  {
    id: "m2",
    from_addr: "VIZA <hello@viza.sg>",
    subject: "Your VIZA mail address is live",
    received_at: "2026-08-18T10:00:00.000Z",
    snippet: "Use this address on every visa form.",
    read: true,
    starred: false,
    archived: false,
    category: "viza",
    needsAction: false,
    hasOriginal: false,
    attachmentCount: null,
  },
];

const MESSAGE = {
  id: "m1",
  from_addr: "Consulate General of Indonesia <visa.singapore@kemlu.go.id>",
  subject: "B211A application BX-2291884 — additional document required",
  received_at: "2026-08-29T01:24:00.000Z",
  html: null,
  text: "Dear applicant, please provide a bank statement within 7 calendar days.",
  raw_size: 4096,
  read: true,
  starred: false,
  archived: false,
  category: "documents",
  needsAction: true,
  hasOriginal: true,
  ai: {
    v: 1,
    lang: "en",
    model: "test-model",
    generatedAt: "2026-08-29T01:30:00.000Z",
    summary:
      "Indonesia needs one more document: a 3-month bank statement. You have until 5 September.",
    details: [
      { label: "Deadline", value: "5 Sep 2026" },
      { label: "Reference", value: "BX-2291884" },
    ],
    category: "documents",
    needsAction: true,
  },
  translations: {},
  attachments: [
    {
      index: 0,
      filename: "BX-2291884_document_request.pdf",
      mimeType: "application/pdf",
      size: 151552,
    },
  ],
  replies: [],
};

import { InboxContent } from "../inbox-content";

describe("InboxContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClientInboxOverview.mockResolvedValue({
      alias: "appl-test@viza.it.com",
      items: ITEMS,
    });
    getClientInboxMessage.mockResolvedValue(MESSAGE);
    setInboxMessageRead.mockResolvedValue({ ok: true });
    ensureInboxAiSummary.mockResolvedValue({ ok: true, ai: MESSAGE.ai });
    listInboxAttachments.mockResolvedValue({
      ok: true,
      attachments: MESSAGE.attachments,
    });
  });

  it("renders the mailbox with alias, folder counts, and conversation rows", async () => {
    render(<InboxContent />);

    await waitFor(() => {
      expect(screen.getByText("appl-test@viza.it.com")).toBeInTheDocument();
    });
    expect(screen.getByText("Consulate General of Indonesia")).toBeInTheDocument();
    expect(screen.getByText("Your VIZA mail address is live")).toBeInTheDocument();
    // "All mail" counts unread only; "Needs action" counts the flagged row.
    expect(screen.getByRole("button", { name: "All mail 1" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Needs action 1" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 conversations")).toBeInTheDocument();
  });

  it("opens a message, marks it read, and shows the AI reading with attachments", async () => {
    render(<InboxContent />);
    await waitFor(() => {
      expect(
        screen.getByText("Consulate General of Indonesia"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Consulate General of Indonesia"));

    expect(setInboxMessageRead).toHaveBeenCalledWith("m1", true);
    await waitFor(() => {
      expect(getClientInboxMessage).toHaveBeenCalledWith("m1");
      expect(screen.getByText("VIZA read this for you")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "Indonesia needs one more document: a 3-month bank statement. You have until 5 September.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("BX-2291884_document_request.pdf")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Download" }),
    ).toHaveAttribute("href", "/api/inbox/m1/attachment/0");
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
  });

  it("shows the setup state when no alias is provisioned yet", async () => {
    getClientInboxOverview.mockResolvedValue({ alias: null, items: [] });
    render(<InboxContent />);

    await waitFor(() => {
      expect(
        screen.getByText("Your VIZA address isn't ready yet"),
      ).toBeInTheDocument();
    });
  });
});
