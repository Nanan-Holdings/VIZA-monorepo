import test from "node:test";
import assert from "node:assert/strict";
import { buildPhEtravelFieldPlan } from "../form-filler";
import type { PhEtravelPortalPayload } from "../normalize";

const payload: PhEtravelPortalPayload = {
  countryCode: "PH",
  visaType: "PH_ETRAVEL_ARRIVAL_CARD",
  applicationId: "ph-test",
  fullName: "TEST SAMPLE TRAVELLER",
  firstName: "TEST",
  middleName: "SAMPLE",
  lastName: "TRAVELLER",
  suffix: null,
  passportNumber: "E12345678",
  passportIssueDate: "2020-01-01",
  passportExpiryDate: "2030-12-31",
  passportIssuingAuthority: "CHINA",
  nationality: "CHINA",
  countryOfBirth: "CHINA",
  countryOfResidence: "CHINA",
  residenceAddress: "Test address",
  occupation: "STUDENT_MINOR",
  dateOfBirth: "1990-01-01",
  sex: "FEMALE",
  emailAddress: "test@example.com",
  mobileCountryCode: "+86",
  mobileNumber: "13800138000",
  travelType: "ARRIVAL",
  transportType: "AIR",
  registrationFor: "FOR_ME",
  isSpecialFlight: false,
  travellerType: "AIRCRAFT_PASSENGER",
  flightNumber: "PR101",
  airlineOrVesselName: "PHILIPPINE_AIRLINES",
  airportOfOrigin: "Singapore Changi Airport",
  portOfEntry: "NINOY AQUINO INTERNATIONAL AIRPORT",
  arrivalDate: "2026-07-16",
  departureDate: "2026-07-17",
  originCountry: "SINGAPORE",
  purposeOfTravel: "HOLIDAY",
  withTransit: false,
  transitCountry: null,
  transitAirport: null,
  transitDate: null,
  destinationType: "HOTEL_RESORT",
  philippinesAddress: "Test Hotel, Manila",
  accompaniedUnder18Count: "0",
  accompanied18PlusCount: "0",
  firstTimeVisitingPhilippines: true,
  hasHealthSymptoms: false,
  healthSymptomsDetails: null,
  hasRecentTravelHistory30d: false,
  visitedCountries30d: [],
  hasExposureToSickPerson30d: false,
  hasBeenSick30d: false,
  sicknessSymptoms: [],
  customs: {
    hasCheckedBaggage: true,
    checkedBaggageCount: "1",
    hasHandcarryBaggage: true,
    handcarryBaggageCount: "1",
    hasDutiableGoods: false,
    dutiableGoodsDetails: null,
    hasCurrencyOverThreshold: false,
    currencyDeclarationDetails: null,
    hasBaggageOrCurrencyToDeclare: false,
    customsSignatureFile: null,
  },
  finalDeclaration: true,
};

test("buildPhEtravelFieldPlan maps canonical values to official display labels", () => {
  const plan = buildPhEtravelFieldPlan(payload);
  const byKey = new Map(plan.map((item) => [item.key, item]));

  assert.equal(byKey.get("registration_for")?.value, "For me");
  assert.equal(byKey.get("transport_type")?.value, "Air");
  assert.equal(byKey.get("purpose")?.value, "Holiday / Vacation");
  assert.equal(byKey.get("destination_type")?.value, "Hotel/Resort");
  assert.equal(byKey.get("first_visit")?.value, "Yes");
  assert.equal(byKey.get("has_customs_declaration")?.value, "No");
});

test("buildPhEtravelFieldPlan carries every required travel value into the browser plan", () => {
  const plan = buildPhEtravelFieldPlan(payload);
  const required = plan.filter((item) => item.required);

  assert.ok(required.length >= 20);
  assert.equal(required.some((item) => item.value === null || item.value === ""), false);
  assert.equal(plan.find((item) => item.key === "arrival_date")?.value, "2026-07-16");
  assert.equal(plan.find((item) => item.key === "philippines_address")?.value, "Test Hotel, Manila");
});
