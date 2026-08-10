"use client";

import { type ReactNode, useState } from "react";
import { User } from "lucide-react";
import { countries } from "country-data-list";
import { useLocale } from "next-intl";
import { FieldGuidancePanel } from "@/components/field-guidance-panel";
import { AiAssistButton } from "@/components/ui/ai-assist-button";
import { ApplicationFormDatePicker } from "@/components/ui/application-form-date-picker";
import { ApplicationFormInputGroup } from "@/components/ui/application-form-input";
import {
  ApplicationFormSelectContent,
  ApplicationFormSelectItem,
  ApplicationFormSelectTrigger,
} from "@/components/ui/application-form-select";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import {
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectValue,
} from "@/components/ui/select";
import { isChineseLocale } from "@/lib/i18n/locale";
import { type VisaFormFieldRow } from "@/types/visa-form-fields";
import { type FieldGuidanceChatMessage } from "@/types/field-guidance";

export type BilingualSide = "zh" | "en";

export interface BilingualOptionPair {
  code: string;
  alpha3?: string;
  zh: string;
  en: string;
}

export interface BilingualFieldCopilotConfig {
  fieldName: string;
  label: string;
  fieldType: VisaFormFieldRow["fieldType"];
  value: string;
  allAnswers: Record<string, string>;
  required?: boolean;
  options?: Array<{ value: string; text: string } | string> | null;
  placeholder?: string | null;
  validationRules?: Record<string, unknown> | null;
  visaType?: string;
  country?: string | null;
}

interface CountryRecord {
  alpha2: string;
  alpha3: string;
  emoji?: string;
  ioc: string;
  name: string;
  status: string;
}

export const COUNTRY_OPTIONS = buildCountryOptions();

export function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getLocalizedRegionName(alpha2: string) {
  try {
    const displayNames = new Intl.DisplayNames(["zh"], { type: "region" });
    return displayNames.of(alpha2.toUpperCase()) ?? "";
  } catch {
    return "";
  }
}

function buildCountryOptions(): BilingualOptionPair[] {
  const priorityCodes = ["CN", "US", "GB", "SG", "JP", "CA", "AU", "FR", "DE"];
  const priorityIndex = new Map(priorityCodes.map((code, index) => [code, index]));

  return (countries.all as CountryRecord[])
    .filter((country) => country.emoji && country.status !== "deleted" && country.ioc !== "PRK")
    .map((country) => ({
      code: country.alpha2,
      alpha3: country.alpha3,
      zh: getLocalizedRegionName(country.alpha2) || country.name,
      en: country.name,
    }))
    .sort((a, b) => {
      const aPriority = priorityIndex.get(a.code) ?? Number.MAX_SAFE_INTEGER;
      const bPriority = priorityIndex.get(b.code) ?? Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.en.localeCompare(b.en);
    });
}

export function findBilingualOption(options: BilingualOptionPair[], value?: string) {
  if (!value) return undefined;
  const lookup = normalizeLookup(value);
  return options.find(
    (option) =>
      normalizeLookup(option.code) === lookup ||
      normalizeLookup(option.alpha3 ?? "") === lookup ||
      normalizeLookup(option.zh) === lookup ||
      normalizeLookup(option.en) === lookup,
  );
}

export function formatChineseDate(isoValue: string) {
  if (!isoValue) return "";
  const [year, month, day] = isoValue.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function formatOfficialDate(isoValue: string) {
  if (!isoValue) return "";
  const [year, month, day] = isoValue.split("-");
  return `${day}/${month}/${year}`;
}

export function mirrorText(value: string) {
  return value.trim();
}

export function translateWithDictionary(
  value: string,
  dictionary: Record<string, string>,
  fallbackPrefix: string,
) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const direct = dictionary[trimmed];
  if (direct) return direct;
  if (/^[\dA-Za-z\s,.'#/-]+$/.test(trimmed)) return trimmed;
  return `${fallbackPrefix}: ${trimmed}`;
}

export function reverseWithDictionary(value: string, dictionary: Record<string, string>) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const reversed = Object.entries(dictionary).find(
    ([, en]) => normalizeLookup(en) === normalizeLookup(trimmed),
  );
  return reversed?.[0] ?? trimmed;
}

export function BilingualSectionHeader(_props: { children: ReactNode }) {
  return null;
}

export function BilingualTableShell({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

export function toCopilotOptions(options: BilingualOptionPair[]): Array<{ value: string; text: string }> {
  return options.map((option) => ({
    value: option.code,
    text: option.en,
  }));
}

export function getBilingualRowLabels(label: string, englishFallback?: string) {
  const englishLabel = englishFallback?.trim();
  if (englishLabel && label.trim().endsWith(englishLabel)) {
    return {
      zh: label.slice(0, -englishLabel.length).replace(/\s*\/\s*$/, "").trim(),
      en: englishLabel,
    };
  }

  const parts = label.split(/\s+\/\s+/);
  const lastPart = parts.at(-1)?.trim();
  if (parts.length > 1 && lastPart && /[A-Za-z]/.test(lastPart)) {
    return {
      zh: parts.slice(0, -1).join(" / ").trim(),
      en: lastPart,
    };
  }

  return {
    zh: label,
    en: englishLabel ?? label,
  };
}

export function BilingualFieldCopilot({ config }: { config: BilingualFieldCopilotConfig }) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<FieldGuidanceChatMessage[]>([]);
  const resolvedVisaType = config.visaType ?? config.allAnswers.visa_type ?? "unknown";
  const resolvedCountry = config.country ?? config.allAnswers.destination_country ?? null;
  const field: VisaFormFieldRow = {
    id: `legacy-${config.fieldName}`,
    visaType: resolvedVisaType,
    fieldName: config.fieldName,
    label: config.label,
    fieldType: config.fieldType,
    required: Boolean(config.required),
    stepNumber: 0,
    stepName: null,
    displayOrder: 0,
    placeholder: config.placeholder ?? null,
    validationRules: config.validationRules ?? null,
    options: config.options ?? null,
    conditionalLogic: null,
  };

  return (
    <div className="mt-2 flex w-full flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        <AiAssistButton
          label={`${open ? (isZh ? "收起 AI 帮助" : "Hide AI help") : (isZh ? "问 AI" : "Ask AI")}: ${config.label}`}
          visibleLabel={open ? (isZh ? "收起 AI 帮助" : "Hide AI help") : (isZh ? "问 AI" : "Ask AI")}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          data-copilot-trigger={config.fieldName}
          iconClassName="h-3.5 w-3.5"
        />
      </div>
      {open && (
        <FieldGuidancePanel
          country={resolvedCountry}
          visaType={resolvedVisaType}
          locale={locale}
          field={field}
          answer={config.value}
          allAnswers={config.allAnswers}
          initialConversation={conversation}
          onConversationChange={setConversation}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export function BilingualRow({
  label,
  zhControl,
  enControl,
  copilot,
}: {
  label: string;
  helper?: string;
  badge?: string;
  zhControl: ReactNode;
  enControl: ReactNode;
  copilot?: BilingualFieldCopilotConfig;
}) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const scopedCopilot = copilot
    ? {
        ...copilot,
        country: copilot.country ?? copilot.allAnswers.destination_country ?? null,
        visaType: copilot.visaType ?? copilot.allAnswers.visa_type ?? "unknown",
      }
    : undefined;
  const labels = getBilingualRowLabels(label, scopedCopilot?.label);
  const requiredMark = scopedCopilot?.required ? <span className="ml-1 text-red-500">*</span> : null;

  if (!isZh) {
    return (
      <div className="min-w-0 px-0 py-4 sm:px-2">
        <span className="mb-2 block text-[15px] font-medium leading-tight text-[#1f2f46]">
          {labels.en}
          {requiredMark}
        </span>
        {enControl}
        {scopedCopilot && (
          <div className="min-w-0" data-copilot-panel-frame={scopedCopilot.fieldName}>
            <BilingualFieldCopilot config={scopedCopilot} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 px-0 py-4 sm:px-2">
      <div className="min-w-0">
        <span className="mb-2 block text-[15px] font-medium leading-tight text-[#1f2f46]">
          {labels.zh}
          {requiredMark}
        </span>
        {zhControl}
      </div>
      {scopedCopilot && (
        <div className="min-w-0" data-copilot-panel-frame={scopedCopilot.fieldName}>
          <BilingualFieldCopilot config={scopedCopilot} />
        </div>
      )}
    </div>
  );
}

export function BilingualTextControl({
  value,
  side,
  placeholder,
  required,
  icon,
  onChange,
  onBlur,
}: {
  value: string;
  side: BilingualSide;
  placeholder: string;
  required?: boolean;
  icon?: ReactNode;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <ApplicationFormInputGroup className="h-12" filled={Boolean(value)}>
      <InputGroupAddon align="inline-start">
        {icon ?? <User className="h-4 w-4 text-gray-400" />}
      </InputGroupAddon>
      <InputGroupInput
        aria-label={side === "zh" ? "中文" : "English"}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        required={required}
        className="h-12 text-[15px]"
      />
    </ApplicationFormInputGroup>
  );
}

export function BilingualOptionControl({
  value,
  side,
  options,
  placeholder,
  icon,
  onChange,
}: {
  value: string;
  side: BilingualSide;
  options: BilingualOptionPair[];
  placeholder: string;
  icon?: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <ApplicationFormSelectTrigger
        className="h-12 text-[15px] data-[placeholder]:text-muted-foreground"
        filled={Boolean(value)}
      >
        <div className="flex min-w-0 items-center gap-2">
          {icon ? <span className="shrink-0 text-gray-400">{icon}</span> : null}
          <SelectValue placeholder={placeholder} />
        </div>
      </ApplicationFormSelectTrigger>
      <ApplicationFormSelectContent>
        {options.map((option) => (
          <ApplicationFormSelectItem key={`${side}-${option.code}`} value={option.code}>
            {side === "zh" ? option.zh : option.en}
          </ApplicationFormSelectItem>
        ))}
      </ApplicationFormSelectContent>
    </Select>
  );
}

export function BilingualCountryControl({
  value,
  side,
  placeholder,
  onChange,
}: {
  value: string;
  side: BilingualSide;
  placeholder: string;
  onChange: (value: string) => void;
  showSecondaryLabel?: boolean;
}) {
  return (
    <CountryDropdown
      defaultValue={value}
      placeholder={placeholder}
      displayLocale={side}
      onChange={(country) => onChange(country.alpha2)}
    />
  );
}

export function BilingualDateControl({
  value,
  side,
  placeholder,
  onChange,
}: {
  value: string;
  side: BilingualSide;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <ApplicationFormDatePicker
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      displayLocale={side}
      displayFormat={side === "zh" ? "yyyy年M月d日" : "dd/MM/yyyy"}
    />
  );
}
