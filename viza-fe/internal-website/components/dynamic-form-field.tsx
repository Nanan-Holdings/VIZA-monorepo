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
import { useTranslations } from "next-intl";
import { type VisaFormFieldRow } from "@/types/visa-form-fields";

interface DynamicFormFieldProps {
  field: VisaFormFieldRow;
  value: string;
  onChange: (value: string) => void;
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

export function DynamicFormField({ field, value, onChange }: DynamicFormFieldProps) {
  const t = useTranslations("applicationSteps");
  const { label, fieldType, required, placeholder, options } = field;

  switch (fieldType) {
    case "date":
      return (
        <FieldWrapper label={label} required={required}>
          <DatePicker
            value={value}
            onChange={onChange}
            placeholder={placeholder ?? undefined}
          />
        </FieldWrapper>
      );

    case "select": {
      // Country fields use source: "ISO3166-1" — render CountryDropdown
      const isCountry = (field.validationRules as { source?: string } | null)?.source === "ISO3166-1";
      if (isCountry) {
        return (
          <FieldWrapper label={label} required={required}>
            <CountryDropdown
              placeholder={placeholder ?? t("select")}
              defaultValue={value}
              onChange={(country) => onChange(country.name)}
            />
          </FieldWrapper>
        );
      }
      const opts = normaliseOptions(options);
      return (
        <FieldWrapper label={label} required={required}>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground">
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
            className="rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E]"
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
          <div className="h-12 rounded-lg border border-dashed border-[#e8e8e8] flex items-center justify-center text-[14px] text-gray-400 bg-gray-50">
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
      return (
        <FieldWrapper label={label} required={required}>
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
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
