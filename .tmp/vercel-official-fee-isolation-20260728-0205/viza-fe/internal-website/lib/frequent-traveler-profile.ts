import { countries } from "country-data-list";
import type { UniversalProfileSnapshot } from "@/lib/universal-profile-prefill";

interface CountryRecord {
  alpha2: string;
  alpha3: string;
  name: string;
  status: string;
}

export interface FrequentTravelerInput {
  fullName: string;
  fullNameZh?: string;
  fullNameEn?: string;
  surname?: string;
  surnameZh?: string;
  surnameEn?: string;
  givenNames?: string;
  givenNamesZh?: string;
  givenNamesEn?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  placeOfBirthZh?: string;
  placeOfBirthEn?: string;
  birthCountry?: string;
  birthProvinceOrState?: string;
  birthProvinceOrStateZh?: string;
  birthProvinceOrStateEn?: string;
  birthCity?: string;
  birthCityZh?: string;
  birthCityEn?: string;
  gender?: string;
  nationality?: string;
  occupation?: string;
  occupationZh?: string;
  occupationEn?: string;
  address?: string;
  addressZh?: string;
  addressEn?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  passportIssuingCountry?: string;
  passportIssuingAuthority?: string;
  email?: string;
  phone?: string;
  wechat?: string;
}

export interface FrequentTravelerSummary {
  id: string;
  fullName: string;
  fullNameZh?: string;
  fullNameEn?: string;
  surname?: string;
  surnameZh?: string;
  surnameEn?: string;
  givenNames?: string;
  givenNamesZh?: string;
  givenNamesEn?: string;
  dateOfBirth: string | null;
  placeOfBirth?: string;
  placeOfBirthZh?: string;
  placeOfBirthEn?: string;
  birthCountry?: string;
  birthProvinceOrState?: string;
  birthProvinceOrStateZh?: string;
  birthProvinceOrStateEn?: string;
  birthCity?: string;
  birthCityZh?: string;
  birthCityEn?: string;
  gender?: string;
  nationality: string | null;
  occupation?: string;
  occupationZh?: string;
  occupationEn?: string;
  address?: string;
  addressZh?: string;
  addressEn?: string;
  passportNumber: string | null;
  passportIssueDate?: string;
  passportExpiryDate: string | null;
  passportIssuingCountry?: string;
  passportIssuingAuthority?: string;
  email: string | null;
  phone: string | null;
  wechat?: string;
  updatedAt: string | null;
}

export type FrequentTravelerProfilePayload = {
  full_name: string | null;
  full_name_zh: string | null;
  full_name_en: string | null;
  surname: string | null;
  surname_zh: string | null;
  surname_en: string | null;
  given_names: string | null;
  given_names_zh: string | null;
  given_names_en: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  place_of_birth_zh: string | null;
  place_of_birth_en: string | null;
  birth_country: string | null;
  birth_province_or_state: string | null;
  birth_province_or_state_zh: string | null;
  birth_province_or_state_en: string | null;
  birth_city: string | null;
  birth_city_zh: string | null;
  birth_city_en: string | null;
  gender: string | null;
  nationality: string | null;
  occupation: string | null;
  occupation_zh: string | null;
  occupation_en: string | null;
  address: string | null;
  address_zh: string | null;
  address_en: string | null;
  passport_number: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  passport_issuing_country: string | null;
  passport_issuing_authority: string | null;
  email: string | null;
  phone: string | null;
  wechat: string | null;
  updated_at: string;
};

export type FrequentTravelerProfileRow = Partial<FrequentTravelerProfilePayload> & {
  id: string;
  auth_user_id?: string | null;
  dependant_of_user_id?: string | null;
  deleted_at?: string | null;
  updated_at?: string | null;
};

export type NormalizedFrequentTravelerInput =
  | {
      value: FrequentTravelerProfilePayload;
    }
  | {
      error: string;
    };

export const FREQUENT_TRAVELER_PROFILE_SELECT = "*";

const OPTIONAL_PROFILE_COLUMNS = new Set([
  "full_name_zh",
  "full_name_en",
  "surname",
  "surname_zh",
  "surname_en",
  "given_names",
  "given_names_zh",
  "given_names_en",
  "place_of_birth_zh",
  "place_of_birth_en",
  "birth_country",
  "birth_province_or_state",
  "birth_province_or_state_zh",
  "birth_province_or_state_en",
  "birth_city",
  "birth_city_zh",
  "birth_city_en",
  "occupation_zh",
  "occupation_en",
  "address_zh",
  "address_en",
  "passport_issue_date",
  "passport_issuing_country",
  "passport_issuing_authority",
  "wechat",
]);

function cleanOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function hasChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function splitChineseFullName(value?: string | null) {
  const compact = value?.replace(/\s+/g, "").trim() ?? "";
  if (!/^[\u3400-\u9fff]{2,}$/.test(compact)) return { surname: "", givenNames: "" };
  return {
    surname: compact.slice(0, 1),
    givenNames: compact.slice(1),
  };
}

function splitPassportOrderEnglishName(value?: string | null) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return { surname: "", givenNames: "" };
  if (parts.length === 1) return { surname: parts[0] ?? "", givenNames: "" };
  return {
    surname: parts[0] ?? "",
    givenNames: parts.slice(1).join(" "),
  };
}

function composeChineseName(surname?: string | null, givenNames?: string | null) {
  return `${cleanOptional(surname) ?? ""}${cleanOptional(givenNames) ?? ""}`.trim() || null;
}

function composeEnglishName(givenNames?: string | null, surname?: string | null) {
  return [cleanOptional(givenNames), cleanOptional(surname)].filter(Boolean).join(" ") || null;
}

function composePassportOrderName(surname?: string | null, givenNames?: string | null) {
  return [cleanOptional(surname), cleanOptional(givenNames)].filter(Boolean).join(" ") || null;
}

function joinProfileParts(parts: Array<string | null | undefined>) {
  return parts.map((part) => cleanOptional(part)).filter(Boolean).join(" | ") || null;
}

function normalizeGender(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "m" || normalized === "male" || normalized === "男") return "M";
  if (normalized === "f" || normalized === "female" || normalized === "女") return "F";
  return cleanOptional(value);
}

function normalizeCountryName(value?: string | null) {
  const trimmed = cleanOptional(value);
  if (!trimmed) return null;
  const lookup = trimmed.toLowerCase();
  const match = (countries.all as CountryRecord[]).find((country) => {
    if (country.status === "deleted") return false;
    return (
      country.alpha2.toLowerCase() === lookup ||
      country.alpha3.toLowerCase() === lookup ||
      country.name.toLowerCase() === lookup
    );
  });
  return match?.name ?? trimmed;
}

export function isMissingOptionalFrequentTravelerColumnError(message?: string | null) {
  const normalized = message?.toLowerCase() ?? "";
  if (!normalized) return false;
  if (!normalized.includes("schema cache") && !normalized.includes("column") && !normalized.includes("does not exist")) {
    return false;
  }
  return Array.from(OPTIONAL_PROFILE_COLUMNS).some((column) => normalized.includes(column));
}

export function stripOptionalFrequentTravelerProfileColumns<T extends Record<string, unknown>>(payload: T) {
  const next = { ...payload };
  for (const column of OPTIONAL_PROFILE_COLUMNS) {
    delete next[column];
  }
  return next;
}

export function normalizeFrequentTravelerInput(input: FrequentTravelerInput): NormalizedFrequentTravelerInput {
  const legacyChineseName = splitChineseFullName(input.fullNameZh || (hasChinese(input.fullName) ? input.fullName : null));
  const legacyEnglishName = splitPassportOrderEnglishName(input.fullNameEn || (!hasChinese(input.fullName) ? input.fullName : null));
  const surnameZh = cleanOptional(input.surnameZh) ?? legacyChineseName.surname;
  const givenNamesZh = cleanOptional(input.givenNamesZh) ?? legacyChineseName.givenNames;
  const surnameEn = cleanOptional(input.surnameEn) ?? cleanOptional(input.surname) ?? legacyEnglishName.surname;
  const givenNamesEn = cleanOptional(input.givenNamesEn) ?? cleanOptional(input.givenNames) ?? legacyEnglishName.givenNames;
  const surname = cleanOptional(input.surname) ?? surnameEn ?? surnameZh;
  const givenNames = cleanOptional(input.givenNames) ?? givenNamesEn ?? givenNamesZh;
  const fullNameZh = cleanOptional(input.fullNameZh) ?? composeChineseName(surnameZh, givenNamesZh);
  const fullNameEn = cleanOptional(input.fullNameEn) ?? composeEnglishName(givenNamesEn ?? givenNames, surnameEn ?? surname);
  const fullName = cleanOptional(input.fullName) ?? fullNameEn ?? fullNameZh ?? composePassportOrderName(surname, givenNames);

  if (!fullName && !surname && !givenNames) {
    return { error: "Traveler name is required." };
  }

  const birthCountry = normalizeCountryName(input.birthCountry);
  const birthProvinceOrState =
    cleanOptional(input.birthProvinceOrState) ?? cleanOptional(input.birthProvinceOrStateEn) ?? cleanOptional(input.birthProvinceOrStateZh);
  const birthCity = cleanOptional(input.birthCity) ?? cleanOptional(input.birthCityEn) ?? cleanOptional(input.birthCityZh);
  const placeOfBirth = cleanOptional(input.placeOfBirth) ?? joinProfileParts([birthCountry, birthProvinceOrState, birthCity]);
  const placeOfBirthZh =
    cleanOptional(input.placeOfBirthZh) ??
    joinProfileParts([birthCountry, input.birthProvinceOrStateZh, input.birthCityZh]);
  const placeOfBirthEn =
    cleanOptional(input.placeOfBirthEn) ??
    joinProfileParts([birthCountry, input.birthProvinceOrStateEn ?? birthProvinceOrState, input.birthCityEn ?? birthCity]);

  return {
    value: {
      full_name: fullName,
      full_name_zh: fullNameZh,
      full_name_en: fullNameEn,
      surname,
      surname_zh: surnameZh || null,
      surname_en: surnameEn || null,
      given_names: givenNames,
      given_names_zh: givenNamesZh || null,
      given_names_en: givenNamesEn || null,
      date_of_birth: cleanOptional(input.dateOfBirth),
      place_of_birth: placeOfBirth,
      place_of_birth_zh: placeOfBirthZh,
      place_of_birth_en: placeOfBirthEn,
      birth_country: birthCountry,
      birth_province_or_state: birthProvinceOrState,
      birth_province_or_state_zh: cleanOptional(input.birthProvinceOrStateZh),
      birth_province_or_state_en: cleanOptional(input.birthProvinceOrStateEn),
      birth_city: birthCity,
      birth_city_zh: cleanOptional(input.birthCityZh),
      birth_city_en: cleanOptional(input.birthCityEn),
      gender: normalizeGender(input.gender),
      nationality: normalizeCountryName(input.nationality),
      occupation: cleanOptional(input.occupation) ?? cleanOptional(input.occupationEn) ?? cleanOptional(input.occupationZh),
      occupation_zh: cleanOptional(input.occupationZh),
      occupation_en: cleanOptional(input.occupationEn),
      address: cleanOptional(input.address) ?? cleanOptional(input.addressEn) ?? cleanOptional(input.addressZh),
      address_zh: cleanOptional(input.addressZh),
      address_en: cleanOptional(input.addressEn),
      passport_number: cleanOptional(input.passportNumber),
      passport_issue_date: cleanOptional(input.passportIssueDate),
      passport_expiry_date: cleanOptional(input.passportExpiryDate),
      passport_issuing_country: normalizeCountryName(input.passportIssuingCountry),
      passport_issuing_authority: cleanOptional(input.passportIssuingAuthority),
      email: cleanOptional(input.email),
      phone: cleanOptional(input.phone),
      wechat: cleanOptional(input.wechat),
      updated_at: new Date().toISOString(),
    },
  };
}

export function toFrequentTravelerSummary(row: FrequentTravelerProfileRow): FrequentTravelerSummary {
  const fullName =
    row.full_name ??
    row.full_name_en ??
    composeEnglishName(row.given_names_en ?? row.given_names, row.surname_en ?? row.surname) ??
    row.full_name_zh ??
    composeChineseName(row.surname_zh, row.given_names_zh) ??
    "";

  return {
    id: row.id,
    fullName,
    fullNameZh: row.full_name_zh ?? undefined,
    fullNameEn: row.full_name_en ?? undefined,
    surname: row.surname ?? undefined,
    surnameZh: row.surname_zh ?? undefined,
    surnameEn: row.surname_en ?? undefined,
    givenNames: row.given_names ?? undefined,
    givenNamesZh: row.given_names_zh ?? undefined,
    givenNamesEn: row.given_names_en ?? undefined,
    dateOfBirth: row.date_of_birth ?? null,
    placeOfBirth: row.place_of_birth ?? undefined,
    placeOfBirthZh: row.place_of_birth_zh ?? undefined,
    placeOfBirthEn: row.place_of_birth_en ?? undefined,
    birthCountry: row.birth_country ?? undefined,
    birthProvinceOrState: row.birth_province_or_state ?? undefined,
    birthProvinceOrStateZh: row.birth_province_or_state_zh ?? undefined,
    birthProvinceOrStateEn: row.birth_province_or_state_en ?? undefined,
    birthCity: row.birth_city ?? undefined,
    birthCityZh: row.birth_city_zh ?? undefined,
    birthCityEn: row.birth_city_en ?? undefined,
    gender: row.gender ?? undefined,
    nationality: row.nationality ?? null,
    occupation: row.occupation ?? undefined,
    occupationZh: row.occupation_zh ?? undefined,
    occupationEn: row.occupation_en ?? undefined,
    address: row.address ?? undefined,
    addressZh: row.address_zh ?? undefined,
    addressEn: row.address_en ?? undefined,
    passportNumber: row.passport_number ?? null,
    passportIssueDate: row.passport_issue_date ?? undefined,
    passportExpiryDate: row.passport_expiry_date ?? null,
    passportIssuingCountry: row.passport_issuing_country ?? undefined,
    passportIssuingAuthority: row.passport_issuing_authority ?? undefined,
    email: row.email ?? null,
    phone: row.phone ?? null,
    wechat: row.wechat ?? undefined,
    updatedAt: row.updated_at ?? null,
  };
}

export function toUniversalProfileSnapshot(row: FrequentTravelerProfileRow | null | undefined): UniversalProfileSnapshot | null {
  if (!row) return null;
  return {
    full_name: row.full_name ?? null,
    full_name_zh: row.full_name_zh ?? null,
    full_name_en: row.full_name_en ?? null,
    surname: row.surname ?? null,
    surname_zh: row.surname_zh ?? null,
    surname_en: row.surname_en ?? null,
    given_names: row.given_names ?? null,
    given_names_zh: row.given_names_zh ?? null,
    given_names_en: row.given_names_en ?? null,
    date_of_birth: row.date_of_birth ?? null,
    place_of_birth: row.place_of_birth ?? null,
    place_of_birth_zh: row.place_of_birth_zh ?? null,
    place_of_birth_en: row.place_of_birth_en ?? null,
    birth_country: row.birth_country ?? null,
    birth_province_or_state: row.birth_province_or_state ?? null,
    birth_province_or_state_zh: row.birth_province_or_state_zh ?? null,
    birth_province_or_state_en: row.birth_province_or_state_en ?? null,
    birth_city: row.birth_city ?? null,
    birth_city_zh: row.birth_city_zh ?? null,
    birth_city_en: row.birth_city_en ?? null,
    gender: row.gender ?? null,
    nationality: row.nationality ?? null,
    occupation: row.occupation ?? null,
    occupation_zh: row.occupation_zh ?? null,
    occupation_en: row.occupation_en ?? null,
    address: row.address ?? null,
    address_zh: row.address_zh ?? null,
    address_en: row.address_en ?? null,
    passport_number: row.passport_number ?? null,
    passport_issue_date: row.passport_issue_date ?? null,
    passport_expiry_date: row.passport_expiry_date ?? null,
    passport_issuing_country: row.passport_issuing_country ?? null,
    passport_issuing_authority: row.passport_issuing_authority ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    wechat: row.wechat ?? null,
  };
}
