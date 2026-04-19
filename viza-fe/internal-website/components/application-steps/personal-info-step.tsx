"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { User, MapPin } from "lucide-react";
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
import { CountryDropdown } from "@/components/ui/country-dropdown";

export interface PersonalInfoData {
  surname: string;
  givenNames: string;
  fullNameNativeAlphabet: string;
  sex: string;
  maritalStatus: string;
  dateOfBirth: string;
  cityOfBirth: string;
  stateOfBirth: string;
  countryOfBirth: string;
  nationality: string;
}

interface PersonalInfoStepProps {
  applicationId?: string;
  prefill?: Partial<PersonalInfoData>;
  onComplete: (data: PersonalInfoData) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-[14px] font-medium text-gray-700 tracking-[-0.2px]">{label}</Label>
      {children}
    </div>
  );
}

export function PersonalInfoStep({ prefill, onComplete }: PersonalInfoStepProps) {
  const t = useTranslations("applicationSteps");
  const [data, setData] = useState<PersonalInfoData>({
    surname: prefill?.surname ?? "",
    givenNames: prefill?.givenNames ?? "",
    fullNameNativeAlphabet: prefill?.fullNameNativeAlphabet ?? "",
    sex: prefill?.sex ?? "",
    maritalStatus: prefill?.maritalStatus ?? "",
    dateOfBirth: prefill?.dateOfBirth ?? "",
    cityOfBirth: prefill?.cityOfBirth ?? "",
    stateOfBirth: prefill?.stateOfBirth ?? "",
    countryOfBirth: prefill?.countryOfBirth ?? "",
    nationality: prefill?.nationality ?? "",
  });

  const set = (field: keyof PersonalInfoData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((d) => ({ ...d, [field]: e.target.value }));

  const setDirect = (field: keyof PersonalInfoData) => (value: string) =>
    setData((d) => ({ ...d, [field]: value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onComplete(data); }} className="flex flex-col gap-7">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
        <Field label={t("personalInfo.surname")}>
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
            <InputGroupAddon align="inline-start">
              <User className="h-4 w-4 text-gray-400" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t("personalInfo.surnamePlaceholder")}
              value={data.surname}
              onChange={set("surname")}
              required
              className="h-12 text-[15px]"
            />
          </InputGroup>
        </Field>
        <Field label={t("personalInfo.givenNames")}>
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
            <InputGroupAddon align="inline-start">
              <User className="h-4 w-4 text-gray-400" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t("personalInfo.givenNamesPlaceholder")}
              value={data.givenNames}
              onChange={set("givenNames")}
              required
              className="h-12 text-[15px]"
            />
          </InputGroup>
        </Field>
      </div>
      <Field label={t("personalInfo.fullNameNative")}>
        <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
          <InputGroupAddon align="inline-start">
            <User className="h-4 w-4 text-gray-400" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={t("personalInfo.fullNameNativePlaceholder")}
            value={data.fullNameNativeAlphabet}
            onChange={set("fullNameNativeAlphabet")}
            className="h-12 text-[15px]"
          />
        </InputGroup>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
        <Field label={t("personalInfo.dateOfBirth")}>
          <DatePicker
            value={data.dateOfBirth}
            onChange={setDirect("dateOfBirth")}
            placeholder={t("personalInfo.dateOfBirthPlaceholder")}
          />
        </Field>
        <Field label={t("personalInfo.maritalStatus")}>
          <Select value={data.maritalStatus} onValueChange={setDirect("maritalStatus")}>
            <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground">
              <SelectValue placeholder={t("select")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SINGLE">{t("personalInfo.single")}</SelectItem>
              <SelectItem value="MARRIED">{t("personalInfo.married")}</SelectItem>
              <SelectItem value="DIVORCED">{t("personalInfo.divorced")}</SelectItem>
              <SelectItem value="WIDOWED">{t("personalInfo.widowed")}</SelectItem>
              <SelectItem value="SEPARATED">{t("personalInfo.separated")}</SelectItem>
              <SelectItem value="OTHER">{t("personalInfo.otherMarital")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
        <Field label={t("personalInfo.gender")}>
          <Select value={data.sex} onValueChange={setDirect("sex")}>
            <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground">
              <SelectValue placeholder={t("select")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">{t("personalInfo.male")}</SelectItem>
              <SelectItem value="F">{t("personalInfo.female")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("personalInfo.nationality")}>
          <CountryDropdown
            placeholder={t("personalInfo.nationalityPlaceholder")}
            defaultValue={data.nationality}
            onChange={(country) => setData((d) => ({ ...d, nationality: country.name }))}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-7">
        <Field label={t("personalInfo.cityOfBirth")}>
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
            <InputGroupAddon align="inline-start">
              <MapPin className="h-4 w-4 text-gray-400" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t("personalInfo.cityOfBirthPlaceholder")}
              value={data.cityOfBirth}
              onChange={set("cityOfBirth")}
              className="h-12 text-[15px]"
            />
          </InputGroup>
        </Field>
        <Field label={t("personalInfo.stateOfBirth")}>
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
            <InputGroupInput
              placeholder={t("personalInfo.stateOfBirthPlaceholder")}
              value={data.stateOfBirth}
              onChange={set("stateOfBirth")}
              className="h-12 text-[15px]"
            />
          </InputGroup>
        </Field>
        <Field label={t("personalInfo.countryOfBirth")}>
          <CountryDropdown
            placeholder={t("personalInfo.countryOfBirthPlaceholder")}
            defaultValue={data.countryOfBirth}
            onChange={(country) => setData((d) => ({ ...d, countryOfBirth: country.name }))}
          />
        </Field>
      </div>
      <BrandActionButton type="submit" className="mt-2">
        {t("continue")}
      </BrandActionButton>
    </form>
  );
}
