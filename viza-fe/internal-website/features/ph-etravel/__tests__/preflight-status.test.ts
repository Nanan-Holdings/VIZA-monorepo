import { describe, expect, test } from "vitest";

import {
  auditPhEtravelSafePreflightOutcome,
  createPhEtravelPreflightUserPresentation,
  getPhEtravelPreflightReadiness,
  PH_ETRAVEL_PREFLIGHT_CONTRACT_VERSION,
} from "../preflight-status";

function outcome(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: PH_ETRAVEL_PREFLIGHT_CONTRACT_VERSION,
    status: "action_required",
    code: "ph_etravel_launch_profile_persona_review_required",
    blockingCodes: ["ph_etravel_launch_profile_persona_review_required"],
    canonicalKeys: ["traveller.first_name"],
    officialResubmitAllowed: false,
    ...overrides,
  };
}

const PH_C_V1_CODE_KEY_FIXTURES = [
  ["ph_etravel_arrival_diverted_unsupported", ["eligibility.ordinary_arrival"]],
  [
    "ph_etravel_arrival_for_other_action_required",
    ["registration.application_for"],
  ],
  [
    "ph_etravel_launch_profile_persona_review_required",
    [
      "profile.photo_url",
      "traveller.first_name",
      "traveller.last_name",
      "traveller.middle_name",
      "traveller.mobile_number",
      "traveller.passenger_type",
      "traveller.sex",
      "traveller.suffix",
    ],
  ],
  [
    "ph_etravel_launch_residence_review_required",
    [
      "residence.address_line1",
      "residence.address_line2",
      "residence.barangay_code",
      "residence.country_code",
      "residence.municipality_code",
      "residence.province_code",
      "residence.region_code",
    ],
  ],
  [
    "ph_etravel_launch_air_travel_review_required",
    ["air.airline_code", "air.flight_number"],
  ],
  [
    "ph_etravel_launch_air_special_flight_review_required",
    ["air.is_special_flight", "air.special_flight_number"],
  ],
  [
    "ph_etravel_launch_health_positive_review_required",
    [
      "health.exposed_to_bats_or_sick_animals",
      "health.has_recent_travel_history_30d",
      "health.sickness_symptoms",
      "health.visited_countries_30d",
      "health.with_negative_antigen",
    ],
  ],
  [
    "ph_etravel_launch_sea_disembarking_review_required",
    ["sea.is_disembarking"],
  ],
  [
    "ph_etravel_launch_sea_customs_flow_review_required",
    ["destination.destination_port_code"],
  ],
  [
    "ph_etravel_launch_sea_electronic_positive_review_required",
    ["attachments.travel_document", "currency.needs_currency_declaration"],
  ],
  [
    "ph_etravel_launch_currency_positive_review_required",
    [
      "currency.bsp_authorization_date",
      "currency.needs_currency_declaration",
      "currency.owner_not_applicable",
    ],
  ],
  [
    "ph_etravel_launch_attachment_review_required",
    ["attachments.travel_document"],
  ],
  [
    "ph_etravel_launch_final_result_recovery_required",
    ["result.official_reference", "result.reference_qr_render"],
  ],
] as const;

describe("Philippines eTravel launch-preflight presentation", () => {
  test("maps P0 safe preflight codes to their E18 scenario without exposing code or key", () => {
    const input = outcome({
      blockingCodes: [
        "ph_etravel_launch_air_travel_review_required",
        "ph_etravel_launch_currency_positive_review_required",
        "ph_etravel_launch_health_positive_review_required",
      ],
      code: "ph_etravel_launch_air_travel_review_required",
      canonicalKeys: [
        "air.airline_code",
        "currency.needs_currency_declaration",
        "health.with_negative_antigen",
      ],
    });
    const audit = auditPhEtravelSafePreflightOutcome(input);
    const presentation = createPhEtravelPreflightUserPresentation(input);

    expect(audit).toMatchObject({
      accepted: true,
      scenarioIds: ["S2", "S3", "S6"],
    });
    expect(
      getPhEtravelPreflightReadiness(input).map((item) => item.id)
    ).toEqual(["S2", "S3", "S6"]);
    expect(presentation).toMatchObject({
      state: "action_required",
      authorization: "stop_before_submit",
      submitted: false,
      noQueue: true,
      noBrowser: true,
      noResubmit: true,
    });
    expect(JSON.stringify(presentation)).not.toMatch(
      /ph_etravel_launch|traveller\.first_name|air\.airline_code/i
    );
  });

  test("diverts unsupported travellers without queue, browser, or resubmit capability", () => {
    const input = outcome({
      status: "diverted",
      code: "ph_etravel_arrival_diverted_unsupported",
      blockingCodes: ["ph_etravel_arrival_diverted_unsupported"],
      canonicalKeys: ["eligibility.ordinary_arrival"],
    });

    expect(auditPhEtravelSafePreflightOutcome(input)).toMatchObject({
      accepted: true,
      scenarioIds: ["S1"],
      status: "diverted",
    });
    expect(createPhEtravelPreflightUserPresentation(input)).toMatchObject({
      state: "diverted",
      noQueue: true,
      noBrowser: true,
      noResubmit: true,
      submitted: false,
    });
    expect(getPhEtravelPreflightReadiness(input)[0].state).toBe("diverted");
  });

  test("treats an allowed preflight as non-submitted and still stop-before-submit", () => {
    const input = outcome({
      status: "allowed",
      code: undefined,
      blockingCodes: [],
      canonicalKeys: [],
    });

    expect(auditPhEtravelSafePreflightOutcome(input)).toMatchObject({
      accepted: true,
      scenarioIds: [],
      status: "allowed",
    });
    expect(createPhEtravelPreflightUserPresentation(input)).toMatchObject({
      state: "action_required",
      authorization: "stop_before_submit",
      submitted: false,
      noQueue: true,
      noBrowser: true,
      noResubmit: true,
    });
  });

  test("fails closed for unsafe version, codes, keys, duplicates, and resubmit permission", () => {
    const invalidInputs = [
      outcome({ contractVersion: "ph_etravel_launch_preflight_v0" }),
      outcome({ code: "unrecognized" }),
      outcome({ canonicalKeys: [] }),
      outcome({
        canonicalKeys: ["traveller.first_name", "traveller.first_name"],
      }),
      outcome({ canonicalKeys: ["air.airline_code"] }),
      outcome({
        canonicalKeys: ["traveller.last_name", "traveller.first_name"],
      }),
      outcome({
        blockingCodes: [
          "ph_etravel_launch_profile_persona_review_required",
          "ph_etravel_launch_profile_persona_review_required",
        ],
      }),
      outcome({ officialResubmitAllowed: true }),
    ];

    for (const input of invalidInputs) {
      expect(auditPhEtravelSafePreflightOutcome(input).accepted).toBe(false);
      expect(createPhEtravelPreflightUserPresentation(input)).toMatchObject({
        state: "action_required",
        noQueue: true,
        noBrowser: true,
        noResubmit: true,
        submitted: false,
      });
    }
  });

  test("matches PH-C v1's complete safe code/key vocabulary and deterministic order", () => {
    for (const [code, canonicalKeys] of PH_C_V1_CODE_KEY_FIXTURES) {
      const input = outcome({
        status:
          code === "ph_etravel_arrival_diverted_unsupported"
            ? "diverted"
            : "action_required",
        code,
        blockingCodes: [code],
        canonicalKeys,
      });

      expect(auditPhEtravelSafePreflightOutcome(input)).toMatchObject({
        accepted: true,
      });
      expect(getPhEtravelPreflightReadiness(input)).toHaveLength(1);
    }
  });

  test("preserves all v1 status fixtures as non-submitted, non-launching UI", () => {
    const fixtures = [
      outcome({
        status: "allowed",
        code: undefined,
        blockingCodes: [],
        canonicalKeys: [],
      }),
      outcome(),
      outcome({
        status: "diverted",
        code: "ph_etravel_arrival_diverted_unsupported",
        blockingCodes: ["ph_etravel_arrival_diverted_unsupported"],
        canonicalKeys: ["eligibility.ordinary_arrival"],
      }),
    ];

    for (const fixture of fixtures) {
      expect(createPhEtravelPreflightUserPresentation(fixture)).toMatchObject({
        authorization: "stop_before_submit",
        submitted: false,
        noQueue: true,
        noBrowser: true,
        noResubmit: true,
      });
    }
  });

  test("rejects PII-like or raw payload values without returning them to the user", () => {
    const input = outcome({
      canonicalKeys: ["traveller.first_name", "applicant@example.test"],
      rawOfficialMessage: "Maria Santos passport P1234567",
    });
    const audit = auditPhEtravelSafePreflightOutcome(input);
    const presentation = createPhEtravelPreflightUserPresentation(input);

    expect(audit).toMatchObject({
      accepted: false,
      issues: ["payload_pii_rejected"],
    });
    expect(JSON.stringify({ audit, presentation })).not.toMatch(
      /Maria|Santos|P1234567|applicant@example\.test|rawOfficialMessage/i
    );
    expect(presentation.userCopy.en).not.toMatch(
      /passport|code|selector|submit/i
    );
  });

  test("retains all 36 remaining gaps as single-owner scenario readiness", () => {
    const input = outcome({
      blockingCodes: [
        "ph_etravel_launch_air_travel_review_required",
        "ph_etravel_launch_currency_positive_review_required",
        "ph_etravel_launch_final_result_recovery_required",
        "ph_etravel_launch_health_positive_review_required",
        "ph_etravel_launch_profile_persona_review_required",
        "ph_etravel_launch_residence_review_required",
        "ph_etravel_launch_sea_disembarking_review_required",
        "ph_etravel_launch_sea_electronic_positive_review_required",
      ],
      canonicalKeys: [
        "air.airline_code",
        "currency.needs_currency_declaration",
        "health.with_negative_antigen",
        "residence.country_code",
        "result.official_reference",
        "sea.is_disembarking",
        "traveller.first_name",
      ],
    });

    expect(auditPhEtravelSafePreflightOutcome(input)).toMatchObject({
      accepted: true,
      scenarioIds: ["S1", "S2", "S3", "S4", "S5", "S6", "S8"],
    });
    expect(
      new Set(getPhEtravelPreflightReadiness(input).map((item) => item.id)).size
    ).toBe(7);
  });
});
