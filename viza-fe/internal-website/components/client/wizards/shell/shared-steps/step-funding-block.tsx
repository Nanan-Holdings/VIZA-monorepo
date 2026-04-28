"use client";

import { useTranslations } from "next-intl";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import { TabChoice } from "@/components/client/simplified-form/tab-choice";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FundingSourceOption {
  value: string;
  labelKey: string;
}

export interface CurrencyOption {
  value: string;
  labelKey: string;
}

interface StepFundingBlockProps {
  i18nNamespace: string;
  titleKey?: string;
  subtitleKey?: string;
  /** Field key for the cost-covered-by pill (e.g. "cost_covered_by"). */
  sourceKey: string;
  sourceLabelKey: string;
  sourceOptions: FundingSourceOption[];
  /** Values that trigger the sponsor sub-block (e.g. ["sponsor","both","other"]). */
  sponsorTriggerValues: string[];
  sponsorNameKey?: string;
  sponsorRelationshipKey?: string;
  /** Optional amount + currency block. */
  amountKey?: string;
  currencyKey?: string;
  currencyOptions?: CurrencyOption[];
  /** Optional travel-medical-insurance Yes/No. */
  insuranceKey?: string;
  insuranceLabelKey?: string;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  onContinue: () => void;
}

export function StepFundingBlock({
  i18nNamespace,
  titleKey,
  subtitleKey,
  sourceKey,
  sourceLabelKey,
  sourceOptions,
  sponsorTriggerValues,
  sponsorNameKey,
  sponsorRelationshipKey,
  amountKey,
  currencyKey,
  currencyOptions,
  insuranceKey,
  insuranceLabelKey,
  values,
  onChange,
  onContinue,
}: StepFundingBlockProps) {
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
  const sourceValue = values[sourceKey] ?? "";
  const showSponsorBlock = sponsorTriggerValues.includes(sourceValue);

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

      <BrandField label={tr(sourceLabelKey)} required>
        <TabChoice
          name={sourceKey}
          value={sourceValue}
          columns={sourceOptions.length >= 4 ? 4 : (sourceOptions.length as 2 | 3)}
          onChange={(v) => set(sourceKey, v)}
          options={sourceOptions.map((o) => ({ value: o.value, label: tr(o.labelKey) }))}
        />
      </BrandField>

      {showSponsorBlock && (sponsorNameKey || sponsorRelationshipKey) ? (
        <div className="grid gap-4 rounded-lg border border-brand-100 bg-brand-50/40 p-4 sm:grid-cols-2">
          {sponsorNameKey ? (
            <BrandField label={tr("fields.sponsorName")}>
              <BrandInput
                value={values[sponsorNameKey] ?? ""}
                onChange={(e) => set(sponsorNameKey, e.target.value)}
                placeholder={tr("fields.sponsorNamePlaceholder")}
              />
            </BrandField>
          ) : null}
          {sponsorRelationshipKey ? (
            <BrandField label={tr("fields.sponsorRelationship")}>
              <BrandInput
                value={values[sponsorRelationshipKey] ?? ""}
                onChange={(e) => set(sponsorRelationshipKey, e.target.value)}
                placeholder={tr("fields.sponsorRelationshipPlaceholder")}
              />
            </BrandField>
          ) : null}
        </div>
      ) : null}

      {amountKey && currencyKey && currencyOptions ? (
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <BrandField label={tr("fields.fundsAmount")}>
            <BrandInput
              type="text"
              inputMode="decimal"
              value={values[amountKey] ?? ""}
              onChange={(e) => set(amountKey, e.target.value)}
              placeholder={tr("fields.fundsAmountPlaceholder")}
            />
          </BrandField>
          <BrandField label={tr("fields.fundsCurrency")}>
            <Select
              value={values[currencyKey] ?? ""}
              onValueChange={(v) => set(currencyKey, v)}
            >
              <SelectTrigger className="h-12 w-32 rounded-lg border-[#e8e8e8]">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {tr(c.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </BrandField>
        </div>
      ) : null}

      {insuranceKey && insuranceLabelKey ? (
        <BrandField label={tr(insuranceLabelKey)}>
          <TabChoice
            name={insuranceKey}
            value={(values[insuranceKey] === "yes" || values[insuranceKey] === "no"
              ? (values[insuranceKey] as "yes" | "no")
              : "") as "yes" | "no" | ""}
            columns={2}
            onChange={(v) => set(insuranceKey, v)}
            options={[
              { value: "yes", label: tShared("yes") },
              { value: "no", label: tShared("no") },
            ]}
          />
        </BrandField>
      ) : null}

      <BrandActionButton
        onClick={onContinue}
        disabled={!sourceValue}
        className="self-end"
      >
        {tShared("continue")}
      </BrandActionButton>
    </div>
  );
}
