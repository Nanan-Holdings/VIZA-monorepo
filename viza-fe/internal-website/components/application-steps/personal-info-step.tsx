"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { User, MapPin, Globe, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export interface PersonalInfoData {
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  gender: string;
  nationality: string;
  occupation: string;
  address: string;
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
    fullName: prefill?.fullName ?? "",
    dateOfBirth: prefill?.dateOfBirth ?? "",
    placeOfBirth: prefill?.placeOfBirth ?? "",
    gender: prefill?.gender ?? "",
    nationality: prefill?.nationality ?? "",
    occupation: prefill?.occupation ?? "",
    address: prefill?.address ?? "",
  });

  const set = (field: keyof PersonalInfoData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((d) => ({ ...d, [field]: e.target.value }));

  const setDirect = (field: keyof PersonalInfoData) => (value: string) =>
    setData((d) => ({ ...d, [field]: value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onComplete(data); }} className="flex flex-col gap-7">
      <Field label={t("personalInfo.fullName")}>
        <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
          <InputGroupAddon align="inline-start">
            <User className="h-4 w-4 text-gray-400" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={t("personalInfo.fullNamePlaceholder")}
            value={data.fullName}
            onChange={set("fullName")}
            required
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
        <Field label={t("personalInfo.placeOfBirth")}>
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
            <InputGroupAddon align="inline-start">
              <MapPin className="h-4 w-4 text-gray-400" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t("personalInfo.placeOfBirthPlaceholder")}
              value={data.placeOfBirth}
              onChange={set("placeOfBirth")}
              className="h-12 text-[15px]"
            />
          </InputGroup>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
        <Field label={t("personalInfo.gender")}>
          <Select value={data.gender} onValueChange={setDirect("gender")}>
            <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground">
              <SelectValue placeholder={t("select")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">{t("personalInfo.male")}</SelectItem>
              <SelectItem value="Female">{t("personalInfo.female")}</SelectItem>
              <SelectItem value="Other">{t("personalInfo.other")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("personalInfo.nationality")}>
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
            <InputGroupAddon align="inline-start">
              <Globe className="h-4 w-4 text-gray-400" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t("personalInfo.nationalityPlaceholder")}
              value={data.nationality}
              onChange={set("nationality")}
              required
              className="h-12 text-[15px]"
            />
          </InputGroup>
        </Field>
      </div>
      <Field label={t("personalInfo.occupation")}>
        <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
          <InputGroupAddon align="inline-start">
            <Briefcase className="h-4 w-4 text-gray-400" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={t("personalInfo.occupationPlaceholder")}
            value={data.occupation}
            onChange={set("occupation")}
            className="h-12 text-[15px]"
          />
        </InputGroup>
      </Field>
      <Field label={t("personalInfo.currentAddress")}>
        <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
          <InputGroupAddon align="inline-start">
            <MapPin className="h-4 w-4 text-gray-400" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={t("personalInfo.currentAddressPlaceholder")}
            value={data.address}
            onChange={set("address")}
            className="h-12 text-[15px]"
          />
        </InputGroup>
      </Field>
      <Button type="submit" className="mt-2 h-12 bg-[#03346E] hover:bg-[#03346E]/90 text-white rounded-lg text-[15px] font-medium">
        {t("continue")}
      </Button>
    </form>
  );
}
