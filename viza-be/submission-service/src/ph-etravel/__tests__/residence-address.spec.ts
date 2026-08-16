import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhEtravelResidenceActionPlan,
  normalizePhEtravelResidenceAddress,
  PhEtravelResidenceValidationError,
  resolvePhEtravelOfficialResidenceHierarchy,
} from "../residence-address";

test("normalizes the official PH residence hierarchy without deriving codes from labels", () => {
  const residence = normalizePhEtravelResidenceAddress({
    country_of_residence: "PH",
    country_of_residence_name: "Philippines",
    residence_region_code: "1400000000",
    residence_province_code: "1400100000",
    residence_province_name: "ABRA",
    residence_municipality_code: "1400101000",
    residence_municipality_name: "BANGUED",
    residence_barangay_code: "1400101001",
    residence_barangay_name: "AGTANGAO",
    residence_address_line1: "House 1, Test Street",
    residence_address_line2: "Unit 2",
  });

  assert.equal(residence.isPhilippines, true);
  assert.equal(residence.province?.code, "1400100000");
  assert.equal(residence.municipality?.code, "1400101000");
  assert.equal(residence.barangay?.code, "1400101001");

  assert.deepEqual(buildPhEtravelResidenceActionPlan(residence), [
    { kind: "select", fieldName: "country_code", code: "PH", label: "Philippines" },
    {
      kind: "select",
      fieldName: "province_code",
      code: "1400100000",
      label: "ABRA",
      dependsOn: "1400000000",
    },
    {
      kind: "select",
      fieldName: "municipality_code",
      code: "1400101000",
      label: "BANGUED",
      dependsOn: "1400100000",
    },
    {
      kind: "select",
      fieldName: "barangay_code",
      code: "1400101001",
      label: "AGTANGAO",
      dependsOn: "1400101000",
    },
    { kind: "fill", fieldName: "street", value: "House 1, Test Street" },
    { kind: "fill", fieldName: "street_two", value: "Unit 2" },
  ]);
});

test("foreign residence plans only country and address lines", () => {
  const residence = normalizePhEtravelResidenceAddress({
    country_of_residence: "CN",
    country_of_residence_name: "China",
    residence_address_line1: "No. 1 Test Road, Shanghai",
    residence_address_line2: "Unit 3",
    province_code: "must-not-leak",
    municipality_code: "must-not-leak",
    barangay_code: "must-not-leak",
  });

  assert.deepEqual(buildPhEtravelResidenceActionPlan(residence), [
    { kind: "select", fieldName: "country_code", code: "CN", label: "China" },
    { kind: "fill", fieldName: "street", value: "No. 1 Test Road, Shanghai" },
    { kind: "fill", fieldName: "street_two", value: "Unit 3" },
  ]);
  assert.equal(residence.province, null);
  assert.equal(residence.municipality, null);
  assert.equal(residence.barangay, null);
});

test("PH residence fails closed when any canonical code is missing", () => {
  assert.throws(
    () => normalizePhEtravelResidenceAddress({
      country_of_residence: "PH",
      residence_region_code: "1400000000",
      residence_province_name: "ABRA",
      residence_municipality_code: "1400101000",
      residence_barangay_code: "1400101001",
      residence_address_line1: "House 1, Test Street",
    }),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelResidenceValidationError);
      assert.equal(error.code, "ph_etravel_residence_action_required");
      assert.deepEqual(error.missingFields, ["residence.province_code"]);
      return true;
    },
  );
});

test("does not parse province, municipality, or barangay from free-text address", () => {
  assert.throws(
    () => normalizePhEtravelResidenceAddress({
      country_of_residence: "PH",
      residence_address_line1: "AGTANGAO, BANGUED, ABRA",
    }),
    (error: unknown) => {
      assert.ok(error instanceof PhEtravelResidenceValidationError);
      assert.deepEqual(error.missingFields, [
        "residence.region_code",
        "residence.province_code",
        "residence.municipality_code",
        "residence.barangay_code",
      ]);
      return true;
    },
  );
});

test("resolves labels and region by exact official codes and verifies parentage", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const data = url.includes("/provinces?")
      ? [{ code: "1400100000", region_code: "1400000000", name: "ABRA" }]
      : url.includes("/municipalities?")
        ? [{ code: "1400101000", province_code: "1400100000", region_code: "1400000000", name: "BANGUED" }]
        : [{ code: "1400101001", municipality_code: "1400101000", province_code: "1400100000", name: "AGTANGAO" }];
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  const residence = normalizePhEtravelResidenceAddress({
    country_of_residence: "PH",
    residence_region_code: "1400000000",
    residence_province_code: "1400100000",
    residence_municipality_code: "1400101000",
    residence_barangay_code: "1400101001",
    residence_address_line1: "House 1, Test Street",
  });

  const resolved = await resolvePhEtravelOfficialResidenceHierarchy(residence, fetchImpl);

  assert.equal(resolved.regionCode, "1400000000");
  assert.equal(resolved.province?.label, "ABRA");
  assert.equal(resolved.municipality?.label, "BANGUED");
  assert.equal(resolved.barangay?.label, "AGTANGAO");
  assert.match(calls[0], /region_code=1400000000$/);
  assert.match(calls[1], /province_code=1400100000$/);
  assert.match(calls[2], /municipality_code=1400101000$/);
});

test("does not treat a Philippine country label as an official country code", () => {
  assert.throws(
    () => normalizePhEtravelResidenceAddress({
      country_of_residence: "Philippines",
      residence_region_code: "1400000000",
      residence_province_code: "1400100000",
      residence_municipality_code: "1400101000",
      residence_barangay_code: "1400101001",
      residence_address_line1: "Synthetic address",
    }),
    (error: unknown) => error instanceof PhEtravelResidenceValidationError
      && error.missingFields.includes("residence.country_code"),
  );
});
