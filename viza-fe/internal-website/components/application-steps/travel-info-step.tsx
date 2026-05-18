"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, MapPin, Plane } from "lucide-react";
import { BrandActionButton } from "@/components/client/brand-action-button";
import {
  BilingualDateControl,
  BilingualOptionControl,
  BilingualRow,
  BilingualSectionHeader,
  BilingualTableShell,
  BilingualTextControl,
  mirrorText,
  reverseWithDictionary,
  toCopilotOptions,
  translateWithDictionary,
  type BilingualOptionPair,
} from "./bilingual-form-shared";

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

type TextField = "arrivalCity" | "accommodationName" | "usAddressStreet1" | "usAddressCity";

const PURPOSE_OPTIONS: BilingualOptionPair[] = [
  { code: "B1/B2", zh: "旅游 / 商务（B1/B2）", en: "Tourism / Business (B1/B2)" },
  { code: "B1", zh: "商务（B1）", en: "Business (B1)" },
  { code: "F1", zh: "学生（F1）", en: "Student (F1)" },
  { code: "J1", zh: "交流访问（J1）", en: "Exchange visitor (J1)" },
  { code: "OTHER", zh: "其他", en: "Other" },
];

const US_STATE_OPTIONS: BilingualOptionPair[] = [
  { code: "AL", zh: "阿拉巴马（AL）", en: "Alabama (AL)" },
  { code: "AK", zh: "阿拉斯加（AK）", en: "Alaska (AK)" },
  { code: "AZ", zh: "亚利桑那（AZ）", en: "Arizona (AZ)" },
  { code: "AR", zh: "阿肯色（AR）", en: "Arkansas (AR)" },
  { code: "CA", zh: "加利福尼亚（CA）", en: "California (CA)" },
  { code: "CO", zh: "科罗拉多（CO）", en: "Colorado (CO)" },
  { code: "CT", zh: "康涅狄格（CT）", en: "Connecticut (CT)" },
  { code: "DE", zh: "特拉华（DE）", en: "Delaware (DE)" },
  { code: "DC", zh: "哥伦比亚特区（DC）", en: "District of Columbia (DC)" },
  { code: "FL", zh: "佛罗里达（FL）", en: "Florida (FL)" },
  { code: "GA", zh: "佐治亚（GA）", en: "Georgia (GA)" },
  { code: "HI", zh: "夏威夷（HI）", en: "Hawaii (HI)" },
  { code: "ID", zh: "爱达荷（ID）", en: "Idaho (ID)" },
  { code: "IL", zh: "伊利诺伊（IL）", en: "Illinois (IL)" },
  { code: "IN", zh: "印第安纳（IN）", en: "Indiana (IN)" },
  { code: "IA", zh: "艾奥瓦（IA）", en: "Iowa (IA)" },
  { code: "KS", zh: "堪萨斯（KS）", en: "Kansas (KS)" },
  { code: "KY", zh: "肯塔基（KY）", en: "Kentucky (KY)" },
  { code: "LA", zh: "路易斯安那（LA）", en: "Louisiana (LA)" },
  { code: "ME", zh: "缅因（ME）", en: "Maine (ME)" },
  { code: "MD", zh: "马里兰（MD）", en: "Maryland (MD)" },
  { code: "MA", zh: "马萨诸塞（MA）", en: "Massachusetts (MA)" },
  { code: "MI", zh: "密歇根（MI）", en: "Michigan (MI)" },
  { code: "MN", zh: "明尼苏达（MN）", en: "Minnesota (MN)" },
  { code: "MS", zh: "密西西比（MS）", en: "Mississippi (MS)" },
  { code: "MO", zh: "密苏里（MO）", en: "Missouri (MO)" },
  { code: "MT", zh: "蒙大拿（MT）", en: "Montana (MT)" },
  { code: "NE", zh: "内布拉斯加（NE）", en: "Nebraska (NE)" },
  { code: "NV", zh: "内华达（NV）", en: "Nevada (NV)" },
  { code: "NH", zh: "新罕布什尔（NH）", en: "New Hampshire (NH)" },
  { code: "NJ", zh: "新泽西（NJ）", en: "New Jersey (NJ)" },
  { code: "NM", zh: "新墨西哥（NM）", en: "New Mexico (NM)" },
  { code: "NY", zh: "纽约（NY）", en: "New York (NY)" },
  { code: "NC", zh: "北卡罗来纳（NC）", en: "North Carolina (NC)" },
  { code: "ND", zh: "北达科他（ND）", en: "North Dakota (ND)" },
  { code: "OH", zh: "俄亥俄（OH）", en: "Ohio (OH)" },
  { code: "OK", zh: "俄克拉荷马（OK）", en: "Oklahoma (OK)" },
  { code: "OR", zh: "俄勒冈（OR）", en: "Oregon (OR)" },
  { code: "PA", zh: "宾夕法尼亚（PA）", en: "Pennsylvania (PA)" },
  { code: "RI", zh: "罗得岛（RI）", en: "Rhode Island (RI)" },
  { code: "SC", zh: "南卡罗来纳（SC）", en: "South Carolina (SC)" },
  { code: "SD", zh: "南达科他（SD）", en: "South Dakota (SD)" },
  { code: "TN", zh: "田纳西（TN）", en: "Tennessee (TN)" },
  { code: "TX", zh: "得克萨斯（TX）", en: "Texas (TX)" },
  { code: "UT", zh: "犹他（UT）", en: "Utah (UT)" },
  { code: "VT", zh: "佛蒙特（VT）", en: "Vermont (VT)" },
  { code: "VA", zh: "弗吉尼亚（VA）", en: "Virginia (VA)" },
  { code: "WA", zh: "华盛顿州（WA）", en: "Washington (WA)" },
  { code: "WV", zh: "西弗吉尼亚（WV）", en: "West Virginia (WV)" },
  { code: "WI", zh: "威斯康星（WI）", en: "Wisconsin (WI)" },
  { code: "WY", zh: "怀俄明（WY）", en: "Wyoming (WY)" },
];

const TEXT_TRANSLATIONS: Record<string, string> = {
  纽约肯尼迪国际机场: "John F. Kennedy International Airport, New York",
  上海浦东国际机场: "Shanghai Pudong International Airport",
  北京首都国际机场: "Beijing Capital International Airport",
  洛杉矶国际机场: "Los Angeles International Airport",
  酒店: "Hotel",
  民宿: "Homestay",
  北京: "Beijing",
  上海: "Shanghai",
  纽约: "New York",
  洛杉矶: "Los Angeles",
};

function toTextValue(value?: string) {
  const officialValue = value ?? "";
  return {
    zh: reverseWithDictionary(officialValue, TEXT_TRANSLATIONS),
    en: officialValue,
  };
}

export function TravelInfoStep({ prefill, onComplete }: TravelInfoStepProps) {
  const t = useTranslations("applicationSteps");
  const [purposeOfTrip, setPurposeOfTrip] = useState(prefill?.purposeOfTrip ?? "");
  const [arrivalDate, setArrivalDate] = useState(prefill?.arrivalDate ?? "");
  const [departureDate, setDepartureDate] = useState(prefill?.departureDate ?? "");
  const [textValues, setTextValues] = useState<Record<TextField, { zh: string; en: string }>>({
    arrivalCity: toTextValue(prefill?.arrivalCity),
    accommodationName: toTextValue(prefill?.accommodationName),
    usAddressStreet1: toTextValue(prefill?.usAddressStreet1),
    usAddressCity: toTextValue(prefill?.usAddressCity),
  });
  const [usAddressState, setUsAddressState] = useState(prefill?.usAddressState ?? "");
  const [usAddressZip, setUsAddressZip] = useState({
    zh: prefill?.usAddressZip ?? "",
    en: prefill?.usAddressZip ?? "",
  });

  const updateText = (field: TextField, side: "zh" | "en", value: string) => {
    setTextValues((current) => ({
      ...current,
      [field]:
        side === "zh"
          ? {
              zh: value,
              en: translateWithDictionary(value, TEXT_TRANSLATIONS, "Please confirm official English"),
            }
          : {
              zh: reverseWithDictionary(value, TEXT_TRANSLATIONS),
              en: value,
            },
    }));
  };

  const updateZip = (value: string) => {
    const nextValue = mirrorText(value);
    setUsAddressZip({ zh: nextValue, en: nextValue });
  };

  const copilotAnswers = {
    purpose_of_trip: purposeOfTrip,
    arrival_date: arrivalDate,
    departure_date: departureDate,
    arrival_city: textValues.arrivalCity.en,
    accommodation_name: textValues.accommodationName.en,
    us_address_street1: textValues.usAddressStreet1.en,
    us_address_city: textValues.usAddressCity.en,
    us_address_state: usAddressState,
    us_address_zip: usAddressZip.en,
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onComplete({
      purposeOfTrip,
      arrivalDate,
      departureDate,
      arrivalCity: textValues.arrivalCity.en,
      accommodationName: textValues.accommodationName.en,
      usAddressStreet1: textValues.usAddressStreet1.en,
      usAddressCity: textValues.usAddressCity.en,
      usAddressState,
      usAddressZip: usAddressZip.en,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <BilingualTableShell>
        <BilingualSectionHeader>旅行详情 / Travel Details</BilingualSectionHeader>
        <div className="divide-y divide-[#eef1f5]">
          <BilingualRow
            label={`${t("travel.purposeOfVisit")} / Purpose of visit`}
            helper="中英文都从同一组官方旅行目的中选择。"
            badge="官方选项映射"
            copilot={{
              fieldName: "purpose_of_trip",
              label: "Purpose of visit",
              fieldType: "select",
              value: purposeOfTrip,
              allAnswers: copilotAnswers,
              required: true,
              options: toCopilotOptions(PURPOSE_OPTIONS),
              placeholder: "Select purpose...",
            }}
            zhControl={
              <BilingualOptionControl
                side="zh"
                value={purposeOfTrip}
                options={PURPOSE_OPTIONS}
                placeholder={t("travel.selectPurpose")}
                icon={<Plane className="h-4 w-4" />}
                onChange={setPurposeOfTrip}
              />
            }
            enControl={
              <BilingualOptionControl
                side="en"
                value={purposeOfTrip}
                options={PURPOSE_OPTIONS}
                placeholder="Select purpose..."
                icon={<Plane className="h-4 w-4" />}
                onChange={setPurposeOfTrip}
              />
            }
          />
          <BilingualRow
            label={`${t("travel.arrivalDate")} / Arrival date`}
            helper="任意一侧选择日期，另一侧会同步显示中文日期或 DD/MM/YYYY。"
            badge="官方日期格式"
            copilot={{
              fieldName: "arrival_date",
              label: "Arrival date",
              fieldType: "date",
              value: arrivalDate,
              allAnswers: copilotAnswers,
              required: true,
              validationRules: { format: "DD/MM/YYYY" },
            }}
            zhControl={
              <BilingualDateControl
                side="zh"
                value={arrivalDate}
                placeholder={t("travel.arrivalDatePlaceholder")}
                onChange={setArrivalDate}
              />
            }
            enControl={
              <BilingualDateControl
                side="en"
                value={arrivalDate}
                placeholder="Select arrival date"
                onChange={setArrivalDate}
              />
            }
          />
          <BilingualRow
            label={`${t("travel.departureDate")} / Departure date`}
            helper="任意一侧选择日期，另一侧会同步显示中文日期或 DD/MM/YYYY。"
            badge="官方日期格式"
            copilot={{
              fieldName: "departure_date",
              label: "Departure date",
              fieldType: "date",
              value: departureDate,
              allAnswers: copilotAnswers,
              required: true,
              validationRules: { format: "DD/MM/YYYY" },
            }}
            zhControl={
              <BilingualDateControl
                side="zh"
                value={departureDate}
                placeholder={t("travel.departureDatePlaceholder")}
                onChange={setDepartureDate}
              />
            }
            enControl={
              <BilingualDateControl
                side="en"
                value={departureDate}
                placeholder="Select departure date"
                onChange={setDepartureDate}
              />
            }
          />
          <BilingualRow
            label={`${t("travel.arrivalCity")} / Arrival city or port`}
            helper="机场、城市或口岸可从中文侧输入，英文侧自动给出常用写法。"
            badge="自动生成英文"
            copilot={{
              fieldName: "arrival_city",
              label: "Arrival city or port",
              fieldType: "text",
              value: textValues.arrivalCity.en,
              allAnswers: copilotAnswers,
              required: true,
              placeholder: "e.g. John F. Kennedy International Airport",
            }}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={textValues.arrivalCity.zh}
                placeholder={t("travel.arrivalCityPlaceholder")}
                icon={<Plane className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateText("arrivalCity", "zh", value)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={textValues.arrivalCity.en}
                placeholder="e.g. John F. Kennedy International Airport"
                icon={<Plane className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateText("arrivalCity", "en", value)}
              />
            }
          />
          <BilingualRow
            label={`${t("travel.accommodationName")} / Accommodation name`}
            helper="住宿名称左右可编辑，英文侧作为官方提交值。"
            badge="双向同步"
            copilot={{
              fieldName: "accommodation_name",
              label: "Accommodation name",
              fieldType: "text",
              value: textValues.accommodationName.en,
              allAnswers: copilotAnswers,
              required: true,
              placeholder: "Hotel / Airbnb name",
            }}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={textValues.accommodationName.zh}
                placeholder={t("travel.accommodationNamePlaceholder")}
                icon={<Building2 className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateText("accommodationName", "zh", value)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={textValues.accommodationName.en}
                placeholder="Hotel / Airbnb name"
                icon={<Building2 className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateText("accommodationName", "en", value)}
              />
            }
          />
        </div>

        <BilingualSectionHeader>住宿地址 / Accommodation Address</BilingualSectionHeader>
        <div className="divide-y divide-[#eef1f5]">
          <BilingualRow
            label={`${t("travel.usAddress")} / Street address`}
            helper="地址左侧可输入中文，右侧保留英文官方提交值。"
            badge="双向同步"
            copilot={{
              fieldName: "us_address_street1",
              label: "Street address",
              fieldType: "text",
              value: textValues.usAddressStreet1.en,
              allAnswers: copilotAnswers,
              required: true,
              placeholder: "Street address",
            }}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={textValues.usAddressStreet1.zh}
                placeholder={t("travel.usStreetPlaceholder")}
                icon={<MapPin className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateText("usAddressStreet1", "zh", value)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={textValues.usAddressStreet1.en}
                placeholder="Street address"
                icon={<MapPin className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateText("usAddressStreet1", "en", value)}
              />
            }
          />
          <BilingualRow
            label={`${t("travel.usCity")} / City`}
            helper="城市名称左右同步，英文侧作为官方提交值。"
            badge="自动生成英文"
            copilot={{
              fieldName: "us_address_city",
              label: "City",
              fieldType: "text",
              value: textValues.usAddressCity.en,
              allAnswers: copilotAnswers,
              required: true,
              placeholder: "City",
            }}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={textValues.usAddressCity.zh}
                placeholder={t("travel.usCityPlaceholder")}
                icon={<MapPin className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateText("usAddressCity", "zh", value)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={textValues.usAddressCity.en}
                placeholder="City"
                icon={<MapPin className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateText("usAddressCity", "en", value)}
              />
            }
          />
          <BilingualRow
            label={`${t("travel.usState")} / State`}
            helper="美国州名以州代码保存，左右侧显示中英说明。"
            badge="官方选项映射"
            copilot={{
              fieldName: "us_address_state",
              label: "State",
              fieldType: "select",
              value: usAddressState,
              allAnswers: copilotAnswers,
              required: true,
              options: toCopilotOptions(US_STATE_OPTIONS),
              placeholder: "State",
            }}
            zhControl={
              <BilingualOptionControl
                side="zh"
                value={usAddressState}
                options={US_STATE_OPTIONS}
                placeholder={t("travel.usStatePlaceholder")}
                icon={<MapPin className="h-4 w-4" />}
                onChange={setUsAddressState}
              />
            }
            enControl={
              <BilingualOptionControl
                side="en"
                value={usAddressState}
                options={US_STATE_OPTIONS}
                placeholder="State"
                icon={<MapPin className="h-4 w-4" />}
                onChange={setUsAddressState}
              />
            }
          />
          <BilingualRow
            label={`${t("travel.usZip")} / ZIP code`}
            helper="邮编不翻译，左右两侧保持完全一致。"
            badge="逐位同步"
            copilot={{
              fieldName: "us_address_zip",
              label: "ZIP code",
              fieldType: "text",
              value: usAddressZip.en,
              allAnswers: copilotAnswers,
              required: true,
              placeholder: "ZIP code",
              validationRules: { maxLength: 10 },
            }}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={usAddressZip.zh}
                placeholder={t("travel.usZipPlaceholder")}
                icon={<MapPin className="h-4 w-4 text-gray-400" />}
                onChange={updateZip}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={usAddressZip.en}
                placeholder="ZIP code"
                icon={<MapPin className="h-4 w-4 text-gray-400" />}
                onChange={updateZip}
              />
            }
          />
        </div>
      </BilingualTableShell>
      <BrandActionButton type="submit" className="mt-2">
        {t("continue")}
      </BrandActionButton>
    </form>
  );
}
