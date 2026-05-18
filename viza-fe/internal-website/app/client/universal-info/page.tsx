"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Database, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

const inputClass =
  "h-[48px] w-full rounded-[10px] border border-[#e6e6e6] bg-white px-4 text-[15px] text-[#252525] outline-none transition-colors placeholder:text-[#9a9a9a] focus:border-[#03346E]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[14px] font-semibold text-[#26364a]">{label}</span>
      {children}
    </label>
  );
}

function cleanValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function UniversalInfoPage() {
  const router = useRouter();
  const [form, setForm] = useState<UniversalProfileForm>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completedCount = useMemo(
    () => PROFILE_FIELDS.filter((field) => form[field].trim()).length,
    [form],
  );
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
        .select("full_name, date_of_birth, place_of_birth, gender, nationality, occupation, address, passport_number, passport_issue_date, passport_expiry_date, passport_issuing_country, email, phone, wechat")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError) {
        setError("读取通用资料失败，请稍后重试。");
        setIsLoading(false);
        return;
      }

      const typedProfile = profile as Partial<UniversalProfileForm> | null;
      setForm({
        full_name: typedProfile?.full_name ?? "",
        date_of_birth: typedProfile?.date_of_birth ?? "",
        place_of_birth: typedProfile?.place_of_birth ?? "",
        gender: typedProfile?.gender ?? "",
        nationality: typedProfile?.nationality ?? "",
        occupation: typedProfile?.occupation ?? "",
        address: typedProfile?.address ?? "",
        passport_number: typedProfile?.passport_number ?? "",
        passport_issue_date: typedProfile?.passport_issue_date ?? "",
        passport_expiry_date: typedProfile?.passport_expiry_date ?? "",
        passport_issuing_country: typedProfile?.passport_issuing_country ?? "",
        email: typedProfile?.email ?? user.email ?? "",
        phone: typedProfile?.phone ?? "",
        wechat: typedProfile?.wechat ?? "",
      });
      setIsLoading(false);
    }

    void loadProfile();
    return () => { isMounted = false; };
  }, [router]);

  function updateField(field: keyof UniversalProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage(null);
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

      const { error: saveError } = await supabase
        .from("applicant_profiles")
        .upsert(
          {
            auth_user_id: user.id,
            full_name: cleanValue(form.full_name),
            date_of_birth: cleanValue(form.date_of_birth),
            place_of_birth: cleanValue(form.place_of_birth),
            gender: cleanValue(form.gender),
            nationality: cleanValue(form.nationality),
            occupation: cleanValue(form.occupation),
            address: cleanValue(form.address),
            passport_number: cleanValue(form.passport_number),
            passport_issue_date: cleanValue(form.passport_issue_date),
            passport_expiry_date: cleanValue(form.passport_expiry_date),
            passport_issuing_country: cleanValue(form.passport_issuing_country),
            email: cleanValue(form.email) ?? user.email ?? null,
            phone: cleanValue(form.phone),
            wechat: cleanValue(form.wechat),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "auth_user_id" },
        );

      if (saveError) throw saveError;
      setMessage("已保存。之后相似签证问题会优先使用这些资料预填。");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存失败，请稍后重试。");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-[#fcfcfc]">
        <Loader2 className="h-10 w-10 animate-spin text-[#03346E]" />
        <p className="text-[16px] text-[#667085]">正在读取通用资料...</p>
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
          返回首页
        </Link>

        <section className="overflow-hidden rounded-[18px] border border-[#e7edf5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-5 border-b border-[#edf2f7] bg-[#f5f9ff] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#03346E] text-white">
                <Database className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-heading text-[28px] font-medium leading-tight text-[#2f2f2f] sm:text-[34px]">
                  通用资料
                </h1>
                <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#667085]">
                  保存你反复会填到的姓名、生日、护照和联系方式。以后进入相似签证表单时，系统会优先用这里的信息自动预填。
                </p>
              </div>
            </div>
            <div className="min-w-[180px] rounded-[14px] border border-[#d7e3f2] bg-white p-4">
              <div className="flex items-center justify-between text-[13px] font-medium text-[#526174]">
                <span>完整度</span>
                <span>{completionPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf2f7]">
                <div
                  className="h-full rounded-full bg-[#03346E] transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <p className="mt-2 text-[12px] text-[#667085]">
                {completedCount}/{PROFILE_FIELDS.length} 项已保存
              </p>
            </div>
          </div>

          <div className="grid gap-0 divide-y divide-[#edf2f7]">
            <section className="grid gap-5 p-6 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <h2 className="font-heading text-[22px] font-medium text-[#03346E]">基本身份信息</h2>
              </div>
              <Field label="姓名">
                <input
                  className={inputClass}
                  value={form.full_name}
                  onChange={(event) => updateField("full_name", event.target.value)}
                  placeholder="例如：张小明 / ZHANG XIAOMING"
                />
              </Field>
              <Field label="出生日期">
                <input
                  className={inputClass}
                  type="date"
                  value={form.date_of_birth}
                  onChange={(event) => updateField("date_of_birth", event.target.value)}
                />
              </Field>
              <Field label="出生地">
                <input
                  className={inputClass}
                  value={form.place_of_birth}
                  onChange={(event) => updateField("place_of_birth", event.target.value)}
                  placeholder="例如：北京"
                />
              </Field>
              <Field label="性别">
                <select
                  className={inputClass}
                  value={form.gender}
                  onChange={(event) => updateField("gender", event.target.value)}
                >
                  <option value="">请选择</option>
                  <option value="male">男 / Male</option>
                  <option value="female">女 / Female</option>
                  <option value="other">其他 / Other</option>
                </select>
              </Field>
              <Field label="国籍">
                <input
                  className={inputClass}
                  value={form.nationality}
                  onChange={(event) => updateField("nationality", event.target.value)}
                  placeholder="例如：中国 / China"
                />
              </Field>
              <Field label="职业">
                <input
                  className={inputClass}
                  value={form.occupation}
                  onChange={(event) => updateField("occupation", event.target.value)}
                  placeholder="例如：软件工程师"
                />
              </Field>
            </section>

            <section className="grid gap-5 p-6 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <h2 className="font-heading text-[22px] font-medium text-[#03346E]">护照信息</h2>
              </div>
              <Field label="护照号码">
                <input
                  className={inputClass}
                  value={form.passport_number}
                  onChange={(event) => updateField("passport_number", event.target.value)}
                  placeholder="按护照填写"
                />
              </Field>
              <Field label="签发国家">
                <input
                  className={inputClass}
                  value={form.passport_issuing_country}
                  onChange={(event) => updateField("passport_issuing_country", event.target.value)}
                  placeholder="例如：中国 / China"
                />
              </Field>
              <Field label="签发日期">
                <input
                  className={inputClass}
                  type="date"
                  value={form.passport_issue_date}
                  onChange={(event) => updateField("passport_issue_date", event.target.value)}
                />
              </Field>
              <Field label="有效期至">
                <input
                  className={inputClass}
                  type="date"
                  value={form.passport_expiry_date}
                  onChange={(event) => updateField("passport_expiry_date", event.target.value)}
                />
              </Field>
            </section>

            <section className="grid gap-5 p-6 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <h2 className="font-heading text-[22px] font-medium text-[#03346E]">联系方式</h2>
              </div>
              <Field label="电子邮箱">
                <input
                  className={inputClass}
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="name@example.com"
                />
              </Field>
              <Field label="手机号">
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="包含国家/地区号码"
                />
              </Field>
              <Field label="微信">
                <input
                  className={inputClass}
                  value={form.wechat}
                  onChange={(event) => updateField("wechat", event.target.value)}
                  placeholder="可选"
                />
              </Field>
              <Field label="常住地址">
                <textarea
                  className="min-h-[110px] w-full rounded-[10px] border border-[#e6e6e6] bg-white px-4 py-3 text-[15px] text-[#252525] outline-none transition-colors placeholder:text-[#9a9a9a] focus:border-[#03346E]"
                  value={form.address}
                  onChange={(event) => updateField("address", event.target.value)}
                  placeholder="例如：北京市朝阳区示例路1号"
                />
              </Field>
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
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#03346E] px-7 text-[15px] font-semibold text-white transition hover:bg-[#06498f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "保存中" : "保存通用资料"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
