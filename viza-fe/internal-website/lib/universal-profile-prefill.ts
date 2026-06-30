import { countries } from "country-data-list";
import { toChineseSourceValue, toOfficialEnglishValue } from "@/lib/ds160-translations";

interface CountryRecord {
  alpha2: string;
  alpha3: string;
  name: string;
  status: string;
}

export interface UniversalProfileSnapshot {
  full_name?: string | null;
  full_name_zh?: string | null;
  full_name_en?: string | null;
  surname?: string | null;
  surname_zh?: string | null;
  surname_en?: string | null;
  given_names?: string | null;
  given_names_zh?: string | null;
  given_names_en?: string | null;
  date_of_birth?: string | null;
  place_of_birth?: string | null;
  place_of_birth_zh?: string | null;
  place_of_birth_en?: string | null;
  birth_country?: string | null;
  birth_province_or_state?: string | null;
  birth_province_or_state_zh?: string | null;
  birth_province_or_state_en?: string | null;
  birth_city?: string | null;
  birth_city_zh?: string | null;
  birth_city_en?: string | null;
  gender?: string | null;
  nationality?: string | null;
  occupation?: string | null;
  occupation_zh?: string | null;
  occupation_en?: string | null;
  address?: string | null;
  address_zh?: string | null;
  address_en?: string | null;
  passport_number?: string | null;
  passport_issue_date?: string | null;
  passport_expiry_date?: string | null;
  passport_issuing_country?: string | null;
  passport_issuing_authority?: string | null;
  email?: string | null;
  phone?: string | null;
  wechat?: string | null;
}

export const UNIVERSAL_PROFILE_SELECT =
  "*";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function hasChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function buildBilingualValue(value: string | null | undefined) {
  const normalized = clean(value);
  if (!normalized) return null;
  if (hasChinese(normalized)) {
    const englishValue = toOfficialEnglishValue(normalized);
    return {
      zh: normalized,
      en: hasChinese(englishValue) ? "" : englishValue,
    };
  }
  return {
    zh: toChineseSourceValue(normalized),
    en: normalized,
  };
}

function buildBilingualValueFromParts(
  value: string | null | undefined,
  zhValue: string | null | undefined,
  enValue: string | null | undefined,
) {
  const zh = clean(zhValue);
  const en = clean(enValue);
  if (zh || en) {
    const generatedEn = zh ? toOfficialEnglishValue(zh) : "";
    return {
      zh: zh ?? (en ? toChineseSourceValue(en) : ""),
      en: en ?? (hasChinese(generatedEn) ? "" : generatedEn),
    };
  }
  return buildBilingualValue(value);
}

function splitLegacyBirthplace(value: string | null | undefined) {
  const parts = (value ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return {
      country: parts[0] ?? "",
      provinceOrState: parts[1] ?? "",
      city: parts.slice(2).join(" | "),
    };
  }

  return { country: "", provinceOrState: "", city: "" };
}

function normalizeCountryAlpha3(value: string | null | undefined) {
  const normalized = clean(value);
  if (!normalized) return null;
  const lookup = normalized.toLowerCase();
  const match = (countries.all as CountryRecord[]).find((country) => {
    if (country.status === "deleted") return false;
    return (
      country.alpha2.toLowerCase() === lookup ||
      country.alpha3.toLowerCase() === lookup ||
      country.name.toLowerCase() === lookup
    );
  });
  return match?.alpha3 ?? normalized;
}

function profileBirthCountry(profile: UniversalProfileSnapshot) {
  const legacyBirthplace = splitLegacyBirthplace(profile.place_of_birth_en ?? profile.place_of_birth);
  return profile.birth_country || legacyBirthplace.country;
}

export function buildMalaysiaMdacUniversalProfileAnswerPatch(
  profile: UniversalProfileSnapshot | null | undefined,
): Record<string, string> {
  if (!profile) return {};
  const birthCountryAlpha3 = normalizeCountryAlpha3(profileBirthCountry(profile));
  if (!birthCountryAlpha3) return {};
  return {
    place_of_birth: birthCountryAlpha3,
  };
}

export function splitUniversalFullName(fullName: string | null | undefined) {
  const normalized = clean(fullName);
  if (normalized && /^[\u3400-\u9fff]+$/.test(normalized)) {
    return {
      givenNames: normalized.slice(1),
      surname: normalized.slice(0, 1),
    };
  }

  const parts = normalized?.split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return { givenNames: "", surname: "" };
  if (parts.length === 1) return { givenNames: parts[0], surname: "" };
  return {
    givenNames: parts.slice(0, -1).join(" "),
    surname: parts.at(-1) ?? "",
  };
}

function splitChineseFullName(fullName: string | null | undefined) {
  const normalized = clean(fullName)?.replace(/\s+/g, "") ?? "";
  if (!/^[\u3400-\u9fff]{2,}$/.test(normalized)) return { surname: "", givenNames: "" };
  return {
    surname: normalized.slice(0, 1),
    givenNames: normalized.slice(1),
  };
}

function splitPassportOrderEnglishName(fullName: string | null | undefined) {
  const parts = clean(fullName)?.split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return { surname: "", givenNames: "" };
  if (parts.length === 1) return { surname: parts[0], givenNames: "" };
  return {
    surname: parts[0] ?? "",
    givenNames: parts.slice(1).join(" "),
  };
}

function setAnswer(out: Record<string, string>, keys: string[], value: string | null | undefined) {
  const normalized = clean(value);
  if (!normalized) return;
  for (const key of keys) out[key] = normalized;
}

function normalizeDs160Sex(value: string | null | undefined) {
  const normalized = clean(value)?.toLowerCase();
  if (!normalized) return null;
  if (normalized === "m" || normalized === "male" || normalized === "男") return "male";
  if (normalized === "f" || normalized === "female" || normalized === "女") return "female";
  return null;
}

function setBilingualAnswerFromParts(
  out: Record<string, string>,
  keys: string[],
  value: string | null | undefined,
  zhValue: string | null | undefined,
  enValue: string | null | undefined,
) {
  const bilingual = buildBilingualValueFromParts(value, zhValue, enValue);
  if (!bilingual) return;
  for (const key of keys) {
    out[key] = bilingual.en || bilingual.zh;
    out[`${key}_zh`] = bilingual.zh;
    out[`${key}_en`] = bilingual.en;
  }
}

export function buildUniversalProfileAnswerPatch(profile: UniversalProfileSnapshot | null | undefined) {
  const out: Record<string, string> = {};
  if (!profile) return out;

  const legacyChineseName = splitChineseFullName(profile.full_name_zh ?? (hasChinese(profile.full_name ?? "") ? profile.full_name : null));
  const legacyEnglishName = splitPassportOrderEnglishName(profile.full_name_en ?? (!hasChinese(profile.full_name ?? "") ? profile.full_name : null));
  const surnameZh = profile.surname_zh || legacyChineseName.surname;
  const givenNamesZh = profile.given_names_zh || legacyChineseName.givenNames;
  const surnameEn = profile.surname_en || profile.surname || (surnameZh ? toOfficialEnglishValue(surnameZh) : legacyEnglishName.surname);
  const givenNamesEn =
    profile.given_names_en || profile.given_names || (givenNamesZh ? toOfficialEnglishValue(givenNamesZh) : legacyEnglishName.givenNames);
  const surname = profile.surname || surnameEn || surnameZh;
  const givenNames = profile.given_names || givenNamesEn || givenNamesZh;
  const fullNameZh = profile.full_name_zh || (surnameZh || givenNamesZh ? `${surnameZh}${givenNamesZh}` : null);
  const fullNameEn = profile.full_name_en || ([givenNamesEn, surnameEn].filter(Boolean).join(" ") || null);
  const legacyBirthplace = splitLegacyBirthplace(profile.place_of_birth_en ?? profile.place_of_birth);
  const legacyBirthplaceZh = splitLegacyBirthplace(profile.place_of_birth_zh);

  setBilingualAnswerFromParts(
    out,
    ["full_name", "fullName", "applicant_full_name"],
    profile.full_name || fullNameEn || fullNameZh,
    fullNameZh,
    fullNameEn,
  );
  setBilingualAnswerFromParts(
    out,
    ["surname", "last_name", "family_name"],
    surname,
    surnameZh,
    surnameEn,
  );
  setBilingualAnswerFromParts(
    out,
    ["given_names", "givenNames", "given_name", "first_name"],
    givenNames,
    givenNamesZh,
    givenNamesEn,
  );
  setAnswer(out, ["date_of_birth", "dob", "birth_date"], profile.date_of_birth);
  setBilingualAnswerFromParts(
    out,
    ["place_of_birth", "city_of_birth", "birth_city", "place_of_birth_city"],
    profile.birth_city || legacyBirthplace.city || profile.place_of_birth,
    profile.birth_city_zh || legacyBirthplaceZh.city || profile.place_of_birth_zh,
    profile.birth_city_en || legacyBirthplace.city || profile.place_of_birth_en,
  );
  setBilingualAnswerFromParts(
    out,
    ["state_of_birth", "birth_state", "birth_province", "place_of_birth_province"],
    profile.birth_province_or_state || legacyBirthplace.provinceOrState,
    profile.birth_province_or_state_zh || legacyBirthplaceZh.provinceOrState,
    profile.birth_province_or_state_en || legacyBirthplace.provinceOrState,
  );
  setAnswer(out, ["country_of_birth", "birth_country", "place_of_birth_country"], profile.birth_country || legacyBirthplace.country);
  setAnswer(out, ["gender"], profile.gender);
  setAnswer(out, ["sex"], normalizeDs160Sex(profile.gender));
  setAnswer(
    out,
    [
      "nationality",
      "nationality_country",
      "country_of_nationality",
      "current_nationality",
    ],
    profile.nationality,
  );
  setBilingualAnswerFromParts(
    out,
    ["occupation", "current_occupation", "primary_occupation", "current_profession"],
    profile.occupation,
    profile.occupation_zh,
    profile.occupation_en,
  );
  setBilingualAnswerFromParts(
    out,
    ["address", "home_address", "residential_address", "home_address_line1"],
    profile.address,
    profile.address_zh,
    profile.address_en,
  );
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
  setAnswer(out, ["wechat", "wechat_id"], profile.wechat);

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
    const legacyBirthplace = splitLegacyBirthplace(profile.place_of_birth_en ?? profile.place_of_birth);
    const legacyChineseName = splitChineseFullName(profile.full_name_zh ?? (hasChinese(profile.full_name ?? "") ? profile.full_name : null));
    const legacyEnglishName = splitPassportOrderEnglishName(profile.full_name_en ?? (!hasChinese(profile.full_name ?? "") ? profile.full_name : null));
    const surname = profile.surname_en || profile.surname || (legacyChineseName.surname ? toOfficialEnglishValue(legacyChineseName.surname) : legacyEnglishName.surname);
    const givenNames =
      profile.given_names_en ||
      profile.given_names ||
      (legacyChineseName.givenNames ? toOfficialEnglishValue(legacyChineseName.givenNames) : legacyEnglishName.givenNames);
    setIfAllowed(identity, "firstName", givenNames, force);
    setIfAllowed(identity, "lastName", surname, force);
    setIfAllowed(identity, "dob", profile.date_of_birth, force);
    setIfAllowed(identity, "gender", profile.gender, force);
    setIfAllowed(identity, "nationality", profile.nationality, force);
    setIfAllowed(identity, "cityOfBirth", profile.birth_city_en || profile.birth_city || legacyBirthplace.city || profile.place_of_birth_en || profile.place_of_birth, force);
    setIfAllowed(identity, "stateOfBirth", profile.birth_province_or_state_en || profile.birth_province_or_state || legacyBirthplace.provinceOrState, force);
    setIfAllowed(identity, "countryOfBirth", profile.birth_country || legacyBirthplace.country, force);
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
    setIfAllowed(contact, "street1", profile.address_en ?? profile.address, force);
    next.contact = contact;
  }

  if (isRecord(next.work)) {
    const work = { ...next.work };
    setIfAllowed(work, "primaryOccupation", profile.occupation_en ?? profile.occupation, force);
    next.work = work;
  }

  return next as TForm;
}
