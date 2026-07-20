import type { Locator, Page } from "@playwright/test";
import type { PhEtravelPortalPayload } from "./normalize";

export type PhEtravelFieldKind = "text" | "date" | "choice" | "checkbox" | "file";

export interface PhEtravelFieldPlanItem {
  key: string;
  portalName?: string;
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
    HOLIDAY: "Holiday/Pleasure/Vacation",
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
    { key: "purpose", portalName: "purpose_of_visit_code", labels: ["Purpose of Travel", "Purpose of Visit"], kind: "choice", value: resolvedOptionLabel(payload.purposeOfTravel, officialLabels), required: true },
    { key: "traveller_type", portalName: "passenger_type", labels: ["Traveller Type", "Traveler Type"], kind: "choice", value: optionLabel(payload.travellerType ?? "AIRCRAFT PASSENGER"), required: true },
    { key: "airline", portalName: "travel_company_code", labels: ["Name of Airline", "Airline Name", "Name of Airline/Vessel"], kind: "choice", value: resolvedOptionLabel(payload.airlineOrVesselName, officialLabels), required: true },
    { key: "flight_number", portalName: "flight_number", labels: ["Flight Number", "Vehicle/Vessel Number"], kind: "choice", value: payload.flightNumber, required: true },
    { key: "origin_country", portalName: "origin_country_code", labels: ["Country of Origin"], kind: "choice", value: resolvedOptionLabel(payload.originCountry, officialLabels), required: true },
    { key: "airport_of_origin", portalName: "origin_port", labels: ["Airport of Origin", "Port of Origin"], kind: "text", value: payload.airportOfOrigin, required: true },
    { key: "port_of_entry", portalName: "destination_port_code", labels: ["Airport/Port of Destination in the Philippines", "Port of Entry", "Airport of Destination"], kind: "choice", value: resolvedOptionLabel(payload.portOfEntry, officialLabels), required: true },
    { key: "with_transit", portalName: "with_transit", labels: ["With Transit", "Connecting Flight"], kind: "checkbox", value: payload.withTransit ?? false },
    { key: "transit_country", portalName: "transit_country_code", labels: ["Country of Transit"], kind: "choice", value: resolvedOptionLabel(payload.transitCountry, officialLabels) },
    { key: "transit_airport", portalName: "transit_port", labels: ["Airport of Transit"], kind: "text", value: payload.transitAirport },
    { key: "transit_date", portalName: "transit_date", labels: ["Date of Transit"], kind: "date", value: payload.transitDate },
    { key: "destination_type", portalName: "stay_location_type", labels: ["Destination upon arrival in the Philippines", "Destination Type"], kind: "choice", value: optionLabel(payload.destinationType ?? "HOTEL_RESORT"), required: true },
    { key: "destination_transit_airport", labels: ["Airport"], kind: "choice", value: resolvedOptionLabel(payload.destinationTransitAirport, officialLabels), required: Boolean(payload.destinationTransitAirport) },
    { key: "destination_country", labels: ["Country of Destination"], kind: "choice", value: resolvedOptionLabel(payload.destinationCountry, officialLabels), required: Boolean(payload.destinationCountry) },
    { key: "philippines_address", portalName: "destination_upon_arrival_in_philippines", labels: ["Hotel/Resort Address", "Residence Address", "Address in the Philippines", "Destination Address"], kind: "text", value: payload.philippinesAddress, required: !payload.destinationTransitAirport },
    { key: "arrival_date", portalName: "arrival_date", labels: ["Date of Arrival", "Date of Arrival of Flight", "Arrival Date"], kind: "date", value: payload.arrivalDate, required: true },
    { key: "departure_date", portalName: "departure_date", labels: ["Date of Departure", "Date of Departure of Flight", "Departure Date"], kind: "date", value: payload.departureDate, required: true },
    { key: "under_18_count", labels: ["Below 18 yrs. old"], kind: "choice", value: payload.accompaniedUnder18Count ?? "0" },
    { key: "adult_count", labels: ["18 yrs. old and above"], kind: "choice", value: payload.accompanied18PlusCount ?? "0" },
    { key: "first_visit", labels: ["First time visiting Philippines"], kind: "choice", value: yesNo(payload.firstTimeVisitingPhilippines) },
    { key: "health_recent_travel", portalName: "meta.with_recent_travel_history", labels: ["recent travel history in the last 30 days"], kind: "choice", value: yesNo(payload.hasRecentTravelHistory30d), required: true },
    ...(payload.visitedCountries30d ?? []).map((country, index) => ({ key: `visited_country_${index}`, labels: ["Country(ies) worked, visited and transited in the last 30 days"], kind: "choice" as const, value: resolvedOptionLabel(country, officialLabels) })),
    { key: "health_exposure", portalName: "is_with_history_exposure", labels: ["history of exposure to a person who is sick"], kind: "choice", value: yesNo(payload.hasExposureToSickPerson30d), required: true },
    { key: "health_sick", portalName: "is_sicked_within_thirty_days", labels: ["been sick in the past 30 days"], kind: "choice", value: yesNo(payload.hasBeenSick30d), required: true },
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
  const pattern = new RegExp(`^\\s*${escapeRegex(label)}\\s*$`, "i");
  const byLabel = await firstVisible([
    page.getByLabel(pattern),
    page.getByPlaceholder(pattern),
    page.getByRole("combobox", { name: pattern }),
  ]);
  if (byLabel) return byLabel;
  const labelNode = await firstVisible([
    page.locator("label, legend").filter({ hasText: pattern }),
    page.getByText(pattern),
  ]);
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

async function controlForItem(page: Page, item: PhEtravelFieldPlanItem): Promise<Locator | null> {
  if (item.portalName) {
    const named = await firstVisible([
      page.locator(`input[name="${item.portalName}"]:visible`),
      page.locator(`textarea[name="${item.portalName}"]:visible`),
      page.locator(`select[name="${item.portalName}"]:visible`),
    ]);
    if (named) return named;
  }
  for (const label of item.labels) {
    const control = await controlForLabel(page, label);
    if (control) return control;
  }
  return null;
}

async function selectOfficialDatePicker(
  page: Page,
  input: Locator,
  isoDate: string,
): Promise<boolean> {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return false;
  const [, year, month, day] = match;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthName = monthNames[Number(month) - 1];
  if (!monthName) return false;

  await input.click({ force: true, timeout: 5_000 }).catch(() => undefined);
  const popper = page.locator(".react-datepicker-popper:visible").last();
  if (!await popper.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) {
    return false;
  }

  const headerSelects = popper.locator(".react-datepicker__header select");
  if (await headerSelects.count().catch(() => 0) >= 2) {
    await headerSelects.nth(1).selectOption(year, { timeout: 5_000 }).catch(() => undefined);
    await headerSelects.nth(0).selectOption(monthName, { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(250);
  }

  const targetDay = popper.locator(
    `.react-datepicker__day--0${day}:not(.react-datepicker__day--outside-month):not(.react-datepicker__day--disabled)`,
  ).first();
  if (!await targetDay.isVisible({ timeout: 3_000 }).catch(() => false)) return false;
  await targetDay.click({ force: true, timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(750);
  const formatted = `${month}/${day}/${year}`;
  return await input.inputValue().catch(() => "") === formatted;
}

async function closeHotelLookup(page: Page): Promise<void> {
  const search = page.getByPlaceholder(/^Search\.\.\.$/i).first();
  if (!await search.isVisible({ timeout: 300 }).catch(() => false)) return;
  const overlay = search.locator("xpath=ancestor::ul[@role='listbox'][1]");
  const close = overlay.getByRole("button", { name: /^Close$/i }).first();
  await close.click({ timeout: 3_000 }).catch(() => undefined);
  if (await search.isVisible({ timeout: 500 }).catch(() => false)) {
    await close.evaluate((button) => (button as HTMLButtonElement).click()).catch(() => undefined);
  }
  await search.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => undefined);
}

async function fillTextOrDate(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  if (typeof item.value !== "string" || !item.value) return false;
  if (item.kind === "date" && item.portalName) {
    const dateInput = await firstVisible([
      page.locator(`input[name="${item.portalName}"]:visible`),
    ]);
    if (dateInput) return selectOfficialDatePicker(page, dateInput, item.value);
  }
  if (item.key === "philippines_address") {
    const destination = await firstVisible([
      page.getByPlaceholder(/Hotel, Resorts, AirBnb, Tourist destinations/i),
      page.getByPlaceholder(/Destination Address/i),
    ]);
    if (destination) {
      await destination.click({ force: true, timeout: 5_000 }).catch(() => undefined);
      const search = await firstVisible([page.getByPlaceholder(/^Search/i)]);
      if (search) {
        await search.fill(item.value, { timeout: 5_000 }).catch(() => undefined);
        await page.waitForTimeout(1_500);
        const searchTerm = item.value.split(",")[0] ?? item.value;
        const suggestion = await firstVisible([
          page.locator("[role='option'], [role='menuitem'], .v-list-item, .q-item, li").filter({ hasText: new RegExp(escapeRegex(searchTerm), "i") }),
        ]);
        if (suggestion) {
          await suggestion.click({ force: true, timeout: 5_000 }).catch(() => undefined);
          return true;
        }
      }
    }
  }
  const namedControl = await controlForItem(page, item);
  if (namedControl) {
    const tag = await namedControl.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
    if (tag !== "select" && await namedControl.getAttribute("role") !== "combobox") {
      const type = await namedControl.getAttribute("type").catch(() => null);
      const value = item.kind === "date" && type !== "date"
        ? item.value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3/$1")
        : item.value;
      await namedControl.fill(value, { timeout: 10_000 }).catch(() => undefined);
      const retained = await namedControl.inputValue().catch(() => "");
      if (retained) {
        if (item.key === "philippines_address") {
          await closeHotelLookup(page);
          await page.getByText(/^eVisa$/i).click({ force: true, timeout: 2_000 }).catch(() => undefined);
        }
        return true;
      }
    }
  }
  if (namedControl) return false;
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

const normalizedChoiceText = (value: string): string =>
  value.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();

function expectedRadioValue(item: PhEtravelFieldPlanItem): string {
  const wanted = normalizedChoiceText(String(item.value ?? ""));
  if (wanted === "hotel resort") return "hotel";
  if (wanted === "transit via airport") return "transit";
  if (wanted === "yes") return "true";
  if (wanted === "no") return "false";
  return wanted;
}

async function selectStaticNamedCombobox(
  page: Page,
  item: PhEtravelFieldPlanItem,
  namedSelector: string,
): Promise<boolean> {
  const hidden = page.locator(`${namedSelector}[type="hidden"]`).first();
  if (!await hidden.count().catch(() => 0)) return false;
  const root = hidden.locator("xpath=ancestor::div[.//input[@role='combobox']][1]");
  const control = await firstVisible([
    root.locator("input[role='combobox']"),
    hidden.locator("xpath=preceding::input[@role='combobox'][1]"),
  ]);
  if (!control) return false;

  await control.click({ force: true, timeout: 5_000 }).catch(() => undefined);
  if (await control.isEditable().catch(() => false)) {
    await control.fill(item.value as string, { timeout: 5_000 }).catch(() => undefined);
  }
  const wanted = normalizedChoiceText(item.value as string);
  const options = page.getByRole("option");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(attempt === 0 ? 500 : 250);
    const count = await options.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      if (!await option.isVisible({ timeout: 100 }).catch(() => false)) continue;
      if (normalizedChoiceText(await option.innerText().catch(() => "")) !== wanted) continue;
      if (!await option.click({ force: true, timeout: 3_000 }).then(() => true).catch(() => false)) continue;
      await page.waitForTimeout(250);
      return normalizedChoiceText(await hidden.inputValue().catch(() => "")) === wanted;
    }
  }

  await page.keyboard.press("Escape").catch(() => undefined);
  return false;
}

async function selectTravellerType(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  const wanted = normalizedChoiceText(item.value as string);
  const hidden = page.locator('input[name="passenger_type"][type="hidden"]').first();
  if (!await hidden.count().catch(() => 0)) return false;
  const control = await firstVisible([
    hidden.locator("xpath=preceding::input[@role='combobox'][1]"),
  ]);
  if (!control) return false;
  await control.click({ force: true, timeout: 5_000 }).catch(() => undefined);
  await control.fill(item.value as string, { timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(750);
  const exactOption = await firstVisible([
    page.getByRole("option").filter({ hasText: new RegExp(`^\\s*${escapeRegex(item.value as string)}\\s*$`, "i") }),
  ]);
  if (exactOption) {
    await exactOption.click({ force: true, timeout: 3_000 }).catch(() => undefined);
  } else {
    await control.press("Enter").catch(() => undefined);
  }
  await page.waitForTimeout(500);
  if (normalizedChoiceText(await hidden.inputValue().catch(() => "")) === wanted) return true;
  await page.keyboard.press("Escape").catch(() => undefined);
  return false;
}

async function selectNamedCombobox(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  if (!item.portalName || typeof item.value !== "string") return false;
  const namedSelector = `input[name="${item.portalName}"]`;
  if (item.key === "traveller_type" && await selectTravellerType(page, item)) return true;
  if (await page.locator(`${namedSelector}[type="hidden"]`).count().catch(() => 0)) {
    return selectStaticNamedCombobox(page, item, namedSelector);
  }
  const control = await firstVisible([page.locator(`${namedSelector}:visible`)]);
  if (!control || await control.getAttribute("role") !== "combobox") return false;

  const wanted = normalizedChoiceText(item.value);
  if (item.key === "flight_number") await page.waitForTimeout(1_500);
  await control.click({ force: true, timeout: 5_000 }).catch(() => undefined);
  await control.fill(item.value, { timeout: 5_000 }).catch(() => undefined);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await page.waitForTimeout(attempt === 0 ? 750 : 350);
    const options = page.getByRole("option");
    const count = await options.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      if (!await option.isVisible({ timeout: 100 }).catch(() => false)) continue;
      const text = normalizedChoiceText(await option.innerText().catch(() => ""));
      if (text !== wanted && !text.endsWith(` ${wanted}`)) continue;
      if (!await option.click({ force: true, timeout: 3_000 }).then(() => true).catch(() => false)) continue;
      await page.waitForTimeout(300);
      const selectedValue = normalizedChoiceText(
        await page.locator(`${namedSelector}:visible`).first().inputValue().catch(() => ""),
      );
      return selectedValue === wanted || selectedValue.endsWith(` ${wanted}`);
    }
  }
  // Clear the query before the control loses focus. The official component
  // otherwise auto-selects the first filtered option on blur.
  await control.fill("").catch(() => undefined);
  await page.keyboard.press("Escape").catch(() => undefined);
  return false;
}

async function selectChoice(page: Page, item: PhEtravelFieldPlanItem): Promise<boolean> {
  if (typeof item.value !== "string" || !item.value) return false;
  const valuePattern = new RegExp(`^\\s*${escapeRegex(item.value)}\\s*$`, "i");
  if (item.portalName) {
    const namedRadios = page.locator(`input[type="radio"][name="${item.portalName}"]`);
    const radioCount = await namedRadios.count().catch(() => 0);
    const wanted = normalizedChoiceText(item.value);
    const expectedValue = expectedRadioValue(item);
    for (let index = 0; index < radioCount; index += 1) {
      const radio = namedRadios.nth(index);
      const value = normalizedChoiceText(await radio.getAttribute("value").catch(() => "") ?? "");
      const labelText = normalizedChoiceText(
        await radio.locator("xpath=ancestor::label[1]").innerText().catch(() => ""),
      );
      const mappedMatch = value === expectedValue;
      if (value !== wanted && labelText !== wanted && !mappedMatch) continue;
      await radio.click({ force: true, timeout: 5_000 });
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (await radio.isChecked().catch(() => false)) return true;
        await page.waitForTimeout(100);
      }
      return false;
    }
  }
  if (item.portalName && await selectNamedCombobox(page, item)) return true;
  for (const label of item.labels) {
    const labelPattern = new RegExp(escapeRegex(label), "i");
    const scopedChoice = await firstVisible([
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
    if (completed.has(item.key) && item.required && item.portalName) {
      const named = page.locator(`input[name="${item.portalName}"]`);
      const count = await named.count().catch(() => 0);
      if (count > 0) {
        const inputType = await named.first().getAttribute("type").catch(() => null);
        const retained = inputType === "radio"
          ? normalizedChoiceText(
            await page.locator(`input[type="radio"][name="${item.portalName}"]:checked`).first().getAttribute("value").catch(() => "") ?? "",
          ) === expectedRadioValue(item)
          : Boolean(await named.first().inputValue().catch(() => ""));
        if (!retained) completed.delete(item.key);
      } else {
        completed.delete(item.key);
      }
    }
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

async function chooseInitialRegistration(page: Page, completed: Set<string>): Promise<boolean> {
  const portalText = await page.locator("body").innerText().catch(() => "");
  if (!/Travel Registration/i.test(portalText) || !/Entering the Philippines/i.test(portalText)) return false;

  const choices: Array<[string, RegExp]> = [
    ["registration_for", /FOR ME\s*\(Current User\)/i],
    ["transport_type", /^AIR$/i],
    ["travel_type", /ARRIVAL\s*Entering the Philippines/i],
  ];
  for (const [key, pattern] of choices) {
    const target = await firstVisible([
      page.getByText(pattern),
      page.locator("label, button, [role='radio'], div").filter({ hasText: pattern }),
    ]);
    if (target) {
      await target.click({ force: true, timeout: 5_000 });
      completed.add(key);
    }
  }

  const specialFlight = await firstVisible([page.getByLabel(/Special Flight/i)]);
  if (specialFlight) {
    if (await specialFlight.isChecked().catch(() => false)) {
      await specialFlight.click({ force: true, timeout: 5_000 });
    }
    completed.add("is_special_flight");
  }
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
    await chooseInitialRegistration(page, completed);
    const confirmation = /registration\s+(?:successful|completed)|successfully\s+registered|thank\s+you\s+for\s+registering/i.test(portalText) &&
      /qr\s*code|reference\s*(?:no|number)/i.test(portalText);
    if (confirmation) {
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
    await closeHotelLookup(page);
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
