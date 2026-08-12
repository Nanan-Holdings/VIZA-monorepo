import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { DocumentCenterData, DocumentRequirement } from "../actions";
import { DocumentCenterClient } from "../document-center-client";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

function requirement(
  key: string,
  labelEn: string,
  required: boolean,
  sortOrder: number
): DocumentRequirement {
  return {
    key,
    documentType: key,
    labelEn,
    labelZh: labelEn,
    description: `${labelEn} guidance.`,
    required,
    sortOrder,
    accept: [],
    source: "fallback",
  };
}

const application = {
  id: "application-japan",
  country: "japan",
  visaType: "tourist",
  countryName: "Japan",
  countryNameZh: "日本",
  countryFlag: "🇯🇵",
  visaTypeLabel: "Tourist Visa (Short-Term Stay)",
  visaTypeLabelZh: "短期旅游签证",
  status: "draft",
  packageId: null,
  packageName: null,
  updatedAt: null,
  createdAt: null,
};

const initialData: DocumentCenterData = {
  applicantId: "applicant-id",
  applications: [application],
  selectedApplication: application,
  packageSummary: {
    id: null,
    name: "Default checklist",
    description: null,
    country: "japan",
    visaType: "tourist",
    source: "fallback",
  },
  requirements: [
    requirement("passport_copy", "Passport bio page", true, 1),
    requirement("photo", "Passport-size photo", true, 2),
    requirement("travel_itinerary", "Travel itinerary", true, 3),
    requirement("bank_statement", "Proof of funds", true, 4),
    requirement("flight_booking", "Flight booking", false, 5),
    requirement("hotel_booking", "Accommodation booking", false, 6),
  ],
  documents: [],
  ocrExtractions: [],
};

const vietnamApplication = {
  ...application,
  id: "application-vietnam",
  country: "vietnam",
  visaType: "evisa_tourism",
  countryName: "Vietnam",
  countryNameZh: "越南",
};

const vietnamData: DocumentCenterData = {
  ...initialData,
  applications: [vietnamApplication],
  selectedApplication: vietnamApplication,
  requirements: [
    requirement("passport_copy", "Passport bio page", true, 1),
    requirement("photo", "Passport-size photo", true, 2),
  ],
};

describe("embedded document upload step", () => {
  test("omits the divider and continue action when the parent does not request step navigation", () => {
    const { container } = render(
      <DocumentCenterClient
        initialData={initialData}
        initialError={null}
        applicationId={application.id}
        embedded
      />
    );

    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    expect(container.querySelector(".border-t")).not.toBeInTheDocument();
  });

  test("renders direct upload fields in document grids without redundant summary panels", () => {
    const onContinue = vi.fn();
    const { container } = render(
      <DocumentCenterClient
        initialData={initialData}
        initialError={null}
        applicationId={application.id}
        embedded
        onContinue={onContinue}
      />
    );

    expect(screen.queryByText("Form documents")).not.toBeInTheDocument();
    expect(screen.queryByText("Japan Documents")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Missing or replacement documents")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Required documents are incomplete, so this visa package cannot move forward yet."
      )
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Upload this if it helps support your application.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Use saved profile file")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Or choose from Travel AI")).not.toBeInTheDocument();

    const requiredSection = screen
      .getByRole("heading", { name: "Required documents" })
      .closest("section");
    const optionalSection = screen
      .getByRole("heading", { name: "Optional supporting documents" })
      .closest("section");

    expect(requiredSection).not.toBeNull();
    expect(optionalSection).not.toBeNull();
    expect(requiredSection?.querySelector(".grid")).toHaveClass(
      "md:grid-cols-2"
    );
    expect(optionalSection?.querySelector(".grid")).toHaveClass(
      "md:grid-cols-2"
    );
    expect(container.querySelectorAll("article")).toHaveLength(6);
    expect(screen.queryByText("Required")).not.toBeInTheDocument();
    expect(screen.getAllByText("*")).toHaveLength(4);

    const aiTriggers = screen.getAllByRole("button", { name: "Ask AI" });
    expect(aiTriggers).toHaveLength(6);
    expect(aiTriggers[0]).toHaveClass(
      "opacity-0",
      "group-hover/document-card:opacity-100"
    );

    expect(
      screen.getByLabelText("Choose Passport bio page", { selector: "input" })
    ).toHaveAttribute("type", "file");
    expect(
      screen.getByLabelText("Choose Proof of funds", { selector: "input" })
    ).toHaveAttribute("type", "file");
    expect(
      within(requiredSection as HTMLElement).queryByRole("button", {
        name: "Upload",
      })
    ).not.toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeEnabled();

    fireEvent.click(continueButton);

    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Upload 4 required documents before continuing."
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Passport bio page, Passport-size photo, Travel itinerary, Proof of funds"
    );
  });

  test("renders flat document subsections and continues when required uploads are ready", () => {
    const onContinue = vi.fn();
    const readyData: DocumentCenterData = {
      ...initialData,
      documents: initialData.requirements
        .filter((item) => item.required)
        .map((item) => ({
          id: `document-${item.key}`,
          applicationId: application.id,
          documentType: item.documentType,
          requirementKey: item.key,
          filename: `${item.key}.pdf`,
          status: "uploaded",
          rejectionReason: null,
          required: true,
          reviewNotes: null,
          reviewedAt: null,
          createdAt: null,
          updatedAt: null,
          source: "application_documents" as const,
        })),
    };

    render(
      <DocumentCenterClient
        initialData={readyData}
        initialError={null}
        applicationId={application.id}
        embedded
        onContinue={onContinue}
      />
    );

    const requiredHeading = screen.getByRole("heading", {
      name: "Required documents",
      level: 3,
    });
    const optionalHeading = screen.getByRole("heading", {
      name: "Optional supporting documents",
      level: 3,
    });

    expect(requiredHeading).toHaveClass(
      "text-lg",
      "font-medium",
      "text-foreground"
    );
    expect(optionalHeading).toHaveClass(
      "text-lg",
      "font-medium",
      "text-foreground"
    );
    expect(requiredHeading.closest("section")).toHaveClass("space-y-4");
    expect(requiredHeading.closest("section")).not.toHaveClass(
      "rounded-xl",
      "border",
      "bg-white",
      "p-5"
    );
    expect(optionalHeading.closest("section")).toHaveClass("space-y-4");
    expect(optionalHeading.closest("section")).not.toHaveClass(
      "rounded-xl",
      "border",
      "bg-white",
      "p-5"
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  test("uses the standard material-card treatment for Vietnam face comparison", () => {
    render(
      <DocumentCenterClient
        initialData={vietnamData}
        initialError={null}
        applicationId={vietnamApplication.id}
        embedded
      />
    );

    const heading = screen.getByRole("heading", {
      name: "Portrait and passport face match",
      level: 3,
    });
    const comparisonCard = heading.closest("article");

    expect(comparisonCard).toHaveClass(
      "rounded-xl",
      "border-border",
      "bg-white",
      "p-5"
    );
    expect(comparisonCard).not.toHaveClass("border-cyan-200", "bg-cyan-50/50");
    expect(screen.getByText("Upload requirements")).toBeInTheDocument();
    expect(screen.getByText("Not checked")).toBeInTheDocument();
    expect(screen.getAllByText("Waiting for upload")).toHaveLength(2);

    const generateButton = screen.getByRole("button", {
      name: "Generate similarity",
    });
    expect(generateButton).toBeDisabled();
    expect(generateButton).toHaveClass("h-[38px]", "rounded-full");
  });
});
