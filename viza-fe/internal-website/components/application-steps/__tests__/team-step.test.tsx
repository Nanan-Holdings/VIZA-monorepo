import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TeamStep } from "../team-step";

const push = vi.fn();
const createTeamCompanion = vi.fn();
const listTeamCompanions = vi.fn();
const getFrequentTravelers = vi.fn();
const messages: Record<string, string> = {
  "application.team.subtitle": "Add travel companions from saved profiles.",
  "application.team.savedProfilesTitle": "Saved traveler profiles",
  "application.team.savedProfilesSubtitle": "Select a profile saved in Settings.",
  "application.team.manageProfiles": "Manage in Settings",
  "application.team.loadingProfiles": "Loading saved profiles...",
  "application.team.selectProfile": "Select and review",
  "application.team.profileAdded": "Added",
  "application.team.addFirstProfile": "Add a traveler profile",
  "application.team.listTitle": "Travel companions",
  "application.team.listSubtitle": "Review companions.",
  "application.team.addNew": "Add new traveler",
  "application.team.loading": "Loading companions...",
  "application.team.emptyTitle": "No companions added",
  "application.team.emptyDescription": "Continue or add a traveler.",
  "application.team.hint": "Submit after every review is finished.",
  "application.team.dialog.noFrequent": "No frequent travelers yet.",
  "settings.travelers.notSet": "Not set",
};
const teamTranslations = (key: string) => messages[`application.team.${key}`] ?? key;
const travelerTranslations = (key: string) => messages[`settings.travelers.${key}`] ?? key;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) =>
    namespace === "application.team" ? teamTranslations : travelerTranslations,
}));

vi.mock("@/app/actions/application-group", () => ({
  createTeamCompanion: (...args: unknown[]) => createTeamCompanion(...args),
  deleteTeamCompanion: vi.fn(),
  listTeamCompanions: (...args: unknown[]) => listTeamCompanions(...args),
}));

vi.mock("@/app/actions/client-settings", () => ({
  getFrequentTravelers: (...args: unknown[]) => getFrequentTravelers(...args),
}));

vi.mock("@/components/application-steps/frequent-traveler-profile-fields", () => ({
  FrequentTravelerProfileFields: () => <div>Traveler profile fields</div>,
}));

describe("TeamStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTeamCompanions.mockResolvedValue({
      ok: true,
      companions: [
        {
          applicationId: "companion-app-1",
          applicantId: "traveler-1",
          fullName: "Existing Traveler",
          nationality: "China",
          passportNumber: "E1234567",
          dateOfBirth: "1990-01-01",
          passportExpiryDate: "2030-01-01",
          status: "ready_for_submission",
        },
      ],
    });
    getFrequentTravelers.mockResolvedValue({
      success: true,
      travelers: [
        {
          id: "traveler-1",
          fullName: "Existing Traveler",
          nationality: "China",
          passportNumber: "E1234567",
          dateOfBirth: "1990-01-01",
          passportExpiryDate: "2030-01-01",
          email: null,
          phone: null,
          updatedAt: "2026-08-01T02:00:00.000Z",
        },
        {
          id: "traveler-2",
          fullName: "Saved Traveler",
          nationality: "Singapore",
          passportNumber: "K7654321",
          dateOfBirth: "1992-02-02",
          passportExpiryDate: "2032-02-02",
          email: null,
          phone: null,
          updatedAt: "2026-08-01T03:00:00.000Z",
        },
      ],
    });
    createTeamCompanion.mockResolvedValue({ ok: true, applicationId: "companion-app-2" });
  });

  test("shows Settings profiles directly without rendering a second Team heading", async () => {
    render(
      <TeamStep
        applicationId="main-app"
        country="japan"
        visaType="JP_TOURIST"
        returnTo="/client/application/long-form?step=team"
        submitLabel="Confirm team"
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Saved traveler profiles" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Team" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage in Settings" })).toHaveAttribute(
      "href",
      "/client/settings/travelers",
    );

    const existingProfile = await screen.findByRole("button", { name: /Existing Traveler.*Added/ });
    expect(existingProfile).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Saved Traveler.*Select and review/ }));

    await waitFor(() => {
      expect(createTeamCompanion).toHaveBeenCalledWith({
        applicationId: "main-app",
        travelerId: "traveler-2",
      });
    });
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("applicationId=companion-app-2"),
    );
  });
});
