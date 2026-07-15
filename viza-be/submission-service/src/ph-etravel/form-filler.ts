import type { Locator, Page } from "@playwright/test";
import type { PhEtravelPortalPayload } from "./normalize";

export type PhEtravelFieldKind = "text" | "date" | "choice" | "checkbox" | "file";

export interface PhEtravelFieldPlanItem {
  key: string;
  labels: string[];
  kind: PhEtravelFieldKind;
  value: string | boolean | null;
  required?: boolean;
}

export interface PhEtravelFormFillResult {
  reachedReview: boolean;
  submitted: boolean;
  portalText: string;
  filledFields: string[];
}

export class PhEtravelFormFillError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly portalSummary: string,
  ) {
    super(message);
    this.name = "PhEtravelFormFillError";
  }
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function optionLabel(value: string | null): string | null {
  if (!value) return null;
  const aliases: Record<string, string> = {
    FOR_ME: "For me",
    FOR_OTHER: "For other",
    AIR: "Air",
    SEA: "Sea",
    ARRIVAL: "Arrival",
    DEPARTURE: "Departure",
    MALE: "Male",
    FEMALE: "Female",
    HOLIDAY: "Holiday / Vacation",
    BUSINESS: "Business / Professional",
    VISIT_FRIENDS_RELATIVES: "Visit Friends / Relatives",
    RETURNING_RESIDENT: "Returning Resident",
    TRADE_FAIR_EXHIBITION: "Trade Fair / Exhibition",
    HOTEL_RESORT: "Hotel/Resort",
    TRANSIT_VIA_AIRPORT: "Transit Via Airport",
    PHILIPPINE_AIRLINES: "Philippine Airlines",
    CEBU_PACIFIC: "Cebu Pacific",
    SINGAPORE_AIRLINES: "Singapore Airlines",
    STUDENT_MINOR: "Student/Minor",
    PROFESSIONAL_TECHNICAL_ADMIN: "Professional/Technical/Administrative",
    AIRCRAFT_PASSENGER: "Aircraft Passenger",
    FLIGHT_CREW: "Flight Crew",
  };
  return aliases[value.toUpperCase()] ?? value.replace(/_/g, " ");
}

function yesNo(value: boolean | null): string | null {
  return value === null ? null : value ? "Yes" : "No";
}

const OFFICIAL_COMMON_API = "https://ws.etravel.gov.ph/api/v1/common";

async function loadOfficialLabelMap(path: string): Promise<Record<string, string>> {
  const response = await fetch(`${OFFICIAL_COMMON_API}/${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return {};
  const payload = await response.json() as { data?: Array<{ code?: unknown; name?: unknown }> };
  return Object.fromEntries((payload.data ?? []).flatMap((item) =>
    typeof item.code === "string" && typeof item.name === "string" ? [[item.code, item.name]] : [],
  ));
}

async function loadOfficialLabels(): Promise<Record<string, string>> {
  const paths = [
    "countries?paginate=0&order_by=name&status_by=asc",
    "occupations?paginate=0&order_by=name&status_by=asc",
    "purpose_of_visits?paginate=0&for_arrival=1&order_by=name&status_by=asc",
    "travel_companies?paginate=0&order_by=name&status_by=asc&transportation_type=AIR",
    "travel_ports?paginate=0&order_by=name&status_by=asc&transportation_type=AIR",
    "sickness_symptoms?paginate=0&order_by=name&status_by=asc&is_active=1",
  ];
  const maps = await Promise.all(paths.map((path) => loadOfficialLabelMap(path).catch(() => ({}))));
  return Object.assign({}, ...maps);
}

function resolvedOptionLabel(value: string | null, officialLabels: Record<string, string>): string | null {
  return value ? officialLabels[value] ?? optionLabel(value) : null;
}

export function buildPhEtravelFieldPlan(
  payload: PhEtravelPortalPayload,
  officialLabels: Record<string, string> = {},
): PhEtravelFieldPlanItem[] {
  return [
    { key: "registration_for", labels: ["Travel Registration", "Registration For"], kind: "choice", value: optionLabel(payload.registrationFor ?? "FOR_ME"), required: true },
    { key: "transport_type", labels: ["Mode of Travel", "Transport Type"], kind: "choice", value: optionLabel(payload.transportType), required: true },
    { key: "travel_type", labels: ["Travel Type"], kind: "choice", value: optionLabel(payload.travelType), required: true },
    { key: "is_special_flight", labels: ["Special Flight"], kind: "checkbox", value: payload.isSpecialFlight },
    { key: "first_name", labels: ["First Name", "Given Name"], kind: "text", value: payload.firstName, required: true },
    { key: "middle_name", labels: ["Middle Name"], kind: "text", value: payload.middleName },
    { key: "last_name", labels: ["Last Name", "Surname", "Family Name"], kind: "text", value: payload.lastName, required: true },
    { key: "suffix", labels: ["Suffix"], kind: "choice", value: optionLabel(payload.suffix) },
    { key: "passport_number", labels: ["Passport Number"], kind: "text", value: payload.passportNumber, required: true },
    { key: "passport_issue_date", labels: ["Passport Issued Date", "Passport Issue Date"], kind: "date", value: payload.passportIssueDate, required: true },
    { key: "passport_expiry_date", labels: ["Passport Expiry Date", "Passport Expiration Date"], kind: "date", value: payload.passportExpiryDate, required: true },
    { key: "passport_issuing_authority", labels: ["Passport Issuing Authority", "Country of Issue"], kind: "choice", value: resolvedOptionLabel(payload.passportIssuingAuthority, officialLabels), required: true },
    { key: "nationality", labels: ["Citizenship", "Nationality"], kind: "choice", value: resolvedOptionLabel(payload.nationality, officialLabels), required: true },
    { key: "country_of_birth", labels: ["Country of Birth"], kind: "choice", value: resolvedOptionLabel(payload.countryOfBirth, officialLabels), required: true },
    { key: "country_of_residence", labels: ["Permanent Country of Residence", "Country of Residence"], kind: "choice", value: resolvedOptionLabel(payload.countryOfResidence, officialLabels), required: true },
    { key: "residence_address", labels: ["Permanent Address", "Residence Address", "No./Bldg./City/State/Province"], kind: "text", value: payload.residenceAddress },
    { key: "occupation", labels: ["Occupation"], kind: "choice", value: resolvedOptionLabel(payload.occupation, officialLabels), required: true },
    { key: "date_of_birth", labels: ["Birth Date", "Date of Birth"], kind: "date", value: payload.dateOfBirth, required: true },
    { key: "sex", labels: ["Sex", "Gender"], kind: "choice", value: optionLabel(payload.sex), required: true },
    { key: "email", labels: ["Email Address", "Email"], kind: "text", value: payload.emailAddress, required: true },
    { key: "mobile", labels: ["Mobile Number", "Contact Number"], kind: "text", value: `${payload.mobileCountryCode}${payload.mobileNumber}`, required: true },
    { key: "traveller_type", labels: ["Traveller Type", "Traveler Type"], kind: "choice", value: optionLabel(payload.travellerType ?? "AIRCRAFT PASSENGER") },
    { key: "airline", labels: ["Airline Name", "Name of Airline/Vessel"], kind: "choice", value: resolvedOptionLabel(payload.airlineOrVesselName, officialLabels) },
    { key: "flight_number", labels: ["Flight Number", "Vehicle/Vessel Number"], kind: "text", value: payload.flightNumber, required: true },
    { key: "origin_country", labels: ["Country of Origin"], kind: "choice", value: resolvedOptionLabel(payload.originCountry, officialLabels), required: true },
    { key: "airport_of_origin", labels: ["Airport of Origin", "Port of Origin"], kind: "text", value: payload.airportOfOrigin },
    { key: "departure_date", labels: ["Date of Departure of Flight", "Departure Date"], kind: "date", value: payload.departureDate, required: true },
    { key: "arrival_date", labels: ["Date of Arrival of Flight", "Arrival Date"], kind: "date", value: payload.arrivalDate, required: true },
    { key: "port_of_entry", labels: ["Airport/Port of Destination in the Philippines", "Port of Entry", "Airport of Destination"], kind: "choice", value: resolvedOptionLabel(payload.portOfEntry, officialLabels), required: true },
    { key: "with_transit", labels: ["With Transit", "Connecting Flight"], kind: "choice", value: yesNo(payload.withTransit) },
    { key: "transit_country", labels: ["Country of Transit"], kind: "choice", value: resolvedOptionLabel(payload.transitCountry, officialLabels) },
    { key: "transit_airport", labels: ["Airport of Transit"], kind: "text", value: payload.transitAirport },
    { key: "transit_date", labels: ["Date of Transit"], kind: "date", value: payload.transitDate },
    { key: "purpose", labels: ["Purpose of Travel", "Purpose of Visit"], kind: "choice", value: resolvedOptionLabel(payload.purposeOfTravel, officialLabels), required: true },
    { key: "destination_type", labels: ["Destination upon arrival in the Philippines", "Destination Type"], kind: "choice", value: optionLabel(payload.destinationType ?? "HOTEL"), required: true },
    { key: "philippines_address", labels: ["Hotel/Resort Address", "Residence Address", "Address in the Philippines", "Destination Address"], kind: "text", value: payload.philippinesAddress, required: true },
    { key: "under_18_count", labels: ["Below 18 yrs. old"], kind: "choice", value: payload.accompaniedUnder18Count ?? "0" },
    { key: "adult_count", labels: ["18 yrs. old and above"], kind: "choice", value: payload.accompanied18PlusCount ?? "0" },
    { key: "first_visit", labels: ["First time visiting Philippines"], kind: "choice", value: yesNo(payload.firstTimeVisitingPhilippines) },
    { key: "health_recent_travel", labels: ["recent travel history in the last 30 days"], kind: "choice", value: yesNo(payload.hasRecentTravelHistory30d) },
    ...(payload.visitedCountries30d ?? []).map((country, index) => ({ key: `visited_country_${index}`, labels: ["Country(ies) worked, visited and transited in the last 30 days"], kind: "choice" as const, value: resolvedOptionLabel(country, officialLabels) })),
    { key: "health_exposure", labels: ["history of exposure to a person who is sick"], kind: "choice", value: yesNo(payload.hasExposureToSickPerson30d) },
    { key: "health_sick", labels: ["been sick in the past 30 days"], kind: "choice", value: yesNo(payload.hasBeenSick30d) },
    ...(payload.sicknessSymptoms ?? []).map((symptom, index) => ({ key: `sickness_symptom_${index}`, labels: ["Symptoms", "Symptom"], kind: "choice" as const, value: resolvedOptionLabel(symptom, officialLabels) })),
    { key: "health_details", labels: ["Health Declaration Details", "Symptoms Details"], kind: "text", value: payload.healthSymptomsDetails },
    { key: "checked_baggage", labels: ["Checked-in (pcs)", "Checked Baggage"], kind: "choice", value: payload.customs.checkedBaggageCount ?? "0" },
    { key: "handcarry_baggage", labels: ["Hand-carried (pcs)", "Hand Carry Baggage"], kind: "choice", value: payload.customs.handcarryBaggageCount ?? "0" },
    { key: "has_customs_declaration", labels: ["baggage or currency to declare"], kind: "choice", value: yesNo(payload.customs.hasBaggageOrCurrencyToDeclare) },
    { key: "has_dutiable_goods", labels: ["restricted, regulated, prohibited, or dutiable goods"], kind: "choice", value: yesNo(payload.customs.hasDutiableGoods) },
    { key: "dutiable_goods_details", labels: ["Goods Declaration Details"], kind: "text", value: payload.customs.dutiableGoodsDetails },
    { key: "has_currency", labels: ["currency or monetary instruments over"], kind: "choice", value: yesNo(payload.customs.hasCurrencyOverThreshold) },
    { key: "currency_details", labels: ["Currency Declaration Details"], kind: "text", value: payload.customs.currencyDeclarationDetails },
    { key: "customs_signature", labels: ["Declaration Signature", "Signature"], kind: "file", value: payload.customs.customsSignatureFile },
  ];
}

async function firstVisible(locators: Locator[]): Promise<Locator | null> {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible({ timeout: 300 }).catch(() => false)) return candidate;
    }
  }
  return null;
}

async function controlForLabel(page: Page, label: string): Promise<Locator | null> {
  const pattern = new RegExp(escapeRegex(label), "i");
  const byLabel = await firstVisible([page.getByLabel(pattern)]);
  if (byLabel) return byLabel;
  const labelNode = await firstVisible([page.locator("label, legend, p, span, div").filter({ hasText: pattern })]);
  if (!labelNode) return null;
  const direct = await firstVisible([
    labelNode.locator("input:not([type='hidden']), textarea, select, [role='combobox']"),
    labelNode.locator("xpath=following::input[not(@type='hidden')][1]"),
    labelNode.locator("xpath=following::textarea[1]"),
    labelNode.locator("xpath=following::select[1]"),
    labelNode.locator("xpath=following::*[@role='combobox'][1]"),
  ]);
  return direct;
}

async function fillTextOrDate(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  if (typeof item.value !== "string" || !item.value) return false;
  for (const label of item.labels) {
    const control = await controlForLabel(page, label);
    if (!control) continue;
    const tag = await control.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
    if (tag === "select" || await control.getAttribute("role") === "combobox") continue;
    const type = await control.getAttribute("type").catch(() => null);
    const value = item.kind === "date" && type !== "date"
      ? item.value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3/$1")
      : item.value;
    await control.fill(value, { timeout: 10_000 }).catch(() => undefined);
    const retained = await control.inputValue().catch(() => "");
    if (retained) return true;
  }
  return false;
}

async function selectChoice(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  if (typeof item.value !== "string" || !item.value) return false;
  const valuePattern = new RegExp(`^\\s*${escapeRegex(item.value)}\\s*$`, "i");
  for (const label of item.labels) {
    const control = await controlForLabel(page, label);
    if (control) {
      const tag = await control.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
      if (tag === "select") {
        const selected = await control.selectOption({ label: item.value }, { timeout: 5_000 }).catch(() => []);
        if (selected.length > 0) return true;
      }
      await control.click({ force: true, timeout: 5_000 }).catch(() => undefined);
      const editable = await control.getAttribute("readonly").catch(() => null) === null;
      if (editable) {
        await control.fill(item.value, { timeout: 5_000 }).catch(() => undefined);
      }
      const option = await firstVisible([
        page.getByRole("option", { name: valuePattern }),
        page.locator("[role='option'], li, button, label").filter({ hasText: valuePattern }),
      ]);
      if (option) {
        await option.click({ force: true, timeout: 5_000 });
        return true;
      }
      await page.keyboard.press("Enter").catch(() => undefined);
      const retained = await control.inputValue().catch(() => "");
      if (retained) return true;
    }

    const labelPattern = new RegExp(escapeRegex(label), "i");
    const scopedChoice = await firstVisible([
      page.getByText(valuePattern),
      page.locator("label, button, [role='radio']").filter({ hasText: valuePattern }),
      page.locator("fieldset, section, div").filter({ hasText: labelPattern }).locator("label, button, [role='radio']").filter({ hasText: valuePattern }),
    ]);
    if (scopedChoice) {
      await scopedChoice.click({ force: true, timeout: 5_000 });
      return true;
    }
  }
  return false;
}

async function setCheckbox(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  if (typeof item.value !== "boolean") return false;
  for (const label of item.labels) {
    const control = await controlForLabel(page, label);
    if (!control) continue;
    const checked = await control.isChecked().catch(() => false);
    if (checked !== item.value) await control.click({ force: true, timeout: 5_000 });
    return true;
  }
  return false;
}

async function uploadFile(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  if (typeof item.value !== "string" || !item.value) return false;
  for (const label of item.labels) {
    const control = await controlForLabel(page, label);
    if (!control) continue;
    if (await control.getAttribute("type") !== "file") continue;
    await control.setInputFiles(item.value, { timeout: 10_000 });
    return true;
  }
  return false;
}

async function fillVisibleFields(page: Page, plan: PhEtravelFieldPlanItem[], completed: Set<string>): Promise<string[]> {
  const newlyFilled: string[] = [];
  for (const item of plan) {
    if (completed.has(item.key) || item.value === null || item.value === "") continue;
    const filled = item.kind === "choice"
      ? await selectChoice(page, item)
      : item.kind === "checkbox"
        ? await setCheckbox(page, item)
        : item.kind === "file"
          ? await uploadFile(page, item)
          : await fillTextOrDate(page, item);
    if (filled) {
      completed.add(item.key);
      newlyFilled.push(item.key);
    }
  }
  return newlyFilled;
}

async function clickVisibleButton(page: Page, pattern: RegExp): Promise<boolean> {
  const target = await firstVisible([
    page.getByRole("button", { name: pattern }),
    page.locator("button, a, [role='button']").filter({ hasText: pattern }),
  ]);
  if (!target || !await target.isEnabled().catch(() => false)) return false;
  await target.click({ force: true, timeout: 10_000 });
  return true;
}

async function checkReviewDeclarations(page: Page): Promise<void> {
  const checkboxes = page.locator("input[type='checkbox']:visible, [role='checkbox']:visible");
  const count = await checkboxes.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const checkbox = checkboxes.nth(index);
    if (!await checkbox.isChecked().catch(() => false)) {
      await checkbox.click({ force: true, timeout: 5_000 });
    }
  }
}

export async function fillPhEtravelOfficialDeclaration(
  page: Page,
  payload: PhEtravelPortalPayload,
  options: {
    stopBeforeSubmit: boolean;
    onStep?: (name: string) => Promise<void>;
  },
): Promise<PhEtravelFormFillResult> {
  const completed = new Set<string>();
  const plan = buildPhEtravelFieldPlan(payload, await loadOfficialLabels());
  let portalText = await page.locator("body").innerText().catch(() => "");

  if (/dashboard|etravel registration|travel declaration|my travel/i.test(portalText)) {
    const opened = await clickVisibleButton(page, /new travel declaration|new declaration|register travel|travel declaration|new registration/i);
    if (opened) {
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
      await page.waitForTimeout(2_000);
      await options.onStep?.("declaration-opened");
    }
  }

  for (let step = 1; step <= 12; step += 1) {
    portalText = await page.locator("body").innerText().catch(() => "");
    if (/qr\s*code|reference\s*(?:no|number)|registration\s+(?:successful|completed)/i.test(portalText)) {
      await options.onStep?.("confirmation");
      return { reachedReview: true, submitted: true, portalText, filledFields: [...completed] };
    }
    if (/enter email address|create an account|login|password/i.test(portalText) && !/travel details|travel registration/i.test(portalText)) {
      throw new PhEtravelFormFillError(
        "Official eTravel session is not authenticated before form filling.",
        "ph_etravel_form_authentication_required",
        portalText.slice(0, 700),
      );
    }

    const review = /review|summary|declaration/i.test(portalText) && /submit|confirm|certif/i.test(portalText);
    if (review) {
      await options.onStep?.("review");
      if (options.stopBeforeSubmit) {
        return { reachedReview: true, submitted: false, portalText, filledFields: [...completed] };
      }
      await checkReviewDeclarations(page);
      if (!await clickVisibleButton(page, /^submit$|submit declaration|confirm and submit|complete registration/i)) {
        throw new PhEtravelFormFillError(
          "Official eTravel Review page did not expose an enabled Submit control.",
          "ph_etravel_submit_control_missing",
          portalText.slice(0, 700),
        );
      }
      await page.waitForTimeout(1_000);
      await clickVisibleButton(page, /^confirm$|yes,? submit|proceed/i).catch(() => false);
      await page.waitForLoadState("domcontentloaded", { timeout: 45_000 }).catch(() => undefined);
      await page.waitForTimeout(3_000);
      continue;
    }

    const newlyFilled = await fillVisibleFields(page, plan, completed);
    if (newlyFilled.length > 0) await options.onStep?.(`form-step-${step}`);
    const advanced = await clickVisibleButton(page, /^next$|^continue$|save and continue|proceed/i);
    if (!advanced) {
      const errors = await page.locator("[role='alert'], .error, .invalid-feedback, .text-danger").allInnerTexts().catch(() => []);
      throw new PhEtravelFormFillError(
        newlyFilled.length === 0
          ? "Official eTravel form selectors no longer match the visible page."
          : "Official eTravel form did not enable the next step after filling visible fields.",
        newlyFilled.length === 0 ? "ph_etravel_selector_drift" : "ph_etravel_step_validation_failed",
        `${portalText}\n${errors.join(" | ")}`.slice(0, 700),
      );
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
  }

  portalText = await page.locator("body").innerText().catch(() => "");
  throw new PhEtravelFormFillError(
    "Official eTravel form exceeded the supported step count before Review.",
    "ph_etravel_form_step_limit_exceeded",
    portalText.slice(0, 700),
  );
}
