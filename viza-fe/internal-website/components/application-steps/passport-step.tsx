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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PassportData {
  passportDocumentType: string;
  passportNumber: string;
  passportBookNumber: string;
  passportIssuingCountry: string;
  passportIssuanceCity: string;
  passportIssuanceDate: string;
  passportExpirationDate: string;
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
    passportDocumentType: prefill?.passportDocumentType ?? "",
    passportNumber: prefill?.passportNumber ?? "",
    passportBookNumber: prefill?.passportBookNumber ?? "",
    passportIssuingCountry: prefill?.passportIssuingCountry ?? "",
    passportIssuanceCity: prefill?.passportIssuanceCity ?? "",
    passportIssuanceDate: prefill?.passportIssuanceDate ?? "",
    passportExpirationDate: prefill?.passportExpirationDate ?? "",
  });

  const set = (field: keyof PassportData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((d) => ({ ...d, [field]: e.target.value }));

  const setDirect = (field: keyof PassportData) => (value: string) =>
    setData((d) => ({ ...d, [field]: value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onComplete(data); }} className="flex flex-col gap-7">
      <Field label={t("passport.documentType")}>
        <Select value={data.passportDocumentType} onValueChange={setDirect("passportDocumentType")}>
          <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground">
            <SelectValue placeholder={t("select")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="REGULAR">{t("passport.regular")}</SelectItem>
            <SelectItem value="OFFICIAL">{t("passport.official")}</SelectItem>
            <SelectItem value="DIPLOMATIC">{t("passport.diplomatic")}</SelectItem>
            <SelectItem value="OTHER">{t("passport.otherType")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
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
        <Field label={t("passport.bookNumber")}>
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
            <InputGroupAddon align="inline-start">
              <ShieldCheck className="h-4 w-4 text-gray-400" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t("passport.bookNumberPlaceholder")}
              value={data.passportBookNumber}
              onChange={set("passportBookNumber")}
              className="h-12 text-[15px]"
            />
          </InputGroup>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
        <Field label={t("passport.issuingCountry")}>
          <CountryDropdown
            placeholder={t("passport.issuingCountryPlaceholder")}
            defaultValue={data.passportIssuingCountry}
            onChange={(country) => setData((d) => ({ ...d, passportIssuingCountry: country.name }))}
          />
        </Field>
        <Field label={t("passport.issuanceCity")}>
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
            <InputGroupInput
              placeholder={t("passport.issuanceCityPlaceholder")}
              value={data.passportIssuanceCity}
              onChange={set("passportIssuanceCity")}
              className="h-12 text-[15px]"
            />
          </InputGroup>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
        <Field label={t("passport.issueDate")}>
          <DatePicker
            value={data.passportIssuanceDate}
            onChange={setDirect("passportIssuanceDate")}
            placeholder={t("passport.issueDatePlaceholder")}
          />
        </Field>
        <Field label={t("passport.expiryDate")}>
          <DatePicker
            value={data.passportExpirationDate}
            onChange={setDirect("passportExpirationDate")}
            placeholder={t("passport.expiryDatePlaceholder")}
          />
        </Field>
      </div>
      <BrandActionButton type="submit" className="mt-2">
        {t("continue")}
      </BrandActionButton>
    </form>
  );
}
