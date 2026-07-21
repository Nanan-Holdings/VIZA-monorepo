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
  passportHolderType: "FOREIGNER",
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
  destinationTransitAirport: null,
  destinationCountry: null,
  destinationPort: null,
  destinationAddress: null,
  philippinesAddress: "Test Hotel, Manila",
  returnDate: null,
  travelTaxPaymentType: null,
  travelTaxReferenceNumber: null,
  travelTaxTicketNumber: null,
  cfoRegistrationNumber: null,
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
    customsInformationAcknowledgement: true,
    hasGoodsToDeclare: false,
    hasCurrencyToDeclare: false,
    currencyType: null,
    currencyAmount: null,
    currencySource: null,
    bspAuthorizationNumber: null,
    bspAuthorizationDate: null,
    customsSignatureDeclaration: true,
  },
  finalDeclaration: true,
};

test("buildPhEtravelFieldPlan maps canonical values to official display labels", () => {
  const plan = buildPhEtravelFieldPlan(payload);
  const byKey = new Map(plan.map((item) => [item.key, item]));

  assert.equal(byKey.get("registration_for")?.value, "For me");
  assert.equal(byKey.get("transport_type")?.value, "Air");
  assert.equal(byKey.get("purpose")?.value, "Holiday/Pleasure/Vacation");
  assert.equal(byKey.get("with_transit")?.kind, "checkbox");
  assert.equal(byKey.get("with_transit")?.value, false);
  assert.equal(byKey.get("purpose")?.portalName, "purpose_of_visit_code");
  assert.equal(byKey.get("traveller_type")?.portalName, "passenger_type");
  assert.equal(byKey.get("airline")?.portalName, "travel_company_code");
  assert.equal(byKey.get("origin_country")?.portalName, "origin_country_code");
  assert.equal(byKey.get("port_of_entry")?.portalName, "destination_port_code");
  assert.equal(byKey.get("flight_number")?.kind, "choice");
  assert.equal(byKey.get("destination_type")?.value, "Hotel/Resort");
  assert.equal(byKey.get("health_recent_travel")?.portalName, "meta.with_recent_travel_history");
  assert.equal(byKey.get("health_exposure")?.portalName, "is_with_history_exposure");
  assert.equal(byKey.get("health_sick")?.portalName, "is_sicked_within_thirty_days");
  assert.ok(
    plan.findIndex((item) => item.key === "departure_date") >
      plan.findIndex((item) => item.key === "philippines_address"),
  );
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

test("buildPhEtravelFieldPlan fills the official transit destination controls", () => {
  const plan = buildPhEtravelFieldPlan({
    ...payload,
    destinationType: "TRANSIT",
    destinationTransitAirport: "TP3000",
    destinationCountry: "HK",
  }, {
    TP3000: "Ninoy Aquino International Airport T3 - (MNL)",
    HK: "Hong Kong",
  });
  const byKey = new Map(plan.map((item) => [item.key, item]));

  assert.equal(byKey.get("destination_transit_airport")?.value, "Ninoy Aquino International Airport T3 - (MNL)");
  assert.equal(byKey.get("destination_transit_airport")?.portalName, "transit_port_code");
  assert.equal(byKey.get("destination_transit_airport")?.required, true);
  assert.equal(byKey.get("destination_country")?.value, "Hong Kong");
  assert.equal(byKey.get("destination_country")?.portalName, "transit_destination_country_code");
  assert.equal(byKey.get("destination_country")?.required, true);
  assert.equal(byKey.get("philippines_address")?.required, false);
});

test("buildPhEtravelFieldPlan emits departure controls and excludes arrival-only health and accommodation", () => {
  const plan = buildPhEtravelFieldPlan({
    ...payload,
    visaType: "PH_ETRAVEL_DEPARTURE_CARD",
    travelType: "DEPARTURE",
    passportHolderType: "FOREIGNER",
    portOfEntry: "TP1000",
    destinationCountry: "SG",
    destinationPort: "Singapore Changi Airport",
    destinationAddress: "1 Airport Boulevard, Singapore",
    philippinesAddress: null,
  });
  const keys = new Set(plan.map((item) => item.key));

  for (const key of ["departure_port", "destination_country", "destination_port", "destination_address", "has_currency_to_declare"]) {
    assert.equal(keys.has(key), true, `${key} missing`);
  }
  assert.equal(plan.find((item) => item.key === "transport_number")?.kind, "text");
  for (const key of ["philippines_address", "destination_type", "health_recent_travel", "airport_of_origin"]) {
    assert.equal(keys.has(key), false, `${key} must not be in departure plan`);
  }
});
