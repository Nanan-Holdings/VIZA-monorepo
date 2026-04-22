"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plane, Building2, MapPin } from "lucide-react";
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

export interface TravelInfoData {
  arrivalDate: string;
  departureDate: string;
  portOfEntry: string;
  purpose: string;
  accommodationName: string;
  accommodationAddress: string;
}

interface TravelInfoStepProps {
  applicationId?: string;
  prefill?: Partial<TravelInfoData>;
  onComplete: (data: TravelInfoData) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-[14px] font-medium text-gray-700 tracking-[-0.2px]">{label}</Label>
      {children}
    </div>
  );
}

export function TravelInfoStep({ prefill, onComplete }: TravelInfoStepProps) {
  const t = useTranslations("applicationSteps");
  const [data, setData] = useState<TravelInfoData>({
    arrivalDate: prefill?.arrivalDate ?? "",
    departureDate: prefill?.departureDate ?? "",
    portOfEntry: prefill?.portOfEntry ?? "",
    purpose: prefill?.purpose ?? "",
    accommodationName: prefill?.accommodationName ?? "",
    accommodationAddress: prefill?.accommodationAddress ?? "",
  });

  const set = (field: keyof TravelInfoData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((d) => ({ ...d, [field]: e.target.value }));

  const setDirect = (field: keyof TravelInfoData) => (value: string) =>
    setData((d) => ({ ...d, [field]: value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onComplete(data); }} className="flex flex-col gap-7">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
        <Field label={t("travel.arrivalDate")}>
          <DatePicker
            value={data.arrivalDate}
            onChange={setDirect("arrivalDate")}
            placeholder={t("travel.arrivalDatePlaceholder")}
          />
        </Field>
        <Field label={t("travel.departureDate")}>
          <DatePicker
            value={data.departureDate}
            onChange={setDirect("departureDate")}
            placeholder={t("travel.departureDatePlaceholder")}
          />
        </Field>
      </div>
      <Field label={t("travel.portOfEntry")}>
        <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
          <InputGroupAddon align="inline-start">
            <Plane className="h-4 w-4 text-gray-400" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={t("travel.portOfEntryPlaceholder")}
            value={data.portOfEntry}
            onChange={set("portOfEntry")}
            className="h-12 text-[15px]"
          />
        </InputGroup>
      </Field>
      <Field label={t("travel.purposeOfVisit")}>
        <Select value={data.purpose} onValueChange={setDirect("purpose")}>
          <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground">
            <SelectValue placeholder={t("travel.selectPurpose")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tourism">{t("travel.tourism")}</SelectItem>
            <SelectItem value="business">{t("travel.business")}</SelectItem>
            <SelectItem value="social_cultural">{t("travel.socialCultural")}</SelectItem>
            <SelectItem value="family_visit">{t("travel.familyVisit")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("travel.accommodationName")}>
        <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
          <InputGroupAddon align="inline-start">
            <Building2 className="h-4 w-4 text-gray-400" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={t("travel.accommodationNamePlaceholder")}
            value={data.accommodationName}
            onChange={set("accommodationName")}
            className="h-12 text-[15px]"
          />
        </InputGroup>
      </Field>
      <Field label={t("travel.accommodationAddress")}>
        <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
          <InputGroupAddon align="inline-start">
            <MapPin className="h-4 w-4 text-gray-400" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={t("travel.accommodationAddressPlaceholder")}
            value={data.accommodationAddress}
            onChange={set("accommodationAddress")}
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
