import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  ApplicationsList,
  type ApplicationListItem,
} from "./applications-list";
import {
  AddDestinationSection,
  getGroupSortRank,
} from "./add-destination-section";
import {
  toApplicationListItem,
} from "./application-list-items";
import type {
  StatusApplication,
} from "./status-data";
import { DestinationFlag } from "@/components/client/home/DestinationFlag";
import { selectUserVisaDestination } from "@/app/actions/user-package";
import { readActiveApplicationSelection } from "@/lib/client/active-application-selection";
import {
  VISA_DESTINATION_COUNTRY_GROUPS,
  getVisaDestinationKey,
} from "@/lib/visa-destinations";

const refresh = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/app/actions/user-package", () => ({
  selectUserVisaDestination: vi.fn(async () => ({ success: true })),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, number>) => {
    const labels: Record<string, string> = {
      currentHandling: "Currently working on",
      yourApplications: "Your applications",
      destinationCount: `${values?.count ?? 0}`,
      current: "Current",
      applicationCount: `${values?.count ?? 0} application records`,
      viewAllApplications: `View all ${values?.count ?? 0}`,
      collapseApplications: "Collapse",
      statusLabel: "Status",
      completionLabel: "Completion",
      selectApplication: "Choose application",
      progressAriaLabel: "Application progress",
      switching: "Switching",
      switchError: "Could not switch",
      addDestination: "Start new application",
      addDestinationHint: "Choose a destination and product from the catalogue",
      searchLabel: "Search destinations",
      searchPlaceholder: "Search country or visa type",
      allRegions: "All regions",
      browse: "Browse",
      collapse: "Collapse",
      added: "Added",
      comingSoon: "Coming soon",
      noResultsTitle: "No destination found",
      noResultsBody: "Try another country or product.",
      starting: "Starting",
      selectError: "We could not open that destination. Please try again.",
      governmentFeeNote: "Government visa fees are paid to the authority and billed separately; amounts vary by country.",
    };
    return labels[key] ?? key;
  },
}));

const item: ApplicationListItem = {
  key: "thailand",
  countryKey: "thailand",
  flag: "🇹🇭",
  countryLabel: "Thailand",
  visaLabel: "TDAC",
  stateLabel: "In progress",
  tone: "brand",
  progressPercent: 40,
  continueHref: "/client/application/long-form?applicationId=one",
  country: "thailand",
  visaType: "tdac",
  destinationId: "thailand-tdac",
  records: [
    {
      selectionKey: "one",
      applicationId: "one",
      packageId: "package-one",
      visaLabel: "TDAC · August trip",
      stateLabel: "In progress",
      tone: "brand",
      progressPercent: 40,
      country: "thailand",
      visaType: "tdac",
      continueHref: "/client/application/long-form?applicationId=one",
      detailHref: "/client/application/long-form?applicationId=one&step=status",
      ongoing: true,
    },
    {
      selectionKey: "two",
      applicationId: "two",
      packageId: "package-one",
      visaLabel: "TDAC · September trip",
      stateLabel: "Not started",
      tone: "brand",
      progressPercent: 10,
      country: "thailand",
      visaType: "tdac",
      continueHref: "/client/application/long-form?applicationId=two",
      detailHref: "/client/application/long-form?applicationId=two&step=status",
      ongoing: true,
    },
    {
      selectionKey: "three",
      applicationId: "three",
      packageId: "package-one",
      visaLabel: "TDAC · October trip",
      stateLabel: "In progress",
      tone: "brand",
      progressPercent: 20,
      country: "thailand",
      visaType: "tdac",
      continueHref: "/client/application/long-form?applicationId=three",
      detailHref:
        "/client/application/long-form?applicationId=three&step=status",
      ongoing: true,
    },
    {
      selectionKey: "four",
      applicationId: "four",
      packageId: "package-one",
      visaLabel: "TDAC · November trip",
      stateLabel: "Not started",
      tone: "brand",
      progressPercent: 0,
      country: "thailand",
      visaType: "tdac",
      continueHref: "/client/application/long-form?applicationId=four",
      detailHref:
        "/client/application/long-form?applicationId=four&step=status",
      ongoing: true,
    },
  ],
};

const taiwanItem: ApplicationListItem = {
  key: "taiwan",
  countryKey: "taiwan",
  flag: "🇹🇼",
  countryLabel: "Taiwan",
  visaLabel: "Taiwan entry permit",
  stateLabel: "Awaiting payment",
  tone: "alert",
  progressPercent: 0,
  continueHref: "/client/checkout?applicationId=taiwan-one",
  country: "taiwan",
  visaType: "entry-permit",
  destinationId: "taiwan-entry-permit",
  records: [
    {
      selectionKey: "taiwan-one",
      applicationId: "taiwan-one",
      packageId: "package-taiwan",
      visaLabel: "Taiwan entry permit",
      stateLabel: "Awaiting payment",
      tone: "alert",
      progressPercent: 0,
      country: "taiwan",
      visaType: "entry-permit",
      continueHref: "/client/checkout?applicationId=taiwan-one",
      detailHref: "/client/checkout?applicationId=taiwan-one",
      ongoing: true,
    },
  ],
};

const startedTaiwanItem: ApplicationListItem = {
  ...taiwanItem,
  progressPercent: 25,
  records: taiwanItem.records.map((record) => ({
    ...record,
    progressPercent: 25,
  })),
};

const usInterviewItem: ApplicationListItem = {
  key: "united-states",
  countryKey: "united-states",
  flag: "🇺🇸",
  countryLabel: "United States",
  visaLabel: "DS-160 Visitor Visa",
  stateLabel: "Draft",
  tone: "brand",
  progressPercent: 0,
  continueHref: "/client/application/long-form?applicationId=us-one",
  country: "US",
  visaType: "DS160",
  destinationId: "us-ds160",
  records: [
    {
      selectionKey: "us-one",
      applicationId: "us-one",
      packageId: "package-us",
      visaLabel: "DS-160 Visitor Visa",
      stateLabel: "Draft",
      tone: "brand",
      progressPercent: 0,
      country: "US",
      visaType: "DS160",
      continueHref: "/client/application/long-form?applicationId=us-one",
      detailHref: "/client/application/long-form?applicationId=us-one&step=status",
      ongoing: true,
      secondaryAction: {
        href: "/client/interview-practice?applicationId=us-one",
        label: "Mock interview",
      },
    },
  ],
};

function statusApplication(overrides: Partial<StatusApplication> = {}): StatusApplication {
  return {
    key: "app:us-one",
    countryKey: "united-states",
    id: "us-one",
    packageId: "package-us",
    country: "US",
    visaType: "DS160",
    countryName: "United States",
    countryNameZh: "美国",
    countryFlag: "🇺🇸",
    visaTypeLabel: "DS-160 Visitor Visa",
    visaTypeLabelZh: "B1/B2 访客签证",
    packageName: "DS-160 Visitor Visa",
    state: "not_started",
    progressPercent: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    submittedAt: null,
    officialReference: null,
    officialReferenceKind: null,
    rawApplicationStatus: "draft",
    externalStatus: null,
    resultStatus: null,
    liveSubmission: null,
    officialTracking: null,
    governmentFee: { amountCents: null, currency: null, mode: null },
    officialFee: { status: null, quoteId: null, paymentIntentId: null, receiptId: null },
    payment: { status: null, amountCents: null, currency: null, updatedAt: null },
    consent: { accepted: false, signaturePresent: false, updatedAt: null },
    formAnswerCount: 0,
    documents: { total: 0, uploaded: 0, validated: 0, missing: 0, rejected: 0 },
    packet: { status: null, readyAt: null, storagePath: null },
    notifications: { total: 0, lastSentAt: null },
    steps: [],
    actions: [],
    files: [],
    events: [],
    applicationRecords: [
      {
        id: "record-us-one",
        applicationId: "us-one",
        packageId: "package-us",
        country: "US",
        visaType: "DS160",
        visaTypeLabel: "DS-160 Visitor Visa",
        visaTypeLabelZh: "B1/B2 访客签证",
        state: "not_started",
        progressPercent: 0,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-20T00:00:00.000Z",
        submittedAt: null,
        confirmationNumber: null,
        file: null,
        detailHref: "/client/application/long-form?applicationId=us-one&step=status",
        continueHref: "/client/application/long-form?applicationId=us-one",
      },
    ],
    ...overrides,
  };
}

describe("applications selector", () => {
  beforeEach(() => {
    refresh.mockReset();
    push.mockReset();
    vi.mocked(selectUserVisaDestination).mockReset();
    vi.mocked(selectUserVisaDestination).mockResolvedValue({ success: true });
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => [...values.keys()][index] ?? null,
        get length() {
          return values.size;
        },
        removeItem: (key: string) => {
          values.delete(key);
        },
        setItem: (key: string, value: string) => {
          values.set(key, value);
        },
      } satisfies Storage,
    });
  });

  it("expands a multi-application country and switches the exact application before opening Home", async () => {
    render(<ApplicationsList items={[item]} initialExpandedCountry={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose application" }));
    expect(screen.getAllByText("TDAC · August trip")).toHaveLength(1);
    expect(screen.getByText("TDAC · September trip")).toBeInTheDocument();
    expect(screen.getByText("TDAC · October trip")).toBeInTheDocument();
    expect(screen.queryByText("TDAC · November trip")).not.toBeInTheDocument();
    const septemberApplication = screen.getByRole("button", {
      name: /TDAC · September trip/,
    });
    expect(septemberApplication).toHaveClass("hover:bg-[#f7f9fc]");
    fireEvent.click(septemberApplication);
    await waitFor(() =>
      expect(readActiveApplicationSelection()?.applicationId).toBe("two")
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/client/home"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("uses a right-arrow row for a country with one selectable application", async () => {
    const { container } = render(
      <ApplicationsList
        items={[item, startedTaiwanItem]}
        initialExpandedCountry={null}
      />
    );

    const taiwanRow = screen.getByRole("button", {
      name: /Taiwan Taiwan entry permit/,
    });
    expect(
      taiwanRow.querySelector('[data-testid="single-application-arrow"]')
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-testid="multi-application-chevron"]')
    ).toHaveLength(1);

    fireEvent.click(taiwanRow);
    await waitFor(() =>
      expect(readActiveApplicationSelection()?.applicationId).toBe("taiwan-one")
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/client/home"));
  });

  it("keeps the clicked country panel mounted while the switch is pending", async () => {
    let finishSelection: ((result: { success: true }) => void) | undefined;
    vi.mocked(selectUserVisaDestination).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSelection = resolve;
        })
    );

    render(
      <ApplicationsList
        items={[item, startedTaiwanItem]}
        initialExpandedCountry={null}
      />
    );

    const taiwanRow = screen.getByRole("button", {
      name: /Taiwan Taiwan entry permit/,
    });
    fireEvent.click(taiwanRow);

    expect(taiwanRow).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Thailand/ })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    finishSelection?.({ success: true });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/client/home"));
  });

  it("does not repeat the only current application in the lower section", async () => {
    render(
      <ApplicationsList
        items={[
          {
            ...startedTaiwanItem,
            records: [startedTaiwanItem.records[0]],
          },
        ]}
        initialExpandedCountry={null}
      />
    );

    await waitFor(() => expect(screen.getByText("0")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Taiwan/ })).toHaveAttribute(
      "href",
      "/client/home"
    );
    expect(
      screen.queryByRole("button", { name: /Taiwan entry permit/ })
    ).not.toBeInTheDocument();
  });

  it("links the current application card to Home", () => {
    render(<ApplicationsList items={[item]} initialExpandedCountry={null} />);

    expect(screen.getByRole("link", { name: /Thailand/ })).toHaveAttribute(
      "href",
      "/client/home"
    );
  });

  it("hides countries and application records whose progress is zero", () => {
    render(
      <ApplicationsList
        items={[item, taiwanItem]}
        initialExpandedCountry={null}
      />
    );

    expect(screen.queryByText("Taiwan")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose application" }));
    expect(screen.queryByText("TDAC · November trip")).not.toBeInTheDocument();
  });

  it("manage mode shows separate same-country records by latest update and keeps zero-progress records", () => {
    const manageItem: ApplicationListItem = {
      ...item,
      records: [
        {
          ...item.records[0],
          selectionKey: "old-submitted",
          applicationId: "old-submitted",
          visaLabel: "TDAC · submitted",
          stateLabel: "Submitted",
          tone: "success",
          progressPercent: 100,
          updatedAt: "2026-08-01T10:00:00.000Z",
          continueHref: "/submitted",
          detailHref: "/submitted-detail",
          ongoing: false,
        },
        {
          ...item.records[1],
          selectionKey: "latest-zero-draft",
          applicationId: "latest-zero-draft",
          visaLabel: "TDAC · latest draft",
          stateLabel: "Draft",
          progressPercent: 0,
          updatedAt: "2026-08-20T10:00:00.000Z",
          continueHref: "/latest-zero-draft",
        },
        {
          ...item.records[2],
          selectionKey: "middle",
          applicationId: "middle",
          visaLabel: "TDAC · middle",
          stateLabel: "In progress",
          progressPercent: 45,
          updatedAt: "2026-08-12T10:00:00.000Z",
          continueHref: "/middle",
        },
      ],
    };

    render(<ApplicationsList items={[manageItem]} mode="manage" />);

    const buttons = screen.getAllByRole("button", { name: /TDAC ·/ });
    expect(buttons.map((button) => button.textContent)).toEqual([
      expect.stringContaining("TDAC · latest draft"),
      expect.stringContaining("TDAC · middle"),
      expect.stringContaining("TDAC · submitted"),
    ]);
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getAllByText("Status")).toHaveLength(3);
    expect(screen.getAllByText("Completion")).toHaveLength(3);

    fireEvent.click(buttons[0]);
    expect(push).toHaveBeenCalledWith("/latest-zero-draft");
  });

  it("manage mode defaults to five records and can expand or collapse the full list", () => {
    const records = Array.from({ length: 6 }, (_, index) => ({
      ...item.records[0],
      selectionKey: `record-${index + 1}`,
      applicationId: `record-${index + 1}`,
      visaLabel: `TDAC · record ${index + 1}`,
      progressPercent: index === 5 ? 0 : 20 + index,
      updatedAt: `2026-08-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
      continueHref: `/record-${index + 1}`,
      detailHref: `/record-${index + 1}-detail`,
    }));
    const manageItem: ApplicationListItem = {
      ...item,
      records,
    };

    render(<ApplicationsList items={[manageItem]} mode="manage" />);

    expect(screen.getByText("TDAC · record 6")).toBeInTheDocument();
    expect(screen.getByText("TDAC · record 2")).toBeInTheDocument();
    expect(screen.queryByText("TDAC · record 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all 6" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View all 6" }));
    expect(screen.getByText("TDAC · record 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("TDAC · record 1")).not.toBeInTheDocument();
  });

  it("manage mode exposes a mock interview action with the exact application id", () => {
    render(<ApplicationsList items={[usInterviewItem]} mode="manage" />);

    expect(screen.getByRole("link", { name: "Mock interview" })).toHaveAttribute(
      "href",
      "/client/interview-practice?applicationId=us-one"
    );
  });

  it("manage mode does not expose mock interview actions for ineligible records", () => {
    render(<ApplicationsList items={[item, startedTaiwanItem]} mode="manage" />);

    expect(screen.queryByRole("link", { name: "Mock interview" })).not.toBeInTheDocument();
  });

  it("creates mock interview actions only for eligible active US DS-160 applications", () => {
    const t = (key: string) => key;
    const eligible = toApplicationListItem(statusApplication(), "en", t);
    const ineligibleCountry = toApplicationListItem(
      statusApplication({
        country: "taiwan",
        countryName: "Taiwan",
        countryNameZh: "台湾",
        visaType: "TW_ENTRY_PERMIT",
        applicationRecords: [
          {
            ...statusApplication().applicationRecords[0],
            country: "taiwan",
            visaType: "TW_ENTRY_PERMIT",
          },
        ],
      }),
      "en",
      t
    );
    const archived = toApplicationListItem(
      statusApplication({ rawApplicationStatus: "archived" }),
      "en",
      t
    );
    const zhEligible = toApplicationListItem(statusApplication(), "zh", t);

    expect(eligible.records[0].secondaryAction).toEqual({
      href: "/client/interview-practice?applicationId=us-one",
      label: "Mock interview",
    });
    expect(zhEligible.records[0].secondaryAction?.label).toBe("模拟面试");
    expect(ineligibleCountry.records[0].secondaryAction).toBeNull();
    expect(archived.records[0].secondaryAction).toBeNull();
  });

  it("renders Taiwan with a circle flag asset instead of an emoji glyph", () => {
    render(<DestinationFlag flag="🇹🇼" size={30} />);

    expect(screen.getByTestId("circle-country-flag")).toHaveAttribute(
      "src",
      "https://react-circle-flags.pages.dev/tw.svg"
    );
  });
});

describe("add destination ordering", () => {
  beforeEach(() => {
    push.mockReset();
    vi.mocked(selectUserVisaDestination).mockReset();
    vi.mocked(selectUserVisaDestination).mockResolvedValue({ success: true });
  });

  it("places Schengen first, then available, added, and coming-soon destinations", () => {
    const schengen = VISA_DESTINATION_COUNTRY_GROUPS.find((group) =>
      group.destinations.some((destination) => destination.kind === "group")
    );
    const australia = VISA_DESTINATION_COUNTRY_GROUPS.find((group) =>
      group.destinations.some(
        (destination) => destination.country === "australia"
      )
    );
    const taiwan = VISA_DESTINATION_COUNTRY_GROUPS.find((group) =>
      group.destinations.some((destination) => destination.country === "taiwan")
    );
    const argentina = VISA_DESTINATION_COUNTRY_GROUPS.find((group) =>
      group.destinations.some(
        (destination) => destination.country === "argentina"
      )
    );
    const started = new Set([
      getVisaDestinationKey("taiwan", "TW_ENTRY_PERMIT"),
    ]);

    expect(schengen).toBeDefined();
    expect(australia).toBeDefined();
    expect(taiwan).toBeDefined();
    expect(argentina).toBeDefined();
    expect(getGroupSortRank(schengen!, started)).toBe(0);
    expect(getGroupSortRank(australia!, started)).toBe(1);
    expect(getGroupSortRank(taiwan!, started)).toBe(2);
    expect(getGroupSortRank(argentina!, started)).toBe(3);
  });

  it("makes the full surface of every destination card an interaction target", () => {
    render(<AddDestinationSection startedKeys={[]} />);

    const cardHitAreas = screen.getAllByTestId("destination-card-hit-area");
    expect(cardHitAreas).toHaveLength(VISA_DESTINATION_COUNTRY_GROUPS.length);
    expect(cardHitAreas[0]).toHaveAccessibleName(/Schengen Area/);
    expect(cardHitAreas[0]).toBeEnabled();
  });

  it("filters the same-page destination catalogue by search and region chips", () => {
    render(<AddDestinationSection startedKeys={[]} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search destinations" }), {
      target: { value: "Thailand" },
    });
    expect(screen.getByText("Thailand")).toBeInTheDocument();
    expect(screen.queryByText("Schengen Area")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search destinations" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Schengen" }));
    expect(screen.getByText("Schengen Area")).toBeInTheDocument();
    expect(screen.queryByText("Thailand")).not.toBeInTheDocument();
  });

  it("expands group destinations inline and only navigates after a concrete product is selected", async () => {
    render(<AddDestinationSection startedKeys={[]} />);

    const schengenCard = screen.getByRole("button", { name: /Schengen Area: Browse/ });
    fireEvent.click(schengenCard);

    expect(push).not.toHaveBeenCalledWith("/client/destinations/schengen");
    const franceOption = await screen.findByRole("button", { name: /France Schengen Short-Stay Visa/ });
    fireEvent.click(franceOption);

    expect(push).toHaveBeenCalledWith(
      "/client/application/long-form?country=france&visaType=EU_SCHENGEN_C_SHORT_STAY",
    );
    await waitFor(() => {
      expect(selectUserVisaDestination).toHaveBeenCalled();
    });
  });

  it("marks already-started products without blocking a second application", async () => {
    render(
      <AddDestinationSection
        startedKeys={[getVisaDestinationKey("thailand", "TH_TDAC_ARRIVAL_CARD")]}
      />,
    );

    expect(screen.getAllByText("Added").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(
      screen.getAllByRole("button", { name: /Thailand Digital Arrival Card/ })[1]
    );

    expect(push).toHaveBeenCalledWith(
      "/client/application/long-form?country=thailand&visaType=TH_TDAC_ARRIVAL_CARD",
    );
    await waitFor(() => {
      expect(selectUserVisaDestination).toHaveBeenCalled();
    });
  });
});
