import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UniversalProfileSyncCard } from "../universal-profile-sync-card";

const loadChanges = vi.fn();
const syncAnswers = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

vi.mock("@/app/actions/visa-application-answers", () => ({
  loadApplicationUniversalProfileChanges: (applicationId: string) =>
    loadChanges(applicationId),
  syncApplicationAnswersToUniversalProfile: (applicationId: string) =>
    syncAnswers(applicationId),
}));

describe("UniversalProfileSyncCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadChanges
      .mockResolvedValueOnce({
        changes: [
          {
            canonicalKey: "phone",
            kind: "new",
            labelZh: "电话号码",
            labelEn: "Phone number",
            valueZh: "+65 8123 4567",
            valueEn: "+65 8123 4567",
          },
          {
            canonicalKey: "employer_name",
            kind: "updated",
            labelZh: "雇主名称",
            labelEn: "Employer name",
            valueZh: "New Employer",
            valueEn: "New Employer",
            previousValueZh: "Old Employer",
            previousValueEn: "Old Employer",
          },
        ],
      })
      .mockResolvedValueOnce({ changes: [] });
    syncAnswers.mockResolvedValue({ savedCount: 2 });
  });

  it("shows only new and updated answers before saving", async () => {
    render(<UniversalProfileSyncCard applicationId="application-1" />);

    expect(await screen.findByText("Phone number:")).toBeInTheDocument();
    expect(screen.getByText("+65 8123 4567")).toBeInTheDocument();
    expect(screen.getByText("Employer name:")).toBeInTheDocument();
    expect(screen.getByText("Old Employer").tagName).toBe("DEL");
    expect(screen.getByText("New Employer")).toBeInTheDocument();
    expect(screen.queryByText("Email address:")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save new information" }));

    await waitFor(() => {
      expect(syncAnswers).toHaveBeenCalledWith("application-1");
    });
    expect(await screen.findByText(
      "2 new or changed answers were saved to Universal Profile. Trip, payment, and declaration details were not saved.",
    )).toBeInTheDocument();
    expect(await screen.findByText(
      "This application has no new or changed reusable information.",
    )).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
  });
});
