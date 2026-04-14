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
import { useTranslations } from "next-intl";
import { type VisaFormFieldRow } from "@/types/visa-form-fields";

interface DynamicFormFieldProps {
  field: VisaFormFieldRow;
  value: string;
  onChange: (value: string) => void;
  forceWhiteBackground?: boolean;
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
      const obj = o as { value?: string; text?: string };
      return { value: obj.value ?? "", text: obj.text ?? obj.value ?? "" };
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
}: {
  value: string;
  onChange: (value: string) => void;
  required: boolean;
  whiteControlClass: string;
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
      containerClassName={`h-12 rounded-lg border border-[#e8e8e8] px-3 focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E] ${whiteControlClass}`}
      className="w-full"
      required={required}
      aria-label="U.S. Social Security Number"
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} className="h-8 w-8 border-0 shadow-none text-[15px]" />
        <InputOTPSlot index={1} className="h-8 w-8 border-0 shadow-none text-[15px]" />
        <InputOTPSlot index={2} className="h-8 w-8 border-0 shadow-none text-[15px]" />
      </InputOTPGroup>
      <InputOTPSeparator className="mx-0 text-gray-500" />
      <InputOTPGroup>
        <InputOTPSlot index={3} className="h-8 w-8 border-0 shadow-none text-[15px]" />
        <InputOTPSlot index={4} className="h-8 w-8 border-0 shadow-none text-[15px]" />
      </InputOTPGroup>
      <InputOTPSeparator className="mx-0 text-gray-500" />
      <InputOTPGroup>
        <InputOTPSlot index={5} className="h-8 w-8 border-0 shadow-none text-[15px]" />
        <InputOTPSlot index={6} className="h-8 w-8 border-0 shadow-none text-[15px]" />
        <InputOTPSlot index={7} className="h-8 w-8 border-0 shadow-none text-[15px]" />
        <InputOTPSlot index={8} className="h-8 w-8 border-0 shadow-none text-[15px]" />
      </InputOTPGroup>
    </InputOTP>
  );
}

export function DynamicFormField({
  field,
  value,
  onChange,
  forceWhiteBackground = false,
}: DynamicFormFieldProps) {
  const t = useTranslations("applicationSteps");
  const { label, fieldType, required, placeholder, options } = field;
  const whiteControlClass = forceWhiteBackground ? "bg-white hover:bg-white" : "";

  switch (fieldType) {
    case "date":
      return (
        <FieldWrapper label={label} required={required}>
          <DatePicker
            value={value}
            onChange={onChange}
            placeholder={placeholder ?? undefined}
            className={whiteControlClass}
          />
        </FieldWrapper>
      );

    case "select": {
      // Country fields use source: "ISO3166-1" — render CountryDropdown
      const source = (field.validationRules as { source?: string } | null)?.source;
      const isCountry = source === "ISO3166-1";
      const isUsState = source === "US_STATES";
      if (isCountry) {
        return (
          <FieldWrapper label={label} required={required}>
            <CountryDropdown
              placeholder={placeholder ?? t("select")}
              defaultValue={value}
              onChange={(country) => onChange(country.name)}
              className={whiteControlClass}
            />
          </FieldWrapper>
        );
      }
      if (isUsState) {
        return (
          <FieldWrapper label={label} required={required}>
            <RegionSelect
              countryCode="US"
              placeholder={placeholder ?? t("select")}
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
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={`h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground ${whiteControlClass}`}>
              <SelectValue placeholder={placeholder ?? t("select")} />
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
      return (
        <FieldWrapper label={label} required={required}>
          <CountryDropdown
            placeholder={placeholder ?? t("dynamicField.selectCountry")}
            defaultValue={value}
            onChange={(country) => onChange(country.name)}
            className={whiteControlClass}
          />
        </FieldWrapper>
      );

    case "radio": {
      const opts = normaliseOptions(options);
      return (
        <FieldWrapper label={label} required={required}>
          <div className="flex flex-col gap-2">
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
            />
          </FieldWrapper>
        );
      }

      return (
        <FieldWrapper label={label} required={required}>
          <InputGroup className={`h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E] ${forceWhiteBackground ? "bg-white" : ""}`}>
            <InputGroupInput
              type={fieldType === "text" ? "text" : fieldType}
              placeholder={placeholder ?? undefined}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              required={required}
              className="h-12 text-[15px]"
            />
          </InputGroup>
        </FieldWrapper>
      );
  }
}
