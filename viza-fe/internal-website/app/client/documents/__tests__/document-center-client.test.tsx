import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DocumentUploadField } from "@/components/ui/document-upload-field";
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

  test("omits the optional supporting documents section when no optional items are configured", () => {
    render(
      <DocumentCenterClient
        initialData={{
          ...initialData,
          requirements: initialData.requirements.filter((item) => item.required),
        }}
        initialError={null}
        applicationId={application.id}
        embedded
      />
    );

    expect(screen.queryByRole("heading", { name: "Optional supporting documents" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("0 items")).not.toBeInTheDocument();
    expect(screen.queryByText(
      "No optional supporting documents are configured for this visa package yet."
    )).not.toBeInTheDocument();
  });

  test("omits redundant document overview UI and renders direct upload controls", () => {
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
    expect(screen.queryByRole("heading", { name: "🇯🇵 Japan Documents" })).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Complete required and optional supporting documents inside this form. Travel itinerary evidence can be uploaded manually or selected from an existing Travel AI English PDF."
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Application status: Draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Checklist source: Default checklist")).not.toBeInTheDocument();
    expect(screen.queryByText("Missing or replacement documents")).not.toBeInTheDocument();
    expect(screen.queryByText("Use saved profile file")).not.toBeInTheDocument();

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
    expect(requiredSection?.querySelectorAll("article")).toHaveLength(4);
    expect(optionalSection?.querySelectorAll("article")).toHaveLength(2);
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(6);
    expect(screen.getAllByRole("button", { name: "Ask AI" })).toHaveLength(6);
    expect(
      within(requiredSection as HTMLElement).getAllByText("Drop file or browse")
    ).toHaveLength(4);
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  test("uses the canonical card treatment when descriptions are missing", () => {
    const signatureRequirement = requirement(
      "customs_signature_file",
      "Customs declaration e-signature",
      true,
      2
    );
    signatureRequirement.description = null;

    const { container } = render(
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
    expect(screen.queryByText("Required")).not.toBeInTheDocument();
    expect(container.querySelectorAll("article.rounded-xl.border.bg-white.p-5")).toHaveLength(2);
    expect(container.querySelectorAll(".min-h-\\[40px\\]")).toHaveLength(2);
  });

  test("offers reuse only when a verified saved profile document is available", () => {
    render(
      <DocumentCenterClient
        initialData={{
          ...initialData,
          requirements: [
            requirement("applicant_photo", "Portrait photo", true, 1),
            requirement("customs_signature_file", "Declaration signature", true, 2),
          ],
          reusableProfileDocuments: [
            { documentType: "photo", filename: "portrait.jpg" },
          ],
        }}
        initialError={null}
        applicationId={application.id}
        embedded
      />
    );

    expect(screen.getByRole("button", { name: "Use saved portrait.jpg" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /saved.*signature/i })).not.toBeInTheDocument();
  });

  test("the trash control removes the attachment instead of opening the picker", () => {
    const onRemove = vi.fn();
    const onFileSelected = vi.fn();

    render(
      <DocumentUploadField
        status="in_review"
        statusLabel="Uploaded"
        file={{ name: "portrait.jpg", kind: "image" }}
        dropLabel="Drop file or browse"
        removeLabel="Remove file"
        onRemove={onRemove}
        inputAriaLabel="Replace portrait"
        onFileSelected={onFileSelected}
      />
    );

    const fileFooter = screen.getByText("portrait.jpg").parentElement;
    expect(fileFooter).toHaveClass("shrink-0");
    expect(fileFooter?.previousElementSibling).toHaveClass("min-h-0", "overflow-hidden");
    expect(fileFooter?.children).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Remove file" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onFileSelected).not.toHaveBeenCalled();
  });

  test("restores an uploaded image preview from its persisted signed URL", () => {
    const previewUrl = "https://project.supabase.co/storage/v1/object/sign/application-documents/portrait.jpg?token=signed";
    render(
      <DocumentCenterClient
        initialData={{
          ...initialData,
          requirements: [requirement("photo", "Portrait photo", true, 1)],
          documents: [{
            id: "document-photo",
            applicationId: application.id,
            documentType: "photo",
            requirementKey: "photo",
            filename: "portrait.jpg",
            status: "uploaded",
            rejectionReason: null,
            required: true,
            reviewNotes: null,
            reviewedAt: null,
            createdAt: null,
            updatedAt: null,
            source: "application_documents",
            previewUrl,
          }],
        }}
        initialError={null}
        applicationId={application.id}
        embedded
      />
    );

    expect(screen.getByRole("img", { name: "Preview of portrait.jpg" }))
      .toHaveAttribute("src", previewUrl);
  });

  test("renders the canonical two-column upload-card grids and continues when ready", () => {
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
          reviewNotes:
            item.key === "passport_copy"
              ? "Uploaded by applicant. Awaiting VIZA review."
              : null,
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
    const requiredGrid = requiredHeading.closest("section")?.querySelector(".grid");
    const optionalGrid = optionalHeading.closest("section")?.querySelector(".grid");
    expect(requiredGrid).toHaveClass("grid-cols-1", "items-start", "gap-4", "md:grid-cols-2");
    expect(optionalGrid).toHaveClass("grid-cols-1", "items-start", "gap-4", "md:grid-cols-2");
    expect(requiredGrid?.querySelectorAll("article.rounded-xl")).toHaveLength(4);
    expect(optionalGrid?.querySelectorAll("article.rounded-xl")).toHaveLength(2);
    expect(requiredGrid?.querySelectorAll(".h-\\[190px\\]")).toHaveLength(4);
    expect(
      screen.queryByText("Uploaded by applicant. Awaiting VIZA review.")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Review note:")).not.toBeInTheDocument();
    expect(screen.queryByText("Required documents complete")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Required documents are complete. VIZA can continue reviewing the application packet."
      )
    ).not.toBeInTheDocument();

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
