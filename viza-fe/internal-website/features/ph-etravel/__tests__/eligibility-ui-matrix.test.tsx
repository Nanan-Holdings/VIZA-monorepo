import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { PhilippinesArrivalEligibilityPage } from "../PhilippinesArrivalEligibilityPage";
import {
  createPhEtravelScheduledPortalSummary,
  createPhEtravelUserStatusMessage,
  phEtravelUserFacingError,
} from "../status";

const FORM_URL =
  "/client/application/long-form?country=philippines&visaType=PH_ETRAVEL_ARRIVAL_CARD&skipFormCheck=true";

function choose(label: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label, "i") }));
}

describe("Philippines eTravel eligibility UI matrix", () => {
  test.each([
    ["普通航空旅客", "Ordinary air passenger"],
    ["普通海路旅客", "Ordinary sea passenger"],
  ])(
    "allows %s to continue to the ordinary arrival form",
    (labelZh, titleEn) => {
      render(<PhilippinesArrivalEligibilityPage />);

      choose(labelZh);

      expect(screen.getAllByText(titleEn).length).toBeGreaterThan(0);
      expect(screen.getByRole("link", { name: /Start form/i })).toHaveAttribute(
        "href",
        FORM_URL
      );
    }
  );

  test.each([
    ["机组或船员", "Crew member path required"],
    ["邮轮旅客", "Cruise path required"],
    ["特殊登记", "Special registration not supported here"],
    ["外国外交官或政要", "Official exception"],
    ["9\\(e\\) 签证持有人", "9(e) visa holder exception"],
    [
      "外交、公务或因公护照",
      "Diplomatic, official, or service passport exception",
    ],
  ])("diverts %s away from the ordinary arrival form", (labelZh, titleEn) => {
    render(<PhilippinesArrivalEligibilityPage />);

    choose(labelZh);

    expect(screen.getByText(titleEn)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Start form/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /打开官方 eTravel/i })
    ).toHaveAttribute("href", "https://etravel.gov.ph");
  });

  test("keeps boundary copy short, explicit, and present for responsive layouts", () => {
    render(<PhilippinesArrivalEligibilityPage />);

    const boundaryLines = [
      "Official eTravel registration is free. VIZA does not collect an official eTravel fee.",
      "eTravel is not a visa and does not replace visa eligibility.",
      "A submitted eTravel QR does not guarantee admission at Philippine border control.",
    ];

    for (const line of boundaryLines) {
      expect(screen.getByText(line)).toBeInTheDocument();
      expect(line.length).toBeLessThanOrEqual(92);
      expect(line.split(/\s+/u).every((word) => word.length <= 16)).toBe(true);
    }
  });

  test("shows safe PH copy for live disabled, SEA scheduled, SEA past-date, unknown errors, and refresh", () => {
    const scheduled = createPhEtravelScheduledPortalSummary({
      travelDateLabel: "arrival",
      earliestSubmissionDate: "2026-07-02",
      daysUntilOpen: 2,
    });

    expect(phEtravelUserFacingError({ code: "live_disabled" })).toBe(
      "Philippines eTravel live submission is currently disabled. You can still prepare and save the form."
    );
    expect(scheduled).toContain("Philippines eTravel");
    expect(scheduled).toContain("72 hours");
    expect(scheduled).toContain("free");
    expect(
      phEtravelUserFacingError({ code: "phetravel_arrival_date_past" })
    ).toContain("arrival date is already in the past");

    const unknown = phEtravelUserFacingError({
      code: "official_raw_response",
      message: "Official response includes Maria Santos passport P1234567",
    });
    expect(unknown).toBe(
      "The Philippines eTravel submission was not completed. Your answers are saved; retry later or contact support."
    );
    expect(unknown).not.toContain("Maria Santos");
    expect(unknown).not.toContain("P1234567");

    expect(createPhEtravelUserStatusMessage("queued")).toContain(
      "Refreshing this page checks status only"
    );
    expect(createPhEtravelUserStatusMessage("queued")).toContain(
      "does not create another official submission job"
    );
    expect(createPhEtravelUserStatusMessage("queued")).not.toContain(
      "may create"
    );
  });

  test("shows SEA Review facts without promising AIR customs or universal signature", () => {
    render(<PhilippinesArrivalEligibilityPage />);

    choose("普通海路旅客");

    expect(
      screen.getByText(/已验证的 SEA 路径适用于非邮轮船只抵达的普通旅客/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/SEA 目的地是路径相关/i)).toBeInTheDocument();
    expect(screen.getByText(/SEA 海关是路径相关/i)).toBeInTheDocument();
    expect(screen.getByText(/SEA 签名是路径相关/i)).toBeInTheDocument();
    expect(screen.getByText(/VIZA v1 会分流船员/i)).toBeInTheDocument();
    expect(
      createPhEtravelUserStatusMessage("sea_manual_customs_forms")
    ).toContain("action-required");
    expect(
      createPhEtravelUserStatusMessage("sea_electronic_signature_required")
    ).toContain("Family Member(s)");
  });
});
