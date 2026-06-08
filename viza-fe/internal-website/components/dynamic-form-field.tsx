"use client";

import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputGroup,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { RegionSelect } from "@/components/ui/region-select";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useLocale, useTranslations } from "next-intl";
import { type VisaFormFieldRow } from "@/types/visa-form-fields";

const SCHENGEN_MEMBER_ALPHA2_CODES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IS",
  "IT",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "CH",
] as const;

const SCHENGEN_COUNTRY_FIELD_NAMES = new Set([
  "main_destination_country",
  "first_entry_country",
  "host_country",
  "business_company_country",
  "study_institution_country",
  "medical_facility_country",
  "event_country",
  "accommodation_country",
]);

function getFieldSource(field: VisaFormFieldRow): string | undefined {
  return (field.validationRules as { source?: string } | null)?.source;
}

function getBaseFieldName(fieldName: string): string {
  return fieldName.replace(/-(zh|en)$/, "").replace(/__\d+$/, "");
}

function usesSchengenMemberStateList(field: VisaFormFieldRow): boolean {
  const source = getFieldSource(field);
  if (source === "SCHENGEN_MEMBER_STATES") return true;
  if (source !== "ISO3166-1") return false;
  if (SCHENGEN_COUNTRY_FIELD_NAMES.has(getBaseFieldName(field.fieldName))) return true;
  return /schengen member state/i.test(field.label);
}

interface DynamicFormFieldProps {
  field: VisaFormFieldRow;
  value: string;
  onChange: (value: string) => void;
  forceWhiteBackground?: boolean;
  disabled?: boolean;
  displayLocale?: "zh" | "en";
}

function FieldWrapper({ label, required, children }: { label: string; required: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-[14px] font-medium text-gray-700 tracking-[-0.2px]">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

function normaliseOptions(opts: VisaFormFieldRow["options"]): Array<{ value: string; text: string }> {
  if (!opts || !Array.isArray(opts)) return [];
  return opts.map((o) => {
    if (typeof o === "string") return { value: o, text: o };
    if (typeof o === "object" && o !== null) {
      const obj = o as { value?: string; text?: string; label_en?: string; label_zh?: string; official_label?: string };
      return {
        value: obj.value ?? "",
        text: obj.text ?? obj.label_en ?? obj.label_zh ?? obj.official_label ?? obj.value ?? "",
      };
    }
    return { value: String(o), text: String(o) };
  });
}

function parseSsnSegments(raw: string): [string, string, string] {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  return [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5, 9)];
}

function formatSsnSegments(part1: string, part2: string, part3: string): string {
  if (!part1 && !part2 && !part3) return "";
  if (!part2 && !part3) return part1;
  if (!part3) return `${part1}-${part2}`;
  return `${part1}-${part2}-${part3}`;
}

function isSsnField(field: VisaFormFieldRow): boolean {
  const fieldName = field.fieldName.toLowerCase();
  const label = field.label.toLowerCase();
  return (
    fieldName === "us_social_security_number"
    || label.includes("social security number")
    || label.includes("社会安全号码")
  );
}

function SsnSegmentedInput({
  value,
  onChange,
  required,
  whiteControlClass,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  required: boolean;
  whiteControlClass: string;
  ariaLabel: string;
}) {
  const [part1, part2, part3] = parseSsnSegments(value);
  const digits = `${part1}${part2}${part3}`;

  return (
    <InputOTP
      maxLength={9}
      value={digits}
      onChange={(nextDigits) => {
        const clean = nextDigits.replace(/\D/g, "").slice(0, 9);
        const [a, b, c] = parseSsnSegments(clean);
        onChange(formatSsnSegments(a, b, c));
      }}
      pattern="[0-9]*"
      inputMode="numeric"
      containerClassName="h-12"
      className="w-full"
      required={required}
      aria-label={ariaLabel}
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
        <InputOTPSlot index={1} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
        <InputOTPSlot index={2} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
      </InputOTPGroup>
      <InputOTPSeparator className="mx-0 text-gray-500" />
      <InputOTPGroup>
        <InputOTPSlot index={3} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
        <InputOTPSlot index={4} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
      </InputOTPGroup>
      <InputOTPSeparator className="mx-0 text-gray-500" />
      <InputOTPGroup>
        <InputOTPSlot index={5} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
        <InputOTPSlot index={6} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
        <InputOTPSlot index={7} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
        <InputOTPSlot index={8} className={`h-12 w-10 text-[15px] border-[#e8e8e8] ${whiteControlClass}`} />
      </InputOTPGroup>
    </InputOTP>
  );
}

export function DynamicFormField({
  field,
  value,
  onChange,
  forceWhiteBackground = false,
  disabled = false,
  displayLocale,
}: DynamicFormFieldProps) {
  const t = useTranslations("applicationSteps");
  const locale = useLocale();
  const { label, fieldType, required, placeholder, options } = field;
  const whiteControlClass = forceWhiteBackground ? "bg-white hover:bg-white" : "";
  const sideLocale = displayLocale ?? (locale.startsWith("zh") ? "zh" : "en");
  const selectFallback = sideLocale === "zh" ? "请选择..." : "Select...";
  const doNotKnowLabel = sideLocale === "zh" ? t("dynamicField.doNotKnow") : "Do not know";
  const doesNotApplyLabel = sideLocale === "zh" ? t("dynamicField.doesNotApply") : "Does not apply";

  switch (fieldType) {
    case "date": {
      const dateRules = (field.validationRules as { allow_do_not_know?: boolean; allow_does_not_apply?: boolean } | null);
      const dateAllowDoNotKnow = dateRules?.allow_do_not_know;
      const dateAllowDoesNotApply = dateRules?.allow_does_not_apply;
      const dateIsDoNotKnow = value === "DO_NOT_KNOW";
      const dateIsDoesNotApply = value === "DOES_NOT_APPLY";
      const dateHasSideCheckbox = dateAllowDoNotKnow || dateAllowDoesNotApply;
      const datePickerNode = !dateIsDoNotKnow && !dateIsDoesNotApply ? (
        <DatePicker
          value={value}
          onChange={onChange}
          placeholder={placeholder ?? undefined}
          className={whiteControlClass}
          displayLocale={sideLocale}
        />
      ) : (
        <div className={`h-12 rounded-lg border border-[#e8e8e8] flex items-center px-3 text-[15px] text-gray-400 ${forceWhiteBackground ? "bg-white" : "bg-gray-50"}`}>
          {dateIsDoNotKnow ? doNotKnowLabel : doesNotApplyLabel}
        </div>
      );
      const sideCheckbox = dateAllowDoNotKnow ? (
        <label className="flex shrink-0 items-center gap-2 cursor-pointer text-[13px] text-gray-500 whitespace-nowrap">
          <Checkbox
            checked={dateIsDoNotKnow}
            onCheckedChange={(checked) => onChange(checked ? "DO_NOT_KNOW" : "")}
          />
          {doNotKnowLabel}
        </label>
      ) : dateAllowDoesNotApply ? (
        <label className="flex shrink-0 items-center gap-2 cursor-pointer text-[13px] text-gray-500 whitespace-nowrap">
          <Checkbox
            checked={dateIsDoesNotApply}
            onCheckedChange={(checked) => onChange(checked ? "DOES_NOT_APPLY" : "")}
          />
          {doesNotApplyLabel}
        </label>
      ) : null;

      return (
        <FieldWrapper label={label} required={required}>
          {dateHasSideCheckbox ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">{datePickerNode}</div>
              {sideCheckbox}
            </div>
          ) : (
            datePickerNode
          )}
        </FieldWrapper>
      );
    }

    case "select": {
      // Country fields use source metadata — render CountryDropdown
      const source = getFieldSource(field);
      const isSchengenMemberState = usesSchengenMemberStateList(field);
      const isCountry = source === "ISO3166-1" || isSchengenMemberState;
      const isUsState = source === "US_STATES";
      if (isCountry) {
        return (
          <FieldWrapper label={label} required={required}>
            <CountryDropdown
              placeholder={placeholder ?? selectFallback}
              defaultValue={value}
              onChange={(country) => onChange(country.name)}
              className={whiteControlClass}
              displayLocale={sideLocale}
              allowedCountryCodes={isSchengenMemberState ? SCHENGEN_MEMBER_ALPHA2_CODES : undefined}
            />
          </FieldWrapper>
        );
      }
      if (isUsState) {
        return (
          <FieldWrapper label={label} required={required}>
            <RegionSelect
              countryCode="US"
              placeholder={placeholder ?? selectFallback}
              defaultValue={value}
              onChange={(region) => onChange(region.shortCode)}
              className={`h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground ${whiteControlClass}`}
            />
          </FieldWrapper>
        );
      }
      const opts = normaliseOptions(options);
      return (
        <FieldWrapper label={label} required={required}>
          <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className={`h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground ${whiteControlClass} ${disabled ? "opacity-70 cursor-not-allowed" : ""}`}>
              <SelectValue placeholder={placeholder ?? selectFallback} />
            </SelectTrigger>
            <SelectContent>
              {opts.map((opt) => (
                <SelectItem key={opt.value} value={opt.value || "_empty"}>
                  {opt.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldWrapper>
      );
    }

    case "textarea":
      return (
        <FieldWrapper label={label} required={required}>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? undefined}
            className={`rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] ${whiteControlClass}`}
          />
        </FieldWrapper>
      );

    case "checkbox":
      return (
        <div className="flex items-center gap-3">
          <Checkbox
            id={field.fieldName}
            checked={value === "true"}
            onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
          />
          <Label htmlFor={field.fieldName} className="text-[14px] font-medium text-gray-700 cursor-pointer">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        </div>
      );

    case "file":
      return (
        <FieldWrapper label={label} required={required}>
          <div className={`h-12 rounded-lg border border-dashed border-[#e8e8e8] flex items-center justify-center text-[14px] text-gray-400 ${forceWhiteBackground ? "bg-white" : "bg-gray-50"}`}>
            {t("upload")}: {label}
          </div>
        </FieldWrapper>
      );

    case "country":
      {
        const isSchengenMemberState = usesSchengenMemberStateList(field);
        return (
          <FieldWrapper label={label} required={required}>
            <CountryDropdown
              placeholder={placeholder ?? (sideLocale === "zh" ? t("dynamicField.selectCountry") : "Select country...")}
              defaultValue={value}
              onChange={(country) => onChange(country.name)}
              className={whiteControlClass}
              displayLocale={sideLocale}
              allowedCountryCodes={isSchengenMemberState ? SCHENGEN_MEMBER_ALPHA2_CODES : undefined}
            />
          </FieldWrapper>
        );
      }

    case "radio": {
      const opts = normaliseOptions(options);
      return (
        <FieldWrapper label={label} required={required}>
          <div className={`flex ${opts.length <= 2 ? "flex-row gap-6" : "flex-col gap-2"}`}>
            {opts.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-[14px]">
                <input
                  type="radio"
                  name={field.fieldName}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={() => onChange(opt.value)}
                  className="accent-[#03346E]"
                />
                {opt.text}
              </label>
            ))}
          </div>
        </FieldWrapper>
      );
    }

    default: // text, number, email, tel, etc.
      if (isSsnField(field)) {
        return (
          <FieldWrapper label={label} required={required}>
            <SsnSegmentedInput
              value={value}
              onChange={onChange}
              required={required}
              whiteControlClass={forceWhiteBackground ? "bg-white" : ""}
              ariaLabel={t("dynamicField.usSocialSecurityNumber")}
            />
          </FieldWrapper>
        );
      }

      {
        const rules = field.validationRules as { allow_do_not_know?: boolean; allow_does_not_apply?: boolean; has_does_not_apply?: boolean } | null;
        const allowDoNotKnow = rules?.allow_do_not_know;
        const allowDoesNotApply = rules?.allow_does_not_apply || rules?.has_does_not_apply;
        const isDoNotKnow = value === "DO_NOT_KNOW";
        const isDoesNotApply = value === "DOES_NOT_APPLY";
        const isOverridden = isDoNotKnow || isDoesNotApply;
        const hasSideCheckbox = allowDoNotKnow || allowDoesNotApply;

        const inputNode = (
          <InputGroup className={`h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E] ${forceWhiteBackground ? "bg-white" : ""} ${(isOverridden || disabled) ? "opacity-50 cursor-not-allowed bg-gray-100" : ""}`}>
            <InputGroupInput
              type={fieldType === "text" ? "text" : fieldType}
              placeholder={placeholder ?? undefined}
              value={isOverridden ? "" : value}
              onChange={(e) => onChange(e.target.value)}
              required={required && !isOverridden}
              disabled={isOverridden || disabled}
              className="h-12 text-[15px]"
            />
          </InputGroup>
        );

        const sideCheckbox = allowDoNotKnow ? (
          <label className="flex shrink-0 items-center gap-2 cursor-pointer text-[13px] text-gray-500 whitespace-nowrap">
            <Checkbox
              checked={isDoNotKnow}
              onCheckedChange={(checked) => onChange(checked ? "DO_NOT_KNOW" : "")}
            />
            {doNotKnowLabel}
          </label>
        ) : allowDoesNotApply ? (
          <label className="flex shrink-0 items-center gap-2 cursor-pointer text-[13px] text-gray-500 whitespace-nowrap">
            <Checkbox
              checked={isDoesNotApply}
              onCheckedChange={(checked) => onChange(checked ? "DOES_NOT_APPLY" : "")}
            />
            {doesNotApplyLabel}
          </label>
        ) : null;

        return (
          <FieldWrapper label={label} required={required}>
            {hasSideCheckbox ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">{inputNode}</div>
                {sideCheckbox}
              </div>
            ) : (
              inputNode
            )}
          </FieldWrapper>
        );
      }
  }
}
