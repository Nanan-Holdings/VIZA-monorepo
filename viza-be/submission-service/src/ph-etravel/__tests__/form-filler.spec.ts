import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPhEtravelAirPositiveCustomsActionPlan,
  buildPhEtravelElectronicCustomsAutofillPhases,
  buildPhEtravelFieldPlan,
  buildPhEtravelSeaElectronicPositiveCustomsActionPlan,
  classifyPhEtravelSeaCustomsPage,
  classifyPhEtravelPreReviewGate,
  isPhEtravelConfirmationText,
  isPhEtravelPublicLandingText,
  isPhEtravelReviewSummaryText,
  PH_ETRAVEL_HEALTH_STATIC_WARNING,
  PH_ETRAVEL_HEALTH_SYMPTOM_LABELS,
  phEtravelStructuredCustomsActionRequired,
} from "../form-filler";
import {
  buildPhEtravelAttachmentActionContract,
  normalizePhEtravelCurrencyOwnerBranch,
  PH_ETRAVEL_ATTACHMENT_MAX_BYTES,
} from "../attachment-owner-contract";
import {
  loadPhEtravelSeaPortFlowMetadata,
  PH_ETRAVEL_SEA_TRAVEL_PORTS_PATH,
  resolvePhEtravelSeaPortFlowMetadata,
  verifyPhEtravelSeaPortFlowPage,
} from "../sea-port-flow";
import type { PhEtravelPortalPayload } from "../normalize";
import { buildPhEtravelSuccessFromPortalText, PhEtravelPortalError } from "../runner";

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
  residence: {
    country: { code: "CN", label: "China" },
    regionCode: null,
    province: null,
    municipality: null,
    barangay: null,
    line1: "Test address",
    line2: null,
    isPhilippines: false,
  },
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
  arrivalBranch: {
    transportType: "AIR",
    passportHolderType: "FOREIGNER",
    travellerType: "AIRCRAFT_PASSENGER",
  },
  registrationFor: "FOR_ME",
  registrationConsent: {
    accepted: true,
    acceptedAt: "2026-07-15T08:00:00.000Z",
    version: "ph-etravel-data-privacy-affidavit-v1",
    source: "viza_consent_audit_record",
  },
  isSpecialFlight: false,
  isDisembarking: null,
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
    amountOfGoodsCurrency: null,
    amountOfGoodsAmount: null,
    generalDeclarationResponses: [],
    goodsItems: [],
    currencyType: null,
    currencyAmount: null,
    currencySource: null,
    currencyOwnerNotApplicable: false,
    currencyOwner: null,
    currencyRecipient: null,
    currencyItems: [],
    bspAuthorizationNumber: null,
    bspAuthorizationDate: null,
    currencySources: [],
    currencySourceOther: null,
    currencyTransportPurposes: [],
    currencyTransportPurposeOther: null,
    currencyTransportMethod: null,
    noOfDaysInPhilippines: null,
    lastTravelToPhilippines: null,
    courierName: null,
    airwayBillNumber: null,
    airwayBillDate: null,
    customsSignatureDeclaration: true,
  },
  finalDeclaration: true,
};

test("AIR Special Flight field plan uses its detail control and never plans a boolean official payload field", () => {
  const plan = buildPhEtravelFieldPlan({
    ...payload,
    isSpecialFlight: true,
    flightNumber: "SPECIAL123",
  });
  const specialDetail = plan.find((item) => item.key === "flight_number_special");

  assert.equal(specialDetail?.portalName, "flight_number_special");
  assert.equal(specialDetail?.kind, "text");
  assert.equal(plan.some((item) => item.key === "is_special_flight"), false);
});

test("authenticated dashboard footer is not mistaken for the public landing page", () => {
  assert.equal(
    isPhEtravelPublicLandingText(
      "New Travel Declaration Travel History View/Manage Logout Download eGovPH App",
    ),
    false,
  );
  assert.equal(
    isPhEtravelPublicLandingText("Click here to sign in Download eGovPH App"),
    true,
  );
});

test("official passport and QR clearance page is recognized as confirmation", () => {
  assert.equal(
    isPhEtravelConfirmationText(
      "Kindly present your passport to the Immigration Officer for eTravel registration confirmation and QR Code to Customs officer for clearance. Reference Number F00TEST",
    ),
    true,
  );
});

test("Review/Summary detection is semantic and independent of wizard page index", () => {
  assert.equal(
    isPhEtravelReviewSummaryText("wizard_page=4 New Travel Declaration Summary Kindly double check the information before submitting. Previous Submit"),
    true,
  );
  assert.equal(
    isPhEtravelReviewSummaryText("wizard_page=8 New Travel Declaration Summary Kindly double check the information before submitting. Previous Submit"),
    true,
  );
  assert.equal(
    isPhEtravelReviewSummaryText("wizard_page=2 Customs Declaration Confirmation Kindly accomplish the manual forms for Customs Baggage Declaration and Currencies Declaration."),
    false,
  );
});

test("SEA customs variants are classified by visible page content instead of fixed page index", () => {
  assert.equal(
    classifyPhEtravelSeaCustomsPage(
      "wizard_page=2 Customs Declaration Confirmation Do you have baggage or currency to declare? No Yes Previous",
    ),
    "electronic_customs_confirmation",
  );
  assert.equal(
    classifyPhEtravelSeaCustomsPage(
      "wizard_page=3 Customs Declaration Other Travel Details Accompanied family members under 18 No. of Baggage Checked-in First time visiting Philippines? Previous Next",
    ),
    "electronic_other_travel_details",
  );
  assert.equal(
    classifyPhEtravelSeaCustomsPage(
      "wizard_page=4 Customs Declaration attachments and signature For Customs - Declaration Signature Signature Clear By Clicking \"Next\", you hereby certify that this declaration is true and correct to the best of my knowledge Previous Next",
    ),
    "electronic_signature_required",
  );
  assert.equal(
    classifyPhEtravelSeaCustomsPage(
      "wizard_page=2 Kindly accomplish the manual forms for Customs Baggage Declaration and Currencies Declaration. Download Baggage/Currency forms Previous Next",
    ),
    "manual_forms_notice",
  );
  assert.equal(
    classifyPhEtravelSeaCustomsPage(
      "wizard_page=6 New Travel Declaration Summary Kindly double check the information before submitting. Previous Submit",
    ),
    "review_summary",
  );
});

test("SEA port-flow metadata exposes only the selected-port dynamic page gate", () => {
  assert.equal(
    PH_ETRAVEL_SEA_TRAVEL_PORTS_PATH,
    "travel_ports?paginate=0&q=&order_by=name&status_by=asc&transportation_type=SEA",
  );
  const dynamicPagesEnabled = resolvePhEtravelSeaPortFlowMetadata({
    destinationPortCode: "TP0103",
    response: { data: [{ code: "TP0103", transportation_type: "SEA", with_custom_declaration: 1 }] },
  });
  const dynamicPagesNotEnabled = resolvePhEtravelSeaPortFlowMetadata({
    destinationPortCode: "TP0011",
    response: { data: [{ code: "TP0011", transportation_type: "SEA", with_custom_declaration: 0 }] },
  });

  assert.deepEqual(dynamicPagesEnabled, {
    status: "dynamic_pages_enabled",
    destinationPortCode: "TP0103",
    source: "official_public_api",
  });
  assert.deepEqual(dynamicPagesNotEnabled, {
    status: "dynamic_pages_not_enabled",
    destinationPortCode: "TP0011",
    source: "official_public_api",
  });
});

test("SEA port-flow metadata fails closed for unknown, missing, malformed, or disembarking-port values", () => {
  const response = { data: [{ code: "TP0103", transportation_type: "SEA", with_custom_declaration: 1 }] };
  assert.deepEqual(resolvePhEtravelSeaPortFlowMetadata({ destinationPortCode: null, response }), {
    status: "action_required",
    code: "sea_destination_port_code_required",
  });
  assert.deepEqual(resolvePhEtravelSeaPortFlowMetadata({ destinationPortCode: "tp0103", response }), {
    status: "action_required",
    code: "sea_destination_port_code_required",
  });
  assert.deepEqual(resolvePhEtravelSeaPortFlowMetadata({ destinationPortCode: "TP9999", response }), {
    status: "action_required",
    code: "sea_destination_port_metadata_unknown",
  });
  assert.deepEqual(resolvePhEtravelSeaPortFlowMetadata({
    destinationPortCode: "TP0103",
    response: { data: [{ code: "TP0103", transportation_type: "SEA", with_custom_declaration: "1" }] },
  }), {
    status: "action_required",
    code: "sea_destination_port_metadata_malformed",
  });
  assert.deepEqual(resolvePhEtravelSeaPortFlowMetadata({
    destinationPortCode: "TP0103",
    response: { data: [{ code: "TP0103", transportation_type: "AIR", with_custom_declaration: 1 }] },
  }), {
    status: "action_required",
    code: "sea_destination_port_metadata_malformed",
  });
});

test("SEA port-flow page gate never converts a false metadata flag into a manual flow", async () => {
  const dynamicPagesEnabled = resolvePhEtravelSeaPortFlowMetadata({
    destinationPortCode: "TP0103",
    response: { data: [{ code: "TP0103", transportation_type: "SEA", with_custom_declaration: 1 }] },
  });
  const dynamicPagesNotEnabled = resolvePhEtravelSeaPortFlowMetadata({
    destinationPortCode: "TP0011",
    response: { data: [{ code: "TP0011", transportation_type: "SEA", with_custom_declaration: 0 }] },
  });

  assert.deepEqual(verifyPhEtravelSeaPortFlowPage({ metadata: dynamicPagesEnabled, pageFlow: "electronic" }), {
    status: "matched",
    flow: "electronic",
  });
  assert.deepEqual(verifyPhEtravelSeaPortFlowPage({ metadata: dynamicPagesNotEnabled, pageFlow: "shared_confirmation" }), {
    status: "action_required",
    code: "sea_dynamic_page_gate_live_content_required",
  });
  assert.deepEqual(verifyPhEtravelSeaPortFlowPage({ metadata: dynamicPagesNotEnabled, pageFlow: "electronic" }), {
    status: "action_required",
    code: "sea_dynamic_page_gate_live_content_required",
  });
  assert.deepEqual(verifyPhEtravelSeaPortFlowPage({ metadata: dynamicPagesEnabled, pageFlow: "manual" }), {
    status: "action_required",
    code: "sea_port_flow_metadata_page_mismatch",
  });

  const unavailable = await loadPhEtravelSeaPortFlowMetadata("TP0103", {
    fetcher: (async () => {
      throw new Error("provider failure applicant@example.test OTP token");
    }) as typeof fetch,
  });
  const errorOutput = JSON.stringify(unavailable);
  assert.deepEqual(unavailable, {
    status: "action_required",
    code: "sea_destination_port_metadata_unavailable",
  });
  assert.doesNotMatch(errorOutput, /applicant@example\.test|OTP|token/i);
});

test("SEA electronic no-declaration E9 path classifies signature to Family to Summary without submit success", () => {
  const signaturePage =
    "wizard_page=4 Customs Declaration attachments and signature For Customs - Declaration Signature Signature Clear By Clicking \"Next\", you hereby certify that this declaration is true and correct to the best of my knowledge Previous Next";
  const familyPage =
    "wizard_page=5 Family Member(s) Travel declarations will also be generated for the selected family members. No Record Found! Add Family Member Previous Next";
  const noCompanionModal =
    "wizard_page=5 You haven't selected any family members for this travel registration. Are you sure you're not traveling with a companion? No Yes";
  const summaryPage =
    "wizard_page=6 New Travel Declaration Summary Kindly double check the information before submitting. For Customs - General Declaration Declaration Signature Previous Submit";

  assert.equal(classifyPhEtravelSeaCustomsPage(signaturePage), "electronic_signature_required");
  assert.equal(classifyPhEtravelPreReviewGate(signaturePage), "signature_required");
  assert.equal(classifyPhEtravelSeaCustomsPage(familyPage), "family_gate");
  assert.equal(classifyPhEtravelPreReviewGate(familyPage), null);
  assert.equal(classifyPhEtravelSeaCustomsPage(noCompanionModal), "family_no_companion_confirmation");
  assert.equal(classifyPhEtravelPreReviewGate(noCompanionModal), "family_companion_confirmation");
  assert.equal(classifyPhEtravelSeaCustomsPage(summaryPage), "review_summary");
  assert.equal(isPhEtravelReviewSummaryText(summaryPage), true);
  assert.equal(isPhEtravelConfirmationText(summaryPage), false);
});

test("buildPhEtravelFieldPlan maps canonical values to official display labels", () => {
  const plan = buildPhEtravelFieldPlan(payload);
  const byKey = new Map(plan.map((item) => [item.key, item]));

  assert.equal(byKey.get("registration_for")?.value, "For me");
  assert.equal(byKey.get("transport_type")?.value, "Air");
  assert.equal(byKey.get("passport_holder_type")?.value, "Foreign Passport Holder");
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

test("Health field plan is shared by AIR and SEA and keeps positive groups repeatable", () => {
  const positiveHealth = {
    ...payload,
    hasRecentTravelHistory30d: true,
    visitedCountries30d: ["PH", "SG"],
    hasBeenSick30d: true,
    sicknessSymptoms: ["SYMPTOM_A", "SYMPTOM_B"],
  };
  const airHealth = buildPhEtravelFieldPlan(positiveHealth)
    .filter((item) => /^(health_|visited_country|visited_countries|sickness_symptom|sickness_symptoms)/.test(item.key));
  const seaHealth = buildPhEtravelFieldPlan({
    ...positiveHealth,
    transportType: "SEA",
    arrivalBranch: { transportType: "SEA", passportHolderType: "FOREIGNER", travellerType: "VESSEL_PASSENGER" },
  }).filter((item) => /^(health_|visited_country|visited_countries|sickness_symptom|sickness_symptoms)/.test(item.key));

  assert.deepEqual(airHealth, seaHealth);
  const byKey = new Map(airHealth.map((item) => [item.key, item]));
  assert.equal(byKey.get("health_recent_travel")?.required, true);
  assert.equal(byKey.get("health_exposure")?.required, true);
  assert.equal(byKey.get("health_sick")?.required, true);
  assert.deepEqual(
    [byKey.get("visited_countries")?.repeatable, byKey.get("visited_countries")?.minimumItems],
    [true, 1],
  );
  assert.deepEqual(
    [byKey.get("sickness_symptoms")?.repeatable, byKey.get("sickness_symptoms")?.minimumItems],
    [true, 1],
  );
  assert.equal(byKey.get("visited_country_0")?.value, "PH");
});

test("Health static warning and screenshot-confirmed symptom list remain non-answer metadata", () => {
  assert.equal(
    PH_ETRAVEL_HEALTH_STATIC_WARNING,
    "As of July 22, 2023, No Covid-19 test or Vaccination requirement when traveling to the Philippines.",
  );
  assert.deepEqual(PH_ETRAVEL_HEALTH_SYMPTOM_LABELS, [
    "Altered Mental Status", "Colds", "Cough", "Diarrhea", "Difficulty of Breathing", "Dizziness", "Fever", "Headache", "Loss of appetite", "Loss of smell", "Loss of taste", "Muscle Pain", "Nausea", "Rashes, vesicles or blisters", "Sore throat",
  ]);
  assert.equal(buildPhEtravelFieldPlan(payload).some((item) => item.key === "health_details"), false);
});

test("buildPhEtravelFieldPlan treats SEA and Filipino as first-class arrival branches", () => {
  const plan = buildPhEtravelFieldPlan({
    ...payload,
    transportType: "SEA",
    passportHolderType: "FILIPINO",
    arrivalBranch: {
      transportType: "SEA",
      passportHolderType: "FILIPINO",
      travellerType: "VESSEL_PASSENGER",
    },
    isDisembarking: true,
    travellerType: "VESSEL_PASSENGER",
    flightNumber: "VOY123",
    airlineOrVesselName: "MV SAMPLE",
    airportOfOrigin: "Singapore Cruise Centre",
    portOfEntry: "MANILA NORTH HARBOR",
    returnDate: "2026-07-20",
    destinationType: "TRAVEL_PORT",
    destinationPort: "CEBU PORT",
    philippinesAddress: null,
  });
  const byKey = new Map(plan.map((item) => [item.key, item]));

  assert.equal(byKey.get("transport_type")?.value, "Sea");
  assert.equal(byKey.get("passport_holder_type")?.value, "Philippine Passport Holder");
  assert.equal(byKey.get("traveller_type")?.value, "Vessel Passenger");
  assert.equal(byKey.get("vessel_name")?.portalName, "vessel_name");
  assert.equal(byKey.get("vessel_name")?.kind, "text");
  assert.equal(byKey.get("voyage_number")?.portalName, "flight_number");
  assert.equal(byKey.get("seaport_of_origin")?.labels.includes("Seaport of Origin"), true);
  assert.equal(byKey.get("return_date")?.portalName, "return_date");
  assert.equal(byKey.get("return_date")?.value, "2026-07-20");
  assert.equal(byKey.get("disembarking_port")?.required, true);
  assert.equal(byKey.has("philippines_address"), false);
  assert.equal(byKey.has("customs_acknowledgement"), false);
  assert.equal(byKey.has("customs_signature"), false);
  assert.equal(byKey.get("checked_baggage")?.value, "1");
});

test("SEA non-disembarking path does not plan the destination branch", () => {
  const plan = buildPhEtravelFieldPlan({
    ...payload,
    transportType: "SEA",
    arrivalBranch: {
      transportType: "SEA",
      passportHolderType: "FOREIGNER",
      travellerType: "VESSEL_PASSENGER",
    },
    isDisembarking: false,
    travellerType: "VESSEL_PASSENGER",
    flightNumber: "VOY123",
    airlineOrVesselName: "MV SAMPLE",
    airportOfOrigin: "Singapore Cruise Centre",
    destinationType: null,
    destinationPort: null,
    philippinesAddress: null,
  });
  const keys = new Set(plan.map((item) => item.key));

  assert.equal(keys.has("is_disembarking"), true);
  assert.equal(keys.has("destination_type"), false);
  assert.equal(keys.has("disembarking_port"), false);
  assert.equal(keys.has("philippines_address"), false);
});

test("buildPhEtravelFieldPlan carries structured customs and currency positive details", () => {
  const plan = buildPhEtravelFieldPlan({
    ...payload,
    customs: {
      ...payload.customs,
      hasBaggageOrCurrencyToDeclare: true,
      hasDutiableGoods: true,
      hasCurrencyOverThreshold: true,
      hasGoodsToDeclare: true,
      hasCurrencyToDeclare: true,
      amountOfGoodsCurrency: "USD",
      amountOfGoodsAmount: "1200",
      currencyType: "FOREIGN_CURRENCY",
      currencyAmount: "15000",
      currencySource: "Salary",
      goodsItems: [
        { description: "Camera equipment", quantity: "1", amountUsd: "500" },
      ],
      currencyOwnerNotApplicable: true,
      currencyOwner: {
        businessName: null,
        firstName: "TEST",
        middleName: null,
        lastName: "OWNER",
        suffix: null,
        occupationOrBusinessActivity: "Engineer",
        country: "CN",
        address: "Test owner address",
        postalCode: "100000",
      },
      currencyRecipient: {
        businessName: "Recipient Co",
        firstName: null,
        middleName: null,
        lastName: null,
        suffix: null,
        occupationOrBusinessActivity: "Trading",
        country: "PH",
        address: "Test recipient address",
        postalCode: "1000",
      },
      currencyItems: [
        { currency: "USD", monetaryInstrument: "CASH", amount: "15000" },
      ],
      currencySources: ["Salary", "Business"],
      currencySourceOther: "Other safe source",
      currencyTransportPurposes: ["Travel", "Business"],
      currencyTransportPurposeOther: "Other safe purpose",
      currencyTransportMethod: "is_physically_transferred_by_person",
      noOfDaysInPhilippines: "5",
      lastTravelToPhilippines: "2026-01-02",
      generalDeclarationResponses: [
        { itemNumber: 1, key: "customs_checklist_1", response: true, details: null },
        { itemNumber: 7, key: "customs_checklist_7", response: true, details: "Camera equipment" },
        { itemNumber: 12, key: "customs_checklist_12", response: true, details: null },
      ],
    },
  });
  const byKey = new Map(plan.map((item) => [item.key, item]));

  assert.equal(byKey.get("has_customs_declaration")?.value, "Yes");
  assert.equal(byKey.get("customs_checklist_1")?.portalName, "check_lists.0.response");
  assert.equal(byKey.get("customs_checklist_7")?.value, "Yes");
  assert.equal(byKey.get("amount_of_goods_currency")?.portalName, "amount_of_goods_acquired.currency");
  assert.equal(byKey.get("goods_item_0_description")?.value, "Camera equipment");
  assert.equal(byKey.has("currency_owner_not_applicable"), false);
  assert.equal(byKey.has("currency_owner_first_name"), false);
  assert.equal(byKey.has("currency_recipient_business_name"), false);
  assert.equal(byKey.get("currency_item_0_amount")?.value, "15000");
  assert.equal(byKey.get("currency_source_0")?.value, true);
  assert.equal(byKey.get("currency_purpose_0")?.value, true);
  assert.equal(byKey.get("currency_transport_method")?.value, "Physically transferred by person");
  assert.equal(byKey.has("dutiable_goods_details"), false);
  assert.equal(byKey.has("currency_details"), false);
});

test("positive structured customs/currency is action-required until official controls are automated", () => {
  const reasons = phEtravelStructuredCustomsActionRequired({
    ...payload,
    customs: {
      ...payload.customs,
      hasCurrencyToDeclare: true,
      hasCurrencyOverThreshold: true,
      goodsItems: [{ description: "Camera", quantity: "1", amountUsd: "500" }],
      currencyItems: [{ currency: "USD", monetaryInstrument: "CASH", amount: "15000" }],
      generalDeclarationResponses: [
        { itemNumber: 1, key: "customs_checklist_1", response: true, details: null },
      ],
    },
  });

  assert.ok(reasons.includes("customs_positive_autofill_not_enabled"));
  assert.ok(reasons.includes("customs_checklist_requires_all_12_responses"));
  assert.ok(reasons.includes("customs_currency_source_required"));
  assert.ok(reasons.includes("customs_currency_transfer_method_required"));
  assert.ok(reasons.includes("owner_recipient_requiredness_unverified"));
  assert.ok(reasons.includes("complete_currency_and_monetary_instrument_option_lists_unverified"));
});

test("electronic customs/currency autofill phases consume selector evidence but keep unsafe gaps blocked", () => {
  const phases = buildPhEtravelElectronicCustomsAutofillPhases({
    ...payload,
    customs: {
      ...payload.customs,
      hasBaggageOrCurrencyToDeclare: true,
      hasGoodsToDeclare: true,
      hasCurrencyToDeclare: true,
      amountOfGoodsCurrency: "USD",
      amountOfGoodsAmount: "1200",
      goodsItems: [{ description: "Camera", quantity: "1", amountUsd: "500" }],
      currencyOwnerNotApplicable: true,
      currencyItems: [{ currency: "USD", monetaryInstrument: "CASH", amount: "15000" }],
      currencySources: ["SALARY"],
      currencyTransportPurposes: ["LEISURE"],
      currencyTransportMethod: "is_shipped_thru_courier_service",
      courierName: "Test Courier",
      airwayBillNumber: "AWB123",
      airwayBillDate: "2026-07-12",
      customsSignatureDeclaration: true,
      generalDeclarationResponses: [
        { itemNumber: 1, key: "customs_checklist_1", response: true, details: null },
        { itemNumber: 12, key: "customs_checklist_12", response: true, details: null },
      ],
    },
  });
  const byKey = new Map(phases.map((phase) => [phase.key, phase]));

  assert.equal(byKey.get("customs_confirmation")?.automationStatus, "ready");
  assert.equal(byKey.get("general_declaration_checklist")?.automationStatus, "selector_plan_ready");
  assert.equal(byKey.get("general_declaration_checklist")?.selectors.includes("input[name=\"check_lists.0.response\"]"), true);
  assert.equal(byKey.get("goods_item_modal_table")?.blockedReason, "customs_goods_items_modal");
  assert.equal(byKey.get("goods_item_modal_table")?.selectors.includes("textarea[name='description']"), true);
  assert.equal(byKey.get("goods_item_modal_table")?.blockingGaps?.includes("other_goods_no_row_page_level_blocking_unverified"), true);
  assert.equal(byKey.get("currency_owner_recipient")?.blockedReason, "customs_currency_owner_recipient_structured_controls");
  assert.equal(byKey.get("currency_owner_recipient")?.blockingGaps?.includes("owner_na_stable_selector_unverified"), true);
  assert.equal(byKey.get("currency_owner_recipient")?.selectorEvidence, "live_selector_missing");
  assert.equal(byKey.get("currency_item_modal_table")?.blockedReason, "customs_currency_item_modal");
  assert.equal(byKey.get("currency_item_modal_table")?.validationEvidence?.includes("No currency item shows At least have 1 item"), true);
  assert.equal(byKey.get("currency_source_purpose_checkboxes")?.automationStatus, "selector_plan_ready");
  assert.equal(byKey.get("currency_source_purpose_checkboxes")?.selectors.includes("input[name='currency_sources.0'][value='SALARY']"), true);
  assert.equal(byKey.get("currency_transfer_branch")?.automationStatus, "selector_plan_ready");
  assert.equal(byKey.get("currency_transfer_branch")?.validationEvidence?.includes("Courier empty fields show Required"), true);
  assert.equal(byKey.get("attachments_signature")?.blockedReason, "customs_attachments_signature_controls");
  assert.equal(byKey.get("attachments_signature")?.selectorEvidence, "live_selector_missing");
  assert.equal(
    phases.filter((phase) => phase.automationStatus === "action_required" &&
      phase.key !== "currency_owner_recipient" && phase.key !== "attachments_signature")
      .every((phase) => phase.selectorEvidence === "selector_plan_ready"),
    true,
  );
});

test("physical transfer branch stays blocked while courier branch has selector plan evidence", () => {
  const phases = buildPhEtravelElectronicCustomsAutofillPhases({
    ...payload,
    customs: {
      ...payload.customs,
      hasCurrencyToDeclare: true,
      currencyItems: [{ currency: "USD", monetaryInstrument: "CASH", amount: "15000" }],
      currencyTransportMethod: "is_physically_transferred_by_person",
    },
  });
  const transfer = phases.find((phase) => phase.key === "currency_transfer_branch");

  assert.equal(transfer?.automationStatus, "action_required");
  assert.equal(transfer?.selectorEvidence, "selector_plan_ready");
  assert.equal(transfer?.blockingGaps?.includes("physical_branch_empty_requiredness_unverified"), true);
});

test("AIR positive customs action plan is deterministic, structured, and never includes final submit", () => {
  const plan = buildPhEtravelAirPositiveCustomsActionPlan({
    ...payload,
    customs: {
      ...payload.customs,
      hasBaggageOrCurrencyToDeclare: true,
      hasGoodsToDeclare: true,
      hasCurrencyToDeclare: true,
      amountOfGoodsCurrency: "USD",
      amountOfGoodsAmount: "1200",
      goodsItems: [
        { description: "Declared equipment", quantity: "1", amountUsd: "500" },
        { description: "Declared material", quantity: "2", amountUsd: "300" },
      ],
      currencyOwner: {
        businessName: null,
        firstName: "OWNER",
        middleName: null,
        lastName: "PERSON",
        suffix: null,
        occupationOrBusinessActivity: "BUSINESS",
        country: "PHL",
        address: "Declared address",
        postalCode: "1000",
      },
      currencyRecipient: {
        businessName: "Recipient Co",
        firstName: null,
        middleName: null,
        lastName: null,
        suffix: null,
        occupationOrBusinessActivity: "BUSINESS",
        country: "SGP",
        address: "Recipient address",
        postalCode: "018956",
      },
      currencyItems: [{ currency: "USD", monetaryInstrument: "CASH", amount: "15000" }],
      currencySources: ["SALARY", "OTHER"],
      currencySourceOther: "Savings",
      currencyTransportPurposes: ["LEISURE", "OTHER"],
      currencyTransportPurposeOther: "Personal travel",
      currencyTransportMethod: "is_shipped_thru_courier_service",
      courierName: "Declared courier",
      airwayBillNumber: "AWB-TEST",
      airwayBillDate: "2026-07-12",
      generalDeclarationResponses: Array.from({ length: 12 }, (_, index) => ({
        itemNumber: index + 1,
        key: `customs_checklist_${index + 1}`,
        response: index === 0 || index === 11,
        details: null,
      })),
    },
  });

  assert.equal(plan.branch, "AIR");
  assert.equal(plan.actionRequired, true);
  assert.equal(plan.actions.filter((action) => action.phase === "general_declaration_checklist").length, 12);
  assert.equal(plan.actions.filter((action) => action.kind === "add_modal_row").length, 3);
  assert.ok(plan.actions.some((action) => action.selector === "input[name='currency_sources.2'][value='OTHER']"));
  assert.ok(plan.actions.some((action) => action.selector === "input[name='transport_purpose_other']"));
  assert.ok(plan.actions.some((action) => action.selector === "input[name='courier_name']"));
  assert.ok(plan.blockingCodes.includes("owner_recipient_requiredness_unverified"));
  assert.ok(plan.blockingCodes.includes("complete_currency_and_monetary_instrument_option_lists_unverified"));
  assert.ok(plan.blockingCodes.includes("attachment_requiredness_unverified"));
  assert.ok(plan.blockingCodes.includes("attachment_metadata_not_provided"));
  assert.ok(plan.blockingCodes.includes("customs_positive_autofill_not_enabled"));
  assert.equal(plan.actions.some((action) => /submit/i.test(action.kind) || /submit/i.test(action.selector)), false);
  assert.equal(isPhEtravelConfirmationText("New Travel Declaration Summary Previous Submit"), false);
});

test("AIR action plan fails closed for incomplete evidence and SEA positive never borrows AIR selectors", () => {
  const airPlan = buildPhEtravelAirPositiveCustomsActionPlan({
    ...payload,
    customs: {
      ...payload.customs,
      hasBaggageOrCurrencyToDeclare: true,
      hasCurrencyToDeclare: true,
      currencyItems: [{ currency: "USD", monetaryInstrument: "CASH", amount: "15000" }],
      currencySources: ["OTHER"],
      currencySourceOther: null,
      currencyTransportPurposes: ["OTHER"],
      currencyTransportPurposeOther: null,
      currencyTransportMethod: "is_physically_transferred_by_person",
      generalDeclarationResponses: [{ itemNumber: 1, key: "customs_checklist_1", response: true, details: null }],
    },
  });
  assert.equal(airPlan.actionRequired, true);
  assert.ok(airPlan.blockingCodes.includes("customs_checklist_requires_all_12_responses"));
  assert.ok(airPlan.blockingCodes.includes("customs_currency_source_other_required"));
  assert.ok(airPlan.blockingCodes.includes("customs_currency_purpose_other_required"));
  assert.ok(airPlan.blockingCodes.includes("physical_branch_empty_requiredness_unverified"));

  const seaPlan = buildPhEtravelAirPositiveCustomsActionPlan({
    ...payload,
    transportType: "SEA",
    arrivalBranch: { transportType: "SEA", passportHolderType: "FOREIGNER", travellerType: "VESSEL_PASSENGER" },
    customs: { ...payload.customs, hasBaggageOrCurrencyToDeclare: true, hasCurrencyToDeclare: true },
  });
  assert.deepEqual(seaPlan, {
    branch: "SEA",
    actions: [],
    blockingCodes: ["sea_electronic_positive_post_signature_evidence_pending"],
    actionRequired: true,
  });
});

test("AIR action plan blocker output does not leak applicant data", () => {
  const plan = buildPhEtravelAirPositiveCustomsActionPlan({
    ...payload,
    emailAddress: "applicant@example.test",
    passportNumber: "P123456789",
    customs: {
      ...payload.customs,
      hasCurrencyToDeclare: true,
      currencyItems: [{ currency: "USD", monetaryInstrument: "CASH", amount: "10001" }],
      currencySources: ["OTHER"],
      currencySourceOther: null,
      currencyTransportPurposes: ["OTHER"],
      currencyTransportPurposeOther: null,
    },
  });
  const errorOutput = JSON.stringify({ code: "ph_etravel_structured_customs_action_required", blockers: plan.blockingCodes });
  for (const sensitiveValue of ["applicant@example.test", "P123456789", "10001", "otp", "token", "cookie"]) {
    assert.equal(errorOutput.toLowerCase().includes(sensitiveValue.toLowerCase()), false);
  }
});

test("SEA E10 electronic Yes plan reuses only the observed controls through Currency", () => {
  const seaPayload: PhEtravelPortalPayload = {
    ...payload,
    transportType: "SEA",
    arrivalBranch: { transportType: "SEA", passportHolderType: "FOREIGNER", travellerType: "VESSEL_PASSENGER" },
    customs: {
      ...payload.customs,
      hasBaggageOrCurrencyToDeclare: true,
      hasGoodsToDeclare: true,
      hasCurrencyToDeclare: true,
      amountOfGoodsCurrency: "USD",
      amountOfGoodsAmount: "1200",
      goodsItems: [{ description: "Declared equipment", quantity: "1", amountUsd: "500" }],
      currencyOwner: {
        businessName: null,
        firstName: "OWNER",
        middleName: null,
        lastName: "PERSON",
        suffix: null,
        occupationOrBusinessActivity: "BUSINESS",
        country: "PHL",
        address: "Declared address",
        postalCode: "1000",
      },
      currencyRecipient: null,
      currencyItems: [{ currency: "USD", monetaryInstrument: "CASH", amount: "15000" }],
      currencySources: ["SALARY", "OTHER"],
      currencySourceOther: "Savings",
      currencyTransportPurposes: ["LEISURE", "OTHER"],
      currencyTransportPurposeOther: "Personal travel",
      currencyTransportMethod: "is_shipped_thru_courier_service",
      courierName: "Declared courier",
      airwayBillNumber: "AWB-TEST",
      airwayBillDate: "2026-07-12",
      generalDeclarationResponses: Array.from({ length: 12 }, (_, index) => ({
        itemNumber: index + 1,
        key: `customs_checklist_${index + 1}`,
        response: index === 0 || index === 11,
        details: null,
      })),
    },
  };
  const plan = buildPhEtravelSeaElectronicPositiveCustomsActionPlan(seaPayload, {
    variant: "electronic",
    metadataFlow: "electronic",
    pageKind: "electronic_customs_confirmation",
    declarationChoice: "yes",
  });

  assert.equal(plan.branch, "SEA");
  assert.equal(plan.actionRequired, true);
  assert.equal(plan.actions.filter((action) => action.phase === "general_declaration_checklist").length, 12);
  assert.ok(plan.actions.some((action) => action.selector === "textarea[name='description']"));
  assert.ok(plan.actions.some((action) => action.selector === "[name='currency_id']"));
  assert.ok(plan.actions.some((action) => action.selector === "input[name='currency_source_other']"));
  assert.ok(plan.actions.some((action) => action.selector === "input[name='transport_purpose_other']"));
  assert.ok(plan.actions.some((action) => action.selector === "input[name='courier_name']"));
  assert.ok(plan.blockingCodes.includes("sea_electronic_positive_post_signature_evidence_pending"));
  assert.ok(plan.blockingCodes.includes("owner_recipient_requiredness_unverified"));
  assert.ok(plan.blockingCodes.includes("complete_currency_and_monetary_instrument_option_lists_unverified"));
  assert.equal(plan.actions.some((action) => /next|signature|family|summary|submit/i.test(`${action.kind} ${action.selector}`)), false);
});

test("SEA manual, No, and unknown page-content paths do not produce electronic selector actions", () => {
  const seaPayload = {
    ...payload,
    transportType: "SEA",
    arrivalBranch: { transportType: "SEA" as const, passportHolderType: "FOREIGNER" as const, travellerType: "VESSEL_PASSENGER" as const },
    customs: { ...payload.customs, hasBaggageOrCurrencyToDeclare: true, hasCurrencyToDeclare: true },
  };
  const manual = buildPhEtravelSeaElectronicPositiveCustomsActionPlan(seaPayload, {
    variant: "manual",
    metadataFlow: "manual",
    pageKind: "manual_forms_notice",
  });
  const noDeclaration = buildPhEtravelSeaElectronicPositiveCustomsActionPlan(seaPayload, {
    variant: "electronic",
    metadataFlow: "electronic",
    pageKind: "electronic_customs_confirmation",
    declarationChoice: "no",
  });
  const unknown = buildPhEtravelSeaElectronicPositiveCustomsActionPlan(seaPayload, {
    variant: "unknown",
    pageKind: "unknown",
  });

  assert.equal(manual.actions.length, 0);
  assert.deepEqual(manual.blockingCodes, ["sea_manual_customs_forms_action_required"]);
  assert.deepEqual(noDeclaration, { branch: "SEA", actions: [], blockingCodes: [], actionRequired: false });
  assert.equal(unknown.actions.length, 0);
  assert.deepEqual(unknown.blockingCodes, ["sea_electronic_customs_page_content_required"]);
});

test("SEA E10 blocker output remains safe when requiredness or option evidence is incomplete", () => {
  const plan = buildPhEtravelSeaElectronicPositiveCustomsActionPlan({
    ...payload,
    transportType: "SEA",
    arrivalBranch: { transportType: "SEA", passportHolderType: "FOREIGNER", travellerType: "VESSEL_PASSENGER" },
    emailAddress: "applicant@example.test",
    passportNumber: "P123456789",
    customs: {
      ...payload.customs,
      hasCurrencyToDeclare: true,
      currencyItems: [{ currency: "UNOBSERVED", monetaryInstrument: "UNOBSERVED", amount: "10001" }],
      currencySources: ["UNOBSERVED"],
      currencyTransportPurposes: ["UNOBSERVED"],
      currencyTransportMethod: "is_physically_transferred_by_person",
      generalDeclarationResponses: [{ itemNumber: 1, key: "customs_checklist_1", response: true, details: null }],
    },
  }, {
    variant: "electronic",
    metadataFlow: "electronic",
    pageKind: "electronic_customs_confirmation",
    declarationChoice: "yes",
  });
  const errorOutput = JSON.stringify({ code: "ph_etravel_structured_customs_action_required", blockers: plan.blockingCodes });

  assert.ok(plan.blockingCodes.includes("customs_checklist_requires_all_12_responses"));
  assert.ok(plan.blockingCodes.includes("customs_currency_source_option_unverified"));
  assert.ok(plan.blockingCodes.includes("customs_currency_purpose_option_unverified"));
  assert.ok(plan.blockingCodes.includes("sea_electronic_positive_no_of_days_in_philippines_required"));
  assert.ok(plan.blockingCodes.includes("sea_electronic_positive_last_travel_to_philippines_required"));
  assert.ok(plan.blockingCodes.includes("sea_electronic_positive_post_signature_evidence_pending"));
  for (const sensitiveValue of ["applicant@example.test", "P123456789", "10001", "otp", "token", "cookie"]) {
    assert.equal(errorOutput.toLowerCase().includes(sensitiveValue.toLowerCase()), false);
  }
});

test("SEA E11 physical requiredness is closed only for its two observed children", () => {
  const physicalPayload = {
    ...payload,
    transportType: "SEA",
    arrivalBranch: { transportType: "SEA" as const, passportHolderType: "FOREIGNER" as const, travellerType: "VESSEL_PASSENGER" as const },
    customs: {
      ...payload.customs,
      hasCurrencyToDeclare: true,
      currencyItems: [{ currency: "USD", monetaryInstrument: "CASH", amount: "15000" }],
      currencySources: ["SALARY"],
      currencyTransportPurposes: ["LEISURE"],
      currencyTransportMethod: "is_physically_transferred_by_person" as const,
      generalDeclarationResponses: Array.from({ length: 12 }, (_, index) => ({
        itemNumber: index + 1,
        key: `customs_checklist_${index + 1}`,
        response: index === 0,
        details: null,
      })),
    },
  };
  const missing = buildPhEtravelSeaElectronicPositiveCustomsActionPlan(physicalPayload, {
    variant: "electronic",
    metadataFlow: "electronic",
    pageKind: "electronic_customs_confirmation",
    declarationChoice: "yes",
  });
  const complete = buildPhEtravelSeaElectronicPositiveCustomsActionPlan({
    ...physicalPayload,
    customs: {
      ...physicalPayload.customs,
      noOfDaysInPhilippines: "7",
      lastTravelToPhilippines: "2026-01-02",
    },
  }, {
    variant: "electronic",
    metadataFlow: "electronic",
    pageKind: "electronic_customs_confirmation",
    declarationChoice: "yes",
  });

  assert.ok(missing.blockingCodes.includes("sea_electronic_positive_no_of_days_in_philippines_required"));
  assert.ok(missing.blockingCodes.includes("sea_electronic_positive_last_travel_to_philippines_required"));
  assert.equal(missing.blockingCodes.includes("physical_branch_empty_requiredness_unverified"), false);
  assert.equal(complete.blockingCodes.includes("sea_electronic_positive_no_of_days_in_philippines_required"), false);
  assert.equal(complete.blockingCodes.includes("sea_electronic_positive_last_travel_to_philippines_required"), false);
  assert.ok(complete.actions.some((action) => action.selector === "input[name='no_of_days_in_philippines']"));
  assert.ok(complete.actions.some((action) => action.selector === "input[name='last_travel_to_philippines']"));
  assert.ok(complete.blockingCodes.includes("owner_recipient_requiredness_unverified"));
});

test("SEA E11 positive signature page is content-classified and stays action-required", () => {
  const signaturePage =
    "wizard_page=99 Customs Declaration attachments and signature Take a photo or upload a file. For Customs - Declaration Attachments and Signature Signature Clear By Clicking \"Next\", you hereby certify that this declaration is true and correct to the best of my knowledge Previous Next";
  const pageKind = classifyPhEtravelSeaCustomsPage(signaturePage);
  assert.equal(pageKind, "electronic_signature_required");
  if (pageKind !== "electronic_signature_required") throw new Error("expected SEA signature page classification");
  const plan = buildPhEtravelSeaElectronicPositiveCustomsActionPlan({
    ...payload,
    transportType: "SEA",
    arrivalBranch: { transportType: "SEA", passportHolderType: "FOREIGNER", travellerType: "VESSEL_PASSENGER" },
    customs: { ...payload.customs, hasCurrencyToDeclare: true },
  }, {
    variant: "electronic",
    metadataFlow: "electronic",
    pageKind,
    declarationChoice: "yes",
  });

  assert.equal(classifyPhEtravelPreReviewGate(signaturePage), "signature_required");
  assert.deepEqual(plan.actions, []);
  assert.ok(plan.blockingCodes.includes("sea_electronic_positive_attachment_evidence_pending"));
  assert.ok(plan.blockingCodes.includes("ph_etravel_signature_required"));
  assert.ok(plan.blockingCodes.includes("sea_electronic_positive_post_signature_evidence_pending"));
  assert.equal(isPhEtravelConfirmationText(signaturePage), false);
});

test("all-negative customs checklist remains fillable and does not unlock positive declaration automation", () => {
  const reasons = phEtravelStructuredCustomsActionRequired({
    ...payload,
    customs: {
      ...payload.customs,
      hasBaggageOrCurrencyToDeclare: true,
      hasGoodsToDeclare: false,
      hasCurrencyToDeclare: false,
      hasCurrencyOverThreshold: false,
      customsSignatureDeclaration: false,
      goodsItems: [],
      currencyItems: [],
      generalDeclarationResponses: Array.from({ length: 12 }, (_, index) => ({
        itemNumber: index + 1,
        key: `customs_checklist_${index + 1}`,
        response: false,
        details: null,
      })),
    },
  });

  assert.deepEqual(reasons, []);
});

test("pre-Review signature and Family Member(s) gates are not submitted states", () => {
  assert.equal(
    classifyPhEtravelPreReviewGate("Declaration Signature Required Please make sure to fill out all required fields."),
    "signature_required",
  );
  assert.equal(
    classifyPhEtravelPreReviewGate(
      "Customs Declaration attachments and signature For Customs - Declaration Signature Signature Clear By Clicking \"Next\", you hereby certify that this declaration is true and correct to the best of my knowledge Previous Next",
    ),
    "signature_required",
  );
  assert.equal(
    classifyPhEtravelPreReviewGate("You haven't selected any family members for this travel registration. Are you sure you're not traveling with a companion?"),
    "family_companion_confirmation",
  );
  assert.equal(
    classifyPhEtravelPreReviewGate("New Travel Declaration Summary Kindly double check the information before submitting. Submit"),
    null,
  );
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
  assert.equal(byKey.get("destination_transit_airport")?.portalValue, "TP3000");
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

test("Philippines eTravel success requires an authoritative result read and matching reference-derived QR render", () => {
  const result = buildPhEtravelSuccessFromPortalText(
    payload,
    "Summary is not submission evidence",
    "https://etravel.gov.ph/qr-code?id=test",
    ["confirmation.png"],
    ["rendered-reference.png"],
    [],
    [],
    undefined,
    {
      authoritativeRead: {
        source: "official_registration_result_read",
        postSubmitRead: true,
        referenceNumber: "F00TEST12345",
        stableReference: true,
      },
      qrRender: {
        renderer: "official_client_reference_qr",
        renderedForReference: "F00TEST12345",
        rendered: true,
        referenceValueValidated: true,
      },
    },
  );

  assert.deepEqual(result.qrCodes, ["rendered-reference.png"]);
  assert.equal(result.referenceNumber, "F00TEST12345");
});

test("Philippines eTravel success rejects HTTP/Summary/local reference and QR visual without authoritative result evidence", () => {
  assert.throws(
    () => buildPhEtravelSuccessFromPortalText(
      payload,
      "HTTP 200 Summary Reference Number F00TEST12345 QR Code",
      "https://etravel.gov.ph/qr-code?id=test",
      ["confirmation.png"],
      ["local-render.png"],
      [],
      [],
    ),
    (error: unknown) => error instanceof PhEtravelPortalError &&
      error.code === "ph_etravel_authoritative_result_read_required",
  );
});

test("Philippines eTravel success rejects mismatched reference-derived QR metadata", () => {
  assert.throws(
    () => buildPhEtravelSuccessFromPortalText(
      payload,
      "Summary is not submission evidence",
      "https://etravel.gov.ph/qr-code?id=test",
      ["confirmation.png"],
      ["rendered-reference.png"],
      [],
      [],
      undefined,
      {
        authoritativeRead: {
          source: "official_registration_result_read",
          postSubmitRead: true,
          referenceNumber: "F00TEST12345",
          stableReference: true,
        },
        qrRender: {
          renderer: "official_client_reference_qr",
          renderedForReference: "OTHER-REFERENCE",
          rendered: true,
          referenceValueValidated: true,
        },
      },
    ),
    (error: unknown) => error instanceof PhEtravelPortalError &&
      error.code === "ph_etravel_authoritative_result_read_required",
  );
});

test("E14 attachment precheck only accepts the observed per-file MIME and size hints", () => {
  const accepted = buildPhEtravelAttachmentActionContract([
    { mimeType: "image/png", sizeBytes: PH_ETRAVEL_ATTACHMENT_MAX_BYTES },
    { mimeType: "image/jpg", sizeBytes: 1 },
    { mimeType: "image/jpeg", sizeBytes: 2 },
  ]);
  const oversized = buildPhEtravelAttachmentActionContract([
    { mimeType: "image/png", sizeBytes: PH_ETRAVEL_ATTACHMENT_MAX_BYTES + 1 },
  ]);
  const unsupported = buildPhEtravelAttachmentActionContract([
    { mimeType: "application/pdf", sizeBytes: 1 },
  ]);

  assert.deepEqual(accepted.actions, []);
  assert.equal(accepted.actionRequired, true);
  assert.ok(accepted.blockingCodes.includes("attachment_count_unverified"));
  assert.ok(accepted.blockingCodes.includes("attachment_server_rules_unverified"));
  assert.ok(oversized.blockingCodes.includes("attachment_file_size_not_allowed"));
  assert.ok(unsupported.blockingCodes.includes("attachment_mime_not_allowed"));
});

test("E14 attachment missing or multiple files remain fail-closed without upload actions", () => {
  const missing = buildPhEtravelAttachmentActionContract([]);
  const multiple = buildPhEtravelAttachmentActionContract([
    { mimeType: "image/png", sizeBytes: 1 },
    { mimeType: "image/jpeg", sizeBytes: 1 },
  ]);
  const serialized = JSON.stringify({ code: "ph_etravel_structured_customs_action_required", blockers: multiple.blockingCodes });

  assert.deepEqual(missing.actions, []);
  assert.ok(missing.blockingCodes.includes("attachment_requiredness_unverified"));
  assert.ok(missing.blockingCodes.includes("attachment_metadata_not_provided"));
  assert.deepEqual(multiple.actions, []);
  assert.ok(multiple.blockingCodes.includes("attachment_count_unverified"));
  for (const unsafe of ["@", "otp", "token", "cookie", "passport"]) {
    assert.equal(serialized.toLowerCase().includes(unsafe), false);
  }
});

test("E14 attachment and signature values never become browser field-plan actions", () => {
  const plan = buildPhEtravelFieldPlan({
    ...payload,
    customs: {
      ...payload.customs,
      customsSignatureFile: "attachment-marker",
      customsSignatureDeclaration: true,
    },
  });

  assert.equal(plan.some((item) => /attachment|signature/i.test(item.key)), false);
  assert.equal(plan.some((item) => /next|continue|submit/i.test(item.key)), false);
});

test("E14 Owner N/A clears party actions and does not alter physical or courier branches", () => {
  const party = {
    businessName: "Business",
    firstName: "First",
    middleName: null,
    lastName: "Last",
    suffix: null,
    occupationOrBusinessActivity: "Work",
    country: "PH",
    address: "Address",
    postalCode: "1000",
  };
  const notApplicable = normalizePhEtravelCurrencyOwnerBranch({
    ownerNotApplicable: true,
    owner: party,
    recipient: party,
  });
  const applicable = normalizePhEtravelCurrencyOwnerBranch({
    ownerNotApplicable: false,
    owner: party,
    recipient: party,
  });
  const plan = buildPhEtravelAirPositiveCustomsActionPlan({
    ...payload,
    customs: {
      ...payload.customs,
      hasCurrencyToDeclare: true,
      currencyOwnerNotApplicable: true,
      currencyOwner: party,
      currencyRecipient: party,
      currencyItems: [{ currency: "USD", monetaryInstrument: "CASH", amount: "1" }],
      currencySources: ["SALARY"],
      currencyTransportPurposes: ["LEISURE"],
      currencyTransportMethod: "is_shipped_thru_courier_service",
      courierName: "Courier",
      airwayBillNumber: "AWB",
      airwayBillDate: "2026-01-01",
    },
  });

  assert.equal(notApplicable.owner, null);
  assert.equal(notApplicable.recipient, null);
  assert.ok(notApplicable.blockingCodes.includes("owner_na_stable_selector_unverified"));
  assert.equal(applicable.owner, party);
  assert.ok(applicable.blockingCodes.includes("owner_recipient_requiredness_unverified"));
  assert.equal(plan.actions.some((action) => action.selector.includes("owner_") || action.selector.includes("recipient_")), false);
  assert.ok(plan.actions.some((action) => action.selector === "input[name='courier_name']"));
  assert.equal(plan.actions.some((action) => /next|signature|submit/i.test(`${action.kind} ${action.selector}`)), false);
});
