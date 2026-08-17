import type { SubmissionPayload } from "../country-submissions/types";
import { normalizePhEtravelCurrencyOwnerBranch } from "./attachment-owner-contract";
import { evaluatePhEtravelSubmissionWindow } from "./date-window";
import {
  normalizePhEtravelResidenceAddress,
  PhEtravelResidenceValidationError,
  type PhEtravelResidenceAddress,
} from "./residence-address";
import type { PhEtravelRegistrationConsentAuthorization } from "./registration-start";
import {
  isPhEtravelCurrentArrivalPurposeCode,
  isPhEtravelOfficialOptionCode,
} from "./official-options";

export const PH_ETRAVEL_OFFICIAL_PORTAL_URL = "https://etravel.gov.ph";

export class PhEtravelPortalValidationError extends Error {
  readonly code = "ph_etravel_portal_payload_validation_failed" as const;
  constructor(message: string, readonly missingFields: string[]) {
    super(message);
    this.name = "PhEtravelPortalValidationError";
  }
}

export function phEtravelDateFieldKeys(input: {
  isDeparture: boolean;
  transportType: "AIR" | "SEA" | "";
}): { arrivalDateKey: string; departureDateKey: string } {
  if (!input.isDeparture && input.transportType === "SEA") {
    return {
      arrivalDateKey: "voyage_arrival_date",
      departureDateKey: "voyage_departure_date",
    };
  }
  return {
    arrivalDateKey: "flight_arrival_date",
    departureDateKey: "flight_departure_date",
  };
}

export interface PhEtravelPortalPayload {
  countryCode: "PH";
  visaType: "PH_ETRAVEL_ARRIVAL_CARD" | "PH_ETRAVEL_DEPARTURE_CARD";
  applicationId: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportIssuingAuthority: string;
  nationality: string;
  countryOfBirth: string;
  countryOfResidence: string;
  residence: PhEtravelResidenceAddress;
  residenceAddress: string | null;
  residenceAddressLine1?: string | null;
  residenceAddressLine2?: string | null;
  occupation: string;
  dateOfBirth: string;
  sex: string;
  emailAddress: string;
  mobileCountryCode: string;
  mobileNumber: string;
  travelType: string;
  transportType: string;
  passportHolderType: string | null;
  arrivalBranch: {
    transportType: "AIR" | "SEA";
    passportHolderType: "FILIPINO" | "FOREIGNER";
    travellerType: "AIRCRAFT_PASSENGER" | "VESSEL_PASSENGER";
  } | null;
  registrationFor: string | null;
  registrationConsent: PhEtravelRegistrationConsentAuthorization | null;
  isSpecialFlight: boolean;
  isDisembarking: boolean | null;
  travellerType: string | null;
  flightNumber: string;
  airlineOrVesselName: string | null;
  /** AIR public-option identities and display labels from E46's code/name APIs. */
  airlineCode?: string | null;
  airlineName?: string | null;
  flightCode?: string | null;
  flightName?: string | null;
  airportOfOrigin: string | null;
  portOfEntry: string;
  arrivalDate: string;
  departureDate: string;
  originCountry: string;
  purposeOfTravel: string;
  withTransit: boolean;
  transitCountry: string | null;
  transitAirport: string | null;
  transitDate: string | null;
  destinationType: string | null;
  destinationTransitAirport: string | null;
  destinationCountry: string | null;
  destinationPort: string | null;
  destinationAddress: string | null;
  philippinesAddress: string | null;
  returnDate: string | null;
  travelTaxPaymentType: string | null;
  travelTaxReferenceNumber: string | null;
  travelTaxTicketNumber: string | null;
  cfoRegistrationNumber: string | null;
  accompaniedUnder18Count: string | null;
  accompanied18PlusCount: string | null;
  firstTimeVisitingPhilippines: boolean | null;
  hasRecentTravelHistory30d: boolean;
  visitedCountries30d: string[];
  hasExposureToSickPerson30d: boolean;
  hasBeenSick30d: boolean;
  sicknessSymptoms: string[];
  hasHealthSymptoms: boolean;
  healthSymptomsDetails: string | null;
  customs: {
    hasCheckedBaggage: boolean;
    checkedBaggageCount: string | null;
    hasHandcarryBaggage: boolean;
    handcarryBaggageCount: string | null;
    hasDutiableGoods: boolean;
    dutiableGoodsDetails: string | null;
    hasCurrencyOverThreshold: boolean;
    currencyDeclarationDetails: string | null;
    hasBaggageOrCurrencyToDeclare: boolean;
    customsSignatureFile: string | null;
    customsInformationAcknowledgement: boolean;
    hasGoodsToDeclare: boolean;
    hasCurrencyToDeclare: boolean;
    amountOfGoodsCurrency: string | null;
    amountOfGoodsAmount: string | null;
    generalDeclarationResponses: Array<{
      itemNumber: number;
      key: string;
      response: boolean;
      details: string | null;
    }>;
    goodsItems: PhEtravelGoodsItem[];
    currencyType: string | null;
    currencyAmount: string | null;
    currencySource: string | null;
    currencyOwnerNotApplicable: boolean;
    currencyOwner: PhEtravelCurrencyParty | null;
    currencyRecipient: PhEtravelCurrencyParty | null;
    currencyItems: PhEtravelCurrencyItem[];
    bspAuthorizationNumber: string | null;
    bspAuthorizationDate: string | null;
    currencySources: string[];
    currencySourceOther: string | null;
    currencyTransportPurposes: string[];
    currencyTransportPurposeOther: string | null;
    currencyTransportMethod: PhEtravelCurrencyTransportMethod | null;
    noOfDaysInPhilippines: string | null;
    lastTravelToPhilippines: string | null;
    courierName: string | null;
    airwayBillNumber: string | null;
    airwayBillDate: string | null;
    customsSignatureDeclaration: boolean;
  };
  finalDeclaration: boolean;
}

export type PhEtravelDeparturePortalPayload = PhEtravelPortalPayload & {
  visaType: "PH_ETRAVEL_DEPARTURE_CARD";
  travelType: "DEPARTURE";
};

export interface PhEtravelGoodsItem {
  description: string;
  quantity: string;
  amountUsd: string;
  /** Local VIZA association; never an inferred official portal field. */
  checklistItemNumber?: number;
}

export interface PhEtravelCurrencyItem {
  currency: string;
  monetaryInstrument: string;
  amount: string;
}

export interface PhEtravelCurrencyParty {
  businessName: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  occupationOrBusinessActivity: string | null;
  country: string | null;
  address: string | null;
  postalCode: string | null;
}

export type PhEtravelCurrencyTransportMethod =
  | "is_physically_transferred_by_person"
  | "is_shipped_thru_courier_service";

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";
}

function firstText(values: unknown[]): string {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return "";
}

function registrationConsentFromMetadata(
  metadata: Record<string, unknown>,
): PhEtravelRegistrationConsentAuthorization | null {
  const candidate = metadata.phEtravelRegistrationConsent ?? metadata.ph_etravel_registration_consent;
  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Record<string, unknown>;
  if (record.accepted !== true) return null;
  const acceptedAt = text(record.acceptedAt ?? record.accepted_at);
  const version = text(record.version ?? record.consent_version);
  const source = text(record.source ?? record.audit_source);
  if (!acceptedAt || !version || !source) return null;
  return { accepted: true, acceptedAt, version, source };
}

function normalizeIsoDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";

  const compact = raw.replace(/\s+/g, " ").trim();
  const directMatch = compact.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (directMatch) {
    const [, year, month, day] = directMatch;
    const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (
      date.getUTCFullYear() === Number(year) &&
      date.getUTCMonth() === Number(month) - 1 &&
      date.getUTCDate() === Number(day)
    ) {
      return normalized;
    }
    return "";
  }

  const slashMatch = compact.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T].*)?$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (
      date.getUTCFullYear() === Number(year) &&
      date.getUTCMonth() === Number(month) - 1 &&
      date.getUTCDate() === Number(day)
    ) {
      return normalized;
    }
    return "";
  }

  const altMatch = compact.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:[ T].*)?$/);
  if (altMatch) {
    const [, month, day, year] = altMatch;
    const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (
      date.getUTCFullYear() === Number(year) &&
      date.getUTCMonth() === Number(month) - 1 &&
      date.getUTCDate() === Number(day)
    ) {
      return normalized;
    }
  }

  return "";
}

function firstIsoDate(values: unknown[], key: string, missing: string[]): string {
  for (const value of values) {
    const normalized = normalizeIsoDate(value);
    if (normalized) return normalized;
  }
  missing.push(key);
  return "";
}

function requireFirstText(values: unknown[], key: string, missing: string[]): string {
  const normalized = firstText(values);
  if (!normalized) missing.push(key);
  return normalized;
}

function requireOfficialOptionCode(values: unknown[], key: string, missing: string[]): string {
  const value = firstText(values);
  if (!isPhEtravelOfficialOptionCode(value)) {
    missing.push(key);
    return "";
  }
  return value;
}

function requireCurrentArrivalPurposeCode(values: unknown[], missing: string[]): string {
  const value = firstText(values);
  if (!isPhEtravelCurrentArrivalPurposeCode(value)) {
    missing.push("purpose_of_travel");
    return "";
  }
  return value;
}

function boolAnswer(value: unknown): boolean {
  const normalized = text(value).toLowerCase();
  return ["yes", "y", "true", "1", "on", "checked"].includes(normalized);
}

function requiredYesNoAnswer(
  answers: Record<string, unknown>,
  keys: string[],
  missingKey: string,
  missing: string[],
): boolean {
  const raw = firstText(keys.map((key) => answers[key])).toLowerCase();
  if (["yes", "y", "true", "1", "on", "checked"].includes(raw)) return true;
  if (["no", "n", "false", "0", "off", "unchecked"].includes(raw)) return false;
  missing.push(missingKey);
  return false;
}

function normalizeCode(value: unknown): string {
  return text(value).replace(/[\s-]+/g, "_").toUpperCase();
}

function normalizeOptionalIsoDate(value: unknown): string | null {
  return normalizeIsoDate(value) || null;
}

function normalizeTransportType(value: unknown): "AIR" | "SEA" | "" {
  const normalized = normalizeCode(value);
  if (/^AIR|AIRCRAFT|FLIGHT$/.test(normalized)) return "AIR";
  if (/^SEA|VESSEL|SHIP|SEAPORT|MARITIME$/.test(normalized)) return "SEA";
  return "";
}

function isPhilippineIdentity(value: unknown): boolean {
  return /^(?:PH|PHL|PHILIPPINES?|FILIPINO|PHILIPPINE\s+PASSPORT)$/i.test(text(value));
}

function normalizePassportHolderType(answers: Record<string, unknown>, payload: SubmissionPayload): "FILIPINO" | "FOREIGNER" | "" {
  const direct = normalizeCode(firstText([
    answers.passport_holder_type,
    answers.nationality_type,
    answers.traveller_nationality_type,
    answers.nationality,
    answers.travel_document_holder,
    answers.passport_holder,
  ]));
  if (/FILIPINO|PHILIPPINE|PH_PASSPORT|PHILIPPINE_PASSPORT/.test(direct)) return "FILIPINO";
  if (/FOREIGN|FOREIGNER|FOREIGN_PASSPORT/.test(direct)) return "FOREIGNER";
  if (isPhilippineIdentity(firstText([answers.nationality, payload.personal.nationality]))) return "FILIPINO";
  return "FOREIGNER";
}

function normalizeArrivalPassengerType(value: unknown, transportType: "AIR" | "SEA"): "AIRCRAFT_PASSENGER" | "VESSEL_PASSENGER" | "" {
  const normalized = normalizeCode(value);
  if (!normalized) return transportType === "AIR" ? "AIRCRAFT_PASSENGER" : "VESSEL_PASSENGER";
  if (/AIRCRAFT_PASSENGER|AIR_PASSENGER|PASSENGER/.test(normalized) && transportType === "AIR") return "AIRCRAFT_PASSENGER";
  if (/VESSEL_PASSENGER|SEA_PASSENGER|PASSENGER/.test(normalized) && transportType === "SEA") return "VESSEL_PASSENGER";
  return "";
}

function unsupportedArrivalBranchFields(answers: Record<string, unknown>): string[] {
  const unsupported: string[] = [];
  const combined = [
    answers.passport_holder_type,
    answers.nationality,
    answers.registration_type,
    answers.travel_registration_type,
    answers.registration_route,
    answers.declaration_route,
    answers.eligibility_category,
    answers.eligibility_status,
    answers.eligibility_traveller_type,
    answers.eligibility_passport_type,
    answers.eligibility_visa_type,
    answers.arrival_registration_type,
    answers.arrival_eligibility,
    answers.traveller_type,
    answers.passenger_type,
    answers.passport_type,
    answers.travel_document_type,
    answers.travel_document_holder,
    answers.passport_holder,
    answers.visa_type,
    answers.visa_category,
    answers.official_status,
    answers.exemption_status,
    answers.exempt_status,
    answers.special_identity,
    answers.official_exemption_status,
  ].map(text).join(" ");
  const flags: Array<[string, unknown]> = [
    ["is_special_registration", answers.is_special_registration],
    ["is_special_travel_declaration", answers.is_special_travel_declaration],
    ["special_registration", answers.special_registration],
    ["special_travel_declaration", answers.special_travel_declaration],
    ["is_crew", answers.is_crew],
    ["crew", answers.crew],
    ["is_cruise_passenger", answers.is_cruise_passenger],
    ["cruise_passenger", answers.cruise_passenger],
    ["is_cruise_travel", answers.is_cruise_travel],
    ["cruise_travel", answers.cruise_travel],
    ["is_foreign_diplomat", answers.is_foreign_diplomat],
    ["foreign_diplomat", answers.foreign_diplomat],
    ["foreign_diplomat_dependent", answers.foreign_diplomat_dependent],
    ["is_foreign_diplomat_dependent", answers.is_foreign_diplomat_dependent],
    ["foreign_diplomat_or_dependent", answers.foreign_diplomat_or_dependent],
    ["is_foreign_dignitary", answers.is_foreign_dignitary],
    ["foreign_dignitary", answers.foreign_dignitary],
    ["foreign_dignitary_delegation", answers.foreign_dignitary_delegation],
    ["is_foreign_dignitary_delegation", answers.is_foreign_dignitary_delegation],
    ["foreign_delegation", answers.foreign_delegation],
    ["is_9e_visa_holder", answers.is_9e_visa_holder],
    ["visa_9e", answers.visa_9e],
    ["has_9e_visa", answers.has_9e_visa],
    ["is_official_passport_holder", answers.is_official_passport_holder],
    ["official_passport_holder", answers.official_passport_holder],
    ["service_passport_holder", answers.service_passport_holder],
    ["diplomatic_passport_holder", answers.diplomatic_passport_holder],
  ];
  if (/flight[\s_]*crew|aircraft[\s_]*crew|vessel[\s_]*crew|cruise[\s_]*crew|\bcrew\b/i.test(combined)) unsupported.push("traveller_type");
  if (/cruise[\s_]*passenger|cruise[\s_]*travel|new-cruise-travel-declaration/i.test(combined)) unsupported.push("cruise");
  if (/special[\s_]*(?:travel[\s_]*)?(?:registration|declaration)|special-travel-declaration/i.test(combined)) unsupported.push("special_registration");
  if (/\b9[\s_]*\(?e\)?\b|9E|diplomat|diplomatic|dependent|\bofficial\b|official[\s_]*passport|service[\s_]*passport|dignitar|delegation/i.test(combined)) unsupported.push("official_exemption_status");
  for (const [key, value] of flags) {
    if (boolAnswer(value)) unsupported.push(key);
  }
  return Array.from(new Set(unsupported));
}

function customsChecklistResponses(answers: Record<string, unknown>): Array<{
  itemNumber: number;
  key: string;
  response: boolean;
  details: string | null;
}> {
  const responses = [];
  for (let itemNumber = 1; itemNumber <= 12; itemNumber += 1) {
    const key = `customs_checklist_${itemNumber}`;
    if (!(key in answers)) continue;
    responses.push({
      itemNumber,
      key,
      response: boolAnswer(answers[key]),
      details: firstText([
        answers[`${key}_details`],
        answers[`customs_checklist_details_${itemNumber}`],
      ]) || null,
    });
  }
  return responses;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parsedJsonValue(value: unknown): unknown {
  const raw = text(value);
  if (!raw || !/^[\[{]/.test(raw)) return value;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return value;
  }
}

function repeatedObjectRows(
  answers: Record<string, unknown>,
  arrayKeys: string[],
  fieldAliases: Record<string, string[]>,
): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  for (const key of arrayKeys) {
    const value = parsedJsonValue(answers[key]);
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      const record = objectRecord(entry);
      if (!record) continue;
      const row: Record<string, string> = {};
      for (const [target, aliases] of Object.entries(fieldAliases)) {
        row[target] = firstText(aliases.map((alias) => record[alias]));
      }
      if (Object.values(row).some(Boolean)) rows.push(row);
    }
  }

  const indexed = new Map<string, Record<string, string>>();
  for (const [target, aliases] of Object.entries(fieldAliases)) {
    for (const alias of aliases) {
      for (const [answerKey, value] of Object.entries(answers)) {
        if (answerKey !== alias && !answerKey.startsWith(`${alias}__`)) continue;
        const normalized = text(value);
        if (!normalized) continue;
        const suffix = answerKey === alias ? "0" : answerKey.slice(alias.length + 2);
        const row = indexed.get(suffix) ?? {};
        row[target] = normalized;
        indexed.set(suffix, row);
      }
    }
  }

  return [
    ...rows,
    ...Array.from(indexed.entries())
      .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
      .map(([, row]) => row),
  ];
}

function normalizeGoodsItems(
  answers: Record<string, unknown>,
  positiveChecklistItemNumbers: number[],
): PhEtravelGoodsItem[] {
  return repeatedObjectRows(answers, ["goods_items", "customs_goods_items"], {
    description: ["description", "goods_item_description", "customs_goods_item_description"],
    quantity: ["quantity", "goods_item_quantity", "customs_goods_item_quantity"],
    amountUsd: ["amount_usd", "amountInUsd", "amount", "value", "goods_item_value", "goods_item_amount_usd", "goods_item_amount"],
    checklistItemNumber: ["checklist_item_number", "customs_checklist_item_number", "general_declaration_item_number"],
  })
    .filter((row) => row.description || row.quantity || row.amountUsd)
    .map((row) => {
      const explicitlyAssociated = Number(row.checklistItemNumber);
      const checklistItemNumber = Number.isInteger(explicitlyAssociated) &&
        explicitlyAssociated >= 3 && explicitlyAssociated <= 12 &&
        positiveChecklistItemNumbers.includes(explicitlyAssociated)
        ? explicitlyAssociated
        // A legacy aggregate row is unambiguous only when exactly one goods
        // checklist item is Yes. Multiple Yes branches must carry their own
        // local association instead of being assigned by runner guesswork.
        : positiveChecklistItemNumbers.length === 1
          ? positiveChecklistItemNumbers[0]
          : undefined;
      return {
        description: row.description ?? "",
        quantity: row.quantity ?? "",
        amountUsd: row.amountUsd ?? "",
        ...(checklistItemNumber ? { checklistItemNumber } : {}),
      };
    });
}

function hasPositiveGoodsAmount(value: unknown): boolean {
  const normalized = text(value).replace(/,/g, "");
  return /^\d+(?:\.\d+)?$/.test(normalized) && Number(normalized) > 0;
}

function normalizeCurrencyItems(answers: Record<string, unknown>): PhEtravelCurrencyItem[] {
  return repeatedObjectRows(answers, ["currency_items", "monetary_instruments"], {
    currency: ["currency", "currency_name", "currency_type", "currency_item_currency"],
    monetaryInstrument: ["monetary_instrument", "instrument", "currency_monetary_instrument", "currency_item_monetary_instrument"],
    amount: ["amount", "currency_amount", "currency_item_amount"],
  })
    .filter((row) => row.currency || row.monetaryInstrument || row.amount)
    .map((row) => ({
      // E13/E45 establish the public API numeric id as the only confirmed
      // submission-code source. Rendered labels and client list ids are not
      // portable official values.
      currency: /^\d+$/.test(row.currency ?? "") ? row.currency ?? "" : "",
      monetaryInstrument: /^\d+$/.test(row.monetaryInstrument ?? "") ? row.monetaryInstrument ?? "" : "",
      amount: row.amount ?? "",
    }));
}

function repeatedTexts(answers: Record<string, unknown>, aliases: string[]): string[] {
  const values: string[] = [];
  for (const alias of aliases) {
    const raw = parsedJsonValue(answers[alias]);
    if (Array.isArray(raw)) {
      values.push(...raw.map(text).filter(Boolean));
    }
    for (const [key, value] of Object.entries(answers)) {
      if (key !== alias && !key.startsWith(`${alias}__`)) continue;
      const normalized = text(value);
      if (normalized) values.push(normalized);
    }
  }
  return Array.from(new Set(values));
}

function currencyPartyFromAnswers(
  answers: Record<string, unknown>,
  prefix: "currency_owner" | "currency_recipient",
): PhEtravelCurrencyParty | null {
  const party: PhEtravelCurrencyParty = {
    businessName: firstText([answers[`${prefix}_business_name`], answers[`${prefix}_business`]]) || null,
    firstName: firstText([answers[`${prefix}_first_name`], answers[`${prefix}_given_name`]]) || null,
    middleName: firstText([answers[`${prefix}_middle_name`]]) || null,
    lastName: firstText([answers[`${prefix}_last_name`], answers[`${prefix}_family_name`], answers[`${prefix}_surname`]]) || null,
    suffix: firstText([answers[`${prefix}_suffix`]]) || null,
    occupationOrBusinessActivity: firstText([
      answers[`${prefix}_occupation`],
      answers[`${prefix}_business_activity`],
      answers[`${prefix}_occupation_or_business_activity`],
    ]) || null,
    country: firstText([answers[`${prefix}_country`], answers[`${prefix}_country_code`]]) || null,
    address: firstText([answers[`${prefix}_address`], answers[`${prefix}_street_address`]]) || null,
    postalCode: firstText([answers[`${prefix}_postal_code`], answers[`${prefix}_zip_code`]]) || null,
  };
  return Object.values(party).some(Boolean) ? party : null;
}

function normalizeCurrencyTransportMethod(value: unknown): PhEtravelCurrencyTransportMethod | null {
  const normalized = normalizeCode(value);
  if (/PHYSICAL|PHYSICALLY|PERSON|HAND_CARRY|CARRIED/.test(normalized)) return "is_physically_transferred_by_person";
  if (/COURIER|SHIPPED|SHIPMENT|AIRWAY|CARGO/.test(normalized)) return "is_shipped_thru_courier_service";
  return null;
}

function dialCodeFromPhone(value: unknown): string {
  const normalized = text(value);
  if (!normalized) return "";
  const plusMatch = normalized.match(/^\s*(\+\d{1,4})(?:\D|$)/);
  if (plusMatch) return plusMatch[1];

  const noSignDigits = normalized.replace(/\D/g, "");
  const zeroPrefixMatch = noSignDigits.match(/^00(\d{1,4})/);
  if (zeroPrefixMatch) {
    return `+${zeroPrefixMatch[1]}`;
  }
  return "";
}

function phoneWithoutDialCode(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const countryCode = dialCodeFromPhone(value).replace("+", "");
  return countryCode && digits.startsWith(countryCode) ? digits.slice(countryCode.length) : digits;
}

function optionalCount(value: unknown, enabled: boolean): string | null {
  const normalized = text(value);
  return enabled && normalized ? normalized : null;
}

function combineNameParts(input: {
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  fallback?: string;
}): string {
  const parts = [input.firstName, input.middleName, input.lastName, input.suffix]
    .map((part) => text(part))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : text(input.fallback);
}

export function normalizePhEtravelPortalPayload(
  payload: SubmissionPayload,
  options: { now?: Date } = {},
): PhEtravelPortalPayload {
  if (payload.countryCode !== "PH") {
    throw new PhEtravelPortalValidationError(
      `Philippines eTravel runner only accepts PH payloads; got ${payload.countryCode}.`,
      ["countryCode"],
    );
  }
  const isDeparture = payload.visaType === "PH_ETRAVEL_DEPARTURE_CARD";
  if (payload.visaType !== "PH_ETRAVEL_ARRIVAL_CARD" && !isDeparture) {
    throw new PhEtravelPortalValidationError(
      `Philippines eTravel runner only accepts PH_ETRAVEL_ARRIVAL_CARD or PH_ETRAVEL_DEPARTURE_CARD payloads; got ${payload.visaType}.`,
      ["visaType"],
    );
  }

  const answers = payload.countrySpecific;
  const missing: string[] = [];
  if (payload.metadata.runnerJob === true && normalizeCode(answers.travel_type) !== "ARRIVAL") {
    missing.push("travel_type");
  }
  const unsupported = !isDeparture ? unsupportedArrivalBranchFields(answers) : [];
  if (unsupported.length > 0) {
    throw new PhEtravelPortalValidationError(
      `Philippines eTravel arrival branch is not supported for: ${unsupported.join(", ")}.`,
      unsupported,
    );
  }
  const transportType = normalizeTransportType(answers.transport_type);
  const passportHolderType = normalizePassportHolderType(answers, payload);
  if (!transportType) missing.push("transport_type");
  if (!passportHolderType) missing.push("passport_holder_type");
  const arrivalTravellerType = transportType
    ? normalizeArrivalPassengerType(firstText([answers.traveller_type, answers.passenger_type]), transportType)
    : "";
  if (!isDeparture && !arrivalTravellerType) missing.push("traveller_type");
  const dateKeys = phEtravelDateFieldKeys({ isDeparture, transportType });
  const arrivalDate = firstIsoDate(
    !isDeparture && transportType === "SEA"
      ? [answers.voyage_arrival_date]
      : [answers.flight_arrival_date, answers.arrival_date, payload.trip.arrivalDate],
    dateKeys.arrivalDateKey,
    missing,
  );
  const departureDate = firstIsoDate(
    !isDeparture && transportType === "SEA"
      ? [answers.voyage_departure_date]
      : [answers.flight_departure_date, answers.departure_date, payload.trip.departureDate],
    dateKeys.departureDateKey,
    missing,
  );
  const windowDate = isDeparture ? departureDate : arrivalDate;
  const window = evaluatePhEtravelSubmissionWindow(windowDate, options.now);
  if (window.status !== "open") {
    const reason = window.status === "scheduled"
      ? `Philippines eTravel may normally be submitted only within 72 hours before ${isDeparture ? "departure" : "arrival"}; earliest date is ${window.earliestSubmissionDate}.`
      : window.status === "past"
        ? `Philippines eTravel ${isDeparture ? "departure" : "arrival"} date is already past.`
        : `Philippines eTravel ${isDeparture ? "departure" : "arrival"} date must use YYYY-MM-DD.`;
    throw new PhEtravelPortalValidationError(reason, [isDeparture ? dateKeys.departureDateKey : dateKeys.arrivalDateKey]);
  }

  const finalDeclaration = boolAnswer(answers.final_declaration);
  if (!finalDeclaration) {
    throw new PhEtravelPortalValidationError(
      "Philippines eTravel final declaration must be accepted before live submission.",
      ["final_declaration"],
    );
  }

  const checkedBaggageCount = firstText([answers.checked_baggage_count]);
  const handcarryBaggageCount = firstText([answers.handcarry_baggage_count]);
  const hasCheckedBaggage = boolAnswer(answers.has_checked_baggage) || checkedBaggageCount !== "" && checkedBaggageCount !== "0";
  const hasHandcarryBaggage = boolAnswer(answers.has_handcarry_baggage) || handcarryBaggageCount !== "" && handcarryBaggageCount !== "0";
  const hasBaggageOrCurrencyToDeclare = boolAnswer(answers.has_baggage_or_currency_to_declare);
  const generalDeclarationResponses = customsChecklistResponses(answers);
  const hasGoodsChecklistPositive = generalDeclarationResponses.some((item) => item.itemNumber >= 3 && item.response);
  const hasCurrencyChecklistPositive = generalDeclarationResponses.some((item) => item.itemNumber <= 2 && item.response);
  const hasDutiableGoods = boolAnswer(answers.has_dutiable_goods) || hasGoodsChecklistPositive;
  const hasCurrencyOverThreshold = boolAnswer(answers.has_currency_over_threshold) || hasCurrencyChecklistPositive;
  const positiveGoodsChecklistItemNumbers = generalDeclarationResponses
    .filter((item) => item.itemNumber >= 3 && item.response)
    .map((item) => item.itemNumber);
  const goodsItems = normalizeGoodsItems(answers, positiveGoodsChecklistItemNumbers);
  const currencyItems = normalizeCurrencyItems(answers);
  const currencySources = repeatedTexts(answers, ["currency_source", "currency_sources", "source_of_currency"]);
  const currencyTransportPurposes = repeatedTexts(answers, [
    "currency_transport_purpose",
    "currency_transport_purposes",
    "purpose_of_currency_transport",
  ]);
  const currencyTransportMethod = normalizeCurrencyTransportMethod(firstText([
    answers.currency_transport_method,
    answers.currency_transfer_method,
    answers.currency_physical_or_courier,
  ]));
  const hasCompleteCurrencyItem = currencyItems.some((item) => item.currency && item.monetaryInstrument && item.amount);
  if (
    hasPositiveGoodsAmount(firstText([answers.amount_of_goods_amount, answers.goods_amount])) &&
    positiveGoodsChecklistItemNumbers.length === 0
  ) {
    missing.push("customs_checklist_3_to_12");
  }
  if (hasCurrencyChecklistPositive || boolAnswer(answers.has_currency_to_declare)) {
    if (!hasCompleteCurrencyItem) missing.push("currency_items");
    if (currencySources.length === 0) missing.push("currency_sources");
    if (currencyTransportPurposes.length === 0) missing.push("currency_transport_purposes");
    if (!currencyTransportMethod) missing.push("currency_transport_method");
    if (currencyTransportMethod === "is_physically_transferred_by_person") {
      if (!text(answers.no_of_days_in_philippines)) missing.push("no_of_days_in_philippines");
      if (!normalizeOptionalIsoDate(answers.last_travel_to_philippines)) missing.push("last_travel_to_philippines");
    }
    if (currencyTransportMethod === "is_shipped_thru_courier_service") {
      if (!text(answers.courier_name)) missing.push("courier_name");
      if (!text(answers.airway_bill_number ?? answers.airway_bill_no)) missing.push("airway_bill_number");
      if (!normalizeOptionalIsoDate(answers.airway_bill_date)) missing.push("airway_bill_date");
    }
  }
  const hasRecentTravelHistory30d = requiredYesNoAnswer(
    answers,
    ["has_recent_travel_history_30d", "with_recent_travel_history"],
    "has_recent_travel_history_30d",
    missing,
  );
  const hasExposureToSickPerson30d = requiredYesNoAnswer(
    answers,
    ["has_exposure_to_sick_person_30d", "is_with_history_exposure"],
    "has_exposure_to_sick_person_30d",
    missing,
  );
  const hasBeenSick30d = requiredYesNoAnswer(
    answers,
    ["has_been_sick_30d", "is_sicked_within_thirty_days"],
    "has_been_sick_30d",
    missing,
  );
  const hasHealthSymptoms = hasRecentTravelHistory30d || hasExposureToSickPerson30d || hasBeenSick30d;
  const repeatedValues = (base: string): string[] => Object.entries(answers)
    .filter(([key, value]) => (key === base || key.startsWith(`${base}__`)) && text(value))
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([, value]) => text(value))
    .filter((value, index, values) => values.indexOf(value) === index);
  const visitedCountries30d = hasRecentTravelHistory30d ? repeatedValues("visited_country_30d") : [];
  const sicknessSymptoms = hasBeenSick30d ? repeatedValues("sickness_symptom") : [];
  if (hasRecentTravelHistory30d && visitedCountries30d.length === 0) missing.push("visited_country_30d");
  if (hasBeenSick30d && sicknessSymptoms.length === 0) missing.push("sickness_symptom");
  const firstName = firstText([answers.first_name, answers.given_name]);
  const middleName = firstText([answers.middle_name, answers.middle_names]) || null;
  const lastName = firstText([answers.last_name, answers.family_name, answers.surname]) || null;
  const suffix = firstText([answers.suffix, answers.extension_name]) || null;
  const fullName = combineNameParts({
    firstName,
    middleName,
    lastName,
    suffix,
    fallback: firstText([answers.full_name, payload.personal.fullName]),
  });
  if (!firstName) missing.push("first_name");
  const hasTransit = boolAnswer(answers.with_transit);
  const isSeaArrival = !isDeparture && transportType === "SEA";
  const hasDisembarkingAnswer = text(answers.is_disembarking) !== "";
  const isDisembarking = isSeaArrival
    ? hasDisembarkingAnswer && boolAnswer(answers.is_disembarking)
      ? true
      : null
    : null;
  if (isSeaArrival && isDisembarking !== true) missing.push("is_disembarking");
  const hasArrivalDestinationBranch = !isDeparture && (!isSeaArrival || isDisembarking === true);
  // `destination_port_code` selects the SEA arrival customs-flow metadata.
  // `disembarking_port_code` belongs only to the conditional stay-location
  // branch and must never stand in for the arrival seaport.
  const seaDestinationPortCode = isSeaArrival
    ? requireOfficialOptionCode([answers.destination_port_code], "destination_port_code", missing)
    : null;
  const destinationType = hasArrivalDestinationBranch
    ? firstText([answers.destination_type]) || null
    : null;
  if (hasArrivalDestinationBranch && !destinationType) missing.push("destination_type");
  const isTransitDestination = /transit/i.test(destinationType ?? "");
  const isTravelPortDestination = /travel[_\s-]?port/i.test(destinationType ?? "");
  const needsPhilippinesAddress = hasArrivalDestinationBranch && !isTransitDestination && !isTravelPortDestination;
  const philippinesAddress = needsPhilippinesAddress
    ? requireFirstText(
        [
          answers.philippines_address,
          answers.destination_residence_address,
          answers.destination_hotel_address,
          answers.destination_hotel_name,
          answers.destination_transit_airport,
          payload.trip.accommodationAddress,
        ],
        "destination_type",
        missing,
      )
    : null;

  let residence: PhEtravelResidenceAddress | null = null;
  try {
    residence = normalizePhEtravelResidenceAddress(answers, payload.personal.address);
  } catch (error) {
    if (!(error instanceof PhEtravelResidenceValidationError)) throw error;
    missing.push(...error.missingFields);
  }

  const isSpecialFlight = boolAnswer(answers.is_special_flight) || text(answers.flight_number).toUpperCase() === "SPECIAL FLIGHT";
  const isAirArrival = !isDeparture && transportType === "AIR";
  const airFlightCode = isAirArrival && !isSpecialFlight
    ? requireOfficialOptionCode(
      [answers.flight_code, answers.selected_flight_code, answers.air_flight_code],
      "flight_code",
      missing,
    )
    : null;
  const airCompanyCode = isAirArrival
    ? requireOfficialOptionCode([answers.travel_company_code, answers.airline_code], "travel_company_code", missing)
    : null;

  const mapped = {
    fullName,
    firstName,
    middleName,
    lastName,
    suffix,
    passportNumber: requireFirstText(
      [answers.passport_number, payload.personal.passportNumber],
      "passport_number",
      missing,
    ),
    passportIssueDate: requireFirstText(
      [answers.passport_issue_date, payload.personal.passportIssueDate],
      "passport_issue_date",
      missing,
    ),
    passportExpiryDate: requireFirstText(
      [answers.passport_expiry_date, payload.personal.passportExpiryDate],
      "passport_expiry_date",
      missing,
    ),
    passportIssuingAuthority: requireFirstText(
      [
        answers.passport_issuing_authority,
        answers.passport_issuing_country,
        payload.personal.passportIssuingCountry,
      ],
      "passport_issuing_authority",
      missing,
    ),
    nationality: requireFirstText([answers.nationality, payload.personal.nationality], "nationality", missing),
    countryOfBirth: requireFirstText([answers.country_of_birth], "country_of_birth", missing),
    countryOfResidence: requireFirstText([answers.country_of_residence], "country_of_residence", missing),
    residence: residence as PhEtravelResidenceAddress,
    residenceAddressLine1: firstText([
      answers.residence_address_line1,
      answers.residential_address,
      answers.home_address,
      answers.home_address_line1,
      answers.address,
      payload.personal.address,
    ]) || null,
    residenceAddressLine2: firstText([
      answers.residence_address_line2,
      answers.home_address_line2,
    ]) || null,
    residenceAddress: [
      firstText([
        answers.residence_address_line1,
        answers.residential_address,
        answers.home_address,
        answers.home_address_line1,
        answers.address,
        payload.personal.address,
      ]),
      firstText([
        answers.residence_address_line2,
        answers.home_address_line2,
      ]),
    ].filter(Boolean).join(", ") || null,
    occupation: requireFirstText([answers.occupation, payload.personal.occupation], "occupation", missing),
    dateOfBirth: requireFirstText([answers.date_of_birth, payload.personal.dateOfBirth], "date_of_birth", missing),
    sex: requireFirstText([answers.sex, payload.personal.gender], "sex", missing),
    emailAddress: requireFirstText([answers.email_address, payload.personal.email], "email_address", missing),
    mobileCountryCode: requireFirstText(
      [answers.mobile_country_code, dialCodeFromPhone(payload.personal.phone)],
      "mobile_country_code",
      missing,
    ),
    mobileNumber: requireFirstText(
      [answers.mobile_number, phoneWithoutDialCode(payload.personal.phone)],
      "mobile_number",
      missing,
    ),
    travelType: isDeparture ? "DEPARTURE" : "ARRIVAL",
    transportType: transportType || requireFirstText([answers.transport_type], "transport_type", missing),
    passportHolderType,
    arrivalBranch: isDeparture ? null : {
      transportType: transportType as "AIR" | "SEA",
      passportHolderType: passportHolderType as "FILIPINO" | "FOREIGNER",
      travellerType: arrivalTravellerType as "AIRCRAFT_PASSENGER" | "VESSEL_PASSENGER",
    },
    registrationFor: firstText([answers.registration_for]) || null,
    registrationConsent: registrationConsentFromMetadata(payload.metadata),
    isSpecialFlight,
    isDisembarking,
    travellerType: isDeparture ? firstText([answers.traveller_type]) || null : arrivalTravellerType,
    flightNumber: requireFirstText(
      [
        isSpecialFlight
          ? firstText([answers.flight_number_special, answers.special_flight_number])
          : isAirArrival ? airFlightCode : answers.flight_number === "OTHER" ? answers.flight_number_other : answers.flight_number,
        answers.voyage_number,
        answers.vessel_name,
        answers.vehicle_or_vessel_number,
        answers.transport_number,
      ],
      "flight_number",
      missing,
    ),
    airlineOrVesselName: isAirArrival
      ? airCompanyCode
      : isSeaArrival ? firstText([
        answers.vessel_name,
        answers.airline_or_vessel_name,
        answers.airline_name === "OTHERS" ? answers.airline_name_other : answers.airline_name,
        answers.travel_company_code,
      ]) || null : firstText([
        answers.airline_name === "OTHERS" ? answers.airline_name_other : answers.airline_name,
        answers.travel_company_code,
        answers.vessel_name,
        answers.airline_or_vessel_name,
      ]) || null,
    airlineCode: airCompanyCode,
    airlineName: isAirArrival ? firstText([answers.travel_company_name, answers.airline_name]) || null : null,
    flightCode: airFlightCode,
    flightName: isAirArrival && !isSpecialFlight
      ? firstText([answers.flight_name, answers.selected_flight_name, answers.air_flight_name]) || null
      : null,
    airportOfOrigin: firstText([
      answers.airport_of_origin,
      answers.origin_port,
      answers.origin_port_code,
      answers.seaport_of_origin,
    ]) || null,
    portOfEntry: isSeaArrival
      ? seaDestinationPortCode!
      : requireFirstText(
          isDeparture
            ? [answers.departure_airport, answers.departure_seaport]
            : [answers.port_of_entry, answers.destination_port_code],
          isDeparture ? "departure_port" : "port_of_entry",
          missing,
        ),
    arrivalDate,
    departureDate,
    originCountry: isDeparture
      ? "PH"
      : requireFirstText(
          [answers.origin_country, answers.country_of_residence, payload.personal.nationality],
          "origin_country",
          missing,
        ),
    purposeOfTravel: isDeparture
      ? requireFirstText(
        [answers.purpose_of_travel, answers.purpose_of_visit, payload.trip.purpose],
        "purpose_of_travel",
        missing,
      )
      : requireCurrentArrivalPurposeCode(
        [answers.purpose_of_travel, answers.purpose_of_visit],
        missing,
      ),
    withTransit: hasTransit,
    transitCountry: hasTransit ? requireFirstText([answers.transit_country], "transit_country", missing) : null,
    transitAirport: hasTransit ? requireFirstText([answers.transit_airport], "transit_airport", missing) : null,
    transitDate: hasTransit ? firstIsoDate([answers.transit_date], "transit_date", missing) : null,
    destinationType,
    destinationTransitAirport: isTransitDestination
      ? requireFirstText([answers.destination_transit_airport], "destination_transit_airport", missing)
      : null,
    destinationCountry: isDeparture
      ? requireFirstText([answers.destination_country], "destination_country", missing)
      : isTransitDestination
        ? requireFirstText([answers.destination_country], "destination_country", missing)
        : null,
    destinationPort: isDeparture
      ? requireFirstText([answers.destination_port], "destination_port", missing)
      : isTravelPortDestination
        ? requireFirstText([answers.disembarking_port_code, answers.destination_port], "disembarking_port_code", missing)
        : firstText([answers.disembarking_port_code, answers.destination_port]) || null,
    destinationAddress: isDeparture
      ? requireFirstText([answers.destination_address, answers.residence_address], "destination_address", missing)
      : null,
    philippinesAddress,
    returnDate: firstIsoDate([answers.return_date], "return_date", []) || null,
    travelTaxPaymentType: firstText([answers.travel_tax_payment_type]) || null,
    travelTaxReferenceNumber: firstText([answers.travel_tax_reference_number]) || null,
    travelTaxTicketNumber: firstText([answers.travel_tax_ticket_number]) || null,
    cfoRegistrationNumber: firstText([answers.cfo_registration_number]) || null,
    accompaniedUnder18Count: firstText([answers.accompanied_under_18_count]) || null,
    accompanied18PlusCount: firstText([answers.accompanied_18_plus_count]) || null,
    firstTimeVisitingPhilippines: text(answers.first_time_visiting_philippines)
      ? boolAnswer(answers.first_time_visiting_philippines)
      : null,
    healthSymptomsDetails: sicknessSymptoms.join(", ") || null,
  };

  if (missing.length > 0) {
    throw new PhEtravelPortalValidationError(`Philippines eTravel payload is missing: ${missing.join(", ")}`, missing);
  }

  const currencyOwnerBranch = normalizePhEtravelCurrencyOwnerBranch({
    ownerNotApplicable: boolAnswer(answers.currency_owner_not_applicable),
    owner: currencyPartyFromAnswers(answers, "currency_owner"),
    recipient: currencyPartyFromAnswers(answers, "currency_recipient"),
  });

  return {
    countryCode: "PH",
    visaType: payload.visaType as PhEtravelPortalPayload["visaType"],
    applicationId: payload.applicationId,
    ...mapped,
    hasHealthSymptoms,
    hasRecentTravelHistory30d,
    visitedCountries30d,
    hasExposureToSickPerson30d,
    hasBeenSick30d,
    sicknessSymptoms,
    customs: {
      hasCheckedBaggage,
      checkedBaggageCount: optionalCount(answers.checked_baggage_count, hasCheckedBaggage),
      hasHandcarryBaggage,
      handcarryBaggageCount: optionalCount(answers.handcarry_baggage_count, hasHandcarryBaggage),
      hasDutiableGoods,
      dutiableGoodsDetails: hasDutiableGoods ? text(answers.dutiable_goods_details) || null : null,
      hasCurrencyOverThreshold,
      currencyDeclarationDetails: hasCurrencyOverThreshold
        ? text(answers.currency_declaration_details) || null
        : null,
      hasBaggageOrCurrencyToDeclare,
      customsSignatureFile: text(answers.customs_signature_file) || null,
      customsInformationAcknowledgement: boolAnswer(answers.customs_information_acknowledgement),
      hasGoodsToDeclare: boolAnswer(answers.has_goods_to_declare) || hasGoodsChecklistPositive || hasDutiableGoods,
      hasCurrencyToDeclare: boolAnswer(answers.has_currency_to_declare) || hasCurrencyChecklistPositive || hasCurrencyOverThreshold,
      amountOfGoodsCurrency: firstText([
        answers.amount_of_goods_currency,
        answers.goods_currency,
      ]) || null,
      amountOfGoodsAmount: firstText([
        answers.amount_of_goods_amount,
        answers.goods_amount,
      ]) || null,
      generalDeclarationResponses,
      goodsItems,
      currencyType: firstText([answers.currency_type]) || null,
      currencyAmount: firstText([answers.currency_amount]) || null,
      currencySource: firstText([answers.currency_source]) || null,
      currencyOwnerNotApplicable: currencyOwnerBranch.ownerNotApplicable,
      currencyOwner: currencyOwnerBranch.owner,
      currencyRecipient: currencyOwnerBranch.recipient,
      currencyItems,
      bspAuthorizationNumber: firstText([answers.bsp_authorization_number]) || null,
      bspAuthorizationDate: normalizeOptionalIsoDate(answers.bsp_authorization_date),
      currencySources,
      currencySourceOther: firstText([answers.currency_source_other, answers.source_of_currency_other]) || null,
      currencyTransportPurposes,
      currencyTransportPurposeOther: firstText([
        answers.currency_transport_purpose_other,
        answers.purpose_of_currency_transport_other,
      ]) || null,
      currencyTransportMethod,
      noOfDaysInPhilippines: firstText([answers.no_of_days_in_philippines]) || null,
      lastTravelToPhilippines: normalizeOptionalIsoDate(answers.last_travel_to_philippines),
      courierName: firstText([answers.courier_name]) || null,
      airwayBillNumber: firstText([answers.airway_bill_number, answers.airway_bill_no]) || null,
      airwayBillDate: normalizeOptionalIsoDate(answers.airway_bill_date),
      customsSignatureDeclaration: boolAnswer(answers.customs_signature_declaration),
    },
    finalDeclaration,
  };
}
