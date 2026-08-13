import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApplicationsList, type ApplicationListItem } from "./applications-list";
import { DestinationFlag } from "@/components/client/home/DestinationFlag";
import { readActiveApplicationSelection } from "@/lib/client/active-application-selection";

const refresh = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/app/actions/user-package", () => ({
  selectUserVisaDestination: vi.fn(async () => ({ success: true })),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) => {
    const labels: Record<string, string> = {
      currentHandling: "Currently working on",
      yourApplications: "Your applications",
      destinationCount: `${values?.count ?? 0} destinations`,
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
  ],
};

describe("applications selector", () => {
  beforeEach(() => {
    refresh.mockReset();
    push.mockReset();
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => [...values.keys()][index] ?? null,
        get length() { return values.size; },
        removeItem: (key: string) => { values.delete(key); },
        setItem: (key: string, value: string) => { values.set(key, value); },
      } satisfies Storage,
    });
  });

  it("expands a multi-application country and switches the exact application before opening Home", async () => {
    const { container } = render(<ApplicationsList items={[item]} initialExpandedCountry={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose application" }));
    expect(screen.getAllByText("TDAC · August trip")).toHaveLength(2);
    expect(screen.getByText("TDAC · September trip")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-check")).not.toBeInTheDocument();

    const septemberApplication = screen.getByRole("button", {
      name: /TDAC · September trip/,
    });
    expect(septemberApplication).toHaveClass("hover:bg-[#f7f9fc]");
    fireEvent.click(septemberApplication);
    await waitFor(() => expect(readActiveApplicationSelection()?.applicationId).toBe("two"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/client/home"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("links the current application card to Home", () => {
    render(<ApplicationsList items={[item]} initialExpandedCountry={null} />);

    expect(screen.getByRole("link", { name: /Thailand/ })).toHaveAttribute(
      "href",
      "/client/home",
    );
  });

  it("renders Taiwan with a circle flag asset instead of an emoji glyph", () => {
    render(<DestinationFlag flag="🇹🇼" size={30} />);

    expect(screen.getByTestId("circle-country-flag")).toHaveAttribute(
      "src",
      "https://react-circle-flags.pages.dev/tw.svg",
    );
  });
});
