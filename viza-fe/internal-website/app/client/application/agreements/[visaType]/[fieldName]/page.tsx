import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  resolveApplicationAgreement,
} from "@/lib/application-agreements";
import { dbRowToFormField, type VisaFormFieldDbRow } from "@/types/visa-form-fields";
import { normalizeBilingualFormField } from "@/lib/bilingual-schema-contract";

type PageProps = {
  params: Promise<{ visaType: string; fieldName: string }>;
};

export const dynamic = "force-dynamic";

export default async function ApplicationAgreementPage({ params }: PageProps) {
  const { visaType, fieldName } = await params;
  if (!/^[A-Za-z0-9_-]+$/.test(visaType) || !/^[A-Za-z0-9_-]+$/.test(fieldName)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/client/login");

  const { data, error } = await supabase
    .from("visa_form_fields")
    .select("*")
    .eq("visa_type", visaType)
    .eq("field_name", fieldName)
    .maybeSingle();
  if (error || !data) notFound();

  const field = normalizeBilingualFormField(dbRowToFormField(data as VisaFormFieldDbRow));
  const agreement = resolveApplicationAgreement(field);
  if (!agreement) notFound();

  const isZh = (await getLocale()).startsWith("zh");
  const content = isZh && agreement.contentZh ? agreement.contentZh : agreement.contentEn;
  const localizedTitle = isZh && typeof field.validationRules?.label_zh === "string"
    ? field.validationRules.label_zh
    : field.label;
  const sourceLabel = agreement.sourceLabel ?? (isZh ? "官方来源" : "Official source");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 md:px-8">
      <p className="text-sm text-[#6b6b6b]">
        {isZh ? "申请声明" : "Application agreement"}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-[#232323]">{localizedTitle}</h1>
      <p className="mt-3 text-sm leading-6 text-[#6b6b6b]">
        {isZh
          ? "VIZA 会在您勾选此项时，连同该版本的完整内容保存您的确认记录。"
          : "When you check this item, VIZA stores your acceptance together with this exact version of the statement."}
      </p>
      <article className="mt-8 whitespace-pre-wrap rounded-xl border border-[#e5e7eb] bg-white p-6 text-[15px] leading-7 text-[#232323]">
        {content}
      </article>
      {agreement.sourceUrl ? (
        <a
          className="mt-6 inline-flex text-sm font-medium text-[#03346E] underline underline-offset-4"
          href={agreement.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          {sourceLabel}
        </a>
      ) : null}
    </main>
  );
}
