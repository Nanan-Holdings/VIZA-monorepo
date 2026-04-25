"use client";

import {
  Building2,
  Home,
  Users,
  Briefcase,
  GraduationCap,
  HelpCircle,
  MapPin,
  Phone,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import { RegionSelect } from "@/components/ui/region-select";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { TabChoice } from "./tab-choice";
import type { SimplifiedTravel } from "./types";

interface StepUsStayProps {
  value: SimplifiedTravel;
  onChange: (value: SimplifiedTravel) => void;
  onContinue: () => void;
}

const DIAL_CODES: Array<{ label: string; value: string }> = [
  { label: "🇺🇸 +1", value: "+1" },
  { label: "🇨🇳 +86", value: "+86" },
  { label: "🇬🇧 +44", value: "+44" },
  { label: "🇯🇵 +81", value: "+81" },
  { label: "🇰🇷 +82", value: "+82" },
  { label: "🇸🇬 +65", value: "+65" },
  { label: "🇦🇺 +61", value: "+61" },
  { label: "🇨🇦 +1", value: "+1" },
];

const ACCOMMODATION_OPTIONS = [
  { value: "hotel" as const, labelKey: "accomHotel" as const, Icon: Building2 },
  { value: "airbnb" as const, labelKey: "accomAirbnb" as const, Icon: Home },
  { value: "friends_family" as const, labelKey: "accomFriends" as const, Icon: Users },
  { value: "business" as const, labelKey: "accomBusiness" as const, Icon: Briefcase },
  { value: "school" as const, labelKey: "accomSchool" as const, Icon: GraduationCap },
  { value: "other" as const, labelKey: "accomOther" as const, Icon: HelpCircle },
] as const;

export function StepUsStay({ value, onChange, onContinue }: StepUsStayProps) {
  const t = useTranslations("simplifiedForm.travel");
  const tCommon = useTranslations("simplifiedForm.common");

  const set = <K extends keyof SimplifiedTravel>(key: K, next: SimplifiedTravel[K]) =>
    onChange({ ...value, [key]: next });

  const accom = value.usAccommodationType;

  const addressTitle =
    accom === "hotel"
      ? t("accomHotelAddressTitle")
      : accom === "airbnb"
        ? t("accomAirbnbAddressTitle")
        : accom === "friends_family"
          ? t("accomFriendsAddressTitle")
          : accom === "business"
            ? t("accomBusinessAddressTitle")
            : accom === "school"
              ? t("accomSchoolAddressTitle")
              : t("accomOtherAddressTitle");

  const contactInfoTitle =
    accom === "hotel"
      ? t("contactInfoHotel")
      : accom === "airbnb"
        ? t("contactInfoAirbnb")
        : accom === "friends_family"
          ? t("contactInfoFriends")
          : accom === "business"
            ? t("contactInfoBusiness")
            : accom === "school"
              ? t("contactInfoSchool")
              : t("contactInfoOther");

  const contactInfoSubtitle =
    accom === "hotel"
      ? t("contactInfoHotelSubtitle")
      : accom === "friends_family"
        ? t("contactInfoFriendsSubtitle")
        : t("contactInfoDefaultSubtitle");

  const emailPlaceholder =
    accom === "hotel" ? t("contactEmailHotelPlaceholder") : t("contactEmailPlaceholder");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("usStayPageTitle")}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t("usStayPageSubtitle")}</p>
      </header>

      {/* Accommodation type icon grid */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-foreground">{t("accomTypeTitle")}</p>
        <div className="grid grid-cols-3 gap-3">
          {ACCOMMODATION_OPTIONS.map(({ value: optValue, labelKey, Icon }) => {
            const isSelected = accom === optValue;
            return (
              <button
                key={optValue}
                type="button"
                onClick={() => set("usAccommodationType", optValue)}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-colors",
                  isSelected
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-border/60 bg-white text-muted-foreground hover:border-brand-500/40 hover:text-foreground",
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hotel */}
      {accom === "hotel" ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("accomHotelNameTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("accomContactSubtitle")}</p>
            </div>
          </div>
          <BrandField label={t("hotelName")} required>
            <BrandInput
              value={value.hotelName}
              onChange={(e) => set("hotelName", e.target.value)}
              placeholder={t("hotelNamePlaceholder")}
            />
          </BrandField>
          <p className="text-xs text-muted-foreground">💡 {t("hotelHint")}</p>
        </div>
      ) : null}

      {/* Airbnb */}
      {accom === "airbnb" ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Home className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("accomHostNameTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("accomContactSubtitle")}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <BrandField label={t("firstName")} required>
              <BrandInput
                value={value.usHostFirstName}
                onChange={(e) => set("usHostFirstName", e.target.value)}
                placeholder={t("hostFirstNamePlaceholder")}
              />
            </BrandField>
            <BrandField label={t("lastName")} required>
              <BrandInput
                value={value.usHostLastName}
                onChange={(e) => set("usHostLastName", e.target.value)}
                placeholder={t("hostLastNamePlaceholder")}
              />
            </BrandField>
          </div>
          <p className="text-xs text-muted-foreground">💡 {t("airbnbHint")}</p>
        </div>
      ) : null}

      {/* Friends / Family */}
      {accom === "friends_family" ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("accomFriendsContactTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("accomContactSubtitle")}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <BrandField label={t("firstName")} required>
              <BrandInput
                value={value.usFriendsFirstName}
                onChange={(e) => set("usFriendsFirstName", e.target.value)}
                placeholder={t("contactFirstNamePlaceholder")}
              />
            </BrandField>
            <BrandField label={t("lastName")} required>
              <BrandInput
                value={value.usFriendsLastName}
                onChange={(e) => set("usFriendsLastName", e.target.value)}
                placeholder={t("contactLastNamePlaceholder")}
              />
            </BrandField>
          </div>
          <BrandField label={t("howKnowThem")} required>
            <TabChoice
              name="friends-relationship"
              value={value.usFriendsRelationship}
              columns={2}
              onChange={(next) =>
                set("usFriendsRelationship", next as SimplifiedTravel["usFriendsRelationship"])
              }
              ariaLabel={t("howKnowThem")}
              options={[
                { value: "relative", label: t("relative") },
                { value: "friend", label: t("friend") },
              ]}
            />
          </BrandField>
        </div>
      ) : null}

      {/* Business */}
      {accom === "business" ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("accomBusinessTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("accomContactSubtitle")}</p>
            </div>
          </div>
          <BrandField label={t("orgName")} required>
            <BrandInput
              value={value.usOrgName}
              onChange={(e) => set("usOrgName", e.target.value)}
              placeholder={t("orgNamePlaceholder")}
            />
          </BrandField>
        </div>
      ) : null}

      {/* School */}
      {accom === "school" ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("accomSchoolTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("accomContactSubtitle")}</p>
            </div>
          </div>
          <BrandField label={t("schoolName")} required>
            <BrandInput
              value={value.usSchoolName}
              onChange={(e) => set("usSchoolName", e.target.value)}
              placeholder={t("schoolNamePlaceholder")}
            />
          </BrandField>
        </div>
      ) : null}

      {/* Other */}
      {accom === "other" ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("accomOtherContactTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("accomContactSubtitle")}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <BrandField label={t("firstName")} required>
              <BrandInput
                value={value.usOtherFirstName}
                onChange={(e) => set("usOtherFirstName", e.target.value)}
                placeholder={t("contactFirstNamePlaceholder")}
              />
            </BrandField>
            <BrandField label={t("lastName")} required>
              <BrandInput
                value={value.usOtherLastName}
                onChange={(e) => set("usOtherLastName", e.target.value)}
                placeholder={t("contactLastNamePlaceholder")}
              />
            </BrandField>
          </div>
        </div>
      ) : null}

      {/* Address section */}
      {accom ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">{addressTitle}</p>
              <p className="text-xs text-muted-foreground">{t("accomAddressSubtitle")}</p>
            </div>
          </div>
          <BrandField label={t("usStreet")} required>
            <BrandInput
              value={value.usStreet}
              onChange={(e) => set("usStreet", e.target.value)}
              placeholder={t("usStreetPlaceholder")}
              autoComplete="address-line1"
            />
          </BrandField>
          <BrandField label={t("usStreet2")}>
            <BrandInput
              value={value.usStreet2}
              onChange={(e) => set("usStreet2", e.target.value)}
              placeholder={t("usStreet2Placeholder")}
              autoComplete="address-line2"
            />
          </BrandField>
          <div className="grid gap-3 sm:grid-cols-3">
            <BrandField label={t("usCity")} required>
              <BrandInput
                value={value.usCity}
                onChange={(e) => set("usCity", e.target.value)}
                placeholder={t("usCityPlaceholderUs")}
                autoComplete="address-level2"
              />
            </BrandField>
            <BrandField label={t("usStateLabel")} required>
              <RegionSelect
                countryCode="US"
                defaultValue={value.usState}
                placeholder={t("usStatePlaceholderUs")}
                onChange={(region) => set("usState", region.shortCode)}
                className="h-12 w-full rounded-lg border-[#e8e8e8] text-[15px] focus:ring-1 focus:ring-brand-500 focus:border-brand-500 data-[placeholder]:text-muted-foreground"
              />
            </BrandField>
            <BrandField label={t("usZip")}>
              <BrandInput
                value={value.usZip}
                onChange={(e) => set("usZip", e.target.value)}
                placeholder={t("usZipPlaceholderUs")}
                autoComplete="postal-code"
              />
            </BrandField>
          </div>
        </div>
      ) : null}

      {/* Contact info card — phone + email */}
      {accom ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">{contactInfoTitle}</p>
              <p className="text-xs text-muted-foreground">{contactInfoSubtitle}</p>
            </div>
          </div>

          <BrandField label={t("phone")} required>
            <InputGroup className="h-12">
              <InputGroupAddon className="h-12 rounded-l-lg border-[#e8e8e8] bg-white px-2">
                <select
                  value={value.usContactPhoneDialCode}
                  onChange={(e) => set("usContactPhoneDialCode", e.target.value)}
                  className="h-8 border-0 bg-transparent pr-1 text-sm outline-none"
                  aria-label={t("dialCode")}
                >
                  {DIAL_CODES.map((code) => (
                    <option key={`${code.value}-${code.label}`} value={code.value}>
                      {code.label}
                    </option>
                  ))}
                </select>
              </InputGroupAddon>
              <InputGroupInput
                value={value.usContactPhone}
                onChange={(e) => set("usContactPhone", e.target.value)}
                placeholder={t("phonePlaceholder")}
              />
            </InputGroup>
          </BrandField>

          <BrandField label={t("email")} required>
            <BrandInput
              value={value.usContactEmail}
              onChange={(e) => set("usContactEmail", e.target.value)}
              placeholder={emailPlaceholder}
              disabled={value.usContactEmailUnknown}
            />
          </BrandField>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={value.usContactEmailUnknown}
              onCheckedChange={(checked) => {
                const isUnknown = checked === true;
                onChange({
                  ...value,
                  usContactEmailUnknown: isUnknown,
                  usContactEmail: isUnknown ? "" : value.usContactEmail,
                });
              }}
            />
            {t("unknownContactEmail")}
          </label>
        </div>
      ) : null}

      <Button
        type="button"
        onClick={onContinue}
        className="mt-2 h-12 rounded-lg bg-brand-500 text-[15px] font-medium text-white hover:bg-brand-500/90"
      >
        {tCommon("continue")}
      </Button>
    </div>
  );
}
