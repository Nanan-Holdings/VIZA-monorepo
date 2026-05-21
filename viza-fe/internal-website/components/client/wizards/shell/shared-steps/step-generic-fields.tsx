"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabChoice } from "@/components/client/simplified-form/tab-choice";

export type GenericField =
  | { kind: "text"; key: string; labelKey: string; placeholderKey?: string; required?: boolean }
  | { kind: "email"; key: string; labelKey: string; placeholderKey?: string }
  | { kind: "phone"; key: string; labelKey: string; placeholderKey?: string }
  | { kind: "date"; key: string; labelKey: string }
  | { kind: "country"; key: string; labelKey: string; placeholderKey?: string }
  | {
      kind: "select";
      key: string;
      labelKey: string;
      placeholderKey?: string;
      options: Array<{ value: string; labelKey: string }>;
    }
  | {
      kind: "yesno";
      key: string;
      labelKey: string;
      yesKey?: string;
      noKey?: string;
    }
  | { kind: "textarea"; key: string; labelKey: string; placeholderKey?: string };

interface StepGenericFieldsProps {
  i18nNamespace: string;
  titleKey?: string;
  subtitleKey?: string;
  fields: GenericField[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  onContinue: () => void;
  onSubmit?: () => void;
  submitLabelKey?: string;
  submitting?: boolean;
}

export function StepGenericFields({
  i18nNamespace,
  titleKey,
  subtitleKey,
  fields,
  values,
  onChange,
  onContinue,
  onSubmit,
  submitLabelKey,
  submitting,
}: StepGenericFieldsProps) {
  const t = useTranslations(i18nNamespace);
  const tShared = useTranslations("simplifiedForm.shared");
  const tr = (key: string | undefined): string => {
    if (!key) return "";
    if (key.startsWith("literal:")) return key.slice("literal:".length);
    if (t.has(key as never)) return t(key as never);
    if (tShared.has(key as never)) return tShared(key as never);
    const last = key.split(".").pop() ?? key;
    return last
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (c) => c.toUpperCase());
  };

  const set = (key: string, value: string) => onChange({ ...values, [key]: value });

  return (
    <div className="flex flex-col gap-6">
      {(titleKey || subtitleKey) && (
        <header className="flex flex-col gap-2">
          {titleKey ? (
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {tr(titleKey)}
            </h1>
          ) : null}
          {subtitleKey ? (
            <p className="text-sm text-muted-foreground sm:text-base">{tr(subtitleKey)}</p>
          ) : null}
        </header>
      )}

      <div className="flex flex-col gap-4">
        {fields.map((field) => {
          const value = values[field.key] ?? "";
          if (field.kind === "text" || field.kind === "email" || field.kind === "phone") {
            return (
              <BrandField key={field.key} label={tr(field.labelKey)} required={field.kind === "text" && (field as { required?: boolean }).required}>
                <BrandInput
                  type={field.kind === "email" ? "email" : "text"}
                  value={value}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={tr(field.placeholderKey)}
                />
              </BrandField>
            );
          }
          if (field.kind === "textarea") {
            return (
              <BrandField key={field.key} label={tr(field.labelKey)}>
                <textarea
                  value={value}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={tr(field.placeholderKey)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-input bg-white px-3 py-2 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </BrandField>
            );
          }
          if (field.kind === "date") {
            return (
              <BrandField key={field.key} label={tr(field.labelKey)}>
                <DatePicker value={value} onChange={(v) => set(field.key, v)} />
              </BrandField>
            );
          }
          if (field.kind === "country") {
            return (
              <BrandField key={field.key} label={tr(field.labelKey)}>
                <CountryDropdown
                  defaultValue={value}
                  onChange={(c) => set(field.key, c.alpha3)}
                  placeholder={tr(field.placeholderKey)}
                />
              </BrandField>
            );
          }
          if (field.kind === "select") {
            return (
              <BrandField key={field.key} label={tr(field.labelKey)}>
                <Select value={value} onValueChange={(v) => set(field.key, v)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={tr(field.placeholderKey)} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {tr(opt.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </BrandField>
            );
          }
          // yesno
          return (
            <BrandField key={field.key} label={tr(field.labelKey)}>
              <TabChoice
                name={field.key}
                value={(value === "yes" || value === "no" ? value : "") as "yes" | "no" | ""}
                columns={2}
                onChange={(next) => set(field.key, next)}
                options={[
                  { value: "yes", label: tr(field.yesKey ?? "yes") },
                  { value: "no", label: tr(field.noKey ?? "no") },
                ]}
              />
            </BrandField>
          );
        })}
      </div>

      <Button
        onClick={onSubmit ?? onContinue}
        disabled={submitting}
        size="lg"
        className="self-end"
      >
        {tr(submitLabelKey ?? "continue") || tShared("continue")}
      </Button>
    </div>
  );
}
