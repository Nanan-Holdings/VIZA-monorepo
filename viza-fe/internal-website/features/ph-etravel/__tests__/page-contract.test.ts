import { describe, expect, test } from "vitest";

import {
  createPhEtravelOrderedPageContract,
  getPhEtravelOrderedPage,
} from "../page-contract";

const pageIds = (
  path: Parameters<typeof createPhEtravelOrderedPageContract>[0]
) => createPhEtravelOrderedPageContract(path).pages.map((page) => page.id);

const fieldKeys = (
  path: Parameters<typeof createPhEtravelOrderedPageContract>[0],
  pageId: string
) => getPhEtravelOrderedPage(path, pageId).fields.map((field) => field.key);

describe("Philippines eTravel ordered page contract", () => {
  test("keeps AIR Customs No continuation explicitly unobserved", () => {
    const contract = createPhEtravelOrderedPageContract("air_no_declaration");

    expect(pageIds("air_no_declaration")).toEqual([
      "travel_details",
      "health_declaration",
      "customs_confirmation",
      "air_no_declaration_continuation_unobserved",
    ]);
    expect(fieldKeys("air_no_declaration", "customs_confirmation")).toEqual([
      "customs.has_baggage_or_currency_to_declare",
    ]);
    expect(contract.pages.at(-1)?.actionOnlyGates[0]).toMatchObject({
      key: "air.no_declaration_continuation",
      evidence: "official_evidence_required",
    });
    expect(contract.submitted).toBe(false);
  });

  test("orders AIR positive electronic pages through Summary without treating action gates as answers", () => {
    const contract = createPhEtravelOrderedPageContract("air_positive");

    expect(pageIds("air_positive")).toEqual([
      "travel_details",
      "health_declaration",
      "customs_confirmation",
      "other_travel_details",
      "customs_general_declaration",
      "currency_declaration",
      "attachments_and_signature",
      "family_members",
      "companion_confirmation",
      "summary",
    ]);
    expect(fieldKeys("air_positive", "customs_general_declaration")).toEqual([
      "baggage.goods_amount_currency",
      "baggage.goods_amount",
      "customs.checklist",
      "baggage.items",
    ]);
    expect(
      getPhEtravelOrderedPage("air_positive", "attachments_and_signature")
        .actionOnlyGates[0].key
    ).toBe("signature.applicant_signature");
    expect(
      getPhEtravelOrderedPage("air_positive", "family_members")
        .actionOnlyGates[0].key
    ).toBe("family.independent_declarations");
    expect(
      getPhEtravelOrderedPage("air_positive", "summary").fields
    ).toHaveLength(0);
  });

  test("isolates SEA manual from electronic customs and signature pages", () => {
    const contract = createPhEtravelOrderedPageContract("sea_manual");

    expect(pageIds("sea_manual")).toEqual([
      "travel_details",
      "health_declaration",
      "manual_baggage_currency_forms",
      "family_members",
      "companion_confirmation",
      "summary",
    ]);
    expect(fieldKeys("sea_manual", "travel_details")).toContain(
      "sea.voyage_number"
    );
    expect(fieldKeys("sea_manual", "travel_details")).not.toContain(
      "air.flight_number"
    );
    expect(
      contract.pages.some((page) => page.id === "attachments_and_signature")
    ).toBe(false);
    expect(
      contract.pages.find((page) => page.id === "manual_baggage_currency_forms")
        ?.actionOnlyGates[0].key
    ).toBe("customs.manual_forms");
  });

  test("keeps SEA electronic No in its observed signature-family-summary order", () => {
    const contract = createPhEtravelOrderedPageContract("sea_electronic_no");

    expect(pageIds("sea_electronic_no")).toEqual([
      "travel_details",
      "health_declaration",
      "customs_confirmation",
      "other_travel_details",
      "attachments_and_signature",
      "family_members",
      "companion_confirmation",
      "summary",
    ]);
    expect(fieldKeys("sea_electronic_no", "other_travel_details")).toEqual([
      "family.accompanied_under_18_count",
      "family.accompanied_18_plus_count",
      "baggage.checked_count",
      "baggage.hand_carried_count",
      "baggage.first_time_visit",
    ]);
    expect(pageIds("sea_electronic_no")).not.toContain(
      "customs_general_declaration"
    );
    expect(pageIds("sea_electronic_no")).not.toContain("currency_declaration");
  });

  test("stops SEA electronic Yes at the verified signature boundary", () => {
    const contract = createPhEtravelOrderedPageContract(
      "sea_electronic_yes_through_signature"
    );

    expect(pageIds("sea_electronic_yes_through_signature")).toEqual([
      "travel_details",
      "health_declaration",
      "customs_confirmation",
      "other_travel_details",
      "customs_general_declaration",
      "currency_declaration",
      "attachments_and_signature",
      "post_signature_positive_unobserved",
    ]);
    expect(
      fieldKeys("sea_electronic_yes_through_signature", "currency_declaration")
    ).toContain("currency.days_in_philippines");
    expect(
      fieldKeys("sea_electronic_yes_through_signature", "currency_declaration")
    ).not.toContain("currency.courier_name");
    expect(contract.pages.at(-1)?.actionOnlyGates[0]).toMatchObject({
      key: "sea.positive_post_signature_continuation",
      evidence: "official_evidence_required",
    });
  });

  test("keeps signature, family, companion, Summary, reference, and QR out of applicant success", () => {
    for (const path of [
      "air_positive",
      "sea_manual",
      "sea_electronic_no",
      "sea_electronic_yes_through_signature",
    ] as const) {
      const contract = createPhEtravelOrderedPageContract(path);

      expect(contract.submitted).toBe(false);
      expect(
        contract.pages.every(
          (page) => page.wizardIndexMeaning === "dynamic_path_result"
        )
      ).toBe(true);
      expect(contract.resultFields.map((field) => field.key)).toEqual([
        "result.official_reference",
        "result.reference_qr_render",
      ]);
      expect(
        contract.resultFields.every((field) => field.mode === "result_only")
      ).toBe(true);
    }
  });
});
