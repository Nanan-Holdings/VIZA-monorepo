export interface UniversalProfileSnapshot {
  full_name?: string | null;
  date_of_birth?: string | null;
  place_of_birth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  occupation?: string | null;
  address?: string | null;
  passport_number?: string | null;
  passport_issue_date?: string | null;
  passport_expiry_date?: string | null;
  passport_issuing_country?: string | null;
  passport_issuing_authority?: string | null;
  email?: string | null;
  phone?: string | null;
}

export const UNIVERSAL_PROFILE_SELECT =
  "full_name, date_of_birth, place_of_birth, gender, nationality, occupation, address, passport_number, passport_issue_date, passport_expiry_date, passport_issuing_country, passport_issuing_authority, email, phone";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function splitUniversalFullName(fullName: string | null | undefined) {
  const parts = clean(fullName)?.split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return { givenNames: "", surname: "" };
  if (parts.length === 1) return { givenNames: parts[0], surname: "" };
  return {
    givenNames: parts.slice(0, -1).join(" "),
    surname: parts.at(-1) ?? "",
  };
}

function setAnswer(out: Record<string, string>, keys: string[], value: string | null | undefined) {
  const normalized = clean(value);
  if (!normalized) return;
  for (const key of keys) out[key] = normalized;
}

export function buildUniversalProfileAnswerPatch(profile: UniversalProfileSnapshot | null | undefined) {
  const out: Record<string, string> = {};
  if (!profile) return out;

  const { givenNames, surname } = splitUniversalFullName(profile.full_name);

  setAnswer(out, ["full_name", "fullName", "applicant_full_name"], profile.full_name);
  setAnswer(out, ["given_names", "givenNames", "given_name", "first_name"], givenNames);
  setAnswer(out, ["surname", "last_name", "family_name"], surname);
  setAnswer(out, ["date_of_birth", "dob", "birth_date"], profile.date_of_birth);
  setAnswer(out, ["place_of_birth", "city_of_birth", "birth_city", "place_of_birth_city"], profile.place_of_birth);
  setAnswer(out, ["gender", "sex"], profile.gender);
  setAnswer(
    out,
    ["nationality", "nationality_country", "country_of_nationality", "current_nationality"],
    profile.nationality,
  );
  setAnswer(out, ["occupation", "current_occupation", "primary_occupation", "current_profession"], profile.occupation);
  setAnswer(out, ["address", "home_address", "residential_address", "home_address_line1"], profile.address);
  setAnswer(out, ["passport_number", "passportNumber", "travel_document_number"], profile.passport_number);
  setAnswer(
    out,
    ["passport_issue_date", "passport_issuance_date", "date_of_issue", "passport_date_of_issue"],
    profile.passport_issue_date,
  );
  setAnswer(
    out,
    ["passport_expiry_date", "passport_expiration_date", "valid_until", "passport_date_of_expiry"],
    profile.passport_expiry_date,
  );
  setAnswer(
    out,
    [
      "passport_issuing_country",
      "passport_issuance_country",
      "passport_country",
      "passport_country_of_issue",
      "issued_by_country",
    ],
    profile.passport_issuing_country,
  );
  setAnswer(out, ["passport_issuing_authority"], profile.passport_issuing_authority);
  setAnswer(out, ["email", "email_address"], profile.email);
  setAnswer(out, ["phone", "phone_number", "primary_phone_number", "mobile_phone", "telephone_number"], profile.phone);

  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setIfAllowed(target: Record<string, unknown>, key: string, value: string | null | undefined, force: boolean) {
  const normalized = clean(value);
  if (!normalized) return;
  const current = target[key];
  if (force || typeof current !== "string" || !current.trim()) {
    target[key] = normalized;
  }
}

export function mergeUniversalProfileIntoAnswers(
  answers: Record<string, string>,
  profile: UniversalProfileSnapshot | null | undefined,
  options: { force?: boolean } = {},
) {
  const patch = buildUniversalProfileAnswerPatch(profile);
  if (options.force) return { ...answers, ...patch };

  const next = { ...answers };
  for (const [key, value] of Object.entries(patch)) {
    if (!next[key]?.trim()) next[key] = value;
  }
  return next;
}

export function mergeUniversalProfileIntoWizardForm<TForm>(
  form: TForm,
  profile: UniversalProfileSnapshot | null | undefined,
  options: { force?: boolean } = {},
): TForm {
  if (!isRecord(form) || !profile) return form;

  const force = options.force ?? false;
  const next: Record<string, unknown> = { ...form };
  const flatPatch = mergeUniversalProfileIntoAnswers(
    Object.fromEntries(Object.entries(next).filter(([, value]) => typeof value === "string")) as Record<string, string>,
    profile,
    { force },
  );

  for (const [key, value] of Object.entries(flatPatch)) {
    setIfAllowed(next, key, value, force);
  }

  if (isRecord(next.identity)) {
    const identity = { ...next.identity };
    const { givenNames, surname } = splitUniversalFullName(profile.full_name);
    setIfAllowed(identity, "firstName", givenNames, force);
    setIfAllowed(identity, "lastName", surname, force);
    setIfAllowed(identity, "dob", profile.date_of_birth, force);
    setIfAllowed(identity, "gender", profile.gender, force);
    setIfAllowed(identity, "nationality", profile.nationality, force);
    setIfAllowed(identity, "cityOfBirth", profile.place_of_birth, force);
    next.identity = identity;
  }

  if (isRecord(next.passport)) {
    const passport = { ...next.passport };
    setIfAllowed(passport, "number", profile.passport_number, force);
    setIfAllowed(passport, "issuingCountry", profile.passport_issuing_country, force);
    setIfAllowed(passport, "issuanceCity", profile.passport_issuing_authority, force);
    setIfAllowed(passport, "issueDate", profile.passport_issue_date, force);
    setIfAllowed(passport, "expiryDate", profile.passport_expiry_date, force);
    next.passport = passport;
  }

  if (isRecord(next.contact)) {
    const contact = { ...next.contact };
    setIfAllowed(contact, "email", profile.email, force);
    setIfAllowed(contact, "phone", profile.phone, force);
    setIfAllowed(contact, "street1", profile.address, force);
    next.contact = contact;
  }

  if (isRecord(next.work)) {
    const work = { ...next.work };
    setIfAllowed(work, "primaryOccupation", profile.occupation, force);
    next.work = work;
  }

  return next as TForm;
}
