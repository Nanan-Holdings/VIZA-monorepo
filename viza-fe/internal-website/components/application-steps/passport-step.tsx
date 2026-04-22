"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

export interface PassportData {
  passportNumber: string;
  issueDate: string;
  expiryDate: string;
  issuingCountry: string;
  issuingAuthority: string;
}

interface PassportStepProps {
  applicationId?: string;
  prefill?: Partial<PassportData>;
  onComplete: (data: PassportData) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-[14px] font-medium text-gray-700 tracking-[-0.2px]">{label}</Label>
      {children}
    </div>
  );
}

export function PassportStep({ prefill, onComplete }: PassportStepProps) {
  const t = useTranslations("applicationSteps");
  const [data, setData] = useState<PassportData>({
    passportNumber: prefill?.passportNumber ?? "",
    issueDate: prefill?.issueDate ?? "",
    expiryDate: prefill?.expiryDate ?? "",
    issuingCountry: prefill?.issuingCountry ?? "",
    issuingAuthority: prefill?.issuingAuthority ?? "",
  });

  const set = (field: keyof PassportData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((d) => ({ ...d, [field]: e.target.value }));

  const setDirect = (field: keyof PassportData) => (value: string) =>
    setData((d) => ({ ...d, [field]: value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onComplete(data); }} className="flex flex-col gap-7">
      <Field label={t("passport.passportNumber")}>
        <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
          <InputGroupAddon align="inline-start">
            <ShieldCheck className="h-4 w-4 text-gray-400" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={t("passport.passportNumberPlaceholder")}
            value={data.passportNumber}
            onChange={set("passportNumber")}
            required
            className="h-12 text-[15px]"
          />
        </InputGroup>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
        <Field label={t("passport.issueDate")}>
          <DatePicker
            value={data.issueDate}
            onChange={setDirect("issueDate")}
            placeholder={t("passport.issueDatePlaceholder")}
          />
        </Field>
        <Field label={t("passport.expiryDate")}>
          <DatePicker
            value={data.expiryDate}
            onChange={setDirect("expiryDate")}
            placeholder={t("passport.expiryDatePlaceholder")}
          />
        </Field>
      </div>
      <Field label={t("passport.issuingCountry")}>
        <CountryDropdown
          placeholder={t("passport.issuingCountryPlaceholder")}
          defaultValue={data.issuingCountry}
          onChange={(country) => setData((d) => ({ ...d, issuingCountry: country.name }))}
        />
      </Field>
      <Field label={t("passport.issuingAuthority")}>
        <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
          <InputGroupAddon align="inline-start">
            <ShieldCheck className="h-4 w-4 text-gray-400" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={t("passport.issuingAuthorityPlaceholder")}
            value={data.issuingAuthority}
            onChange={set("issuingAuthority")}
            className="h-12 text-[15px]"
          />
        </InputGroup>
      </Field>
      <BrandActionButton type="submit" className="mt-2">
        {t("continue")}
      </BrandActionButton>
    </form>
  );
}
