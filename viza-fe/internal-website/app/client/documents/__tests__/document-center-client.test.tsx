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

  test("renders the embedded document overview and direct upload controls", () => {
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

    expect(screen.getByText("Form documents")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "🇯🇵 Japan Documents" })).toBeInTheDocument();
    expect(screen.getByText("Missing or replacement documents")).toBeInTheDocument();
    expect(screen.getAllByText("Use saved profile file").length).toBeGreaterThan(0);

    const requiredSection = screen
      .getByRole("heading", { name: "Required documents" })
      .closest("section");
    const optionalSection = screen
      .getByRole("heading", { name: "Optional supporting documents" })
      .closest("section");

    expect(requiredSection).not.toBeNull();
    expect(optionalSection).not.toBeNull();
    expect(requiredSection?.querySelectorAll("[data-requirement-key]")).toHaveLength(4);
    expect(optionalSection?.querySelectorAll("[data-requirement-key]")).toHaveLength(2);
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(6);
    expect(within(requiredSection as HTMLElement).getAllByRole("button", { name: "Upload" })).toHaveLength(4);
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  test("keeps missing descriptions optional without hiding requirement badges", () => {
    const signatureRequirement = requirement(
      "customs_signature_file",
      "Customs declaration e-signature",
      true,
      2
    );
    signatureRequirement.description = null;

    render(
      <DocumentCenterClient
        initialData={{
          ...initialData,
          requirements: [
            requirement("applicant_photo", "Portrait photo", true, 1),
            signatureRequirement,
          ],
        }}
        initialError={null}
        applicationId={application.id}
        embedded
      />
    );

    expect(screen.getByRole("heading", { name: "Portrait photo", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Customs declaration e-signature", level: 3 })).toBeInTheDocument();
    expect(screen.getAllByText("Required")).toHaveLength(2);
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
      level: 2,
    });
    const optionalHeading = screen.getByRole("heading", {
      name: "Optional supporting documents",
      level: 2,
    });

    expect(requiredHeading).toHaveClass(
      "text-xl",
      "font-semibold"
    );
    expect(optionalHeading).toHaveClass(
      "text-xl",
      "font-semibold"
    );
    expect(requiredHeading.closest("section")).toHaveClass("space-y-3");
    expect(requiredHeading.closest("section")).not.toHaveClass(
      "rounded-xl",
      "border",
      "bg-white",
      "p-5"
    );
    expect(optionalHeading.closest("section")).toHaveClass("space-y-3");
    expect(optionalHeading.closest("section")).not.toHaveClass(
      "rounded-xl",
      "border",
      "bg-white",
      "p-5"
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  test("uses the dedicated Vietnam face-comparison treatment", () => {
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
      level: 2,
    });
    const comparisonCard = heading.closest("section");

    expect(comparisonCard).toHaveClass(
      "rounded-lg",
      "border-cyan-200",
      "bg-cyan-50/50",
      "p-5"
    );
    expect(screen.getByText("Vietnam official photo comparison")).toBeInTheDocument();
    expect(screen.getByText("Not checked")).toBeInTheDocument();
    expect(screen.getByText("Upload the portrait photo first.")).toBeInTheDocument();
    expect(screen.getByText("Upload the passport bio page first.")).toBeInTheDocument();

    const generateButton = screen.getByRole("button", {
      name: "Generate similarity",
    });
    expect(generateButton).toBeDisabled();
    expect(generateButton).toHaveClass("w-full", "bg-white");
  });
});
