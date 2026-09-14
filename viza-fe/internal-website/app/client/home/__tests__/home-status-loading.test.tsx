import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  fetchClientHomeDashboard: vi.fn(),
  locale: "en",
  translate: (key: string, values?: Record<string, unknown>) => {
    if (key === "welcomeBack") return `${key}:${String(values?.name ?? "")}`;
    if (key === "vizaApplicationForCountry") {
      return `${key}:${String(values?.country ?? "")}`;
    }
    return key;
  },
  readActiveApplicationSelection: vi.fn(),
  setActiveApplicationSelection: vi.fn(),
  getRecentApplicationFormHref: vi.fn(),
  readApplicationFormTarget: vi.fn(),
  getNextApplicationHref: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => mocks.locale,
  useTranslations: () => mocks.translate,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/client/home-dashboard-client", () => ({
  fetchClientHomeDashboard: mocks.fetchClientHomeDashboard,
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
  getVisaPackageTitle: (_country: string, visaType: string, locale: string) =>
    `${locale}:${visaType}`,
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
  ActiveVisaCard: ({ visaName }: { visaName: string | null }) => (
    <div data-testid="active-visa">{visaName ?? "empty"}</div>
  ),
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
  timelinePartialData = false,
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
    timelinePartialData,
  };
}

async function waitForDashboardToSettle() {
  await waitFor(() => {
    expect(screen.getByTestId("active-visa")).toBeInTheDocument();
  });
}

describe("HomePage status loading", () => {
  beforeEach(() => {
    mocks.locale = "en";
    mocks.createClient.mockReturnValue({
      auth: {
        setSession: vi.fn(),
      },
    });
    mocks.fetchClientHomeDashboard.mockReset();
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
    mocks.fetchClientHomeDashboard.mockResolvedValue(dashboard([]));

    render(<HomePage />);
    await waitForDashboardToSettle();

    expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledWith({
      applicationId: null,
      country: null,
      visaType: null,
    }, { signal: expect.any(AbortSignal) });
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
    mocks.fetchClientHomeDashboard.mockResolvedValue(
      dashboard([first, second], SECOND_APPLICATION_ID, timeline(SECOND_APPLICATION_ID)),
    );

    render(<HomePage />);
    await waitForDashboardToSettle();

    await waitFor(() => {
      expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledTimes(1);
    });
    expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: SECOND_APPLICATION_ID,
        country: second.country,
        visaType: second.visa_type,
      }),
      { signal: expect.any(AbortSignal) },
    );
  });

  it("derives the visa label from the current locale when a refresh overlaps a pending read", async () => {
    const selected = application(FIRST_APPLICATION_ID, "2026-09-01T00:00:00.000Z");
    let resolveRead!: (value: ClientHomeDashboardWithTimelineData) => void;
    const pendingRead = new Promise<ClientHomeDashboardWithTimelineData>((resolve) => {
      resolveRead = resolve;
    });
    mocks.fetchClientHomeDashboard.mockImplementationOnce(() => pendingRead);

    const { rerender } = render(<HomePage />);
    await waitFor(() => {
      expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledTimes(1);
    });

    mocks.locale = "zh";
    rerender(<HomePage />);
    resolveRead(dashboard([selected], FIRST_APPLICATION_ID, timeline(FIRST_APPLICATION_ID)));

    await waitFor(() => {
      expect(screen.getByTestId("active-visa")).toHaveTextContent(
        "zh:SG_ARRIVAL_CARD",
      );
    });
    expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledTimes(1);
  });

  it("uses the server-selected owned application when client hints disagree", async () => {
    const first = application(FIRST_APPLICATION_ID, "2026-09-01T00:00:00.000Z");
    const second = application(SECOND_APPLICATION_ID, "2026-09-02T00:00:00.000Z");
    mocks.readActiveApplicationSelection.mockReturnValue({
      applicationId: "99999999-9999-4999-8999-999999999999",
      packageId: null,
      country: first.country,
      visaType: first.visa_type,
      href: "/client/destinations",
    });
    mocks.readApplicationFormTarget.mockReturnValue({
      applicationId: SECOND_APPLICATION_ID,
      country: second.country,
      visaType: second.visa_type,
    });
    mocks.fetchClientHomeDashboard.mockResolvedValue(
      dashboard([first, second], FIRST_APPLICATION_ID, timeline(FIRST_APPLICATION_ID)),
    );

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByTestId("timeline")).toHaveTextContent("status-loaded");
    });
    expect(mocks.setActiveApplicationSelection).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: FIRST_APPLICATION_ID }),
    );
  });

  it("marks an unknown server timeline identity as partial instead of showing another app as complete", async () => {
    const selected = application(FIRST_APPLICATION_ID, "2026-09-01T00:00:00.000Z");
    mocks.fetchClientHomeDashboard.mockResolvedValue(
      dashboard([selected], "99999999-9999-4999-8999-999999999999", timeline("99999999-9999-4999-8999-999999999999")),
    );

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByTestId("timeline")).toHaveTextContent("status-empty");
    });
    expect(screen.getByText("partialData")).toBeInTheDocument();
  });

  it("clears stale timeline state when a later aggregate refresh returns null", async () => {
    const selected = application(FIRST_APPLICATION_ID, "2026-09-01T00:00:00.000Z");
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    mocks.fetchClientHomeDashboard
      .mockResolvedValueOnce(
        dashboard([selected], FIRST_APPLICATION_ID, timeline(FIRST_APPLICATION_ID)),
      )
      .mockResolvedValueOnce(dashboard([selected], FIRST_APPLICATION_ID, null));

    render(<HomePage />);

    await waitFor(() => {
      expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledWith(
        { applicationId: null, country: null, visaType: null },
        { signal: expect.any(AbortSignal) },
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
      expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId("timeline")).toHaveTextContent("status-empty");
    });
  });

  it("clears prior applicant state when a refresh finds no authenticated session", async () => {
    const selected = application(FIRST_APPLICATION_ID, "2026-09-01T00:00:00.000Z");
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    mocks.fetchClientHomeDashboard
      .mockResolvedValueOnce(
        dashboard([selected], FIRST_APPLICATION_ID, timeline(FIRST_APPLICATION_ID)),
      )
      .mockResolvedValueOnce({
        ...dashboard([]),
        authenticated: false,
        authEmail: null,
        profile: null,
      });

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByTestId("active-visa")).toHaveTextContent(
        "en:SG_ARRIVAL_CARD",
      );
    });
    expect(screen.getByText("welcomeBack:Test")).toBeInTheDocument();
    expect(screen.getByText("vizaApplicationForCountry:singapore")).toBeInTheDocument();

    now.mockReturnValue(1_030_001);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("active-visa")).toHaveTextContent("empty");
      expect(screen.getByTestId("timeline")).toHaveTextContent("status-empty");
    });
    expect(screen.getByText("welcomeBack:there")).toBeInTheDocument();
    expect(screen.getByText("vizaApplication")).toBeInTheDocument();
    expect(screen.queryByText("welcomeBack:Test")).not.toBeInTheDocument();
    expect(
      screen.queryByText("vizaApplicationForCountry:singapore"),
    ).not.toBeInTheDocument();
  });

  it("shows the existing localized partial-data notice for a degraded timeline", async () => {
    const selected = application(FIRST_APPLICATION_ID, "2026-09-01T00:00:00.000Z");
    mocks.fetchClientHomeDashboard.mockResolvedValue(
      dashboard([selected], FIRST_APPLICATION_ID, timeline(FIRST_APPLICATION_ID), true),
    );

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText("partialData")).toBeInTheDocument();
    });
    expect(screen.getByTestId("timeline")).toHaveTextContent("status-loaded");
  });

  it("aborts the in-flight read on unmount without starting a retry", async () => {
    let finishRead: ((data: ClientHomeDashboardWithTimelineData) => void) | undefined;
    mocks.fetchClientHomeDashboard.mockImplementation(() => new Promise((resolve) => {
      finishRead = resolve;
    }));
    const { unmount } = render(<HomePage />);
    await waitFor(() => expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledTimes(1));
    const signal = mocks.fetchClientHomeDashboard.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    window.dispatchEvent(new Event("focus"));
    expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledTimes(1);
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finishRead?.(dashboard([])));
    expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledTimes(1);
  });

  it("clears an abort retry timer when the page unmounts", async () => {
    mocks.fetchClientHomeDashboard.mockRejectedValueOnce(
      new DOMException("The operation was aborted.", "AbortError"),
    );

    const { unmount } = render(<HomePage />);
    await waitFor(() => {
      expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledTimes(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(mocks.fetchClientHomeDashboard).toHaveBeenCalledTimes(1);
  });
});
