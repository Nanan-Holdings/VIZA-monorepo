"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Pencil, Save } from "lucide-react";
import { useLocale } from "next-intl";
import {
  loadUniversalProfileWorkspace,
  saveUniversalProfileAnswerValues,
} from "@/app/actions/visa-application-answers";
import { BilingualReviewPanel, type ReviewRow } from "@/components/application-steps/bilingual-review-panel";
import { COUNTRY_OPTIONS } from "@/components/application-steps/bilingual-form-shared";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { ApplicationFormDatePicker } from "@/components/ui/application-form-date-picker";
import { ApplicationFormField } from "@/components/ui/application-form-field";
import { ApplicationFormInputGroup } from "@/components/ui/application-form-input";
import { ApplicationFormPanel } from "@/components/ui/application-form-panel";
import {
  ApplicationSearchableMultiSelect,
  ApplicationSearchableSelect,
  type ApplicationSelectOption,
} from "@/components/ui/application-form-select";
import { ApplicationFormTextarea } from "@/components/ui/application-form-textarea";
import { InputGroupInput } from "@/components/ui/input-group";
import { getChineseLabel, getEnglishLabel } from "@/lib/ds160-translations";
import { evaluateShowIf } from "@/lib/form-utils";
import { isChineseLocale } from "@/lib/i18n/locale";
import { buildUniversalProfileAnswerPatch } from "@/lib/universal-profile-prefill";
import {
  UNIVERSAL_PROFILE_CATEGORIES,
  type UniversalProfileAnswerRecord,
  type UniversalProfileCategory,
  type UniversalProfileFieldDefinition,
} from "@/lib/universal-profile-fields";
import type { VisaFormFieldOption } from "@/types/visa-form-fields";

type DraftValue = { value: string; zh: string; en: string };

const LEGACY_CORE_KEYS = new Set([
  "full_name",
  "surname",
  "given_names",
  "date_of_birth",
  "place_of_birth",
  "birth_country",
  "birth_province_or_state",
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
]);

const CATEGORY_COPY: Record<UniversalProfileCategory, { zh: string; en: string; descriptionZh: string; descriptionEn: string }> = {
  identity: { zh: "身份与国籍", en: "Identity and nationality", descriptionZh: "曾用名、婚姻状态、其他国籍和身份证件等。", descriptionEn: "Other names, civil status, additional nationalities, and identity details." },
  contact: { zh: "住址与联系方式", en: "Address and contact", descriptionZh: "完整住址、备用电话、邮箱和社交账号。", descriptionEn: "Full address history, alternate phones, emails, and social accounts." },
  travel_documents: { zh: "旅行证件", en: "Travel documents", descriptionZh: "护照类型、签发地点、其他或遗失证件。", descriptionEn: "Passport type, place of issue, and other or lost documents." },
  family: { zh: "家庭成员", en: "Family", descriptionZh: "父母、配偶、伴侣和法定监护人资料。", descriptionEn: "Parents, spouse, partner, and legal-guardian details." },
  work_education: { zh: "工作与教育", en: "Work and education", descriptionZh: "雇主、职位、收入、学校和教育经历。", descriptionEn: "Employer, job, income, school, and education history." },
  immigration_history: { zh: "旅行与签证记录", en: "Travel and visa history", descriptionZh: "既往旅行、签证、拒签和居留身份。", descriptionEn: "Previous travel, visas, refusals, and residence status." },
  background: { zh: "背景资料", en: "Background", descriptionZh: "未来申请可能重复询问的健康、安全和合规事实。", descriptionEn: "Health, security, and compliance facts reused by future applications." },
};

const HISTORY_STARTER_PATTERN = /(?:ever_refused|visa_refused|has_been_refused|deported|overstay|has_overstayed|has_visited|visited_|travelled_|previous_.*visa|has_schengen_visits|has_us_canada|has_other_country|refusal_)/i;

function isDefaultProfileField(field: UniversalProfileFieldDefinition) {
  if (field.sourceVisaTypes.length >= 2) return true;
  if (field.category === "background") return true;
  return field.category === "immigration_history" && HISTORY_STARTER_PATTERN.test(field.canonicalKey);
}

function optionValue(option: VisaFormFieldOption) {
  return typeof option === "string" ? option : option.value;
}

function optionText(option: VisaFormFieldOption, side: "zh" | "en") {
  if (typeof option === "string") return option;
  if (side === "zh") return option.label_zh || option.text || option.label_en || option.official_label || option.value;
  return option.label_en || option.official_label || option.text || option.value;
}

function fieldOptions(field: UniversalProfileFieldDefinition, side: "zh" | "en"): ApplicationSelectOption[] {
  if (field.fieldType === "country") {
    return COUNTRY_OPTIONS.map((option) => ({ value: option.code, text: side === "zh" ? option.zh : option.en, searchText: `${option.zh} ${option.en}` }));
  }
  return (field.options ?? []).map((option) => ({
    value: optionValue(option),
    text: optionText(option, side),
    searchText: typeof option === "string" ? option : `${option.label_zh ?? ""} ${option.label_en ?? ""} ${option.text ?? ""}`,
  }));
}

function displayValue(field: UniversalProfileFieldDefinition, value: string, side: "zh" | "en") {
  if (!value) return "";
  if (field.fieldType === "multi_select") {
    return value.split(",").map((item) => fieldOptions(field, side).find((option) => option.value === item.trim())?.text ?? item.trim()).join(", ");
  }
  return fieldOptions(field, side).find((option) => option.value === value)?.text ?? value;
}

function FieldControl({
  field,
  side,
  draft,
  onChange,
}: {
  field: UniversalProfileFieldDefinition;
  side: "zh" | "en";
  draft: DraftValue;
  onChange: (next: DraftValue) => void;
}) {
  const sharedValue = draft.value;
  const options = fieldOptions(field, side);
  const placeholder = side === "zh" ? "请输入或选择" : field.placeholder || "Enter or select";
  if (field.fieldType === "date") {
    return <ApplicationFormDatePicker value={sharedValue} onChange={(value) => onChange({ ...draft, value, zh: value, en: value })} displayLocale={side} placeholder={placeholder} forceWhiteBackground />;
  }
  if (field.fieldType === "select" || field.fieldType === "radio" || field.fieldType === "checkbox" || field.fieldType === "country") {
    return <ApplicationSearchableSelect value={sharedValue} onValueChange={(value) => onChange({ ...draft, value, zh: value, en: value })} options={options} placeholder={placeholder} sideLocale={side} forceWhiteBackground />;
  }
  if (field.fieldType === "multi_select") {
    return <ApplicationSearchableMultiSelect value={sharedValue} onValueChange={(value) => onChange({ ...draft, value, zh: value, en: value })} options={options} placeholder={placeholder} sideLocale={side} forceWhiteBackground />;
  }
  const sideValue = side === "zh" ? draft.zh : draft.en;
  if (field.fieldType === "textarea") {
    return <ApplicationFormTextarea value={sideValue} onChange={(event) => onChange({ ...draft, value: event.target.value, [side]: event.target.value })} placeholder={placeholder} forceWhiteBackground />;
  }
  return (
    <ApplicationFormInputGroup filled={Boolean(sideValue.trim())} forceWhiteBackground>
      <InputGroupInput value={sideValue} onChange={(event) => onChange({ ...draft, value: event.target.value, [side]: event.target.value })} placeholder={placeholder} />
    </ApplicationFormInputGroup>
  );
}

function buildDraft(answer?: UniversalProfileAnswerRecord): DraftValue {
  return {
    value: answer?.value ?? "",
    zh: answer?.valueZh || answer?.value || "",
    en: answer?.valueEn || answer?.value || "",
  };
}

export function UniversalProfileExtendedEditor({ category }: { category: UniversalProfileCategory }) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [fields, setFields] = useState<UniversalProfileFieldDefinition[]>([]);
  const [answers, setAnswers] = useState<UniversalProfileAnswerRecord[]>([]);
  const [coreValues, setCoreValues] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({});
  const [editingCategories, setEditingCategories] = useState<Set<UniversalProfileCategory>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<UniversalProfileCategory>>(new Set());
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState<UniversalProfileCategory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [schemaAvailable, setSchemaAvailable] = useState(true);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("viza:live-save-status", {
      detail: { status: savingCategory ? "saving" : "saved" },
    }));
  }, [savingCategory]);

  useEffect(() => () => {
    window.dispatchEvent(new CustomEvent("viza:live-save-status", {
      detail: { status: "saved" },
    }));
  }, []);

  useEffect(() => {
    let active = true;
    loadUniversalProfileWorkspace().then((result) => {
      if (!active) return;
      setLoading(false);
      setSchemaAvailable(result.schemaAvailable);
      if (result.error) {
        setError(result.error);
        return;
      }
      const extendedFields = result.fields.filter((field) => !LEGACY_CORE_KEYS.has(field.canonicalKey));
      const answerMap = new Map(result.answers.map((answer) => [answer.canonicalKey, answer]));
      setFields(extendedFields);
      setAnswers(result.answers);
      setCoreValues(buildUniversalProfileAnswerPatch(result.profile));
      setDrafts(Object.fromEntries(extendedFields.map((field) => [field.canonicalKey, buildDraft(answerMap.get(field.canonicalKey))])));
    });
    return () => { active = false; };
  }, []);

  const answerMap = useMemo(() => new Map(answers.map((answer) => [answer.canonicalKey, answer])), [answers]);
  const currentValues = useMemo(() => ({
    ...coreValues,
    ...Object.fromEntries(Object.entries(drafts).map(([key, draft]) => [key, draft.value])),
  }), [coreValues, drafts]);
  const visibleFields = useMemo(() => {
    return fields.filter((field) => {
      if (field.category !== category) return false;
      if (!evaluateShowIf(field, currentValues, fields)) return false;
      return true;
    });
  }, [category, currentValues, fields]);


  function updateDraft(key: string, next: DraftValue) {
    setDrafts((current) => ({ ...current, [key]: next }));
    setDirtyKeys((current) => new Set(current).add(key));
    setMessage(null);
  }

  async function saveCategory(category: UniversalProfileCategory) {
    const categoryFields = fields.filter((field) => field.category === category && dirtyKeys.has(field.canonicalKey));
    if (categoryFields.length === 0) return;
    setSavingCategory(category);
    setError(null);
    const answersToSave = categoryFields.map((field) => ({
      canonicalKey: field.canonicalKey,
      value: drafts[field.canonicalKey]?.value ?? "",
      valueZh: drafts[field.canonicalKey]?.zh ?? "",
      valueEn: drafts[field.canonicalKey]?.en ?? "",
    }));
    let saveError: string | undefined;
    for (let from = 0; from < answersToSave.length; from += 200) {
      const result = await saveUniversalProfileAnswerValues({
        answers: answersToSave.slice(from, from + 200),
      });
      if (result.error) {
        saveError = result.error;
        break;
      }
    }
    setSavingCategory(null);
    if (saveError) {
      setError(saveError);
      return;
    }
    setAnswers((current) => {
      const next = new Map(current.map((answer) => [answer.canonicalKey, answer]));
      for (const field of categoryFields) {
        const draft = drafts[field.canonicalKey];
        if (!draft?.value.trim()) next.delete(field.canonicalKey);
        else next.set(field.canonicalKey, {
          canonicalKey: field.canonicalKey,
          value: draft.value,
          valueZh: draft.zh,
          valueEn: draft.en,
          labelZh: getChineseLabel(field.label),
          labelEn: getEnglishLabel(field.label),
          fieldType: field.fieldType,
          category: field.category,
        });
      }
      return Array.from(next.values());
    });
    setDirtyKeys((current) => {
      const next = new Set(current);
      categoryFields.forEach((field) => next.delete(field.canonicalKey));
      return next;
    });
    setEditingCategories((current) => {
      const next = new Set(current);
      next.delete(category);
      return next;
    });
    setMessage(isZh ? "通用资料已保存。" : "Universal Profile saved.");
  }

  if (loading) {
    return <ApplicationFormPanel className="flex min-h-52 items-center justify-center gap-3 p-6 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-brand-500" />{isZh ? "正在加载此分类..." : "Loading this category..."}</ApplicationFormPanel>;
  }

  const allCategoryFields = visibleFields;
  if (allCategoryFields.length === 0) return null;
  const categoryExpanded = expandedCategories.has(category);
  const categoryFields = allCategoryFields.filter((field) => (
    categoryExpanded ||
    Boolean(answerMap.get(field.canonicalKey)?.value.trim()) ||
    isDefaultProfileField(field)
  ));
  const hiddenFieldCount = allCategoryFields.length - categoryFields.length;
  const categoryInfo = CATEGORY_COPY[category];
  const categoryIndex = UNIVERSAL_PROFILE_CATEGORIES.indexOf(category);
  const editing = editingCategories.has(category);
  const savedFields = categoryFields.filter((field) => Boolean(answerMap.get(field.canonicalKey)?.value.trim()) && !editing);
  const editableFields = categoryFields.filter((field) => editing || !answerMap.get(field.canonicalKey)?.value.trim());
  const rows: ReviewRow[] = savedFields.map((field) => {
    const answer = answerMap.get(field.canonicalKey)!;
    return {
      section: isZh ? "已保存资料" : "Saved information",
      fieldName: field.canonicalKey,
      label: field.label,
      sourceLabel: getChineseLabel(field.label),
      officialLabel: getEnglishLabel(field.label),
      sourceValue: displayValue(field, answer.valueZh || answer.value, "zh"),
      officialValue: displayValue(field, answer.valueEn || answer.value, "en"),
      badges: [], warnings: [], editable: true, editStepIndex: categoryIndex,
    };
  });

  return (
    <ApplicationFormPanel className="scroll-mt-28 p-4 sm:p-6 md:p-8">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-[20px] font-medium tracking-[-0.5px] text-[#3d3d3d] sm:text-[24px]">
            {isZh ? categoryInfo.zh : categoryInfo.en}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {isZh ? categoryInfo.descriptionZh : categoryInfo.descriptionEn}
          </p>
        </div>
        {editing ? <Pencil className="h-4 w-4 shrink-0 text-brand-500" /> : null}
      </div>

      {!schemaAvailable ? <p role="alert" className="mt-4 text-sm font-medium text-amber-700">{isZh ? "完整资料表尚未安装数据库迁移；现有基础资料仍可正常使用。" : "The expanded profile migration is not installed yet. Existing core profile data still works."}</p> : null}
      {error ? <p role="alert" className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
      {message ? <p role="status" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />{message}</p> : null}

      {savedFields.length > 0 ? (
        <div className="mt-5 [&_tr]:border-0">
          <BilingualReviewPanel rows={rows} onEditSection={() => setEditingCategories((current) => new Set(current).add(category))} />
        </div>
      ) : null}

      {editableFields.length > 0 ? (
        <div className="mt-5 flex flex-col gap-6">
          {editableFields.map((field) => {
            const draft = drafts[field.canonicalKey] ?? buildDraft();
            return (
              <div key={field.canonicalKey} className="grid gap-4 md:grid-cols-2">
                {isZh ? (
                  <ApplicationFormField label={getChineseLabel(field.label)} required={false}>
                    <FieldControl field={field} side="zh" draft={draft} onChange={(next) => updateDraft(field.canonicalKey, next)} />
                  </ApplicationFormField>
                ) : null}
                <ApplicationFormField label={getEnglishLabel(field.label)} required={false} className={isZh ? undefined : "md:col-span-2"}>
                  <FieldControl field={field} side="en" draft={draft} onChange={(next) => updateDraft(field.canonicalKey, next)} />
                </ApplicationFormField>
              </div>
            );
          })}
          {categoryFields.some((field) => dirtyKeys.has(field.canonicalKey)) ? (
            <div className="flex justify-end pt-1">
              <BrandActionButton type="button" onClick={() => saveCategory(category)} disabled={savingCategory !== null}>
                {savingCategory === category ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingCategory === category ? isZh ? "保存中" : "Saving" : isZh ? "保存此部分" : "Save section"}
              </BrandActionButton>
            </div>
          ) : null}
        </div>
      ) : null}

      {hiddenFieldCount > 0 ? (
        <div className="mt-6 flex justify-center border-t border-[#eef1f5] pt-5">
          <BrandActionButton
            type="button"
            variant="secondary"
            onClick={() => setExpandedCategories((current) => new Set(current).add(category))}
          >
            {isZh ? `显示全部可选字段（另有 ${hiddenFieldCount} 项）` : `Show all optional fields (${hiddenFieldCount} more)`}
          </BrandActionButton>
        </div>
      ) : null}
    </ApplicationFormPanel>
  );
}
