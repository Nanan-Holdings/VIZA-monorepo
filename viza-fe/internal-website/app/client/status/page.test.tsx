import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ApplicationListItem } from "./applications-list";
import type {
  ClientStatusIndexData,
  ClientStatusIndexApplication,
} from "./status-data";

const mocks = vi.hoisted(() => ({
  getClientStatusIndexData: vi.fn(),
  getClientStatusData: vi.fn(),
  getTranslations: vi.fn(),
  getLocale: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  buildApplicationLongFormHref: vi.fn(
    ({
      applicationId,
      country,
      visaType,
      step,
    }: {
      applicationId?: string | null;
      country?: string | null;
      visaType?: string | null;
      step?: string | null;
    }) => {
      const params = new URLSearchParams();
      if (applicationId) params.set("applicationId", applicationId);
      if (country) params.set("country", country);
      if (visaType) params.set("visaType", visaType);
      if (step) params.set("step", step);
      return `/client/application/long-form?${params.toString()}`;
    },
  ),
}));

vi.mock("./status-data", () => ({
  getClientStatusIndexData: mocks.getClientStatusIndexData,
  getClientStatusData: mocks.getClientStatusData,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children?: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
  getLocale: mocks.getLocale,
}));

vi.mock("@/lib/visa-destinations", () => ({
  getPopularVisaDestinationByPackage: vi.fn(() => ({ id: "destination-test" })),
  getVisaDestinationKey: vi.fn(
    (country: string, visaType: string) => `${country}:${visaType}`,
  ),
}));

vi.mock("@/lib/client/active-application-selection", () => ({
  isOngoingApplicationState: vi.fn((state: string) => state !== "approved"),
}));

vi.mock("@/lib/client/recent-application-form", () => ({
  buildApplicationLongFormHref: mocks.buildApplicationLongFormHref,
}));

vi.mock("./applications-list", () => ({
  ApplicationsList: ({
    items,
    initialExpandedCountry,
  }: {
    items: ApplicationListItem[];
    initialExpandedCountry: string | null;
  }) => (
    <div
      data-testid="applications-list"
      data-expanded-country={initialExpandedCountry ?? ""}
    >
      {items.map((item) => (
        <article key={item.key} data-testid={`application-${item.key}`}>
          <h2>{item.countryLabel}</h2>
          <p>{item.visaLabel}</p>
          <p>{item.stateLabel}</p>
          {item.records.map((record) => (
            <a key={record.selectionKey} href={record.detailHref}>
              {record.visaLabel}
            </a>
          ))}
        </article>
      ))}
    </div>
  ),
}));

vi.mock("./add-destination-section", () => ({
  AddDestinationSection: ({
    startedKeys,
  }: {
    startedKeys: string[];
  }) => (
    <div data-testid="add-destination-section">{startedKeys.join(",")}</div>
  ),
}));

import ClientStatusPage from "./page";

const applicationRecord = {
  id: "record-malaysia",
  applicationId: "application-malaysia",
  packageId: "package-malaysia",
  country: "malaysia",
  visaType: "evisa_tourism",
  visaTypeLabel: "Malaysia eVisa",
  visaTypeLabelZh: "马来西亚电子签证",
  state: "in_progress" as const,
  progressPercent: 42,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
  submittedAt: null,
  detailHref: "/client/application/long-form?applicationId=application-malaysia&step=status",
  continueHref: "/client/application/long-form?applicationId=application-malaysia",
};

const malaysiaApplication: ClientStatusIndexApplication = {
  id: "application-malaysia",
  key: "malaysia:evisa_tourism",
  countryKey: "马来西亚",
  packageId: "package-malaysia",
  country: "malaysia",
  visaType: "evisa_tourism",
  countryName: "Malaysia",
  countryNameZh: "马来西亚",
  countryFlag: "MY",
  visaTypeLabel: "Malaysia eVisa",
  visaTypeLabelZh: "马来西亚电子签证",
  state: "in_progress",
  progressPercent: 42,
  applicationRecords: [applicationRecord],
};

const thailandApplication: ClientStatusIndexApplication = {
  id: "application-thailand",
  key: "thailand:tdac",
  countryKey: "泰国",
  packageId: "package-thailand",
  country: "thailand",
  visaType: "tdac",
  countryName: "Thailand",
  countryNameZh: "泰国",
  countryFlag: "TH",
  visaTypeLabel: "Thailand Digital Arrival Card",
  visaTypeLabelZh: "泰国电子入境卡",
  state: "approved",
  progressPercent: 100,
  applicationRecords: [
    {
      ...applicationRecord,
      id: "record-thailand",
      applicationId: "application-thailand",
      packageId: "package-thailand",
      country: "thailand",
      visaType: "tdac",
      visaTypeLabel: "Thailand Digital Arrival Card",
      visaTypeLabelZh: "泰国电子入境卡",
      state: "approved",
      progressPercent: 100,
    },
  ],
};

function makeIndexData(
  overrides: Partial<ClientStatusIndexData> = {},
): ClientStatusIndexData {
  return {
    authenticated: true,
    applications: [malaysiaApplication, thailandApplication],
    detailApplications: [
      {
        id: malaysiaApplication.id,
        packageId: malaysiaApplication.packageId,
        country: malaysiaApplication.country,
        visaType: malaysiaApplication.visaType,
      },
      {
        id: thailandApplication.id,
        packageId: thailandApplication.packageId,
        country: thailandApplication.country,
        visaType: thailandApplication.visaType,
      },
    ],
    partialData: false,
    ...overrides,
  };
}

function translationFor(locale: string) {
  const values: Record<string, string> = {
    "index.title": locale.startsWith("zh") ? "申请状态" : "Application status",
    "index.subtitle": locale.startsWith("zh") ? "查看申请进度" : "Track your applications",
    "index.yourApplications": locale.startsWith("zh")
      ? "你的申请"
      : "Your applications",
    "empty.title": locale.startsWith("zh") ? "暂无申请" : "No applications",
    "empty.description": locale.startsWith("zh")
      ? "添加一个目的地开始申请"
      : "Add a destination to get started",
    "empty.cta": locale.startsWith("zh") ? "添加目的地" : "Add destination",
    "states.in_progress": locale.startsWith("zh") ? "进行中" : "In progress",
    "states.approved": locale.startsWith("zh") ? "已批准" : "Approved",
  };
  return (key: string) => values[key] ?? key;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLocale.mockResolvedValue("en");
  mocks.getTranslations.mockResolvedValue(translationFor("en"));
  mocks.getClientStatusIndexData.mockResolvedValue(makeIndexData());
});

describe("client status index page", () => {
  it("uses only the index loader and never loads full detail history", async () => {
    const element = await ClientStatusPage({
      searchParams: Promise.resolve({}),
    });

    expect(mocks.getClientStatusIndexData).toHaveBeenCalledTimes(1);
    expect(mocks.getClientStatusData).not.toHaveBeenCalled();
    render(element);
    expect(screen.getByTestId("applications-list")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to the login page", async () => {
    mocks.getClientStatusIndexData.mockResolvedValueOnce(
      makeIndexData({
        authenticated: false,
        applications: [],
        detailApplications: [],
      }),
    );

    await expect(
      ClientStatusPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/client/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/client/login");
    expect(mocks.getClientStatusData).not.toHaveBeenCalled();
  });

  it("surfaces a status provider outage instead of redirecting it as a login", async () => {
    mocks.getClientStatusIndexData.mockResolvedValueOnce(
      makeIndexData({
        authenticated: false,
        unavailable: true,
        applications: [],
        detailApplications: [],
      }),
    );

    await expect(
      ClientStatusPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("Client status is temporarily unavailable");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects an application selector with the exact application identity and status step", async () => {
    await expect(
      ClientStatusPage({
        searchParams: Promise.resolve({ applicationId: "application-malaysia" }),
      }),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/client/application/long-form?applicationId=application-malaysia&country=malaysia&visaType=evisa_tourism&step=status",
    );

    expect(mocks.buildApplicationLongFormHref).toHaveBeenCalledWith({
      applicationId: "application-malaysia",
      country: "malaysia",
      visaType: "evisa_tourism",
      step: "status",
    });
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/client/application/long-form?applicationId=application-malaysia&country=malaysia&visaType=evisa_tourism&step=status",
    );
  });

  it("keeps packageId links compatible by resolving the package to its application", async () => {
    await expect(
      ClientStatusPage({
        searchParams: Promise.resolve({ packageId: "package-malaysia" }),
      }),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/client/application/long-form?applicationId=application-malaysia&country=malaysia&visaType=evisa_tourism&step=status",
    );

    expect(mocks.buildApplicationLongFormHref).toHaveBeenCalledWith({
      applicationId: "application-malaysia",
      country: "malaysia",
      visaType: "evisa_tourism",
      step: "status",
    });
  });

  it("renders the complete index when a selector is unknown", async () => {
    const element = await ClientStatusPage({
      searchParams: Promise.resolve({ applicationId: "unknown-application" }),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
    render(element);
    expect(screen.getByTestId("application-malaysia:evisa_tourism")).toBeInTheDocument();
    expect(screen.getByTestId("application-thailand:tdac")).toBeInTheDocument();
    expect(screen.getByTestId("applications-list")).toHaveAttribute(
      "data-expanded-country",
      "",
    );
  });

  it("normalizes a country selector and uses Chinese list fields", async () => {
    mocks.getLocale.mockResolvedValueOnce("zh-CN");
    mocks.getTranslations.mockResolvedValueOnce(translationFor("zh-CN"));

    const element = await ClientStatusPage({
      searchParams: Promise.resolve({ country: "MY" }),
    });

    render(element);
    expect(screen.getByTestId("applications-list")).toHaveAttribute(
      "data-expanded-country",
      "马来西亚",
    );
    expect(screen.getByText("马来西亚")).toBeInTheDocument();
    expect(screen.getByTestId("application-malaysia:evisa_tourism")).toHaveTextContent(
      "马来西亚电子签证",
    );
    expect(screen.getByTestId("application-malaysia:evisa_tourism")).toHaveTextContent(
      "进行中",
    );
    expect(screen.queryByText("Malaysia eVisa")).not.toBeInTheDocument();
  });

  it("uses English country and visa labels for the English locale", async () => {
    const element = await ClientStatusPage({
      searchParams: Promise.resolve({ country: "thailand" }),
    });

    render(element);
    expect(screen.getByTestId("application-thailand:tdac")).toHaveTextContent(
      "Thailand",
    );
    expect(screen.getByTestId("application-thailand:tdac")).toHaveTextContent(
      "Thailand Digital Arrival Card",
    );
    expect(screen.getByTestId("application-thailand:tdac")).toHaveTextContent(
      "Approved",
    );
  });
});
