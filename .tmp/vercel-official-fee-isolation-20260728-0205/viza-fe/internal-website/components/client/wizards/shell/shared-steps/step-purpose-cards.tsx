"use client";

import { useTranslations } from "next-intl";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { TabChoice } from "@/components/client/simplified-form/tab-choice";

export interface PurposeOption {
  value: string;
  labelKey: string;
  descriptionKey?: string;
}

interface StepPurposeCardsProps {
  i18nNamespace: string;
  titleKey?: string;
  subtitleKey?: string;
  fieldKey: string;
  value: string;
  onChange: (value: string) => void;
  options: PurposeOption[];
  onContinue: () => void;
  columns?: 2 | 3;
}

export function StepPurposeCards({
  i18nNamespace,
  titleKey,
  subtitleKey,
  fieldKey,
  value,
  onChange,
  options,
  onContinue,
  columns = 2,
}: StepPurposeCardsProps) {
  const t = useTranslations(i18nNamespace);
  const tShared = useTranslations("simplifiedForm.shared");
  const tr = (key?: string): string => {
    if (!key) return "";
    if (key.startsWith("literal:")) return key.slice("literal:".length);
    if (t.has(key as never)) return t(key as never);
    if (tShared.has(key as never)) return tShared(key as never);
    return key.split(".").pop() ?? key;
  };

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

      <TabChoice
        name={fieldKey}
        value={value}
        onChange={(v) => onChange(v)}
        columns={columns}
        options={options.map((o) => ({
          value: o.value,
          label: tr(o.labelKey),
          description: tr(o.descriptionKey),
        }))}
      />

      <BrandActionButton onClick={onContinue} disabled={!value} className="self-end">
        {tShared("continue")}
      </BrandActionButton>
    </div>
  );
}
