"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, AtSign, CheckCircle2, Database, Loader2, MapPin, Phone, Save, ShieldCheck, User, WalletCards } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toChineseSourceValue, toOfficialEnglishValue } from "@/lib/ds160-translations";
import { isChineseLocale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/client";
import type { UniversalProfileSnapshot } from "@/lib/universal-profile-prefill";

interface UniversalProfileForm {
  full_name: string;
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

type BilingualProfileState = Record<BilingualProfileField, BilingualTextValue>;
type UniversalProfileRow = Partial<UniversalProfileForm> & Partial<Record<BilingualProfileColumn, string | null>>;

const EMPTY_FORM: UniversalProfileForm = {
  full_name: "",
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
  "full_name",
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

function countryEnglishName(value: string) {
  return findBilingualOption(COUNTRY_OPTIONS, value)?.en ?? value;
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
  const legacyPlaceOfBirth = toInitialBilingualValue(profile, "place_of_birth");
  const birthCity = toInitialBilingualValue(profile, "birth_city");

  return {
    full_name: toInitialBilingualValue(profile, "full_name"),
    place_of_birth: legacyPlaceOfBirth,
    birth_province_or_state: toInitialBilingualValue(profile, "birth_province_or_state"),
    birth_city: birthCity.zh || birthCity.en ? birthCity : legacyPlaceOfBirth,
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

export default function UniversalInfoPage() {
  const router = useRouter();
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [form, setForm] = useState<UniversalProfileForm>(EMPTY_FORM);
  const [bilingualForm, setBilingualForm] = useState<BilingualProfileState>(EMPTY_BILINGUAL_FORM);
  const [translationStatus, setTranslationStatus] = useState<Partial<Record<BilingualProfileField, TranslationStatus>>>({});
  const [manualEnglishFields, setManualEnglishFields] = useState<Partial<Record<BilingualProfileField, boolean>>>({});
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

      const draftResult = await ensureDraftApplication("us", "b1_b2");
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

      const initialBilingual = toInitialBilingualForm(typedProfile);
      const initialBirthCity = initialBilingual.birth_city.en || initialBilingual.birth_city.zh;
      const initialBirthProvince = initialBilingual.birth_province_or_state.en || initialBilingual.birth_province_or_state.zh;

      setForm({
        full_name: initialBilingual.full_name.en || initialBilingual.full_name.zh,
        date_of_birth: typedProfile?.date_of_birth ?? "",
        place_of_birth: initialBirthCity || initialBilingual.place_of_birth.en || initialBilingual.place_of_birth.zh,
        birth_country: normalizeCountryCode(typedProfile?.birth_country),
        birth_province_or_state: initialBirthProvince,
        birth_city: initialBirthCity,
        gender: normalizeGender(typedProfile?.gender),
        nationality: normalizeCountryCode(typedProfile?.nationality),
        occupation: initialBilingual.occupation.en || initialBilingual.occupation.zh,
        address: initialBilingual.address.en || initialBilingual.address.zh,
        passport_number: typedProfile?.passport_number ?? "",
        passport_issue_date: typedProfile?.passport_issue_date ?? "",
        passport_expiry_date: typedProfile?.passport_expiry_date ?? "",
        passport_issuing_country: normalizeCountryCode(typedProfile?.passport_issuing_country),
        email: typedProfile?.email ?? user.email ?? "",
        phone: typedProfile?.phone ?? "",
        wechat: typedProfile?.wechat ?? "",
      });
      setBilingualForm(initialBilingual);
      setManualEnglishFields({});
      setTranslationStatus({});
      setIsLoading(false);
    }

    void loadProfile();
    return () => { isMounted = false; };
  }, [isZh, router]);

  function updateField(field: keyof UniversalProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setError(null);
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

    setBilingualForm((current) => ({ ...current, [field]: nextValue }));
    setForm((current) => ({ ...current, [field]: nextValue.en || nextValue.zh }));
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
    const placeOfBirth = fields.place_of_birth ? toInitialBilingualValue(fields as UniversalProfileRow, "place_of_birth") : null;

    setBilingualForm((current) => ({
      ...current,
      full_name: fields.full_name ? ocrBilingualFields.full_name : current.full_name,
      place_of_birth: placeOfBirth ?? current.place_of_birth,
      birth_city: placeOfBirth ?? current.birth_city,
    }));
    setForm((current) => {
      const nextFullName = fields.full_name ? ocrBilingualFields.full_name.en || ocrBilingualFields.full_name.zh : current.full_name;
      const nextBirthCity = placeOfBirth ? placeOfBirth.en || placeOfBirth.zh : current.birth_city;

      return {
        ...current,
        full_name: nextFullName,
        date_of_birth: fields.date_of_birth ?? current.date_of_birth,
        place_of_birth: nextBirthCity || current.place_of_birth,
        birth_city: nextBirthCity || current.birth_city,
        gender: normalizeGender(fields.gender) || current.gender,
        nationality: normalizeCountryCode(fields.nationality) || current.nationality,
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
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const birthProvince = bilingualForm.birth_province_or_state;
      const birthCity = bilingualForm.birth_city;
      const legacyPlaceOfBirthZh = birthCity.zh || bilingualForm.place_of_birth.zh;
      const legacyPlaceOfBirthEn = birthCity.en || bilingualForm.place_of_birth.en;

      const result = await saveUniversalProfileWithSharedAnswers({
        applicationId: passportOcrApplicationId,
        country: "us",
        visaType: "b1_b2",
        profile: {
          full_name: cleanValue(bilingualForm.full_name.en || bilingualForm.full_name.zh),
          full_name_zh: isZh ? cleanValue(bilingualForm.full_name.zh) : undefined,
          full_name_en: isZh ? cleanValue(bilingualForm.full_name.en) : undefined,
          date_of_birth: cleanValue(form.date_of_birth),
          place_of_birth: cleanValue(legacyPlaceOfBirthEn || legacyPlaceOfBirthZh),
          place_of_birth_zh: isZh ? cleanValue(legacyPlaceOfBirthZh) : undefined,
          place_of_birth_en: isZh ? cleanValue(legacyPlaceOfBirthEn) : undefined,
          birth_country: cleanValue(countryEnglishName(form.birth_country)),
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
                  zhLabel="姓名"
                  enLabel="Full name"
                  zhControl={
                    <BilingualTextControl
                      side="zh"
                      value={bilingualForm.full_name.zh}
                      placeholder="如：陈泓羽"
                      icon={<User className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("full_name", "zh", value)}
                    />
                  }
                  enControl={
                    <BilingualTextControl
                      side="en"
                      value={bilingualForm.full_name.en}
                      placeholder="For example: HONGYU CHEN"
                      icon={<User className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("full_name", "en", value)}
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
                    <BilingualCountryControl
                      side="zh"
                      value={form.birth_country}
                      placeholder="选择出生国家..."
                      showSecondaryLabel={false}
                      onChange={(value) => updateField("birth_country", value)}
                    />
                  }
                  enControl={
                    <BilingualCountryControl
                      side="en"
                      value={form.birth_country}
                      placeholder="Select country of birth..."
                      showSecondaryLabel={false}
                      onChange={(value) => updateField("birth_country", value)}
                    />
                  }
                />
                <ProfileBilingualRow
                  zhLabel="出生省/州"
                  enLabel="State/Province of birth"
                  zhControl={
                    <BilingualTextControl
                      side="zh"
                      value={bilingualForm.birth_province_or_state.zh}
                      placeholder="如：湖南"
                      icon={<MapPin className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("birth_province_or_state", "zh", value)}
                      onBlur={() => void translateBilingualField("birth_province_or_state")}
                    />
                  }
                  enControl={
                    <BilingualTextControl
                      side="en"
                      value={bilingualForm.birth_province_or_state.en}
                      placeholder="For example: Hunan"
                      icon={<MapPin className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("birth_province_or_state", "en", value)}
                    />
                  }
                  footer={<TranslationHint status={translationStatus.birth_province_or_state} isZh={isZh} />}
                />
                <ProfileBilingualRow
                  zhLabel="出生城市"
                  enLabel="City of birth"
                  zhControl={
                    <BilingualTextControl
                      side="zh"
                      value={bilingualForm.birth_city.zh}
                      placeholder="如：长沙"
                      icon={<MapPin className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("birth_city", "zh", value)}
                      onBlur={() => void translateBilingualField("birth_city")}
                    />
                  }
                  enControl={
                    <BilingualTextControl
                      side="en"
                      value={bilingualForm.birth_city.en}
                      placeholder="For example: Changsha"
                      icon={<MapPin className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("birth_city", "en", value)}
                    />
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
                    <BilingualTextControl
                      side="zh"
                      value={form.phone}
                      placeholder="包含国家/地区号码"
                      icon={<Phone className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateField("phone", updateMirroredValue(value))}
                    />
                  }
                  enControl={
                    <BilingualTextControl
                      side="en"
                      value={form.phone}
                      placeholder="Include country or region code"
                      icon={<Phone className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateField("phone", updateMirroredValue(value))}
                    />
                  }
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
