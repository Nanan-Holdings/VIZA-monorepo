import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { PhilippinesArrivalEligibilityPage } from "../PhilippinesArrivalEligibilityPage";

describe("PhilippinesArrivalEligibilityPage", () => {
  test("shows ordinary passenger entry with required eTravel boundary copy", () => {
    render(<PhilippinesArrivalEligibilityPage />);

    expect(screen.getByRole("heading", { name: "菲律宾 eTravel 入境申报" })).toBeInTheDocument();
    expect(screen.getByText(/Official eTravel registration is free/i)).toBeInTheDocument();
    expect(screen.getByText(/not a visa/i)).toBeInTheDocument();
    expect(screen.getByText(/does not guarantee admission/i)).toBeInTheDocument();
    expect(screen.getByText(/Each selected family member generates a separate travel declaration/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start form/i })).toHaveAttribute(
      "href",
      "/client/application/long-form?country=philippines&visaType=PH_ETRAVEL_ARRIVAL_CARD&skipFormCheck=true",
    );
  });

  test("makes ordinary sea support visibly non-cruise only", () => {
    render(<PhilippinesArrivalEligibilityPage />);

    fireEvent.click(screen.getByRole("button", { name: /普通海路旅客/i }));

    expect(screen.getByText(/verified ordinary SEA arrival passenger paths/i)).toBeInTheDocument();
    expect(screen.getByText(/separate official paths/i)).toBeInTheDocument();
    expect(screen.getByText(/非邮轮船只抵达的普通旅客/i)).toBeInTheDocument();
    expect(screen.getByText(/SEA 目的地是路径相关/i)).toBeInTheDocument();
    expect(screen.getByText(/手工 Baggage 和 Currency 表单/i)).toBeInTheDocument();
    expect(screen.getByText(/电子变体则到达签名页/i)).toBeInTheDocument();
    expect(screen.getByText(/Family Member\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/VIZA v1 会分流船员/i)).toBeInTheDocument();
  });

  test("diverts cruise travellers to the official eTravel entry instead of the ordinary form", () => {
    render(<PhilippinesArrivalEligibilityPage />);

    fireEvent.click(screen.getByRole("button", { name: /邮轮旅客/i }));

    expect(screen.getByText(/separate cruise travel declaration path/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /打开官方 eTravel/i })).toHaveAttribute(
      "href",
      "https://etravel.gov.ph",
    );
    expect(screen.queryByRole("link", { name: /Start form/i })).not.toBeInTheDocument();
  });
});
