import { describe, expect, test } from "vitest";

import {
  applyPhEtravelOwnerNaNormalization,
  createPhEtravelOwnerNaPresentation,
  PH_ETRAVEL_OWNER_NA_CLEARED_FIELD_KEYS,
} from "../owner-na";

const electronicCurrencyContext = {
  transportType: "SEA" as const,
  seaFlow: "electronic_customs" as const,
  customsDeclaration: "yes" as const,
  currencyDeclaration: "yes" as const,
};

describe("Philippines eTravel Owner N/A presentation contract", () => {
  test("clears and disables the E14 owner/recipient field set only when true", () => {
    const result = applyPhEtravelOwnerNaNormalization({
      context: electronicCurrencyContext,
      ownerNotApplicable: true,
      values: {
        owner_first_name: "Should clear",
        recipient_last_name: "Should clear",
        currency_id: 1,
      },
    });

    expect(result.presentation).toMatchObject({
      visible: true,
      officialStateKey: "owner_details_not_applicable",
      controlsDisabled: true,
      requiredness: "unknown",
    });
    expect(result.presentation.clearedFieldKeys).toHaveLength(26);
    expect(result.presentation.clearedFieldKeys).toEqual(
      PH_ETRAVEL_OWNER_NA_CLEARED_FIELD_KEYS
    );
    expect(result.values).toEqual({ currency_id: 1 });
  });

  test("does not infer requiredness or clear values when false", () => {
    const result = applyPhEtravelOwnerNaNormalization({
      context: electronicCurrencyContext,
      ownerNotApplicable: false,
      values: { owner_first_name: "Retained", recipient_last_name: "Retained" },
    });

    expect(result.presentation).toMatchObject({
      visible: true,
      controlsDisabled: false,
      requiredness: "unknown",
      clearedFieldKeys: [],
    });
    expect(result.values).toEqual({
      owner_first_name: "Retained",
      recipient_last_name: "Retained",
    });
  });

  test("keeps Owner N/A out of manual, Customs No, and non-currency contexts", () => {
    for (const context of [
      { ...electronicCurrencyContext, seaFlow: "manual_forms" as const },
      { ...electronicCurrencyContext, customsDeclaration: "no" as const },
      { ...electronicCurrencyContext, currencyDeclaration: "no" as const },
    ]) {
      expect(createPhEtravelOwnerNaPresentation(context, true)).toMatchObject({
        visible: false,
        controlsDisabled: false,
        clearedFieldKeys: [],
      });
    }
  });

  test("does not couple Owner N/A to physical or courier child branches", () => {
    const physical = createPhEtravelOwnerNaPresentation(
      { ...electronicCurrencyContext, currencyTransportMethod: "physical" },
      true
    );
    const courier = createPhEtravelOwnerNaPresentation(
      { ...electronicCurrencyContext, currencyTransportMethod: "courier" },
      true
    );

    expect(physical.clearedFieldKeys).toEqual(courier.clearedFieldKeys);
    expect(physical.requiredness).toBe("unknown");
    expect(courier.requiredness).toBe("unknown");
  });
});
