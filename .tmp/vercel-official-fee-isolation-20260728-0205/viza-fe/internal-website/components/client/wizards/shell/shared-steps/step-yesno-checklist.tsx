"use client";

import { useTranslations } from "next-intl";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { TabChoice } from "@/components/client/simplified-form/tab-choice";

export interface ChecklistItem {
  key: string;
  labelKey: string;
  /** Show an explain textarea when value === yes (e.g. character declarations). */
  explainOnYes?: boolean;
  /** Override the explain textarea key — defaults to `${key}_explain`. */
  explainKey?: string;
  /** Optional helper text below the label. */
  hintKey?: string;
}

interface StepYesNoChecklistProps {
  i18nNamespace: string;
  titleKey?: string;
  subtitleKey?: string;
  items: ChecklistItem[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  onContinue: () => void;
  onSubmit?: () => void;
  submitLabelKey?: string;
  submitting?: boolean;
}

export function StepYesNoChecklist({
  i18nNamespace,
  titleKey,
  subtitleKey,
  items,
  values,
  onChange,
  onContinue,
  onSubmit,
  submitLabelKey,
  submitting,
}: StepYesNoChecklistProps) {
  const t = useTranslations(i18nNamespace);
  const tShared = useTranslations("simplifiedForm.shared");
  const tr = (key?: string): string => {
    if (!key) return "";
    if (key.startsWith("literal:")) return key.slice("literal:".length);
    if (t.has(key as never)) return t(key as never);
    if (tShared.has(key as never)) return tShared(key as never);
    return key.split(".").pop() ?? key;
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

      <ul className="flex flex-col divide-y divide-border rounded-xl border border-input bg-white">
        {items.map((item) => {
          const value = values[item.key] ?? "";
          const explainKey = item.explainKey ?? `${item.key}_explain`;
          const showExplain = item.explainOnYes && value === "yes";
          return (
            <li key={item.key} className="flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex flex-col gap-1">
                <p className="text-[15px] font-medium text-foreground">{tr(item.labelKey)}</p>
                {item.hintKey ? (
                  <p className="text-xs text-muted-foreground">{tr(item.hintKey)}</p>
                ) : null}
              </div>
              <TabChoice
                name={item.key}
                value={(value === "yes" || value === "no" ? value : "") as "yes" | "no" | ""}
                columns={2}
                onChange={(v) => set(item.key, v)}
                options={[
                  { value: "yes", label: tShared("yes") },
                  { value: "no", label: tShared("no") },
                ]}
              />
              {showExplain ? (
                <textarea
                  value={values[explainKey] ?? ""}
                  onChange={(e) => set(explainKey, e.target.value)}
                  placeholder={tr("declarations.explainPlaceholder")}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-input bg-white px-3 py-2 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <BrandActionButton
        onClick={onSubmit ?? onContinue}
        loading={submitting}
        loadingText={tShared("submitting")}
        className="self-end"
      >
        {tr(submitLabelKey) || tShared("continue")}
      </BrandActionButton>
    </div>
  );
}
