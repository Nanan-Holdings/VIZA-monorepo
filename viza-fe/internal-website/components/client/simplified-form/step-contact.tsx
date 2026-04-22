"use client";

import { useTranslations } from "next-intl";
import { Mail, Phone, Instagram, Facebook, Linkedin, Youtube, Music2, Twitter, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandInput, BrandField } from "@/components/client/brand-field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { cn } from "@/lib/utils";
import { TabChoice } from "./tab-choice";
import type { SimplifiedContact, SocialPlatform } from "./types";

interface StepContactProps {
  value: SimplifiedContact;
  onChange: (value: SimplifiedContact) => void;
  onContinue: () => void;
}

const SOCIAL_CONFIG: Array<{ value: SocialPlatform; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { value: "instagram", label: "Instagram", Icon: Instagram },
  { value: "facebook", label: "Facebook", Icon: Facebook },
  { value: "twitter", label: "X / Twitter", Icon: Twitter },
  { value: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { value: "youtube", label: "YouTube", Icon: Youtube },
  { value: "tiktok", label: "TikTok", Icon: Music2 },
  { value: "weibo", label: "Weibo", Icon: Globe },
];

export function StepContact({ value, onChange, onContinue }: StepContactProps) {
  const t = useTranslations("simplifiedForm.contact");
  const tCommon = useTranslations("simplifiedForm.common");

  const set = <K extends keyof SimplifiedContact>(key: K, next: SimplifiedContact[K]) =>
    onChange({ ...value, [key]: next });

  const togglePlatform = (platform: SocialPlatform) => {
    const selected = value.socialPlatforms.includes(platform);
    if (selected) {
      const nextPlatforms = value.socialPlatforms.filter((p) => p !== platform);
      const { [platform]: _removed, ...nextHandles } = value.socialHandles;
      onChange({ ...value, socialPlatforms: nextPlatforms, socialHandles: nextHandles });
    } else {
      onChange({ ...value, socialPlatforms: [...value.socialPlatforms, platform] });
    }
  };

  const setHandle = (platform: SocialPlatform, handle: string) =>
    onChange({ ...value, socialHandles: { ...value.socialHandles, [platform]: handle } });

  const canContinue =
    value.email.trim() &&
    value.phone.trim() &&
    value.homeCountry &&
    value.street1.trim() &&
    value.city.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) onContinue();
      }}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <BrandField label={t("email")} htmlFor="email" required>
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-brand-500 focus-within:border-brand-500">
            <InputGroupAddon align="inline-start">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              type="email"
              value={value.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              required
              className="h-12 text-[15px]"
            />
          </InputGroup>
        </BrandField>
        <BrandField label={t("phone")} htmlFor="phone" required>
          <InputGroup className="h-12 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-brand-500 focus-within:border-brand-500">
            <InputGroupAddon align="inline-start">
              <Phone className="h-4 w-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              id="phone"
              type="tel"
              value={value.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder={t("phonePlaceholder")}
              autoComplete="tel"
              required
              className="h-12 text-[15px]"
            />
          </InputGroup>
        </BrandField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <BrandField label={t("secondaryPhone")} hint={t("secondaryPhoneHint")}>
          <BrandInput
            value={value.secondaryPhone}
            onChange={(e) => set("secondaryPhone", e.target.value)}
            placeholder={t("secondaryPhonePlaceholder")}
            autoComplete="tel"
          />
        </BrandField>
        <BrandField label={t("secondaryEmail")} hint={t("secondaryEmailHint")}>
          <BrandInput
            type="email"
            value={value.secondaryEmail}
            onChange={(e) => set("secondaryEmail", e.target.value)}
            placeholder={t("secondaryEmailPlaceholder")}
            autoComplete="email"
          />
        </BrandField>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
        <p className="text-sm font-semibold text-foreground">{t("homeAddressTitle")}</p>
        <BrandField label={t("homeCountry")} required>
          <CountryDropdown
            defaultValue={value.homeCountry}
            placeholder={t("homeCountryPlaceholder")}
            onChange={(country) => set("homeCountry", country.alpha3)}
          />
        </BrandField>
        <BrandField label={t("street")} htmlFor="street1" required>
          <BrandInput
            id="street1"
            value={value.street1}
            onChange={(e) => set("street1", e.target.value)}
            placeholder={t("streetPlaceholder")}
            autoComplete="address-line1"
            required
          />
        </BrandField>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandField label={t("city")} htmlFor="city" required>
            <BrandInput
              id="city"
              value={value.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder={t("cityPlaceholder")}
              autoComplete="address-level2"
              required
            />
          </BrandField>
          <BrandField label={t("state")} htmlFor="state">
            <BrandInput
              id="state"
              value={value.state}
              onChange={(e) => set("state", e.target.value)}
              placeholder={t("statePlaceholder")}
              autoComplete="address-level1"
            />
          </BrandField>
        </div>
        <BrandField label={t("postalCode")} htmlFor="postal">
          <BrandInput
            id="postal"
            value={value.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            placeholder={t("postalCodePlaceholder")}
            autoComplete="postal-code"
          />
        </BrandField>
      </div>

      <BrandField label={t("mailingSame")}>
        <TabChoice
          name="mailing-same"
          value={value.mailingSame ? "yes" : "no"}
          columns={2}
          onChange={(next) => set("mailingSame", next === "yes")}
          ariaLabel={t("mailingSame")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />
        {!value.mailingSame ? (
          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border/60 bg-white p-3">
            <BrandField label={t("homeCountry")}>
              <CountryDropdown
                defaultValue={value.mailingCountry}
                placeholder={t("homeCountryPlaceholder")}
                onChange={(country) => set("mailingCountry", country.alpha3)}
              />
            </BrandField>
            <BrandField label={t("street")}>
              <BrandInput
                value={value.mailingStreet1}
                onChange={(e) => set("mailingStreet1", e.target.value)}
                placeholder={t("streetPlaceholder")}
                autoComplete="address-line1"
              />
            </BrandField>
            <div className="grid gap-3 sm:grid-cols-2">
              <BrandField label={t("city")}>
                <BrandInput
                  value={value.mailingCity}
                  onChange={(e) => set("mailingCity", e.target.value)}
                  placeholder={t("cityPlaceholder")}
                  autoComplete="address-level2"
                />
              </BrandField>
              <BrandField label={t("state")}>
                <BrandInput
                  value={value.mailingState}
                  onChange={(e) => set("mailingState", e.target.value)}
                  placeholder={t("statePlaceholder")}
                  autoComplete="address-level1"
                />
              </BrandField>
            </div>
            <BrandField label={t("postalCode")}>
              <BrandInput
                value={value.mailingPostalCode}
                onChange={(e) => set("mailingPostalCode", e.target.value)}
                placeholder={t("postalCodePlaceholder")}
                autoComplete="postal-code"
              />
            </BrandField>
          </div>
        ) : null}
      </BrandField>

      <BrandField label={t("socialMedia")} hint={t("socialMediaHint")}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {SOCIAL_CONFIG.map(({ value: platform, label, Icon }) => {
            const selected = value.socialPlatforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                aria-pressed={selected}
                className={cn(
                  "flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  selected
                    ? "border-brand-500 bg-brand-500 text-primary-foreground"
                    : "border-input bg-white text-foreground hover:border-brand-200 hover:bg-brand-50",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        {value.socialPlatforms.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {value.socialPlatforms.map((platform) => {
              const cfg = SOCIAL_CONFIG.find((c) => c.value === platform)!;
              return (
                <BrandInput
                  key={platform}
                  value={value.socialHandles[platform] ?? ""}
                  onChange={(e) => setHandle(platform, e.target.value)}
                  placeholder={t("socialHandlePlaceholder", { platform: cfg.label })}
                  aria-label={cfg.label}
                />
              );
            })}
          </div>
        ) : null}
      </BrandField>

      <Button
        type="submit"
        disabled={!canContinue}
        className="mt-2 h-12 rounded-lg bg-brand-500 text-[15px] font-medium text-white hover:bg-brand-500/90"
      >
        {tCommon("continue")}
      </Button>
    </form>
  );
}
