"use client";

import { AtSign, MapPin, Phone, ShieldCheck, User, WalletCards } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  BilingualCountryControl,
  BilingualDateControl,
  BilingualOptionControl,
  BilingualRow,
  BilingualTextControl,
  mirrorText,
  type BilingualOptionPair,
  type BilingualSide,
} from "@/components/application-steps/bilingual-form-shared";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FrequentTravelerInput } from "@/lib/frequent-traveler-profile";

interface FrequentTravelerProfileFieldsProps {
  value: FrequentTravelerInput;
  onFieldChange: (field: keyof FrequentTravelerInput, value: string) => void;
  className?: string;
}

const GENDER_OPTIONS: BilingualOptionPair[] = [
  { code: "M", zh: "男", en: "Male" },
  { code: "F", zh: "女", en: "Female" },
];

function BilingualTextareaControl({
  value,
  side,
  placeholder,
  onChange,
}: {
  value: string;
  side: BilingualSide;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Textarea
      aria-label={side === "zh" ? "中文" : "English"}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-24 resize-y rounded-lg border-[#e8e8e8] text-[15px] focus:border-[#03346E] focus:ring-1 focus:ring-[#03346E]"
    />
  );
}

export function FrequentTravelerProfileFields({
  value,
  onFieldChange,
  className,
}: FrequentTravelerProfileFieldsProps) {
  const t = useTranslations("settings.travelers");

  function fieldValue(field: keyof FrequentTravelerInput) {
    const current = value[field];
    return typeof current === "string" ? current : "";
  }

  function updateBilingualField(
    baseField: keyof FrequentTravelerInput,
    zhField: keyof FrequentTravelerInput,
    enField: keyof FrequentTravelerInput,
    side: BilingualSide,
    nextValue: string,
  ) {
    onFieldChange(side === "zh" ? zhField : enField, nextValue);
    if (side === "en" || !fieldValue(baseField)) {
      onFieldChange(baseField, nextValue);
    }
  }

  function updateMirroredField(field: keyof FrequentTravelerInput, nextValue: string) {
    onFieldChange(field, mirrorText(nextValue));
  }

  return (
    <div className={cn("space-y-6", className)}>
      <section>
        <h4 className="text-sm font-semibold text-[#03346E]">{t("sections.identity")}</h4>
        <div className="mt-2 divide-y divide-[#eef1f5]">
          <BilingualRow
            label={t("fields.surname")}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={fieldValue("surnameZh")}
                placeholder={t("placeholders.surnameZh")}
                icon={<User className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateBilingualField("surname", "surnameZh", "surnameEn", "zh", next)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={fieldValue("surnameEn")}
                placeholder={t("placeholders.surnameEn")}
                icon={<User className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateBilingualField("surname", "surnameZh", "surnameEn", "en", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.givenNames")}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={fieldValue("givenNamesZh")}
                placeholder={t("placeholders.givenNamesZh")}
                icon={<User className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateBilingualField("givenNames", "givenNamesZh", "givenNamesEn", "zh", next)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={fieldValue("givenNamesEn")}
                placeholder={t("placeholders.givenNamesEn")}
                icon={<User className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateBilingualField("givenNames", "givenNamesZh", "givenNamesEn", "en", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.dateOfBirth")}
            zhControl={
              <BilingualDateControl
                side="zh"
                value={fieldValue("dateOfBirth")}
                placeholder={t("placeholders.dateOfBirthZh")}
                onChange={(next) => onFieldChange("dateOfBirth", next)}
              />
            }
            enControl={
              <BilingualDateControl
                side="en"
                value={fieldValue("dateOfBirth")}
                placeholder={t("placeholders.dateOfBirthEn")}
                onChange={(next) => onFieldChange("dateOfBirth", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.birthCountry")}
            zhControl={
              <BilingualCountryControl
                side="zh"
                value={fieldValue("birthCountry")}
                placeholder={t("placeholders.birthCountryZh")}
                showSecondaryLabel={false}
                onChange={(next) => onFieldChange("birthCountry", next)}
              />
            }
            enControl={
              <BilingualCountryControl
                side="en"
                value={fieldValue("birthCountry")}
                placeholder={t("placeholders.birthCountryEn")}
                showSecondaryLabel={false}
                onChange={(next) => onFieldChange("birthCountry", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.birthProvinceOrState")}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={fieldValue("birthProvinceOrStateZh")}
                placeholder={t("placeholders.birthProvinceOrStateZh")}
                icon={<MapPin className="h-4 w-4 text-gray-400" />}
                onChange={(next) =>
                  updateBilingualField("birthProvinceOrState", "birthProvinceOrStateZh", "birthProvinceOrStateEn", "zh", next)
                }
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={fieldValue("birthProvinceOrStateEn")}
                placeholder={t("placeholders.birthProvinceOrStateEn")}
                icon={<MapPin className="h-4 w-4 text-gray-400" />}
                onChange={(next) =>
                  updateBilingualField("birthProvinceOrState", "birthProvinceOrStateZh", "birthProvinceOrStateEn", "en", next)
                }
              />
            }
          />
          <BilingualRow
            label={t("fields.birthCity")}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={fieldValue("birthCityZh")}
                placeholder={t("placeholders.birthCityZh")}
                icon={<MapPin className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateBilingualField("birthCity", "birthCityZh", "birthCityEn", "zh", next)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={fieldValue("birthCityEn")}
                placeholder={t("placeholders.birthCityEn")}
                icon={<MapPin className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateBilingualField("birthCity", "birthCityZh", "birthCityEn", "en", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.gender")}
            zhControl={
              <BilingualOptionControl
                side="zh"
                value={fieldValue("gender")}
                options={GENDER_OPTIONS}
                placeholder={t("placeholders.genderZh")}
                icon={<User className="h-4 w-4" />}
                onChange={(next) => onFieldChange("gender", next)}
              />
            }
            enControl={
              <BilingualOptionControl
                side="en"
                value={fieldValue("gender")}
                options={GENDER_OPTIONS}
                placeholder={t("placeholders.genderEn")}
                icon={<User className="h-4 w-4" />}
                onChange={(next) => onFieldChange("gender", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.nationality")}
            zhControl={
              <BilingualCountryControl
                side="zh"
                value={fieldValue("nationality")}
                placeholder={t("placeholders.nationalityZh")}
                showSecondaryLabel={false}
                onChange={(next) => onFieldChange("nationality", next)}
              />
            }
            enControl={
              <BilingualCountryControl
                side="en"
                value={fieldValue("nationality")}
                placeholder={t("placeholders.nationalityEn")}
                showSecondaryLabel={false}
                onChange={(next) => onFieldChange("nationality", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.occupation")}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={fieldValue("occupationZh")}
                placeholder={t("placeholders.occupationZh")}
                icon={<WalletCards className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateBilingualField("occupation", "occupationZh", "occupationEn", "zh", next)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={fieldValue("occupationEn")}
                placeholder={t("placeholders.occupationEn")}
                icon={<WalletCards className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateBilingualField("occupation", "occupationZh", "occupationEn", "en", next)}
              />
            }
          />
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-[#03346E]">{t("sections.passport")}</h4>
        <div className="mt-2 divide-y divide-[#eef1f5]">
          <BilingualRow
            label={t("fields.passportNumber")}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={fieldValue("passportNumber")}
                placeholder={t("placeholders.passportNumber")}
                icon={<ShieldCheck className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateMirroredField("passportNumber", next)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={fieldValue("passportNumber")}
                placeholder={t("placeholders.passportNumber")}
                icon={<ShieldCheck className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateMirroredField("passportNumber", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.passportIssuingCountry")}
            zhControl={
              <BilingualCountryControl
                side="zh"
                value={fieldValue("passportIssuingCountry")}
                placeholder={t("placeholders.passportIssuingCountryZh")}
                showSecondaryLabel={false}
                onChange={(next) => onFieldChange("passportIssuingCountry", next)}
              />
            }
            enControl={
              <BilingualCountryControl
                side="en"
                value={fieldValue("passportIssuingCountry")}
                placeholder={t("placeholders.passportIssuingCountryEn")}
                showSecondaryLabel={false}
                onChange={(next) => onFieldChange("passportIssuingCountry", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.passportIssueDate")}
            zhControl={
              <BilingualDateControl
                side="zh"
                value={fieldValue("passportIssueDate")}
                placeholder={t("placeholders.passportIssueDateZh")}
                onChange={(next) => onFieldChange("passportIssueDate", next)}
              />
            }
            enControl={
              <BilingualDateControl
                side="en"
                value={fieldValue("passportIssueDate")}
                placeholder={t("placeholders.passportIssueDateEn")}
                onChange={(next) => onFieldChange("passportIssueDate", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.passportExpiryDate")}
            zhControl={
              <BilingualDateControl
                side="zh"
                value={fieldValue("passportExpiryDate")}
                placeholder={t("placeholders.passportExpiryDateZh")}
                onChange={(next) => onFieldChange("passportExpiryDate", next)}
              />
            }
            enControl={
              <BilingualDateControl
                side="en"
                value={fieldValue("passportExpiryDate")}
                placeholder={t("placeholders.passportExpiryDateEn")}
                onChange={(next) => onFieldChange("passportExpiryDate", next)}
              />
            }
          />
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-[#03346E]">{t("sections.contact")}</h4>
        <div className="mt-2 divide-y divide-[#eef1f5]">
          <BilingualRow
            label={t("fields.email")}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={fieldValue("email")}
                placeholder={t("placeholders.email")}
                icon={<AtSign className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateMirroredField("email", next)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={fieldValue("email")}
                placeholder={t("placeholders.email")}
                icon={<AtSign className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateMirroredField("email", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.phone")}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={fieldValue("phone")}
                placeholder={t("placeholders.phone")}
                icon={<Phone className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateMirroredField("phone", next)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={fieldValue("phone")}
                placeholder={t("placeholders.phone")}
                icon={<Phone className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateMirroredField("phone", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.wechat")}
            zhControl={
              <BilingualTextControl
                side="zh"
                value={fieldValue("wechat")}
                placeholder={t("placeholders.wechat")}
                icon={<Phone className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateMirroredField("wechat", next)}
              />
            }
            enControl={
              <BilingualTextControl
                side="en"
                value={fieldValue("wechat")}
                placeholder={t("placeholders.wechat")}
                icon={<Phone className="h-4 w-4 text-gray-400" />}
                onChange={(next) => updateMirroredField("wechat", next)}
              />
            }
          />
          <BilingualRow
            label={t("fields.address")}
            zhControl={
              <BilingualTextareaControl
                side="zh"
                value={fieldValue("addressZh")}
                placeholder={t("placeholders.addressZh")}
                onChange={(next) => updateBilingualField("address", "addressZh", "addressEn", "zh", next)}
              />
            }
            enControl={
              <BilingualTextareaControl
                side="en"
                value={fieldValue("addressEn")}
                placeholder={t("placeholders.addressEn")}
                onChange={(next) => updateBilingualField("address", "addressZh", "addressEn", "en", next)}
              />
            }
          />
        </div>
      </section>
    </div>
  );
}
