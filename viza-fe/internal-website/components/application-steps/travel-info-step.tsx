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
  purposeOfTrip: string;
  arrivalDate: string;
  departureDate: string;
  arrivalCity: string;
  accommodationName: string;
  usAddressStreet1: string;
  usAddressCity: string;
  usAddressState: string;
  usAddressZip: string;
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

// US states for the DS-160 address dropdown
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY",
] as const;

export function TravelInfoStep({ prefill, onComplete }: TravelInfoStepProps) {
  const t = useTranslations("applicationSteps");
  const [data, setData] = useState<TravelInfoData>({
    purposeOfTrip: prefill?.purposeOfTrip ?? "",
    arrivalDate: prefill?.arrivalDate ?? "",
    departureDate: prefill?.departureDate ?? "",
    arrivalCity: prefill?.arrivalCity ?? "",
    accommodationName: prefill?.accommodationName ?? "",
    usAddressStreet1: prefill?.usAddressStreet1 ?? "",
    usAddressCity: prefill?.usAddressCity ?? "",
    usAddressState: prefill?.usAddressState ?? "",
    usAddressZip: prefill?.usAddressZip ?? "",
  });

  const set = (field: keyof TravelInfoData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((d) => ({ ...d, [field]: e.target.value }));

  const setDirect = (field: keyof TravelInfoData) => (value: string) =>
    setData((d) => ({ ...d, [field]: value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onComplete(data); }} className="flex flex-col gap-7">
      <Field label={t("travel.purposeOfVisit")}>
        <Select value={data.purposeOfTrip} onValueChange={setDirect("purposeOfTrip")}>
          <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground">
            <SelectValue placeholder={t("travel.selectPurpose")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="B1/B2">{t("travel.tourism")}</SelectItem>
            <SelectItem value="B1">{t("travel.business")}</SelectItem>
            <SelectItem value="F1">{t("travel.student")}</SelectItem>
            <SelectItem value="J1">{t("travel.exchange")}</SelectItem>
            <SelectItem value="OTHER">{t("travel.other")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
        <Field label={t("travel.arrivalCity")}>
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
            <InputGroupAddon align="inline-start">
              <Plane className="h-4 w-4 text-gray-400" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t("travel.arrivalCityPlaceholder")}
              value={data.arrivalCity}
              onChange={set("arrivalCity")}
              className="h-12 text-[15px]"
            />
          </InputGroup>
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
      </div>
      <Field label={t("travel.usAddress")}>
        <div className="flex flex-col gap-3">
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
            <InputGroupAddon align="inline-start">
              <MapPin className="h-4 w-4 text-gray-400" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t("travel.usStreetPlaceholder")}
              value={data.usAddressStreet1}
              onChange={set("usAddressStreet1")}
              className="h-12 text-[15px]"
            />
          </InputGroup>
          <div className="grid grid-cols-3 gap-3">
            <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
              <InputGroupInput
                placeholder={t("travel.usCityPlaceholder")}
                value={data.usAddressCity}
                onChange={set("usAddressCity")}
                className="h-12 text-[15px]"
              />
            </InputGroup>
            <Select value={data.usAddressState} onValueChange={setDirect("usAddressState")}>
              <SelectTrigger className="h-12 rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-[#03346E] focus:border-[#03346E] data-[placeholder]:text-muted-foreground">
                <SelectValue placeholder={t("travel.usStatePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-[#03346E] focus-within:border-[#03346E]">
              <InputGroupInput
                placeholder={t("travel.usZipPlaceholder")}
                value={data.usAddressZip}
                onChange={set("usAddressZip")}
                className="h-12 text-[15px]"
              />
            </InputGroup>
          </div>
        </div>
      </Field>
      <BrandActionButton type="submit" className="mt-2">
        {t("continue")}
      </BrandActionButton>
    </form>
  );
}
