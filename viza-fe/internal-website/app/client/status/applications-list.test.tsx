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
      selectApplication: "Choose application",
      progressAriaLabel: "Application progress",
      switching: "Switching",
      switchError: "Could not switch",
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

  it("renders Taiwan with a circle flag asset instead of an emoji glyph", () => {
    render(<DestinationFlag flag="🇹🇼" size={30} />);

    expect(screen.getByTestId("circle-country-flag")).toHaveAttribute(
      "src",
      "https://react-circle-flags.pages.dev/tw.svg"
    );
  });
});

describe("add destination ordering", () => {
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
});
