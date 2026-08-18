import { describe, expect, test } from "vitest";

import {
  getPhEtravelArrivalPurposeCode,
  getPhEtravelOfficialOptionSource,
  hasUniqueOfficialOptionValues,
  PH_ETRAVEL_ARRIVAL_PURPOSE_OPTIONS,
  PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS,
  PH_ETRAVEL_OCCUPATION_OPTIONS,
} from "../official-options";

describe("Philippines eTravel official option-source contract", () => {
  test("keeps E49 complete small option values and submits purpose code not label", () => {
    expect(PH_ETRAVEL_ARRIVAL_PURPOSE_OPTIONS).toHaveLength(16);
    expect(PH_ETRAVEL_OCCUPATION_OPTIONS).toHaveLength(15);
    expect(PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS).toHaveLength(16);
    expect(
      hasUniqueOfficialOptionValues(PH_ETRAVEL_ARRIVAL_PURPOSE_OPTIONS)
    ).toBe(true);
    expect(hasUniqueOfficialOptionValues(PH_ETRAVEL_OCCUPATION_OPTIONS)).toBe(
      true
    );
    expect(
      hasUniqueOfficialOptionValues(PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS)
    ).toBe(true);
    expect(
      PH_ETRAVEL_ARRIVAL_PURPOSE_OPTIONS.find(
        (option) => option.value === "POV999"
      )
    ).toMatchObject({
      label: "Others",
    });
    expect(getPhEtravelArrivalPurposeCode("POV999")).toBe("POV999");
    expect(getPhEtravelArrivalPurposeCode("Others")).toBeNull();
    expect(
      PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS.find(
        (option) => option.value === 16
      )
    ).toMatchObject({
      label: "TRUST CERTIFICATES",
    });
    expect(
      PH_ETRAVEL_OCCUPATION_OPTIONS.find((option) => option.value === "OCC013")
    ).toMatchObject({
      forArrival: false,
      forDeparture: true,
    });
  });

  test("keeps countries and currencies as reproducible dynamic sources", () => {
    const country = getPhEtravelOfficialOptionSource("country");
    const currency = getPhEtravelOfficialOptionSource("currency");

    expect(country).toMatchObject({
      kind: "dynamic_query",
      endpoint: "/api/v1/common/countries",
      valueField: "code",
      query: { paginate: "0", q: "" },
    });
    expect(currency).toMatchObject({
      kind: "dynamic_query",
      endpoint: "/api/v1/common/currencies",
      valueField: "id",
      query: { paginate: "0", q: "" },
    });
  });

  test("keeps SEA destination ports as a dynamic metadata source", () => {
    expect(
      getPhEtravelOfficialOptionSource("sea_destination_port")
    ).toMatchObject({
      kind: "dynamic_query",
      endpoint: "/api/v1/common/travel_ports",
      query: expect.objectContaining({
        transportation_type: "SEA",
        paginate: "0",
        q: "",
      }),
      valueField: "code",
    });
  });

  test("uses the current UI-shaped arrival-purpose source", () => {
    expect(getPhEtravelOfficialOptionSource("arrival_purpose")).toMatchObject({
      kind: "complete_small_list",
      endpoint: "/api/v1/common/purpose_of_visits",
      query: {
        paginate: "0",
        q: "",
        for_arrival: "1",
        order_by: "name",
        status_by: "asc",
      },
      valueField: "code",
      retrievedAt: "2026-08-18",
    });
  });
});
