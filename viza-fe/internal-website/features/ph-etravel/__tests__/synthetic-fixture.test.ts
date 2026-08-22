import { describe, expect, it, vi } from "vitest";
import {
  createPhEtravelSyntheticFixtureDraft,
  isPhEtravelSyntheticFixtureRequestAllowed,
  normalizePhEtravelSyntheticFixtureTransport,
  phEtravelSyntheticFixtureSeedAnswers,
  PH_ETRAVEL_SYNTHETIC_FIXTURE_MARKER_FIELD,
  PH_ETRAVEL_SYNTHETIC_FIXTURE_VERSION,
} from "../synthetic-fixture";

function query(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  return builder;
}

describe("PH eTravel synthetic fixture gate", () => {
  it("fails closed unless explicitly enabled", () => {
    expect(
      isPhEtravelSyntheticFixtureRequestAllowed({
        env: {},
        nodeEnv: "production",
      })
    ).toEqual({
      allowed: false,
      status: 404,
      code: "synthetic_fixtures_disabled",
    });
  });

  it("requires a configured production gate", () => {
    expect(
      isPhEtravelSyntheticFixtureRequestAllowed({
        env: { PH_ETRAVEL_SYNTHETIC_FIXTURES_ENABLED: "true" },
        nodeEnv: "production",
      })
    ).toEqual({
      allowed: false,
      status: 404,
      code: "synthetic_fixture_gate_unconfigured",
    });
  });

  it("allows only explicitly listed test account emails", () => {
    const env = {
      PH_ETRAVEL_SYNTHETIC_FIXTURES_ENABLED: "true",
      PH_ETRAVEL_SYNTHETIC_FIXTURE_EMAILS:
        "ph-air-fixture@example.test, ph-sea-fixture@example.test",
    };
    expect(
      isPhEtravelSyntheticFixtureRequestAllowed({
        env,
        userEmail: "outside@example.test",
        nodeEnv: "production",
      })
    ).toMatchObject({ allowed: false, status: 403 });
    expect(
      isPhEtravelSyntheticFixtureRequestAllowed({
        env,
        userEmail: "PH-AIR-FIXTURE@example.test",
        nodeEnv: "production",
      })
    ).toEqual({ allowed: true });
  });

  it("requires the bearer token when one is configured", () => {
    const env = {
      PH_ETRAVEL_SYNTHETIC_FIXTURES_ENABLED: "true",
      PH_ETRAVEL_SYNTHETIC_FIXTURE_TOKEN: "token-123",
    };
    expect(
      isPhEtravelSyntheticFixtureRequestAllowed({
        env,
        authorizationHeader: "Bearer wrong",
        nodeEnv: "production",
      })
    ).toMatchObject({
      allowed: false,
      code: "synthetic_fixture_token_required",
    });
    expect(
      isPhEtravelSyntheticFixtureRequestAllowed({
        env,
        authorizationHeader: "Bearer token-123",
        nodeEnv: "production",
      })
    ).toEqual({ allowed: true });
  });
});

describe("PH eTravel synthetic fixture draft creation", () => {
  it("normalizes only AIR and SEA transport types", () => {
    expect(normalizePhEtravelSyntheticFixtureTransport("air")).toBe("AIR");
    expect(normalizePhEtravelSyntheticFixtureTransport("SEA")).toBe("SEA");
    expect(normalizePhEtravelSyntheticFixtureTransport("TW_ENTRY_PERMIT")).toBe(
      null
    );
    expect(normalizePhEtravelSyntheticFixtureTransport("CRUISE")).toBe(null);
  });

  it("seeds only PH arrival fixture marker and registration answers", () => {
    const rows = phEtravelSyntheticFixtureSeedAnswers({
      applicationId: "app-ph-air",
      transportType: "AIR",
      now: "2026-08-22T00:00:00.000Z",
    });
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.field_name)).toEqual([
      PH_ETRAVEL_SYNTHETIC_FIXTURE_MARKER_FIELD,
      "flight_type",
      "registration_for",
      "transport_type",
    ]);
    expect(
      rows.find((row) => row.field_name === "transport_type")
    ).toMatchObject({
      value_text: "AIR",
    });
    const marker = JSON.parse(rows[0].value_text);
    expect(marker).toMatchObject({
      version: PH_ETRAVEL_SYNTHETIC_FIXTURE_VERSION,
      product: "PH_ETRAVEL_ARRIVAL_CARD",
      transportType: "AIR",
      pii: false,
      officialPortal: false,
    });
  });

  it("always creates an isolated Philippines arrival draft and never reuses Taiwan applications", async () => {
    const profileQuery = query({ data: { id: "profile-id" }, error: null });
    const createQuery = query({ data: { id: "new-ph-sea" }, error: null });
    const seedQuery = query({ data: null, error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(createQuery)
      .mockReturnValueOnce(seedQuery);
    const admin = { from };

    const result = await createPhEtravelSyntheticFixtureDraft({
      authUserId: "auth-user",
      transportType: "SEA",
      now: "2026-08-22T00:00:00.000Z",
      admin: admin as never,
    });

    expect(result).toEqual({
      ok: true,
      applicationId: "new-ph-sea",
      transportType: "SEA",
    });
    expect(createQuery.insert).toHaveBeenCalledWith({
      applicant_id: "profile-id",
      country: "philippines",
      visa_type: "PH_ETRAVEL_ARRIVAL_CARD",
      visa_package_id: null,
      status: "draft",
    });
    expect(seedQuery.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          application_id: "new-ph-sea",
          field_name: "transport_type",
          value_text: "SEA",
        }),
      ])
    );
    expect(from).not.toHaveBeenCalledWith("runner_job");
  });
});
