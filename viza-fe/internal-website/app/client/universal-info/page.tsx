"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, AtSign, CheckCircle2, CheckIcon, ChevronDown, Database, Loader2, MapPin, Phone, Save, ShieldCheck, User, WalletCards } from "lucide-react";
import { CircleFlag } from "react-circle-flags";
import { countries } from "country-data-list";
import {
  ensureDraftApplication,
  saveUniversalProfileWithSharedAnswers,
} from "@/app/actions/visa-application-answers";
import { loadUniversalProfilePassportUploadStatus } from "@/app/client/documents/actions";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { PassportOcrUpload } from "@/components/client/passport-ocr-upload";
import {
  BilingualCountryControl,
  BilingualDateControl,
  BilingualOptionControl,
  BilingualTextControl,
  COUNTRY_OPTIONS,
  findBilingualOption,
  mirrorText,
  type BilingualOptionPair,
} from "@/components/application-steps/bilingual-form-shared";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  getBirthCityOptions,
  getBirthProvinceOptions,
  findBirthCityOption,
  findBirthProvinceOption,
  normalizeBirthplace,
  OTHER_BIRTHPLACE_OPTION,
  type BirthplaceOption,
} from "@/lib/birthplace-options";
import { toChineseSourceValue, toOfficialEnglishValue } from "@/lib/ds160-translations";
import { isChineseLocale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { UniversalProfileSnapshot } from "@/lib/universal-profile-prefill";

interface UniversalProfileForm {
  full_name: string;
  surname: string;
  given_names: string;
  date_of_birth: string;
  place_of_birth: string;
  birth_country: string;
  birth_province_or_state: string;
  birth_city: string;
  gender: string;
  nationality: string;
  occupation: string;
  address: string;
  passport_number: string;
  passport_issue_date: string;
  passport_expiry_date: string;
  passport_issuing_country: string;
  email: string;
  phone: string;
  wechat: string;
}

const BILINGUAL_PROFILE_FIELDS = [
  "full_name",
  "surname",
  "given_names",
  "place_of_birth",
  "birth_province_or_state",
  "birth_city",
  "occupation",
  "address",
] as const;
type BilingualProfileField = (typeof BILINGUAL_PROFILE_FIELDS)[number];
type BilingualProfileColumn = `${BilingualProfileField}_zh` | `${BilingualProfileField}_en`;

const TRANSLATABLE_PROFILE_FIELDS = ["birth_province_or_state", "birth_city", "occupation", "address"] as const;
type TranslationStatus = "idle" | "translating" | "translated" | "failed" | "manual";

interface BilingualTextValue {
  zh: string;
  en: string;
}

interface PassportUploadState {
  uploaded: boolean;
  fileName: string | null;
  status: string | null;
  updatedAt: string | null;
}

interface PhoneCountryRecord {
  alpha2: string;
  countryCallingCodes: string[];
  emoji?: string;
  ioc: string;
  name: string;
  status: string;
}

interface PhoneDialCodeOption {
  countryCode: string;
  dialCode: string;
  dialDigits: string;
  enName: string;
}

interface PhoneNumberRule {
  pattern?: RegExp;
  min?: number;
  max?: number;
  zhHint: string;
  enHint: string;
}

type BilingualProfileState = Record<BilingualProfileField, BilingualTextValue>;
type UniversalProfileRow = Partial<UniversalProfileForm> & Partial<Record<BilingualProfileColumn, string | null>>;

const EMPTY_FORM: UniversalProfileForm = {
  full_name: "",
  surname: "",
  given_names: "",
  date_of_birth: "",
  place_of_birth: "",
  birth_country: "",
  birth_province_or_state: "",
  birth_city: "",
  gender: "",
  nationality: "",
  occupation: "",
  address: "",
  passport_number: "",
  passport_issue_date: "",
  passport_expiry_date: "",
  passport_issuing_country: "",
  email: "",
  phone: "",
  wechat: "",
};

const EMPTY_BILINGUAL_FORM: BilingualProfileState = {
  full_name: { zh: "", en: "" },
  surname: { zh: "", en: "" },
  given_names: { zh: "", en: "" },
  place_of_birth: { zh: "", en: "" },
  birth_province_or_state: { zh: "", en: "" },
  birth_city: { zh: "", en: "" },
  occupation: { zh: "", en: "" },
  address: { zh: "", en: "" },
};

const EMPTY_PASSPORT_UPLOAD: PassportUploadState = {
  uploaded: false,
  fileName: null,
  status: null,
  updatedAt: null,
};

const PROFILE_FIELDS: Array<keyof UniversalProfileForm> = [
  "surname",
  "given_names",
  "date_of_birth",
  "birth_country",
  "birth_province_or_state",
  "birth_city",
  "gender",
  "nationality",
  "occupation",
  "address",
  "passport_number",
  "passport_issue_date",
  "passport_expiry_date",
  "passport_issuing_country",
  "email",
  "phone",
  "wechat",
];

const GENDER_OPTIONS: BilingualOptionPair[] = [
  { code: "M", zh: "男", en: "Male" },
  { code: "F", zh: "女", en: "Female" },
];

const DEFAULT_PHONE_COUNTRY_CODE = "CN";
const PRIORITY_PHONE_COUNTRIES = ["CN", "US", "CA", "GB", "SG", "JP", "AU", "HK", "MO", "TW", "KR", "TH", "VN", "MY", "ID"];

const PHONE_NUMBER_RULES: Record<string, PhoneNumberRule> = {
  CN: {
    pattern: /^1[3-9]\d{9}$/,
    zhHint: "中国大陆手机号应为 11 位，通常以 1 开头，例如 13312345678。",
    enHint: "China mobile numbers should be 11 digits and usually start with 1, for example 13312345678.",
  },
  US: {
    pattern: /^\d{10}$/,
    zhHint: "美国号码请填写 10 位本地号码，不需要再输入 +1。",
    enHint: "US numbers should use 10 local digits. Do not enter +1 again.",
  },
  CA: {
    pattern: /^\d{10}$/,
    zhHint: "加拿大号码请填写 10 位本地号码，不需要再输入 +1。",
    enHint: "Canada numbers should use 10 local digits. Do not enter +1 again.",
  },
  GB: {
    pattern: /^0?\d{10}$/,
    zhHint: "英国号码通常为 10 位，若包含开头 0 则为 11 位。",
    enHint: "UK numbers are usually 10 digits, or 11 digits when including the leading 0.",
  },
  SG: {
    pattern: /^[3689]\d{7}$/,
    zhHint: "新加坡号码应为 8 位，并通常以 3、6、8 或 9 开头。",
    enHint: "Singapore numbers should be 8 digits and usually start with 3, 6, 8, or 9.",
  },
  HK: {
    pattern: /^[23569]\d{7}$/,
    zhHint: "香港号码应为 8 位，并通常以 2、3、5、6 或 9 开头。",
    enHint: "Hong Kong numbers should be 8 digits and usually start with 2, 3, 5, 6, or 9.",
  },
  MO: {
    pattern: /^6\d{7}$/,
    zhHint: "澳门手机号码应为 8 位，并通常以 6 开头。",
    enHint: "Macau mobile numbers should be 8 digits and usually start with 6.",
  },
  TW: {
    pattern: /^(?:0?9\d{8}|0?[2-8]\d{7,8})$/,
    zhHint: "台湾手机通常为 09 开头 10 位，或去掉开头 0 后 9 位。",
    enHint: "Taiwan mobile numbers usually start with 09 and have 10 digits, or 9 digits without the leading 0.",
  },
  JP: {
    pattern: /^0?\d{9,10}$/,
    zhHint: "日本号码通常为 9-10 位，若包含开头 0 则为 10-11 位。",
    enHint: "Japan numbers are usually 9-10 digits, or 10-11 digits when including the leading 0.",
  },
  AU: {
    pattern: /^0?[2-478]\d{8}$/,
    zhHint: "澳大利亚号码通常为 9 位，若包含开头 0 则为 10 位。",
    enHint: "Australia numbers are usually 9 digits, or 10 digits when including the leading 0.",
  },
  FR: {
    pattern: /^0?[1-9]\d{8}$/,
    zhHint: "法国号码通常为 9 位，若包含开头 0 则为 10 位。",
    enHint: "France numbers are usually 9 digits, or 10 digits when including the leading 0.",
  },
  DE: {
    min: 5,
    max: 13,
    zhHint: "德国本地号码通常为 5-13 位数字。",
    enHint: "Germany local numbers are usually 5-13 digits.",
  },
  IN: {
    pattern: /^[6-9]\d{9}$/,
    zhHint: "印度手机号码应为 10 位，并通常以 6-9 开头。",
    enHint: "India mobile numbers should be 10 digits and usually start with 6-9.",
  },
  AE: {
    pattern: /^(?:0?5\d{8}|0?[2-9]\d{7})$/,
    zhHint: "阿联酋手机通常为 5 开头 9 位，或包含开头 0 后 10 位。",
    enHint: "UAE mobile numbers usually start with 5 and have 9 digits, or 10 digits with the leading 0.",
  },
  MY: {
    pattern: /^0?\d{8,10}$/,
    zhHint: "马来西亚号码通常为 8-10 位，若包含开头 0 则为 9-11 位。",
    enHint: "Malaysia numbers are usually 8-10 digits, or 9-11 digits with the leading 0.",
  },
  TH: {
    pattern: /^(?:0?[689]\d{8}|0?2\d{7})$/,
    zhHint: "泰国手机通常为 9 位，若包含开头 0 则为 10 位。",
    enHint: "Thailand mobile numbers are usually 9 digits, or 10 digits with the leading 0.",
  },
  VN: {
    pattern: /^0?[35789]\d{8}$/,
    zhHint: "越南手机通常为 9 位，若包含开头 0 则为 10 位。",
    enHint: "Vietnam mobile numbers are usually 9 digits, or 10 digits with the leading 0.",
  },
  ID: {
    pattern: /^0?8\d{8,11}$/,
    zhHint: "印度尼西亚手机通常以 8 开头，号码长度为 9-12 位。",
    enHint: "Indonesia mobile numbers usually start with 8 and have 9-12 digits.",
  },
  PH: {
    pattern: /^0?9\d{9}$/,
    zhHint: "菲律宾手机通常为 9 开头 10 位，或包含开头 0 后 11 位。",
    enHint: "Philippines mobile numbers usually start with 9 and have 10 digits, or 11 digits with the leading 0.",
  },
  NZ: {
    min: 8,
    max: 10,
    zhHint: "新西兰本地号码通常为 8-10 位数字。",
    enHint: "New Zealand local numbers are usually 8-10 digits.",
  },
};

const PHONE_PLACEHOLDERS: Record<string, string> = {
  CN: "13312345678",
  US: "5551234567",
  CA: "5551234567",
  GB: "7123456789",
  SG: "81234567",
  HK: "51234567",
  MO: "61234567",
  TW: "912345678",
  JP: "9012345678",
  AU: "412345678",
};

const PHONE_DIAL_CODE_OPTIONS = buildPhoneDialCodeOptions();

function cleanValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function copy(isZh: boolean, zh: string, en: string) {
  return isZh ? zh : en;
}

function normalizeGender(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "m" || normalized === "male" || normalized === "男") return "M";
  if (normalized === "f" || normalized === "female" || normalized === "女") return "F";
  return "";
}

function normalizeCountryCode(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return "";
  return findBilingualOption(COUNTRY_OPTIONS, normalized)?.code ?? normalized;
}

function buildPhoneDialCodeOptions(): PhoneDialCodeOption[] {
  const priorityIndex = new Map(PRIORITY_PHONE_COUNTRIES.map((code, index) => [code, index]));
  return (countries.all as PhoneCountryRecord[])
    .filter((country) => country.emoji && country.status !== "deleted" && country.ioc !== "PRK")
    .flatMap((country) =>
      country.countryCallingCodes
        .filter((dialCode) => /^\+\d+$/.test(dialCode))
        .map((dialCode) => ({
          countryCode: country.alpha2,
          dialCode,
          dialDigits: dialCode.replace(/\D/g, ""),
          enName: country.name,
        })),
    )
    .sort((a, b) => {
      const aPriority = priorityIndex.get(a.countryCode) ?? Number.MAX_SAFE_INTEGER;
      const bPriority = priorityIndex.get(b.countryCode) ?? Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) return aPriority - bPriority;
      if (a.dialCode !== b.dialCode) return a.dialCode.localeCompare(b.dialCode);
      return a.enName.localeCompare(b.enName);
    });
}

function getLocalizedPhoneCountryName(countryCode: string, locale: "zh" | "en") {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    return displayNames.of(countryCode.toUpperCase()) ?? countryCode;
  } catch {
    return countryCode;
  }
}

function getPhoneDialCodeOption(countryCode: string) {
  return PHONE_DIAL_CODE_OPTIONS.find((option) => option.countryCode === countryCode) ??
    PHONE_DIAL_CODE_OPTIONS.find((option) => option.countryCode === DEFAULT_PHONE_COUNTRY_CODE) ??
    PHONE_DIAL_CODE_OPTIONS[0];
}

function extractPhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function sanitizePhoneLocalInput(value: string) {
  return value.replace(/[^\d\s().-]/g, "").replace(/\s+/g, " ").trimStart();
}

function splitPhoneValue(value: string, fallbackCountryCode: string) {
  const fallbackOption = getPhoneDialCodeOption(fallbackCountryCode);
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      countryCode: fallbackOption?.countryCode ?? DEFAULT_PHONE_COUNTRY_CODE,
      localNumber: "",
    };
  }

  if (/^\+/.test(trimmed)) {
    const allDigits = extractPhoneDigits(trimmed);
    const fallbackMatches =
      fallbackOption && allDigits.startsWith(fallbackOption.dialDigits)
        ? fallbackOption
        : null;
    const matchedOption = fallbackMatches ??
      PHONE_DIAL_CODE_OPTIONS
        .filter((option) => allDigits.startsWith(option.dialDigits))
        .sort((a, b) => b.dialDigits.length - a.dialDigits.length)[0];

    if (matchedOption) {
      return {
        countryCode: matchedOption.countryCode,
        localNumber: allDigits.slice(matchedOption.dialDigits.length),
      };
    }
  }

  return {
    countryCode: fallbackOption?.countryCode ?? DEFAULT_PHONE_COUNTRY_CODE,
    localNumber: sanitizePhoneLocalInput(trimmed),
  };
}

function composePhoneValue(countryCode: string, localNumber: string) {
  const option = getPhoneDialCodeOption(countryCode);
  const normalizedLocalNumber = sanitizePhoneLocalInput(localNumber).trim();
  if (!option || !normalizedLocalNumber) return "";
  return `${option.dialCode} ${normalizedLocalNumber}`;
}

function getPhonePlaceholder(countryCode: string) {
  return PHONE_PLACEHOLDERS[countryCode] ?? "13312345678";
}

function validatePhoneNumberValue(value: string, countryCode: string, isZh: boolean) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const phoneParts = splitPhoneValue(trimmed, countryCode);
  const option = getPhoneDialCodeOption(phoneParts.countryCode);
  const localDigits = extractPhoneDigits(phoneParts.localNumber);
  if (!option || !localDigits) {
    return copy(isZh, "请填写联系电话号码。", "Enter a contact phone number.");
  }

  const totalDigits = option.dialDigits.length + localDigits.length;
  if (totalDigits < 8 || totalDigits > 15) {
    return copy(
      isZh,
      "电话号码总长度需符合国际格式，含国家区号通常为 8-15 位数字。",
      "Phone numbers should match the international format, usually 8-15 digits including the country code.",
    );
  }

  if (/^(\d)\1+$/.test(localDigits)) {
    return copy(isZh, "电话号码不能全部为同一个数字。", "The phone number cannot be the same digit repeated.");
  }

  const rule = PHONE_NUMBER_RULES[phoneParts.countryCode];
  if (!rule) return null;

  if (rule.pattern && !rule.pattern.test(localDigits)) {
    return copy(isZh, rule.zhHint, rule.enHint);
  }
  if (rule.min && localDigits.length < rule.min) {
    return copy(isZh, rule.zhHint, rule.enHint);
  }
  if (rule.max && localDigits.length > rule.max) {
    return copy(isZh, rule.zhHint, rule.enHint);
  }

  return null;
}

function countryEnglishName(value: string) {
  return findBilingualOption(COUNTRY_OPTIONS, value)?.en ?? value;
}

function countryChineseName(value: string) {
  return findBilingualOption(COUNTRY_OPTIONS, value)?.zh ?? value;
}

function hasChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function textOrNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function splitStoredBilingualValue(value?: string | null): BilingualTextValue | null {
  const trimmed = textOrNull(value);
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+\/\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const zh = parts.find(hasChinese);
  const en = parts.find((part) => !hasChinese(part));
  if (!zh && !en) return null;
  return { zh: zh ?? "", en: en ?? "" };
}

function joinBirthplaceParts(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" | ");
}

function parseLegacyBirthplace(value?: string | null) {
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

function optionToBilingualValue(option: BirthplaceOption | undefined): BilingualTextValue {
  if (!option || option.code === OTHER_BIRTHPLACE_OPTION.code) return { zh: "", en: "" };
  return { zh: option.zh, en: option.en };
}

function isOtherBirthplaceValue(value: string) {
  return value === OTHER_BIRTHPLACE_OPTION.code;
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

function composeChineseName(surname: string, givenNames: string) {
  return `${surname.trim()}${givenNames.trim()}`.trim();
}

function composeEnglishFullName(givenNames: string, surname: string) {
  return [givenNames.trim(), surname.trim()].filter(Boolean).join(" ");
}

function isTranslatableProfileField(field: BilingualProfileField) {
  return TRANSLATABLE_PROFILE_FIELDS.includes(field as (typeof TRANSLATABLE_PROFILE_FIELDS)[number]);
}

function toEnglishProfileValue(field: BilingualProfileField, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!hasChinese(trimmed)) return trimmed;

  if (field === "full_name") {
    const compactName = trimmed.replace(/\s+/g, "");
    if (/^[\u3400-\u9fff]+$/.test(compactName) && compactName.length > 1) {
      const surname = toOfficialEnglishValue(compactName.slice(0, 1));
      const givenNames = Array.from(compactName.slice(1))
        .map((character) => toOfficialEnglishValue(character))
        .join("");
      if (surname && givenNames && !hasChinese(`${surname}${givenNames}`)) {
        return `${surname} ${givenNames}`;
      }
    }
  }

  const english = toOfficialEnglishValue(trimmed);
  return hasChinese(english) ? "" : english;
}

function toInitialBilingualValue(profile: UniversalProfileRow, field: BilingualProfileField): BilingualTextValue {
  const storedZh = textOrNull(profile[`${field}_zh`]);
  const storedEn = textOrNull(profile[`${field}_en`]);
  if (storedZh || storedEn) {
    return {
      zh: storedZh ?? (storedEn ? toChineseSourceValue(storedEn) : ""),
      en: storedEn ?? (storedZh ? toEnglishProfileValue(field, storedZh) : ""),
    };
  }

  const canonical = textOrNull(profile[field]);
  const storedPair = splitStoredBilingualValue(canonical);
  if (storedPair) {
    return {
      zh: storedPair.zh,
      en: storedPair.en || (storedPair.zh ? toEnglishProfileValue(field, storedPair.zh) : ""),
    };
  }

  if (!canonical) return { zh: "", en: "" };
  if (hasChinese(canonical)) {
    return {
      zh: canonical,
      en: toEnglishProfileValue(field, canonical),
    };
  }

  return {
    zh: toChineseSourceValue(canonical),
    en: canonical,
  };
}

function toInitialBilingualForm(profile: UniversalProfileRow | null): BilingualProfileState {
  if (!profile) return EMPTY_BILINGUAL_FORM;
  const legacyChineseName = splitChineseFullName(profile.full_name_zh ?? (hasChinese(profile.full_name ?? "") ? profile.full_name : null));
  const legacyEnglishName = splitPassportOrderEnglishName(
    profile.full_name_en ?? (!hasChinese(profile.full_name ?? "") ? profile.full_name : null),
  );
  const storedSurname = toInitialBilingualValue(profile, "surname");
  const storedGivenNames = toInitialBilingualValue(profile, "given_names");
  const legacyBirthplaceZh = parseLegacyBirthplace(profile.place_of_birth_zh);
  const legacyBirthplaceEn = parseLegacyBirthplace(profile.place_of_birth_en ?? profile.place_of_birth);
  const legacyPlaceOfBirth = toInitialBilingualValue(profile, "place_of_birth");
  const birthCity = toInitialBilingualValue(profile, "birth_city");
  const birthProvince = toInitialBilingualValue(profile, "birth_province_or_state");

  return {
    full_name: toInitialBilingualValue(profile, "full_name"),
    surname: storedSurname.zh || storedSurname.en
      ? storedSurname
      : {
          zh: legacyChineseName.surname,
          en: legacyChineseName.surname ? toEnglishProfileValue("surname", legacyChineseName.surname) : legacyEnglishName.surname,
        },
    given_names: storedGivenNames.zh || storedGivenNames.en
      ? storedGivenNames
      : {
          zh: legacyChineseName.givenNames,
          en: legacyChineseName.givenNames ? toEnglishProfileValue("given_names", legacyChineseName.givenNames) : legacyEnglishName.givenNames,
        },
    place_of_birth: legacyPlaceOfBirth,
    birth_province_or_state: birthProvince.zh || birthProvince.en
      ? birthProvince
      : {
          zh: legacyBirthplaceZh.provinceOrState,
          en: legacyBirthplaceEn.provinceOrState,
        },
    birth_city: birthCity.zh || birthCity.en
      ? birthCity
      : {
          zh: legacyBirthplaceZh.city || legacyPlaceOfBirth.zh,
          en: legacyBirthplaceEn.city || legacyPlaceOfBirth.en,
        },
    occupation: toInitialBilingualValue(profile, "occupation"),
    address: toInitialBilingualValue(profile, "address"),
  };
}

function updateMirroredValue(value: string) {
  return mirrorText(value);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-[22px] font-medium text-brand-500">
      {children}
    </h2>
  );
}

function ProfileBilingualRow({
  zhLabel,
  enLabel,
  zhControl,
  enControl,
  footer,
}: {
  zhLabel: string;
  enLabel: string;
  zhControl: React.ReactNode;
  enControl: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-4 px-0 py-4 sm:px-2 md:grid-cols-2">
      <div className="min-w-0">
        <span className="mb-2 block text-[15px] font-medium leading-tight text-[#1f2f46]">{zhLabel}</span>
        {zhControl}
      </div>
      <div className="min-w-0">
        <span className="mb-2 block text-[15px] font-medium leading-tight text-[#1f2f46]">{enLabel}</span>
        {enControl}
      </div>
      {footer ? <div className="min-w-0 md:col-span-2">{footer}</div> : null}
    </div>
  );
}

function TranslationHint({ status, isZh }: { status?: TranslationStatus; isZh: boolean }) {
  if (!status || status === "idle") return null;
  const message = {
    translating: copy(isZh, "正在自动翻译...", "Auto translating..."),
    translated: copy(isZh, "已自动翻译，可继续手动修改英文侧。", "Auto translated. You can still edit the English side."),
    failed: copy(isZh, "暂时无法自动翻译，请手动填写英文侧。", "Auto translation is unavailable. Please fill the English side manually."),
    manual: copy(isZh, "英文侧已手动编辑，本次未自动覆盖。", "English side was edited manually, so it was not overwritten."),
  }[status];

  return (
    <p className="text-[12px] font-medium text-[#667085]" aria-live="polite">
      {message}
    </p>
  );
}

function AddressControl({
  side,
  value,
  placeholder,
  onChange,
  onBlur,
}: {
  side: "zh" | "en";
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <Textarea
      aria-label={side === "zh" ? "中文" : "English"}
      className="min-h-[110px] rounded-lg border-[#e8e8e8] text-[15px] shadow-xs focus-visible:border-brand-500 focus-visible:ring-1 focus-visible:ring-brand-500"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
    />
  );
}

function PhoneDialCodeSelect({
  value,
  isZh,
  onChange,
}: {
  value: string;
  isZh: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = getPhoneDialCodeOption(value);
  const selectedCountryName = selectedOption
    ? getLocalizedPhoneCountryName(selectedOption.countryCode, isZh ? "zh" : "en")
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex h-12 w-[132px] shrink-0 items-center justify-between rounded-lg border border-[#e8e8e8] bg-transparent px-3 text-[15px] font-normal shadow-xs hover:bg-transparent focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        aria-label={copy(isZh, "选择国家区号", "Select country calling code")}
      >
        {selectedOption ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
              <CircleFlag countryCode={selectedOption.countryCode.toLowerCase()} height={20} />
            </span>
            <span className="shrink-0 font-medium text-[#1f2f46]">{selectedOption.dialCode}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">+86</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </PopoverTrigger>
      <PopoverContent collisionPadding={10} side="bottom" className="min-w-[300px] p-0">
        <Command
          className="w-full"
          filter={(commandValue, search, keywords) => {
            const haystack = [commandValue, ...(keywords ?? [])].join(" ").toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={copy(isZh, "搜索国家或区号...", "Search country or code...")} />
          <CommandList className="max-h-[240px]">
            <CommandEmpty>{copy(isZh, "未找到区号", "No calling code found.")}</CommandEmpty>
            <CommandGroup>
              {PHONE_DIAL_CODE_OPTIONS.map((option) => {
                const countryName = getLocalizedPhoneCountryName(option.countryCode, isZh ? "zh" : "en");
                return (
                  <CommandItem
                    className="flex w-full items-center gap-2 [&_svg]:size-auto"
                    key={`${option.countryCode}-${option.dialCode}`}
                    value={`${option.countryCode}-${option.dialCode}`}
                    keywords={[countryName, option.enName, option.countryCode, option.dialCode]}
                    onSelect={() => {
                      onChange(option.countryCode);
                      setOpen(false);
                    }}
                  >
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
                      <CircleFlag countryCode={option.countryCode.toLowerCase()} height={20} />
                    </span>
                    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {countryName}
                    </span>
                    <span className="shrink-0 font-medium text-[#1f2f46]">{option.dialCode}</span>
                    <CheckIcon
                      className={cn(
                        "ml-auto !h-4 !w-4 shrink-0",
                        selectedOption?.countryCode === option.countryCode ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
      {selectedCountryName ? <span className="sr-only">{selectedCountryName}</span> : null}
    </Popover>
  );
}

function PhoneNumberControl({
  side,
  isZh,
  countryCode,
  localNumber,
  error,
  onCountryChange,
  onNumberChange,
  onBlur,
}: {
  side: "zh" | "en";
  isZh: boolean;
  countryCode: string;
  localNumber: string;
  error: string | null;
  onCountryChange: (value: string) => void;
  onNumberChange: (value: string) => void;
  onBlur: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 gap-2">
      <PhoneDialCodeSelect
        value={countryCode}
        isZh={isZh}
        onChange={onCountryChange}
      />
      <InputGroup
        className={cn(
          "h-12 min-w-0 flex-1 rounded-lg border-[#e8e8e8] focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500",
          error && "border-red-300 focus-within:border-red-500 focus-within:ring-red-500",
        )}
      >
        <InputGroupAddon align="inline-start">
          <Phone className="h-4 w-4 text-gray-400" />
        </InputGroupAddon>
        <InputGroupInput
          id={`universal-phone-${side}`}
          type="tel"
          aria-label={side === "zh" ? "联系电话" : "Phone number"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "universal-phone-error" : undefined}
          value={localNumber}
          onChange={(event) => onNumberChange(sanitizePhoneLocalInput(event.target.value))}
          onBlur={(event) => onBlur(event.currentTarget.value)}
          placeholder={getPhonePlaceholder(countryCode)}
          autoComplete="tel"
          className="h-12 text-[15px]"
        />
      </InputGroup>
    </div>
  );
}

export default function UniversalInfoPage() {
  const router = useRouter();
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [form, setForm] = useState<UniversalProfileForm>(EMPTY_FORM);
  const [bilingualForm, setBilingualForm] = useState<BilingualProfileState>(EMPTY_BILINGUAL_FORM);
  const [translationStatus, setTranslationStatus] = useState<Partial<Record<BilingualProfileField, TranslationStatus>>>({});
  const [manualEnglishFields, setManualEnglishFields] = useState<Partial<Record<BilingualProfileField, boolean>>>({});
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_PHONE_COUNTRY_CODE);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [shouldFocusPhoneError, setShouldFocusPhoneError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [passportOcrApplicationId, setPassportOcrApplicationId] = useState<string | null>(null);
  const [passportUpload, setPassportUpload] = useState<PassportUploadState>(EMPTY_PASSPORT_UPLOAD);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completedProfileFieldCount = useMemo(() => {
    return PROFILE_FIELDS.filter((field) => {
      if (BILINGUAL_PROFILE_FIELDS.includes(field as BilingualProfileField)) {
        const bilingualValue = bilingualForm[field as BilingualProfileField];
        return Boolean(bilingualValue.zh.trim() || bilingualValue.en.trim());
      }
      return Boolean(form[field].trim());
    }).length;
  }, [bilingualForm, form]);
  const completedCount = completedProfileFieldCount + (passportUpload.uploaded ? 1 : 0);
  const completionTotal = PROFILE_FIELDS.length + 1;
  const completionPercent = Math.round((completedCount / completionTotal) * 100);
  const phoneParts = useMemo(
    () => splitPhoneValue(form.phone, phoneCountryCode),
    [form.phone, phoneCountryCode],
  );
  const birthProvinceOptions = useMemo(
    () => getBirthProvinceOptions(form.birth_country),
    [form.birth_country],
  );
  const birthCityOptions = useMemo(
    () => getBirthCityOptions(form.birth_country, form.birth_province_or_state),
    [form.birth_country, form.birth_province_or_state],
  );
  const isOtherBirthProvince = isOtherBirthplaceValue(form.birth_province_or_state);
  const isOtherBirthCity = isOtherBirthplaceValue(form.birth_city);

  useEffect(() => {
    if (!shouldFocusPhoneError || !phoneError) return;
    const focusTimer = window.setTimeout(() => {
      const phoneInput = document.getElementById("universal-phone-zh");
      if (phoneInput instanceof HTMLInputElement) {
        phoneInput.focus({ preventScroll: true });
        phoneInput.select();
      }
      setShouldFocusPhoneError(false);
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [phoneError, shouldFocusPhoneError]);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/client/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("applicant_profiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError) {
        setError(isZh ? "读取通用资料失败，请稍后重试。" : "Could not load your universal profile. Please try again later.");
        setIsLoading(false);
        return;
      }

      const typedProfile = profile as UniversalProfileRow | null;
      if (!typedProfile) {
        await supabase.from("applicant_profiles").upsert(
          {
            auth_user_id: user.id,
            email: user.email ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "auth_user_id" },
        );
      }

      const draftResult = await ensureDraftApplication("us", "b1_b2", { preferExplicit: true });
      if (isMounted && draftResult.applicationId) {
        setPassportOcrApplicationId(draftResult.applicationId);
        const uploadResult = await loadUniversalProfilePassportUploadStatus(draftResult.applicationId);
        if (isMounted && uploadResult.ok) {
          setPassportUpload({
            uploaded: uploadResult.uploaded,
            fileName: uploadResult.fileName,
            status: uploadResult.status,
            updatedAt: uploadResult.updatedAt,
          });
        }
      }

      const legacyBirthplace = parseLegacyBirthplace(typedProfile?.place_of_birth_en ?? typedProfile?.place_of_birth);
      const initialBilingual = toInitialBilingualForm(typedProfile);
      const normalizedBirthplace = normalizeBirthplace({
        placeOfBirth: typedProfile?.place_of_birth_en ?? typedProfile?.place_of_birth_zh ?? typedProfile?.place_of_birth,
        country: typedProfile?.birth_country || legacyBirthplace.country || typedProfile?.nationality,
        province: typedProfile?.birth_province_or_state ?? legacyBirthplace.provinceOrState,
        provinceZh: initialBilingual.birth_province_or_state.zh,
        provinceEn: initialBilingual.birth_province_or_state.en,
        city: typedProfile?.birth_city ?? legacyBirthplace.city,
        cityZh: initialBilingual.birth_city.zh,
        cityEn: initialBilingual.birth_city.en,
        nationality: typedProfile?.nationality,
      });
      const normalizedInitialBilingual: BilingualProfileState = {
        ...initialBilingual,
        place_of_birth: {
          zh: normalizedBirthplace.placeOfBirthZh || initialBilingual.place_of_birth.zh,
          en: normalizedBirthplace.placeOfBirthEn || initialBilingual.place_of_birth.en,
        },
        birth_province_or_state: normalizedBirthplace.province.zh || normalizedBirthplace.province.en
          ? normalizedBirthplace.province
          : initialBilingual.birth_province_or_state,
        birth_city: normalizedBirthplace.city.zh || normalizedBirthplace.city.en
          ? normalizedBirthplace.city
          : initialBilingual.birth_city,
      };
      const initialBirthCountry = normalizedBirthplace.countryCode || normalizeCountryCode(
        typedProfile?.birth_country || legacyBirthplace.country || typedProfile?.nationality,
      );
      const initialFullNameEn = composeEnglishFullName(initialBilingual.given_names.en, initialBilingual.surname.en);
      const initialFullNameZh = composeChineseName(initialBilingual.surname.zh, initialBilingual.given_names.zh);
      const initialPhone = typedProfile?.phone ?? "";
      const initialPhoneParts = splitPhoneValue(initialPhone, DEFAULT_PHONE_COUNTRY_CODE);

      setForm({
        full_name: initialFullNameEn || initialFullNameZh || initialBilingual.full_name.en || initialBilingual.full_name.zh,
        surname: initialBilingual.surname.en || initialBilingual.surname.zh,
        given_names: initialBilingual.given_names.en || initialBilingual.given_names.zh,
        date_of_birth: typedProfile?.date_of_birth ?? "",
        place_of_birth: normalizedBirthplace.placeOfBirthEn || normalizedBirthplace.placeOfBirthZh || initialBilingual.place_of_birth.en || initialBilingual.place_of_birth.zh,
        birth_country: initialBirthCountry,
        birth_province_or_state: normalizedBirthplace.provinceCode,
        birth_city: normalizedBirthplace.cityCode,
        gender: normalizeGender(typedProfile?.gender),
        nationality: normalizeCountryCode(typedProfile?.nationality),
        occupation: initialBilingual.occupation.en || initialBilingual.occupation.zh,
        address: initialBilingual.address.en || initialBilingual.address.zh,
        passport_number: typedProfile?.passport_number ?? "",
        passport_issue_date: typedProfile?.passport_issue_date ?? "",
        passport_expiry_date: typedProfile?.passport_expiry_date ?? "",
        passport_issuing_country: normalizeCountryCode(typedProfile?.passport_issuing_country),
        email: typedProfile?.email ?? user.email ?? "",
        phone: initialPhone,
        wechat: typedProfile?.wechat ?? "",
      });
      setPhoneCountryCode(initialPhoneParts.countryCode);
      setBilingualForm(normalizedInitialBilingual);
      setManualEnglishFields({});
      setTranslationStatus({});
      setIsLoading(false);
    }

    void loadProfile();
    return () => { isMounted = false; };
  }, [isZh, router]);

  function updateField(field: keyof UniversalProfileForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "nationality" && !current.birth_country ? { birth_country: value } : {}),
    }));
    if (field === "phone") {
      setPhoneError(null);
      setShouldFocusPhoneError(false);
    }
    setMessage(null);
    setError(null);
  }

  function setBirthplaceBilingualField(field: "birth_province_or_state" | "birth_city", value: BilingualTextValue) {
    setBilingualForm((current) => ({ ...current, [field]: value }));
    setTranslationStatus((current) => ({ ...current, [field]: "idle" }));
    setMessage(null);
    setError(null);
  }

  function updateBirthCountry(value: string) {
    const nextCountry = normalizeCountryCode(value);
    setForm((current) => ({
      ...current,
      birth_country: nextCountry,
      birth_province_or_state: "",
      birth_city: "",
      ...(current.nationality ? {} : { nationality: nextCountry }),
    }));
    setBilingualForm((current) => ({
      ...current,
      birth_province_or_state: { zh: "", en: "" },
      birth_city: { zh: "", en: "" },
      place_of_birth: { zh: "", en: "" },
    }));
    setTranslationStatus((current) => ({
      ...current,
      birth_province_or_state: "idle",
      birth_city: "idle",
    }));
    setMessage(null);
    setError(null);
  }

  function updateBirthProvince(value: string) {
    const option = findBirthProvinceOption(form.birth_country, value);
    const nextValue = option?.code ?? value;
    const nextBilingualValue = optionToBilingualValue(option);

    setForm((current) => ({
      ...current,
      birth_province_or_state: nextValue,
      birth_city: "",
    }));
    setBilingualForm((current) => ({
      ...current,
      birth_province_or_state: nextBilingualValue,
      birth_city: { zh: "", en: "" },
    }));
    setTranslationStatus((current) => ({
      ...current,
      birth_province_or_state: "idle",
      birth_city: "idle",
    }));
    setMessage(null);
    setError(null);
  }

  function updateBirthCity(value: string) {
    const option = findBirthCityOption(form.birth_country, form.birth_province_or_state, value);
    const nextValue = option?.code ?? value;
    setForm((current) => ({
      ...current,
      birth_city: nextValue,
      place_of_birth: option && option.code !== OTHER_BIRTHPLACE_OPTION.code ? option.en : current.place_of_birth,
    }));
    setBirthplaceBilingualField("birth_city", optionToBilingualValue(option));
  }

  function updateBirthplaceFreeText(field: "birth_province_or_state" | "birth_city", side: "zh" | "en", value: string) {
    const currentValue = bilingualForm[field];
    const nextValue = side === "zh"
      ? {
          zh: value,
          en: manualEnglishFields[field] && currentValue.en.trim() ? currentValue.en : toEnglishProfileValue(field, value),
        }
      : {
          zh: toChineseSourceValue(value),
          en: value,
        };

    if (side === "en") {
      setManualEnglishFields((current) => ({ ...current, [field]: Boolean(value.trim()) }));
    } else if (!value.trim()) {
      setManualEnglishFields((current) => ({ ...current, [field]: false }));
    }

    setBirthplaceBilingualField(field, nextValue);
  }

  function updatePhoneCountry(countryCode: string) {
    setPhoneCountryCode(countryCode);
    const nextPhoneValue = composePhoneValue(countryCode, phoneParts.localNumber);
    updateField("phone", nextPhoneValue);
    if (phoneError) {
      setPhoneError(validatePhoneNumberValue(nextPhoneValue, countryCode, isZh));
    }
  }

  function updatePhoneNumber(localNumber: string) {
    const nextPhoneValue = composePhoneValue(phoneParts.countryCode, localNumber);
    updateField("phone", nextPhoneValue);
    if (phoneError) {
      setPhoneError(validatePhoneNumberValue(nextPhoneValue, phoneParts.countryCode, isZh));
    }
  }

  function validatePhoneField(localNumber?: string) {
    const phoneValue = typeof localNumber === "string"
      ? composePhoneValue(phoneParts.countryCode, localNumber)
      : form.phone;
    const validationError = validatePhoneNumberValue(phoneValue, phoneParts.countryCode, isZh);
    setPhoneError(validationError);
    return !validationError;
  }

  function updateBilingualField(field: BilingualProfileField, side: "zh" | "en", value: string) {
    const currentValue = bilingualForm[field];
    const nextValue =
      side === "zh"
        ? {
            zh: value,
            en: manualEnglishFields[field] && currentValue.en.trim() ? currentValue.en : toEnglishProfileValue(field, value),
          }
        : {
            zh: toChineseSourceValue(value),
            en: value,
          };

    if (side === "en") {
      setManualEnglishFields((current) => ({ ...current, [field]: Boolean(value.trim()) }));
    } else if (!value.trim()) {
      setManualEnglishFields((current) => ({ ...current, [field]: false }));
    }

    setBilingualForm((current) => {
      const merged = { ...current, [field]: nextValue };
      if (field === "surname" || field === "given_names") {
        merged.full_name = {
          zh: composeChineseName(merged.surname.zh, merged.given_names.zh),
          en: composeEnglishFullName(merged.given_names.en, merged.surname.en),
        };
      }
      return merged;
    });
    setForm((current) => {
      if (field === "surname" || field === "given_names") {
        const nextSurname = field === "surname" ? nextValue : bilingualForm.surname;
        const nextGivenNames = field === "given_names" ? nextValue : bilingualForm.given_names;
        return {
          ...current,
          [field]: nextValue.en || nextValue.zh,
          full_name: composeEnglishFullName(nextGivenNames.en, nextSurname.en) ||
            composeChineseName(nextSurname.zh, nextGivenNames.zh),
        };
      }
      return { ...current, [field]: nextValue.en || nextValue.zh };
    });
    setTranslationStatus((current) => ({ ...current, [field]: "idle" }));
    setMessage(null);
    setError(null);
  }

  async function translateBilingualField(field: BilingualProfileField) {
    if (!isTranslatableProfileField(field)) return;
    const sourceText = bilingualForm[field].zh.trim();
    if (!sourceText || !hasChinese(sourceText)) return;

    if (manualEnglishFields[field] && bilingualForm[field].en.trim()) {
      setTranslationStatus((current) => ({ ...current, [field]: "manual" }));
      return;
    }

    setTranslationStatus((current) => ({ ...current, [field]: "translating" }));

    try {
      const response = await fetch("/api/translations/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          sourceLanguage: "zh-CN",
          targetLanguage: "en",
          fieldType: field,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { translatedText?: string } | null;
      const fallback = toEnglishProfileValue(field, sourceText);
      const translated = payload?.translatedText?.trim() || fallback;

      if (!response.ok && (!fallback || hasChinese(fallback))) {
        throw new Error("Translation unavailable");
      }

      if (!translated || hasChinese(translated)) {
        setTranslationStatus((current) => ({ ...current, [field]: "failed" }));
        return;
      }

      setBilingualForm((current) => ({
        ...current,
        [field]: {
          ...current[field],
          en: translated,
        },
      }));
      setForm((current) => ({ ...current, [field]: translated }));
      setTranslationStatus((current) => ({ ...current, [field]: "translated" }));
    } catch {
      const fallback = toEnglishProfileValue(field, sourceText);
      if (fallback && !hasChinese(fallback)) {
        setBilingualForm((current) => ({
          ...current,
          [field]: {
            ...current[field],
            en: fallback,
          },
        }));
        setForm((current) => ({ ...current, [field]: fallback }));
        setTranslationStatus((current) => ({ ...current, [field]: "translated" }));
        return;
      }
      setTranslationStatus((current) => ({ ...current, [field]: "failed" }));
    }
  }

  function applyPassportOcrFields(fields: UniversalProfileSnapshot) {
    const ocrBilingualFields = toInitialBilingualForm(fields as UniversalProfileRow);
    const normalizedBirthplace = normalizeBirthplace({
      placeOfBirth: fields.place_of_birth,
      country: fields.birth_country || fields.nationality,
      province: fields.birth_province_or_state,
      provinceZh: fields.birth_province_or_state_zh,
      provinceEn: fields.birth_province_or_state_en,
      city: fields.birth_city,
      cityZh: fields.birth_city_zh,
      cityEn: fields.birth_city_en,
      nationality: fields.nationality,
    });
    const hasOcrBirthplace = Boolean(
      normalizedBirthplace.countryCode ||
      normalizedBirthplace.province.zh ||
      normalizedBirthplace.province.en ||
      normalizedBirthplace.city.zh ||
      normalizedBirthplace.city.en,
    );

    setBilingualForm((current) => ({
      ...current,
      full_name: fields.full_name || fields.surname || fields.given_names ? ocrBilingualFields.full_name : current.full_name,
      surname: fields.full_name || fields.surname ? ocrBilingualFields.surname : current.surname,
      given_names: fields.full_name || fields.given_names ? ocrBilingualFields.given_names : current.given_names,
      place_of_birth: hasOcrBirthplace && !current.place_of_birth.zh.trim() && !current.place_of_birth.en.trim()
        ? {
            zh: normalizedBirthplace.placeOfBirthZh,
            en: normalizedBirthplace.placeOfBirthEn,
          }
        : current.place_of_birth,
      birth_province_or_state: hasOcrBirthplace && !current.birth_province_or_state.zh.trim() && !current.birth_province_or_state.en.trim()
        ? normalizedBirthplace.province
        : current.birth_province_or_state,
      birth_city: hasOcrBirthplace && !current.birth_city.zh.trim() && !current.birth_city.en.trim()
        ? normalizedBirthplace.city
        : current.birth_city,
    }));
    setForm((current) => {
      const nextFullName = fields.full_name || fields.surname || fields.given_names
        ? composeEnglishFullName(ocrBilingualFields.given_names.en, ocrBilingualFields.surname.en) ||
          composeChineseName(ocrBilingualFields.surname.zh, ocrBilingualFields.given_names.zh)
        : current.full_name;
      const shouldFillBirthProvince = hasOcrBirthplace && !current.birth_province_or_state;
      const shouldFillBirthCity = hasOcrBirthplace && !current.birth_city;

      return {
        ...current,
        full_name: nextFullName,
        surname: fields.full_name || fields.surname
          ? ocrBilingualFields.surname.en || ocrBilingualFields.surname.zh
          : current.surname,
        given_names: fields.full_name || fields.given_names
          ? ocrBilingualFields.given_names.en || ocrBilingualFields.given_names.zh
          : current.given_names,
        date_of_birth: fields.date_of_birth ?? current.date_of_birth,
        place_of_birth: shouldFillBirthCity
          ? normalizedBirthplace.placeOfBirthEn || normalizedBirthplace.placeOfBirthZh || current.place_of_birth
          : current.place_of_birth,
        birth_province_or_state: shouldFillBirthProvince
          ? normalizedBirthplace.provinceCode || current.birth_province_or_state
          : current.birth_province_or_state,
        birth_city: shouldFillBirthCity
          ? normalizedBirthplace.cityCode || current.birth_city
          : current.birth_city,
        gender: normalizeGender(fields.gender) || current.gender,
        nationality: normalizeCountryCode(fields.nationality) || current.nationality,
        birth_country: current.birth_country || normalizedBirthplace.countryCode || normalizeCountryCode(fields.nationality) || current.nationality,
        passport_number: fields.passport_number ?? current.passport_number,
        passport_issue_date: fields.passport_issue_date ?? current.passport_issue_date,
        passport_expiry_date: fields.passport_expiry_date ?? current.passport_expiry_date,
        passport_issuing_country: normalizeCountryCode(fields.passport_issuing_country) || current.passport_issuing_country,
      };
    });
    setMessage(isZh ? "护照 OCR 已填入可识别字段，请核对后保存或继续编辑。" : "Passport OCR filled the readable fields. Please review before saving or editing.");
    setError(null);
  }

  async function handleSave() {
    setMessage(null);
    setError(null);

    if (!validatePhoneField()) {
      setShouldFocusPhoneError(true);
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const birthProvince = bilingualForm.birth_province_or_state;
      const birthCity = bilingualForm.birth_city;
      const surname = bilingualForm.surname;
      const givenNames = bilingualForm.given_names;
      const fullNameZh = composeChineseName(surname.zh, givenNames.zh);
      const fullNameEn = composeEnglishFullName(givenNames.en, surname.en);
      const resolvedBirthCountry = form.birth_country || form.nationality;
      const birthCountryEn = countryEnglishName(resolvedBirthCountry);
      const birthCountryZh = countryChineseName(resolvedBirthCountry);
      const legacyPlaceOfBirthZh = joinBirthplaceParts([
        birthCountryZh,
        birthProvince.zh,
        birthCity.zh || bilingualForm.place_of_birth.zh,
      ]);
      const legacyPlaceOfBirthEn = joinBirthplaceParts([
        birthCountryEn,
        birthProvince.en,
        birthCity.en || bilingualForm.place_of_birth.en,
      ]);

      const result = await saveUniversalProfileWithSharedAnswers({
        applicationId: passportOcrApplicationId,
        country: "us",
        visaType: "b1_b2",
        preferExplicit: true,
        profile: {
          full_name: cleanValue(fullNameEn || fullNameZh),
          full_name_zh: cleanValue(fullNameZh) ?? undefined,
          full_name_en: cleanValue(fullNameEn) ?? undefined,
          surname: cleanValue(surname.en || surname.zh),
          surname_zh: cleanValue(surname.zh) ?? undefined,
          surname_en: cleanValue(surname.en) ?? undefined,
          given_names: cleanValue(givenNames.en || givenNames.zh),
          given_names_zh: cleanValue(givenNames.zh) ?? undefined,
          given_names_en: cleanValue(givenNames.en) ?? undefined,
          date_of_birth: cleanValue(form.date_of_birth),
          place_of_birth: cleanValue(legacyPlaceOfBirthEn || legacyPlaceOfBirthZh),
          place_of_birth_zh: isZh ? cleanValue(legacyPlaceOfBirthZh) : undefined,
          place_of_birth_en: isZh ? cleanValue(legacyPlaceOfBirthEn) : undefined,
          birth_country: cleanValue(birthCountryEn),
          birth_province_or_state: cleanValue(birthProvince.en || birthProvince.zh),
          birth_province_or_state_zh: isZh ? cleanValue(birthProvince.zh) : undefined,
          birth_province_or_state_en: isZh ? cleanValue(birthProvince.en) : undefined,
          birth_city: cleanValue(birthCity.en || birthCity.zh),
          birth_city_zh: isZh ? cleanValue(birthCity.zh) : undefined,
          birth_city_en: isZh ? cleanValue(birthCity.en) : undefined,
          gender: cleanValue(form.gender),
          nationality: cleanValue(countryEnglishName(form.nationality)),
          occupation: cleanValue(bilingualForm.occupation.en || bilingualForm.occupation.zh),
          occupation_zh: isZh ? cleanValue(bilingualForm.occupation.zh) : undefined,
          occupation_en: isZh ? cleanValue(bilingualForm.occupation.en) : undefined,
          address: cleanValue(bilingualForm.address.en || bilingualForm.address.zh),
          address_zh: isZh ? cleanValue(bilingualForm.address.zh) : undefined,
          address_en: isZh ? cleanValue(bilingualForm.address.en) : undefined,
          passport_number: cleanValue(form.passport_number),
          passport_issue_date: cleanValue(form.passport_issue_date),
          passport_expiry_date: cleanValue(form.passport_expiry_date),
          passport_issuing_country: cleanValue(countryEnglishName(form.passport_issuing_country)),
          email: cleanValue(form.email) ?? user.email ?? null,
          phone: cleanValue(form.phone),
          wechat: cleanValue(form.wechat),
        },
      });

      if (result.error) throw new Error(result.error);
      if (result.applicationId) setPassportOcrApplicationId(result.applicationId);
      setMessage(
        isZh
          ? "已保存通用资料。之后新进入相似签证表单时会优先用这里的信息预填。"
          : "Universal profile saved. New similar visa forms will use this profile for initial prefilling.",
      );
      router.push("/client/home");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : isZh ? "保存失败，请稍后重试。" : "Save failed. Please try again later.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-[#fcfcfc]">
        <Loader2 className="h-10 w-10 animate-spin text-[#03346E]" />
        <p className="text-[16px] text-[#667085]">
          {isZh ? "正在读取通用资料..." : "Loading universal profile..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] px-4 pb-16 pt-8 sm:px-6 lg:px-10">
      <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-6">
        <Link
          href="/client/home"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e6e6e6] bg-white px-4 py-2 text-[14px] font-medium text-[#03346E] transition hover:border-[#03346E]"
        >
          <ArrowLeft className="h-4 w-4" />
          {copy(isZh, "返回首页", "Back home")}
        </Link>

        <section className="overflow-hidden rounded-[18px] border border-[#e7edf5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-5 border-b border-[#edf2f7] bg-[#f5f9ff] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#03346E] text-white">
                <Database className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-heading text-[28px] font-medium leading-tight text-[#2f2f2f] sm:text-[34px]">
                  {copy(isZh, "通用资料", "Universal profile")}
                </h1>
                <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#667085]">
                  {copy(
                    isZh,
                    "保存你反复会填到的姓名、生日、出生地、护照和联系方式。以后进入相似签证表单时，系统会优先用这里的信息自动预填。",
                    "Save the name, birthday, birthplace, passport, and contact details you reuse. Similar visa forms can use this profile for prefilling.",
                  )}
                </p>
              </div>
            </div>
            <div className="min-w-[180px] rounded-[14px] border border-[#d7e3f2] bg-white p-4">
              <div className="flex items-center justify-between text-[13px] font-medium text-[#526174]">
                <span>{copy(isZh, "完整度", "Completeness")}</span>
                <span>{completionPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf2f7]">
                <div
                  className="h-full rounded-full bg-[#03346E] transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <p className="mt-2 text-[12px] text-[#667085]">
                {isZh
                  ? `${completedCount}/${completionTotal} 项已保存`
                  : `${completedCount}/${completionTotal} saved`}
              </p>
            </div>
          </div>

          <div className="grid gap-0 divide-y divide-[#edf2f7]">
            <section className="p-6">
              <PassportOcrUpload
                applicationId={passportOcrApplicationId}
                initialUploaded={passportUpload.uploaded}
                initialFileName={passportUpload.fileName}
                onFieldsApplied={applyPassportOcrFields}
                onUploaded={(fileName) => {
                  setPassportUpload({
                    uploaded: true,
                    fileName,
                    status: "uploaded",
                    updatedAt: new Date().toISOString(),
                  });
                }}
              />
            </section>

            <section className="p-6">
              <SectionTitle>{copy(isZh, "基本身份信息", "Basic identity information")}</SectionTitle>
              <div className="mt-3 divide-y divide-[#eef1f5]">
                <ProfileBilingualRow
                  zhLabel="姓氏"
                  enLabel="Surname"
                  zhControl={
                    <BilingualTextControl
                      side="zh"
                      value={bilingualForm.surname.zh}
                      placeholder="如：李"
                      icon={<User className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("surname", "zh", value)}
                    />
                  }
                  enControl={
                    <BilingualTextControl
                      side="en"
                      value={bilingualForm.surname.en}
                      placeholder="For example: LI"
                      icon={<User className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("surname", "en", value)}
                    />
                  }
                />
                <ProfileBilingualRow
                  zhLabel="名字"
                  enLabel="Given names"
                  zhControl={
                    <BilingualTextControl
                      side="zh"
                      value={bilingualForm.given_names.zh}
                      placeholder="如：晓明"
                      icon={<User className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("given_names", "zh", value)}
                    />
                  }
                  enControl={
                    <BilingualTextControl
                      side="en"
                      value={bilingualForm.given_names.en}
                      placeholder="For example: XIAOMING"
                      icon={<User className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("given_names", "en", value)}
                    />
                  }
                />
                <ProfileBilingualRow
                  zhLabel="出生日期"
                  enLabel="Date of birth"
                  zhControl={
                    <BilingualDateControl
                      side="zh"
                      value={form.date_of_birth}
                      placeholder="选择出生日期"
                      onChange={(value) => updateField("date_of_birth", value)}
                    />
                  }
                  enControl={
                    <BilingualDateControl
                      side="en"
                      value={form.date_of_birth}
                      placeholder="Select date of birth"
                      onChange={(value) => updateField("date_of_birth", value)}
                    />
                  }
                />
                <ProfileBilingualRow
                  zhLabel="出生国家"
                  enLabel="Country of birth"
                  zhControl={
                    <div data-testid="birth-country-zh-control">
                      <BilingualCountryControl
                        side="zh"
                        value={form.birth_country}
                        placeholder="选择出生国家..."
                        showSecondaryLabel={false}
                        onChange={updateBirthCountry}
                      />
                    </div>
                  }
                  enControl={
                    <div data-testid="birth-country-en-control">
                      <BilingualCountryControl
                        side="en"
                        value={form.birth_country}
                        placeholder="Select country of birth..."
                        showSecondaryLabel={false}
                        onChange={updateBirthCountry}
                      />
                    </div>
                  }
                />
                <ProfileBilingualRow
                  zhLabel="出生省/州"
                  enLabel="State/Province of birth"
                  zhControl={
                    <div className="space-y-2" data-testid="birth-province-zh-control">
                      <BilingualOptionControl
                        side="zh"
                        value={form.birth_province_or_state}
                        options={birthProvinceOptions}
                        placeholder="选择出生省/州"
                        icon={<MapPin className="h-4 w-4" />}
                        onChange={updateBirthProvince}
                      />
                      {isOtherBirthProvince ? (
                        <BilingualTextControl
                          side="zh"
                          value={bilingualForm.birth_province_or_state.zh}
                          placeholder="如：湖南"
                          icon={<MapPin className="h-4 w-4 text-gray-400" />}
                          onChange={(value) => updateBirthplaceFreeText("birth_province_or_state", "zh", value)}
                        />
                      ) : null}
                    </div>
                  }
                  enControl={
                    <div className="space-y-2" data-testid="birth-province-en-control">
                      <BilingualOptionControl
                        side="en"
                        value={form.birth_province_or_state}
                        options={birthProvinceOptions}
                        placeholder="Select state/province"
                        icon={<MapPin className="h-4 w-4" />}
                        onChange={updateBirthProvince}
                      />
                      {isOtherBirthProvince ? (
                        <BilingualTextControl
                          side="en"
                          value={bilingualForm.birth_province_or_state.en}
                          placeholder="For example: Hunan"
                          icon={<MapPin className="h-4 w-4 text-gray-400" />}
                          onChange={(value) => updateBirthplaceFreeText("birth_province_or_state", "en", value)}
                        />
                      ) : null}
                    </div>
                  }
                  footer={<TranslationHint status={translationStatus.birth_province_or_state} isZh={isZh} />}
                />
                <ProfileBilingualRow
                  zhLabel="出生城市"
                  enLabel="City of birth"
                  zhControl={
                    <div className="space-y-2" data-testid="birth-city-zh-control">
                      <BilingualOptionControl
                        side="zh"
                        value={form.birth_city}
                        options={birthCityOptions}
                        placeholder="选择出生城市"
                        icon={<MapPin className="h-4 w-4" />}
                        onChange={updateBirthCity}
                      />
                      {isOtherBirthCity ? (
                        <BilingualTextControl
                          side="zh"
                          value={bilingualForm.birth_city.zh}
                          placeholder="如：长沙"
                          icon={<MapPin className="h-4 w-4 text-gray-400" />}
                          onChange={(value) => updateBirthplaceFreeText("birth_city", "zh", value)}
                        />
                      ) : null}
                    </div>
                  }
                  enControl={
                    <div className="space-y-2" data-testid="birth-city-en-control">
                      <BilingualOptionControl
                        side="en"
                        value={form.birth_city}
                        options={birthCityOptions}
                        placeholder="Select city of birth"
                        icon={<MapPin className="h-4 w-4" />}
                        onChange={updateBirthCity}
                      />
                      {isOtherBirthCity ? (
                        <BilingualTextControl
                          side="en"
                          value={bilingualForm.birth_city.en}
                          placeholder="For example: Changsha"
                          icon={<MapPin className="h-4 w-4 text-gray-400" />}
                          onChange={(value) => updateBirthplaceFreeText("birth_city", "en", value)}
                        />
                      ) : null}
                    </div>
                  }
                  footer={<TranslationHint status={translationStatus.birth_city} isZh={isZh} />}
                />
                <ProfileBilingualRow
                  zhLabel="性别"
                  enLabel="Gender"
                  zhControl={
                    <BilingualOptionControl
                      side="zh"
                      value={form.gender}
                      options={GENDER_OPTIONS}
                      placeholder="请选择"
                      icon={<User className="h-4 w-4" />}
                      onChange={(value) => updateField("gender", value)}
                    />
                  }
                  enControl={
                    <BilingualOptionControl
                      side="en"
                      value={form.gender}
                      options={GENDER_OPTIONS}
                      placeholder="Select..."
                      icon={<User className="h-4 w-4" />}
                      onChange={(value) => updateField("gender", value)}
                    />
                  }
                />
                <ProfileBilingualRow
                  zhLabel="国籍"
                  enLabel="Nationality"
                  zhControl={
                    <BilingualCountryControl
                      side="zh"
                      value={form.nationality}
                      placeholder="选择国家..."
                      showSecondaryLabel={false}
                      onChange={(value) => updateField("nationality", value)}
                    />
                  }
                  enControl={
                    <BilingualCountryControl
                      side="en"
                      value={form.nationality}
                      placeholder="Select country..."
                      showSecondaryLabel={false}
                      onChange={(value) => updateField("nationality", value)}
                    />
                  }
                />
                <ProfileBilingualRow
                  zhLabel="职业"
                  enLabel="Occupation"
                  zhControl={
                    <BilingualTextControl
                      side="zh"
                      value={bilingualForm.occupation.zh}
                      placeholder="如：软件工程师"
                      icon={<WalletCards className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("occupation", "zh", value)}
                      onBlur={() => void translateBilingualField("occupation")}
                    />
                  }
                  enControl={
                    <BilingualTextControl
                      side="en"
                      value={bilingualForm.occupation.en}
                      placeholder="For example: Software engineer"
                      icon={<WalletCards className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("occupation", "en", value)}
                    />
                  }
                  footer={<TranslationHint status={translationStatus.occupation} isZh={isZh} />}
                />
              </div>
            </section>

            <section className="p-6">
              <SectionTitle>{copy(isZh, "护照信息", "Passport information")}</SectionTitle>
              <div className="mt-3 divide-y divide-[#eef1f5]">
                <ProfileBilingualRow
                  zhLabel="护照号码"
                  enLabel="Passport number"
                  zhControl={
                    <BilingualTextControl
                      side="zh"
                      value={form.passport_number}
                      placeholder="按护照填写"
                      icon={<ShieldCheck className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateField("passport_number", updateMirroredValue(value))}
                    />
                  }
                  enControl={
                    <BilingualTextControl
                      side="en"
                      value={form.passport_number}
                      placeholder="As shown on passport"
                      icon={<ShieldCheck className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateField("passport_number", updateMirroredValue(value))}
                    />
                  }
                />
                <ProfileBilingualRow
                  zhLabel="签发国家"
                  enLabel="Issuing country"
                  zhControl={
                    <BilingualCountryControl
                      side="zh"
                      value={form.passport_issuing_country}
                      placeholder="选择签发国家..."
                      showSecondaryLabel={false}
                      onChange={(value) => updateField("passport_issuing_country", value)}
                    />
                  }
                  enControl={
                    <BilingualCountryControl
                      side="en"
                      value={form.passport_issuing_country}
                      placeholder="Select issuing country..."
                      showSecondaryLabel={false}
                      onChange={(value) => updateField("passport_issuing_country", value)}
                    />
                  }
                />
                <ProfileBilingualRow
                  zhLabel="签发日期"
                  enLabel="Issue date"
                  zhControl={
                    <BilingualDateControl
                      side="zh"
                      value={form.passport_issue_date}
                      placeholder="选择签发日期"
                      onChange={(value) => updateField("passport_issue_date", value)}
                    />
                  }
                  enControl={
                    <BilingualDateControl
                      side="en"
                      value={form.passport_issue_date}
                      placeholder="Select issue date"
                      onChange={(value) => updateField("passport_issue_date", value)}
                    />
                  }
                />
                <ProfileBilingualRow
                  zhLabel="有效期至"
                  enLabel="Expiry date"
                  zhControl={
                    <BilingualDateControl
                      side="zh"
                      value={form.passport_expiry_date}
                      placeholder="选择有效期"
                      onChange={(value) => updateField("passport_expiry_date", value)}
                    />
                  }
                  enControl={
                    <BilingualDateControl
                      side="en"
                      value={form.passport_expiry_date}
                      placeholder="Select expiry date"
                      onChange={(value) => updateField("passport_expiry_date", value)}
                    />
                  }
                />
              </div>
            </section>

            <section className="p-6">
              <SectionTitle>{copy(isZh, "联系方式", "Contact information")}</SectionTitle>
              <div className="mt-3 divide-y divide-[#eef1f5]">
                <ProfileBilingualRow
                  zhLabel="电子邮箱"
                  enLabel="Email"
                  zhControl={
                    <BilingualTextControl
                      side="zh"
                      value={form.email}
                      placeholder="name@example.com"
                      icon={<AtSign className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateField("email", updateMirroredValue(value))}
                    />
                  }
                  enControl={
                    <BilingualTextControl
                      side="en"
                      value={form.email}
                      placeholder="name@example.com"
                      icon={<AtSign className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateField("email", updateMirroredValue(value))}
                    />
                  }
                />
                <ProfileBilingualRow
                  zhLabel="手机号"
                  enLabel="Phone number"
                  zhControl={
                    <PhoneNumberControl
                      side="zh"
                      isZh={isZh}
                      countryCode={phoneParts.countryCode}
                      localNumber={phoneParts.localNumber}
                      error={phoneError}
                      onCountryChange={updatePhoneCountry}
                      onNumberChange={updatePhoneNumber}
                      onBlur={validatePhoneField}
                    />
                  }
                  enControl={
                    <PhoneNumberControl
                      side="en"
                      isZh={isZh}
                      countryCode={phoneParts.countryCode}
                      localNumber={phoneParts.localNumber}
                      error={phoneError}
                      onCountryChange={updatePhoneCountry}
                      onNumberChange={updatePhoneNumber}
                      onBlur={validatePhoneField}
                    />
                  }
                  footer={phoneError ? (
                    <p id="universal-phone-error" role="alert" className="text-[12px] font-medium text-red-600">
                      {phoneError}
                    </p>
                  ) : null}
                />
                <ProfileBilingualRow
                  zhLabel="微信"
                  enLabel="WeChat"
                  zhControl={
                    <BilingualTextControl
                      side="zh"
                      value={form.wechat}
                      placeholder="可选"
                      icon={<Phone className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateField("wechat", updateMirroredValue(value))}
                    />
                  }
                  enControl={
                    <BilingualTextControl
                      side="en"
                      value={form.wechat}
                      placeholder="Optional"
                      icon={<Phone className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateField("wechat", updateMirroredValue(value))}
                    />
                  }
                />
                <ProfileBilingualRow
                  zhLabel="常住地址"
                  enLabel="Residential address"
                  zhControl={
                    <AddressControl
                      side="zh"
                      value={bilingualForm.address.zh}
                      placeholder="例如：北京市朝阳区示例路1号"
                      onChange={(value) => updateBilingualField("address", "zh", value)}
                      onBlur={() => void translateBilingualField("address")}
                    />
                  }
                  enControl={
                    <AddressControl
                      side="en"
                      value={bilingualForm.address.en}
                      placeholder="For example: 1 Example Road"
                      onChange={(value) => updateBilingualField("address", "en", value)}
                    />
                  }
                  footer={<TranslationHint status={translationStatus.address} isZh={isZh} />}
                />
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#edf2f7] bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-6">
              {message && (
                <p className="inline-flex items-center gap-2 text-[14px] font-medium text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {message}
                </p>
              )}
              {error && <p className="text-[14px] font-medium text-red-600">{error}</p>}
            </div>
            <BrandActionButton
              type="button"
              onClick={handleSave}
              loading={isSaving}
              loadingText={copy(isZh, "保存中", "Saving")}
              className="px-7 font-semibold"
            >
              <Save className="h-4 w-4" />
              {copy(isZh, "保存通用资料", "Save profile")}
            </BrandActionButton>
          </div>
        </section>
      </main>
    </div>
  );
}
