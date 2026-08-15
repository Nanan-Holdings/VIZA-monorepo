import { describe, expect, test } from "vitest";

import {
  createPhEtravelRegistrationAnswerProjection,
  normalizePhEtravelTravelRegistration,
  PH_ETRAVEL_PRIVACY_AFFIDAVIT_CONSENT_VERSION,
  PH_ETRAVEL_TRAVEL_REGISTRATION_PRESENTATION,
} from "../travel-registration";

const validConsent = {
  affirmed: true,
  acceptedAt: "2026-08-15T14:30:00.000Z",
  version: PH_ETRAVEL_PRIVACY_AFFIDAVIT_CONSENT_VERSION,
} as const;

describe("Philippines eTravel Travel Registration frontend contract", () => {
  test("shows and locks ARRIVAL without exposing DEPARTURE", () => {
    const flightType = PH_ETRAVEL_TRAVEL_REGISTRATION_PRESENTATION.fields[0];

    expect(flightType).toMatchObject({
      key: "flight_type",
      control: "locked_value",
      value: "ARRIVAL",
      officialLabel: "ARRIVAL — Entering the Philippines",
      exposedOptions: ["ARRIVAL"],
      hiddenUnsupportedOptions: ["DEPARTURE"],
    });
    expect(flightType.exposedOptions).not.toContain("DEPARTURE");
    expect(
      PH_ETRAVEL_TRAVEL_REGISTRATION_PRESENTATION.fields[1].officialOptions
    ).toEqual([
      {
        value: "FOR_ME",
        label: { en: "FOR ME (Current User)", zh: "本人（当前用户）" },
      },
      {
        value: "FOR_OTHER",
        label: { en: "FOR OTHER (Family Member)", zh: "他人（家人）" },
      },
    ]);
    expect(
      PH_ETRAVEL_TRAVEL_REGISTRATION_PRESENTATION.fields[2].officialOptions.map(
        (option) => option.value
      )
    ).toEqual(["AIR", "SEA"]);
  });

  test("preserves exact official registration and transport values", () => {
    const result = normalizePhEtravelTravelRegistration({
      flightType: "arrival",
      registrationFor: "for_other",
      transportType: "sea",
      consent: validConsent,
    });

    expect(result.answers).toEqual({
      flight_type: "ARRIVAL",
      registration_for: "FOR_OTHER",
      transport_type: "SEA",
    });
    expect(result.canEnqueue).toBe(true);
  });

  test("fails closed when persisted data attempts the DEPARTURE product", () => {
    const result = normalizePhEtravelTravelRegistration({
      flightType: "DEPARTURE",
      registrationFor: "FOR_ME",
      transportType: "AIR",
      consent: validConsent,
    });

    expect(result.answers.flight_type).toBe("ARRIVAL");
    expect(result.arrivalProductMismatch).toBe(true);
    expect(result.canEnqueue).toBe(false);
    expect(result.missingItems[0]).toMatchObject({
      key: "registration.flight_type",
      reason: "arrival_product_mismatch",
      focusTarget: { fieldName: "flight_type" },
    });
  });

  test("requires a versioned affirmative consent with an auditable timestamp", () => {
    const result = normalizePhEtravelTravelRegistration({
      flightType: "ARRIVAL",
      registrationFor: "FOR_ME",
      transportType: "AIR",
      consent: { affirmed: true },
    });

    expect(result.consentAudit).toBeNull();
    expect(result.canEnqueue).toBe(false);
    expect(result.missingItems).toContainEqual(
      expect.objectContaining({
        key: "product.privacy_affidavit_consent",
        fieldName: "registration_data_privacy_affidavit_consent",
        reason: "consent_not_auditable",
        focusTarget: {
          stepNumber: 1,
          section: "Travel Registration",
          fieldName: "registration_data_privacy_affidavit_consent",
          anchor: "field-registration_data_privacy_affidavit_consent",
        },
      })
    );
  });

  test("creates a separate audit record but excludes consent from answer projection", () => {
    const result = normalizePhEtravelTravelRegistration({
      flightType: "ARRIVAL",
      registrationFor: "FOR_ME",
      transportType: "AIR",
      consent: validConsent,
    });

    expect(result.consentAudit).toEqual({
      kind: "privacy_and_affidavit",
      affirmed: true,
      acceptedAt: "2026-08-15T14:30:00.000Z",
      version: PH_ETRAVEL_PRIVACY_AFFIDAVIT_CONSENT_VERSION,
      scope: "viza_enqueue_gate_only",
      officialPayloadField: false,
    });
    const projection = createPhEtravelRegistrationAnswerProjection(result);
    expect(projection).toEqual({
      flight_type: "ARRIVAL",
      registration_for: "FOR_ME",
      transport_type: "AIR",
    });
    expect(JSON.stringify(projection)).not.toMatch(
      /consent|privacy|affidavit/i
    );
  });

  test("locates all incomplete Travel Registration values and blocks enqueue", () => {
    const result = normalizePhEtravelTravelRegistration({});

    expect(result.missingItems.map((item) => item.fieldName)).toEqual([
      "registration_for",
      "transport_type",
      "registration_data_privacy_affidavit_consent",
    ]);
    expect(
      result.missingItems.every((item) => item.focusTarget.stepNumber === 1)
    ).toBe(true);
    expect(result.canEnqueue).toBe(false);
  });
});
