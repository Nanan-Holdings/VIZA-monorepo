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

const BILINGUAL_PROFILE_FIELDS = ["full_name", "place_of_birth", "occupation", "address"] as const;
type BilingualProfileField = (typeof BILINGUAL_PROFILE_FIELDS)[number];
type BilingualProfileColumn = `${BilingualProfileField}_zh` | `${BilingualProfileField}_en`;

interface BilingualTextValue {
  zh: string;
  en: string;
}

type BilingualProfileState = Record<BilingualProfileField, BilingualTextValue>;
type UniversalProfileRow = Partial<UniversalProfileForm> & Partial<Record<BilingualProfileColumn, string | null>>;

const EMPTY_FORM: UniversalProfileForm = {
  full_name: "",
  date_of_birth: "",
  place_of_birth: "",
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
  occupation: { zh: "", en: "" },
  address: { zh: "", en: "" },
};

const PROFILE_FIELDS: Array<keyof UniversalProfileForm> = [
  "full_name",
  "date_of_birth",
  "place_of_birth",
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
  return {
    full_name: toInitialBilingualValue(profile, "full_name"),
    place_of_birth: toInitialBilingualValue(profile, "place_of_birth"),
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

function SingleRow({ label, control }: { label: string; control: React.ReactNode }) {
  return (
    <div className="min-w-0 px-0 py-4 sm:px-2">
      <span className="mb-2 block text-[15px] font-medium leading-tight text-[#1f2f46]">
        {label}
      </span>
      {control}
    </div>
  );
}

function AddressControl({
  side,
  value,
  placeholder,
  onChange,
}: {
  side: "zh" | "en";
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Textarea
      aria-label={side === "zh" ? "中文" : "English"}
      className="min-h-[110px] rounded-lg border-[#e8e8e8] text-[15px] shadow-xs focus-visible:border-brand-500 focus-visible:ring-1 focus-visible:ring-brand-500"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

export default function UniversalInfoPage() {
  const router = useRouter();
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const activeSide: "zh" | "en" = isZh ? "zh" : "en";
  const [form, setForm] = useState<UniversalProfileForm>(EMPTY_FORM);
  const [bilingualForm, setBilingualForm] = useState<BilingualProfileState>(EMPTY_BILINGUAL_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [passportOcrApplicationId, setPassportOcrApplicationId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completedCount = useMemo(() => {
    return PROFILE_FIELDS.filter((field) => {
      if (BILINGUAL_PROFILE_FIELDS.includes(field as BilingualProfileField)) {
        const bilingualValue = bilingualForm[field as BilingualProfileField];
        return Boolean(bilingualValue.zh.trim() || bilingualValue.en.trim());
      }
      return Boolean(form[field].trim());
    }).length;
  }, [bilingualForm, form]);
  const completionPercent = Math.round((completedCount / PROFILE_FIELDS.length) * 100);

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
      }

      setForm({
        full_name: toInitialBilingualValue(typedProfile ?? {}, "full_name").en,
        date_of_birth: typedProfile?.date_of_birth ?? "",
        place_of_birth: toInitialBilingualValue(typedProfile ?? {}, "place_of_birth").en,
        gender: normalizeGender(typedProfile?.gender),
        nationality: normalizeCountryCode(typedProfile?.nationality),
        occupation: toInitialBilingualValue(typedProfile ?? {}, "occupation").en,
        address: toInitialBilingualValue(typedProfile ?? {}, "address").en,
        passport_number: typedProfile?.passport_number ?? "",
        passport_issue_date: typedProfile?.passport_issue_date ?? "",
        passport_expiry_date: typedProfile?.passport_expiry_date ?? "",
        passport_issuing_country: normalizeCountryCode(typedProfile?.passport_issuing_country),
        email: typedProfile?.email ?? user.email ?? "",
        phone: typedProfile?.phone ?? "",
        wechat: typedProfile?.wechat ?? "",
      });
      setBilingualForm(toInitialBilingualForm(typedProfile));
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
    const nextValue =
      side === "zh"
        ? {
            zh: value,
            en: toEnglishProfileValue(field, value),
          }
        : {
            zh: toChineseSourceValue(value),
            en: value,
          };

    setBilingualForm((current) => ({ ...current, [field]: nextValue }));
    setForm((current) => ({ ...current, [field]: nextValue.en || nextValue.zh }));
    setMessage(null);
    setError(null);
  }

  function applyPassportOcrFields(fields: UniversalProfileSnapshot) {
    const ocrBilingualFields = toInitialBilingualForm(fields as UniversalProfileRow);
    setBilingualForm((current) => ({
      ...current,
      full_name: fields.full_name ? ocrBilingualFields.full_name : current.full_name,
      place_of_birth: fields.place_of_birth ? ocrBilingualFields.place_of_birth : current.place_of_birth,
    }));
    setForm((current) => {
      const nextFullName = fields.full_name ? ocrBilingualFields.full_name.en || ocrBilingualFields.full_name.zh : current.full_name;
      const nextPlaceOfBirth = fields.place_of_birth
        ? ocrBilingualFields.place_of_birth.en || ocrBilingualFields.place_of_birth.zh
        : current.place_of_birth;

      return {
        ...current,
        full_name: nextFullName,
        date_of_birth: fields.date_of_birth ?? current.date_of_birth,
        place_of_birth: nextPlaceOfBirth,
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

      const result = await saveUniversalProfileWithSharedAnswers({
        applicationId: passportOcrApplicationId,
        country: "us",
        visaType: "b1_b2",
        profile: {
          full_name: cleanValue(bilingualForm.full_name.en || bilingualForm.full_name.zh),
          full_name_zh: isZh ? cleanValue(bilingualForm.full_name.zh) : undefined,
          full_name_en: isZh ? cleanValue(bilingualForm.full_name.en) : undefined,
          date_of_birth: cleanValue(form.date_of_birth),
          place_of_birth: cleanValue(bilingualForm.place_of_birth.en || bilingualForm.place_of_birth.zh),
          place_of_birth_zh: isZh ? cleanValue(bilingualForm.place_of_birth.zh) : undefined,
          place_of_birth_en: isZh ? cleanValue(bilingualForm.place_of_birth.en) : undefined,
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
          ? "已保存，并同步到申请答案。之后相似签证问题会优先使用这些资料预填。"
          : "Saved and synced to application answers. Similar visa forms will use this profile for prefilling.",
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
                    "保存你反复会填到的姓名、生日、护照和联系方式。以后进入相似签证表单时，系统会优先用这里的信息自动预填。",
                    "Save the name, birthday, passport, and contact details you reuse. Similar visa forms can use this profile for prefilling.",
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
                  ? `${completedCount}/${PROFILE_FIELDS.length} 项已保存`
                  : `${completedCount}/${PROFILE_FIELDS.length} saved`}
              </p>
            </div>
          </div>

          <div className="grid gap-0 divide-y divide-[#edf2f7]">
            <section className="p-6">
              <PassportOcrUpload
                applicationId={passportOcrApplicationId}
                onFieldsApplied={applyPassportOcrFields}
              />
            </section>

            <section className="p-6">
              <SectionTitle>{copy(isZh, "基本身份信息", "Basic identity information")}</SectionTitle>
              <div className="mt-3 divide-y divide-[#eef1f5]">
                <SingleRow
                  label={copy(isZh, "姓名", "Full name")}
                  control={
                    <BilingualTextControl
                      side={activeSide}
                      value={activeSide === "zh" ? bilingualForm.full_name.zh : bilingualForm.full_name.en}
                      placeholder={copy(isZh, "如：陈泓羽", "For example: HONGYU CHEN")}
                      icon={<User className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("full_name", activeSide, value)}
                    />
                  }
                />
                <SingleRow
                  label={copy(isZh, "出生日期", "Date of birth")}
                  control={
                    <BilingualDateControl
                      side={activeSide}
                      value={form.date_of_birth}
                      placeholder={copy(isZh, "选择出生日期", "Select date of birth")}
                      onChange={(value) => updateField("date_of_birth", value)}
                    />
                  }
                />
                <SingleRow
                  label={copy(isZh, "出生地", "Place of birth")}
                  control={
                    <BilingualTextControl
                      side={activeSide}
                      value={
                        activeSide === "zh"
                          ? bilingualForm.place_of_birth.zh
                          : bilingualForm.place_of_birth.en
                      }
                      placeholder={copy(isZh, "如：湖南", "For example: HUNAN")}
                      icon={<MapPin className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("place_of_birth", activeSide, value)}
                    />
                  }
                />
                <SingleRow
                  label={copy(isZh, "性别", "Gender")}
                  control={
                    <BilingualOptionControl
                      side={activeSide}
                      value={form.gender}
                      options={GENDER_OPTIONS}
                      placeholder={copy(isZh, "请选择", "Select...")}
                      icon={<User className="h-4 w-4" />}
                      onChange={(value) => updateField("gender", value)}
                    />
                  }
                />
                <SingleRow
                  label={copy(isZh, "国籍", "Nationality")}
                  control={
                    <BilingualCountryControl
                      side={activeSide}
                      value={form.nationality}
                      placeholder={copy(isZh, "选择国家...", "Select country...")}
                      showSecondaryLabel={false}
                      onChange={(value) => updateField("nationality", value)}
                    />
                  }
                />
                <SingleRow
                  label={copy(isZh, "职业", "Occupation")}
                  control={
                    <BilingualTextControl
                      side={activeSide}
                      value={
                        activeSide === "zh"
                          ? bilingualForm.occupation.zh
                          : bilingualForm.occupation.en
                      }
                      placeholder={copy(isZh, "如：软件工程师", "For example: Software engineer")}
                      icon={<WalletCards className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateBilingualField("occupation", activeSide, value)}
                    />
                  }
                />
              </div>
            </section>

            <section className="p-6">
              <SectionTitle>{copy(isZh, "护照信息", "Passport information")}</SectionTitle>
              <div className="mt-3 divide-y divide-[#eef1f5]">
                <SingleRow
                  label={copy(isZh, "护照号码", "Passport number")}
                  control={
                    <BilingualTextControl
                      side={activeSide}
                      value={form.passport_number}
                      placeholder={copy(isZh, "按护照填写", "As shown on passport")}
                      icon={<ShieldCheck className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateField("passport_number", updateMirroredValue(value))}
                    />
                  }
                />
                <SingleRow
                  label={copy(isZh, "签发国家", "Issuing country")}
                  control={
                    <BilingualCountryControl
                      side={activeSide}
                      value={form.passport_issuing_country}
                      placeholder={copy(isZh, "选择签发国家...", "Select issuing country...")}
                      showSecondaryLabel={false}
                      onChange={(value) => updateField("passport_issuing_country", value)}
                    />
                  }
                />
                <SingleRow
                  label={copy(isZh, "签发日期", "Issue date")}
                  control={
                    <BilingualDateControl
                      side={activeSide}
                      value={form.passport_issue_date}
                      placeholder={copy(isZh, "选择签发日期", "Select issue date")}
                      onChange={(value) => updateField("passport_issue_date", value)}
                    />
                  }
                />
                <SingleRow
                  label={copy(isZh, "有效期至", "Expiry date")}
                  control={
                    <BilingualDateControl
                      side={activeSide}
                      value={form.passport_expiry_date}
                      placeholder={copy(isZh, "选择有效期", "Select expiry date")}
                      onChange={(value) => updateField("passport_expiry_date", value)}
                    />
                  }
                />
              </div>
            </section>

            <section className="p-6">
              <SectionTitle>{copy(isZh, "联系方式", "Contact information")}</SectionTitle>
              <div className="mt-3 divide-y divide-[#eef1f5]">
                <SingleRow
                  label={copy(isZh, "电子邮箱", "Email")}
                  control={
                    <BilingualTextControl
                      side={activeSide}
                      value={form.email}
                      placeholder="name@example.com"
                      icon={<AtSign className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateField("email", updateMirroredValue(value))}
                    />
                  }
                />
                <SingleRow
                  label={copy(isZh, "手机号", "Phone number")}
                  control={
                    <BilingualTextControl
                      side={activeSide}
                      value={form.phone}
                      placeholder={copy(isZh, "包含国家/地区号码", "Include country or region code")}
                      icon={<Phone className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateField("phone", updateMirroredValue(value))}
                    />
                  }
                />
                <SingleRow
                  label={copy(isZh, "微信", "WeChat")}
                  control={
                    <BilingualTextControl
                      side={activeSide}
                      value={form.wechat}
                      placeholder={copy(isZh, "可选", "Optional")}
                      icon={<Phone className="h-4 w-4 text-gray-400" />}
                      onChange={(value) => updateField("wechat", updateMirroredValue(value))}
                    />
                  }
                />
                <SingleRow
                  label={copy(isZh, "常住地址", "Residential address")}
                  control={
                    <AddressControl
                      side={activeSide}
                      value={activeSide === "zh" ? bilingualForm.address.zh : bilingualForm.address.en}
                      placeholder={copy(isZh, "例如：北京市朝阳区示例路1号", "For example: 1 Example Road")}
                      onChange={(value) => updateBilingualField("address", activeSide, value)}
                    />
                  }
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
