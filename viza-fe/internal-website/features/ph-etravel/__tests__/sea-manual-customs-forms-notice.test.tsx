import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import {
  PH_ETRAVEL_SEA_MANUAL_CUSTOMS_PDFS,
  SeaManualCustomsFormsNotice,
  shouldShowPhEtravelSeaManualCustomsFormsNotice,
} from "../SeaManualCustomsFormsNotice";

describe("PH eTravel SEA manual customs form notice", () => {
  test("shows the two external official PDFs only for SEA manual forms", () => {
    render(
      <SeaManualCustomsFormsNotice
        transportType="SEA"
        seaFlow="manual_forms"
      />
    );

    expect(screen.getByText("外部官方 PDF 表单")).toBeInTheDocument();
    for (const document of PH_ETRAVEL_SEA_MANUAL_CUSTOMS_PDFS) {
      const link = screen.getByText(document.label).closest("a");
      if (!link) throw new Error("Expected official PDF link");
      expect(link).toHaveAttribute("href", document.href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveTextContent("外部官方 PDF");
    }
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  test.each([
    { transportType: "AIR" as const, seaFlow: "manual_forms" as const },
    { transportType: "SEA" as const, seaFlow: "electronic_customs" as const },
    { transportType: "SEA" as const, seaFlow: null },
  ])("does not show the PDFs for non-manual paths", (props) => {
    const { container } = render(<SeaManualCustomsFormsNotice {...props} />);

    expect(container).toBeEmptyDOMElement();
    expect(shouldShowPhEtravelSeaManualCustomsFormsNotice(props)).toBe(false);
  });

  test("keeps the links outside form completeness", () => {
    expect(PH_ETRAVEL_SEA_MANUAL_CUSTOMS_PDFS).toEqual([
      expect.objectContaining({
        id: "customs_baggage_declaration",
        isApplicantAnswer: false,
        affectsCompleteness: false,
      }),
      expect.objectContaining({
        id: "bsp_currency_declaration",
        isApplicantAnswer: false,
        affectsCompleteness: false,
      }),
    ]);
    expect(
      shouldShowPhEtravelSeaManualCustomsFormsNotice({
        transportType: "SEA",
        seaFlow: "manual_forms",
      })
    ).toBe(true);
  });
});
