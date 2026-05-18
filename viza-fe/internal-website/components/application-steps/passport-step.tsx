"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, ShieldCheck } from "lucide-react";
import { BrandActionButton } from "@/components/client/brand-action-button";
import {
  BilingualCountryControl,
  BilingualDateControl,
  BilingualOptionControl,
  BilingualRow,
  BilingualSectionHeader,
  BilingualTableShell,
  BilingualTextControl,
  COUNTRY_OPTIONS,
  findBilingualOption,
  mirrorText,
  reverseWithDictionary,
  toCopilotOptions,
  translateWithDictionary,
  type BilingualOptionPair,
} from "./bilingual-form-shared";

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

type MirroredField = "passportNumber" | "passportBookNumber";

const PASSPORT_TYPE_OPTIONS: BilingualOptionPair[] = [
  { code: "REGULAR", zh: "普通护照", en: "Regular" },
  { code: "OFFICIAL", zh: "公务护照", en: "Official" },
  { code: "DIPLOMATIC", zh: "外交护照", en: "Diplomatic" },
  { code: "OTHER", zh: "其他", en: "Other" },
];

const CITY_TRANSLATIONS: Record<string, string> = {
  北京: "Beijing",
  上海: "Shanghai",
  广州: "Guangzhou",
  深圳: "Shenzhen",
  成都: "Chengdu",
  杭州: "Hangzhou",
  南京: "Nanjing",
  苏州: "Suzhou",
};

function toMirroredValue(value?: string) {
  const officialValue = value ?? "";
  return { zh: officialValue, en: officialValue };
}

function toCityValue(value?: string) {
  const officialValue = value ?? "";
  return {
    zh: reverseWithDictionary(officialValue, CITY_TRANSLATIONS),
    en: officialValue,
  };
}

export function PassportStep({ prefill, onComplete }: PassportStepProps) {
  const t = useTranslations("applicationSteps");
  const [passportDocumentType, setPassportDocumentType] = useState(prefill?.passportDocumentType ?? "");
  const [mirroredValues, setMirroredValues] = useState<Record<MirroredField, { zh: string; en: string }>>({
    passportNumber: toMirroredValue(prefill?.passportNumber),
    passportBookNumber: toMirroredValue(prefill?.passportBookNumber),
  });
  const [passportIssuingCountryCode, setPassportIssuingCountryCode] = useState(
    findBilingualOption(COUNTRY_OPTIONS, prefill?.passportIssuingCountry)?.code ?? "",
  );
  const [passportIssuanceCity, setPassportIssuanceCity] = useState(toCityValue(prefill?.passportIssuanceCity));
  const [passportIssuanceDate, setPassportIssuanceDate] = useState(prefill?.passportIssuanceDate ?? "");
  const [passportExpirationDate, setPassportExpirationDate] = useState(prefill?.passportExpirationDate ?? "");

  const updateMirrored = (field: MirroredField, value: string) => {
    const nextValue = mirrorText(value);
    setMirroredValues((current) => ({
      ...current,
      [field]: { zh: nextValue, en: nextValue },
    }));
  };

  const updateCity = (side: "zh" | "en", value: string) => {
    setPassportIssuanceCity(
      side === "zh"
        ? {
            zh: value,
            en: translateWithDictionary(value, CITY_TRANSLATIONS, "Please confirm official English"),
          }
        : {
            zh: reverseWithDictionary(value, CITY_TRANSLATIONS),
            en: value,
          },
    );
  };

  const copilotAnswers = {
    passport_document_type: passportDocumentType,
    passport_number: mirroredValues.passportNumber.en,
    passport_book_number: mirroredValues.passportBookNumber.en,
    passport_issuing_country: findBilingualOption(COUNTRY_OPTIONS, passportIssuingCountryCode)?.en ?? "",
    passport_issuance_city: passportIssuanceCity.en,
    passport_issuance_date: passportIssuanceDate,
    passport_issue_date: passportIssuanceDate,
    passport_expiration_date: passportExpirationDate,
    passport_expiry_date: passportExpirationDate,
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onComplete({
      passportDocumentType,
      passportNumber: mirroredValues.passportNumber.en,
      passportBookNumber: mirroredValues.passportBookNumber.en,
      passportIssuingCountry: findBilingualOption(COUNTRY_OPTIONS, passportIssuingCountryCode)?.en ?? "",
      passportIssuanceCity: passportIssuanceCity.en,
      passportIssuanceDate,
      passportExpirationDate,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <BilingualTableShell>
        <BilingualSectionHeader>护照信息 / Passport Information</BilingualSectionHeader>
        <div className="divide-y divide-[#eef1f5]">
          <BilingualRow
            label={`${t("passport.documentType")} / Passport document type`}
            helper="中英文都从同一组官方护照类型中选择。"
            badge="官方选项映射"
            copilot={{
              fieldName: "passport_document_type",
              label: "Passport document type",
              fieldType: "select",
              value: passportDocumentType,
              allAnswers: copilotAnswers,
              required: true,
              options: toCopilotOptions(PASSPORT_TYPE_OPTIONS),
              placeholder: "Select passport type",
            }}
            zhControl={
              <BilingualOptionControl
                side="zh"
                value={passportDocumentType}
                options={PASSPORT_TYPE_OPTIONS}
                placeholder={t("select")}
                icon={<ShieldCheck className="h-4 w-4" />}
                onChange={setPassportDocumentType}
              />
            }
            enControl={
              <BilingualOptionControl
                side="en"
                value={passportDocumentType}
                options={PASSPORT_TYPE_OPTIONS}
                placeholder="Select..."
                icon={<ShieldCheck className="h-4 w-4" />}
                onChange={setPassportDocumentType}
              />
            }
          />
          <BilingualRow
            label={`${t("passport.passportNumber")} / Passport number`}
            helper="号码不翻译，左右两侧保持完全一致。"
            badge="逐位同步"
            copilot={{
              fieldName: "passport_number",
              label: "Passport number",
              fieldType: "text",
              value: mirroredValues.passportNumber.en,
              allAnswers: copilotAnswers,
              required: true,
              placeholder: "PA1234567",
              validationRules: { maxLength: 20 },
            }}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={mirroredValues.passportNumber.zh}
                placeholder={t("passport.passportNumberPlaceholder")}
                required
                icon={<ShieldCheck className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateMirrored("passportNumber", value)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={mirroredValues.passportNumber.en}
                placeholder="PA1234567"
                required
                icon={<ShieldCheck className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateMirrored("passportNumber", value)}
              />
            }
          />
          <BilingualRow
            label={`${t("passport.bookNumber")} / Passport book number`}
            helper="如护照没有单独本号，可留空。"
            badge="逐位同步"
            copilot={{
              fieldName: "passport_book_number",
              label: "Passport book number",
              fieldType: "text",
              value: mirroredValues.passportBookNumber.en,
              allAnswers: copilotAnswers,
              placeholder: "Book number if any",
              validationRules: { maxLength: 20 },
            }}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={mirroredValues.passportBookNumber.zh}
                placeholder={t("passport.bookNumberPlaceholder")}
                icon={<ShieldCheck className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateMirrored("passportBookNumber", value)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={mirroredValues.passportBookNumber.en}
                placeholder="Book number if any"
                icon={<ShieldCheck className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateMirrored("passportBookNumber", value)}
              />
            }
          />
          <BilingualRow
            label={`${t("passport.issuingCountry")} / Issuing country`}
            helper="国家名称左侧显示中文，右侧显示英文官方写法。"
            badge="国家选项映射"
            copilot={{
              fieldName: "passport_issuing_country",
              label: "Issuing country",
              fieldType: "country",
              value: findBilingualOption(COUNTRY_OPTIONS, passportIssuingCountryCode)?.en ?? "",
              allAnswers: copilotAnswers,
              required: true,
              placeholder: "Select issuing country",
            }}
            zhControl={
              <BilingualCountryControl
                side="zh"
                value={passportIssuingCountryCode}
                placeholder={t("passport.issuingCountryPlaceholder")}
                onChange={setPassportIssuingCountryCode}
              />
            }
            enControl={
              <BilingualCountryControl
                side="en"
                value={passportIssuingCountryCode}
                placeholder="Select issuing country..."
                onChange={setPassportIssuingCountryCode}
              />
            }
          />
          <BilingualRow
            label={`${t("passport.issuanceCity")} / Issuance city`}
            helper="签发城市可从中文侧输入，英文侧自动给出常用写法。"
            badge="自动生成英文"
            copilot={{
              fieldName: "passport_issuance_city",
              label: "Issuance city",
              fieldType: "text",
              value: passportIssuanceCity.en,
              allAnswers: copilotAnswers,
              required: true,
              placeholder: "e.g. Beijing",
            }}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={passportIssuanceCity.zh}
                placeholder={t("passport.issuanceCityPlaceholder")}
                icon={<MapPin className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateCity("zh", value)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={passportIssuanceCity.en}
                placeholder="e.g. Beijing"
                icon={<MapPin className="h-4 w-4 text-gray-400" />}
                onChange={(value) => updateCity("en", value)}
              />
            }
          />
          <BilingualRow
            label={`${t("passport.issueDate")} / Issue date`}
            helper="任意一侧选择日期，另一侧会同步显示中文日期或 DD/MM/YYYY。"
            badge="官方日期格式"
            copilot={{
              fieldName: "passport_issuance_date",
              label: "Issue date",
              fieldType: "date",
              value: passportIssuanceDate,
              allAnswers: copilotAnswers,
              required: true,
              validationRules: { format: "DD/MM/YYYY" },
            }}
            zhControl={
              <BilingualDateControl
                side="zh"
                value={passportIssuanceDate}
                placeholder={t("passport.issueDatePlaceholder")}
                onChange={setPassportIssuanceDate}
              />
            }
            enControl={
              <BilingualDateControl
                side="en"
                value={passportIssuanceDate}
                placeholder="Select issue date"
                onChange={setPassportIssuanceDate}
              />
            }
          />
          <BilingualRow
            label={`${t("passport.expiryDate")} / Expiry date`}
            helper="任意一侧选择日期，另一侧会同步显示中文日期或 DD/MM/YYYY。"
            badge="官方日期格式"
            copilot={{
              fieldName: "passport_expiration_date",
              label: "Expiry date",
              fieldType: "date",
              value: passportExpirationDate,
              allAnswers: copilotAnswers,
              required: true,
              validationRules: { format: "DD/MM/YYYY" },
            }}
            zhControl={
              <BilingualDateControl
                side="zh"
                value={passportExpirationDate}
                placeholder={t("passport.expiryDatePlaceholder")}
                onChange={setPassportExpirationDate}
              />
            }
            enControl={
              <BilingualDateControl
                side="en"
                value={passportExpirationDate}
                placeholder="Select expiry date"
                onChange={setPassportExpirationDate}
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
