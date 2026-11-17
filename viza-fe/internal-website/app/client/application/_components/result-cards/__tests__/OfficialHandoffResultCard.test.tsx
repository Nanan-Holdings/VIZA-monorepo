import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isOfficialHandoffResult, OfficialHandoffResultCard } from "../OfficialHandoffResultCard";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

const FUTURE = new Date(Date.now() + 30 * 60_000).toISOString();
const LIVE_URL = "https://www.browserbase.com/devtools-fullscreen/inspector.html";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OfficialHandoffResultCard", () => {
  it("recognises only handoff results with a handoff id", () => {
    expect(isOfficialHandoffResult({ status: "awaiting_applicant_official_submit", handoffId: "t" })).toBe(true);
    expect(isOfficialHandoffResult({ status: "awaiting_applicant_official_submit" })).toBe(false);
    expect(isOfficialHandoffResult({ status: "submitted", handoffId: "t" })).toBe(false);
  });

  it("opens the claimed official session in the tab it opened synchronously", async () => {
    const popup = { location: { replace: vi.fn() }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ liveViewUrl: LIVE_URL, expiresAt: FUTURE }), { status: 200 }),
    );

    render(
      <OfficialHandoffResultCard
        applicationId="app-id"
        result={{ status: "awaiting_applicant_official_submit", handoffId: "t", handoffExpiresAt: FUTURE, targetCountry: "ID" }}
      />,
    );
    expect(screen.getByText(/VIZA 不收取任何费用/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "前往印尼官网确认并提交" }));

    await waitFor(() => expect(popup.location.replace).toHaveBeenCalledWith(LIVE_URL));
    expect(fetchMock).toHaveBeenCalledWith("/api/applications/app-id/official-handoff", expect.objectContaining({ method: "POST" }));
  });

  it("switches to the regenerate action when the server says the session expired", async () => {
    const popup = { location: { replace: vi.fn() }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "handoff_expired" }), { status: 410 }),
    );

    render(
      <OfficialHandoffResultCard
        applicationId="app-id"
        result={{ status: "awaiting_applicant_official_submit", handoffId: "t", handoffExpiresAt: FUTURE, targetCountry: "ID" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "前往印尼官网确认并提交" }));

    expect(await screen.findByRole("button", { name: "重新准备官网会话" })).toBeInTheDocument();
    expect(popup.close).toHaveBeenCalled();
    expect(popup.location.replace).not.toHaveBeenCalled();
  });

  it("shows the regenerate action for an expired handoff without opening anything", () => {
    render(
      <OfficialHandoffResultCard
        applicationId="app-id"
        result={{ status: "awaiting_applicant_official_submit", handoffId: "t", handoffExpired: true, targetCountry: "ID" }}
      />,
    );
    expect(screen.getByText("官网会话已过期")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "前往印尼官网确认并提交" })).not.toBeInTheDocument();
  });
});
