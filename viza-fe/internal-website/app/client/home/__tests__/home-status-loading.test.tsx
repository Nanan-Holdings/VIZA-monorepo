import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClientHomeDashboardWithTimeline: vi.fn(),
  translate: (key: string) => key,
  readActiveApplicationSelection: vi.fn(),
  setActiveApplicationSelection: vi.fn(),
  getRecentApplicationFormHref: vi.fn(),
  readApplicationFormTarget: vi.fn(),
  getNextApplicationHref: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => mocks.translate,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/app/actions/client-home-dashboard", () => ({
  getClientHomeDashboardWithTimeline: mocks.getClientHomeDashboardWithTimeline,
}));

vi.mock("@/lib/client/active-application-selection", () => ({
  isOngoingApplicationState: (status: string) => status === "draft",
  readActiveApplicationSelection: mocks.readActiveApplicationSelection,
  setActiveApplicationSelection: mocks.setActiveApplicationSelection,
}));

vi.mock("@/lib/client/recent-application-form", () => ({
  getRecentApplicationFormHref: mocks.getRecentApplicationFormHref,
  readApplicationFormTarget: mocks.readApplicationFormTarget,
}));

vi.mock("@/lib/client/application-progress", () => ({
  getNextApplicationHref: mocks.getNextApplicationHref,
}));

vi.mock("@/lib/visa-destinations", () => ({
  getDestinationDisplayNameForLocale: (country: string) => country,
  getFormVisaType: (visaType: string) => visaType,
  getVisaPackageTitle: (_country: string, visaType: string) => visaType,
}));

vi.mock("@/lib/client/country-hero-theme", () => ({
  getCountryHeroTheme: () => ({ image: null }),
  heroGradientCss: () => "linear-gradient(#123456, #654321)",
}));

vi.mock("@/components/client/home/ApplicationTimelineSection", () => ({
  ApplicationTimelineSection: ({
    application,
  }: {
    application: unknown;
  }) => (
    <div data-testid="timeline">
      {application ? "status-loaded" : "status-empty"}
    </div>
  ),
}));

vi.mock("@/components/client/home/QuickActionsCard", () => ({
  QuickActionsCard: () => <div data-testid="quick-actions" />,
}));

vi.mock("@/components/client/home/UniversalInfoCard", () => ({
  UniversalInfoCard: () => <div data-testid="universal-info" />,
}));

vi.mock("@/components/client/home/ActiveVisaCard", () => ({
  ActiveVisaCard: () => <div data-testid="active-visa" />,
}));

import type {
  ClientHomeDashboardWithTimelineData,
} from "@/app/actions/client-home-dashboard";
import type { ClientHomeTimelineApplication } from "@/app/client/status/status-data";
import type { ApplicationRow } from "@/lib/client/application-progress";
import HomePage from "../page";

const FIRST_APPLICATION_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_APPLICATION_ID = "22222222-2222-4222-8222-222222222222";

function application(id: string, updatedAt: string): ApplicationRow {
  return {
    id,
    status: "draft",
    country: "singapore",
    visa_type: "SG_ARRIVAL_CARD",
    purpose: "tourism",
    visa_package_id: null,
    submission_result_status: null,
    submitted_at: null,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

function timeline(applicationId: string): ClientHomeTimelineApplication {
  return {
    id: applicationId,
    country: "singapore",
    officialReference: null,
    formAnswerCount: 0,
    documents: { total: 0, uploaded: 0, validated: 0, missing: 0, rejected: 0 },
    steps: [],
    actions: [],
  };
}

function dashboard(
  applications: ApplicationRow[],
  timelineApplicationId: string | null = null,
  timeline: ClientHomeTimelineApplication | null = null,
): ClientHomeDashboardWithTimelineData {
  return {
    authenticated: true,
    authEmail: "test@example.com",
    profile: {
      full_name: "Test Applicant",
      surname: null,
      given_names: null,
      date_of_birth: null,
      place_of_birth: null,
      birth_country: null,
      birth_province_or_state: null,
      birth_city: null,
      gender: null,
      nationality: null,
      occupation: null,
      address: null,
      passport_number: null,
      passport_issue_date: null,
      passport_expiry_date: null,
      passport_issuing_country: null,
      email: null,
      phone: null,
      wechat: null,
    },
    applications,
    documents: [],
    payments: [],
    timelineApplicationId,
    timeline,
    timelinePartialData: false,
  };
}

async function waitForDashboardToSettle() {
  await waitFor(() => {
    expect(screen.getByTestId("active-visa")).toBeInTheDocument();
  });
}

describe("HomePage status loading", () => {
  beforeEach(() => {
    mocks.createClient.mockReturnValue({
      auth: {
        setSession: vi.fn(),
      },
    });
    mocks.getClientHomeDashboardWithTimeline.mockReset();
    mocks.readActiveApplicationSelection.mockReset();
    mocks.setActiveApplicationSelection.mockReset();
    mocks.getRecentApplicationFormHref.mockReset();
    mocks.readApplicationFormTarget.mockReset();
    mocks.getNextApplicationHref.mockReset();
    mocks.readActiveApplicationSelection.mockReturnValue(null);
    mocks.getRecentApplicationFormHref.mockReturnValue(null);
    mocks.readApplicationFormTarget.mockReturnValue(null);
    mocks.getNextApplicationHref.mockReturnValue("/client/destinations");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("keeps the timeline empty when the aggregate dashboard has no application", async () => {
    mocks.getClientHomeDashboardWithTimeline.mockResolvedValue(dashboard([]));

    render(<HomePage />);
    await waitForDashboardToSettle();

    expect(mocks.getClientHomeDashboardWithTimeline).toHaveBeenCalledWith({
      applicationId: null,
      country: null,
      visaType: null,
    });
    await waitFor(() => {
      expect(screen.getByTestId("timeline")).toHaveTextContent("status-empty");
    });
  });

  it("passes only the exact selected application hint to the aggregate dashboard", async () => {
    const first = application(FIRST_APPLICATION_ID, "2026-09-01T00:00:00.000Z");
    const second = application(SECOND_APPLICATION_ID, "2026-09-02T00:00:00.000Z");
    mocks.readActiveApplicationSelection.mockReturnValue({
      applicationId: SECOND_APPLICATION_ID,
      packageId: null,
      country: second.country,
      visaType: second.visa_type,
      href: "/client/destinations",
    });
    mocks.getClientHomeDashboardWithTimeline.mockResolvedValue(
      dashboard([first, second], SECOND_APPLICATION_ID, timeline(SECOND_APPLICATION_ID)),
    );

    render(<HomePage />);
    await waitForDashboardToSettle();

    await waitFor(() => {
      expect(mocks.getClientHomeDashboardWithTimeline).toHaveBeenCalledTimes(1);
    });
    expect(mocks.getClientHomeDashboardWithTimeline).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: SECOND_APPLICATION_ID,
        country: second.country,
        visaType: second.visa_type,
      }),
    );
  });

  it("clears stale timeline state when a later aggregate refresh returns null", async () => {
    const selected = application(FIRST_APPLICATION_ID, "2026-09-01T00:00:00.000Z");
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    mocks.getClientHomeDashboardWithTimeline
      .mockResolvedValueOnce(
        dashboard([selected], FIRST_APPLICATION_ID, timeline(FIRST_APPLICATION_ID)),
      )
      .mockResolvedValueOnce(dashboard([selected], FIRST_APPLICATION_ID, null));

    render(<HomePage />);

    await waitFor(() => {
      expect(mocks.getClientHomeDashboardWithTimeline).toHaveBeenCalledWith(
        { applicationId: null, country: null, visaType: null },
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("timeline")).toHaveTextContent("status-loaded");
    });

    now.mockReturnValue(1_030_001);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mocks.getClientHomeDashboardWithTimeline).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId("timeline")).toHaveTextContent("status-empty");
    });
  });
});
