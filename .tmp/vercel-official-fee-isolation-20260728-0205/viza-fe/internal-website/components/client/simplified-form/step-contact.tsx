"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, Phone, Instagram, Facebook, Linkedin, Youtube, Music2, Twitter, MessageCircle, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandInput, BrandField } from "@/components/client/brand-field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { cn } from "@/lib/utils";
import { TabChoice } from "./tab-choice";
import type { AdditionalPhone, SimplifiedContact, SocialPlatform } from "./types";

interface StepContactProps {
  value: SimplifiedContact;
  onChange: (value: SimplifiedContact) => void;
  onContinue: () => void;
}

const SOCIAL_CONFIG: Array<{ value: SocialPlatform; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { value: "instagram", label: "照片墙 Instagram", Icon: Instagram },
  { value: "facebook", label: "脸书 Facebook", Icon: Facebook },
  { value: "twitter", label: "推特 X / Twitter", Icon: Twitter },
  { value: "linkedin", label: "领英 LinkedIn", Icon: Linkedin },
  { value: "youtube", label: "油管 YouTube", Icon: Youtube },
  { value: "tiktok", label: "抖音国际版 TikTok", Icon: Music2 },
  { value: "wechat", label: "微信 WeChat", Icon: MessageCircle },
  { value: "weibo", label: "微博 Weibo", Icon: Radio },
];

const EXTRA_SOCIAL_OPTIONS: Array<{ value: SocialPlatform; label: string }> = [
  { value: "askfm", label: "问答网 ASK.FM" },
  { value: "flickr", label: "图片社区 Flickr" },
  { value: "myspace", label: "社交空间 Myspace" },
  { value: "reddit", label: "红迪 Reddit" },
  { value: "tumblr", label: "汤博乐 Tumblr" },
  { value: "vine", label: "短视频 Vine" },
  { value: "vkontakte", label: "VK VKontakte" },
  { value: "youku", label: "优酷 Youku" },
];

const DIAL_CODES: Array<{ label: string; value: string }> = [
  { label: "🇨🇳 +86", value: "+86" },
  { label: "🇺🇸 +1", value: "+1" },
  { label: "🇬🇧 +44", value: "+44" },
  { label: "🇯🇵 +81", value: "+81" },
  { label: "🇰🇷 +82", value: "+82" },
  { label: "🇸🇬 +65", value: "+65" },
  { label: "🇦🇺 +61", value: "+61" },
  { label: "🇨🇦 +1", value: "+1" },
  { label: "🇩🇪 +49", value: "+49" },
  { label: "🇫🇷 +33", value: "+33" },
];

export function StepContact({ value, onChange, onContinue }: StepContactProps) {
  const t = useTranslations("simplifiedForm.contact");
  const tCommon = useTranslations("simplifiedForm.common");
  const [hasOtherPhone, setHasOtherPhone] = useState(
    (value.additionalPhones?.length ?? 0) > 0 || value.secondaryPhone.trim() !== "",
  );
  const [hasOtherEmail, setHasOtherEmail] = useState(
    (value.additionalEmails?.length ?? 0) > 0 || value.secondaryEmail.trim() !== "",
  );

  const set = <K extends keyof SimplifiedContact>(key: K, next: SimplifiedContact[K]) =>
    onChange({ ...value, [key]: next });
  const primaryPhoneRaw = value.phone.trim();
  const matchedPrimaryDialCode =
    DIAL_CODES.map((item) => item.value)
      .sort((a, b) => b.length - a.length)
      .find((code) => primaryPhoneRaw.startsWith(code)) ?? "+86";
  const primaryPhoneNumber = primaryPhoneRaw.startsWith(matchedPrimaryDialCode)
    ? primaryPhoneRaw.slice(matchedPrimaryDialCode.length).trim()
    : primaryPhoneRaw.replace(/^\+\d+\s*/, "").trim();
  const additionalPhones =
    value.additionalPhones?.length
      ? value.additionalPhones
      : value.secondaryPhone.trim()
        ? [{ dialCode: "+86", number: value.secondaryPhone.trim() }]
        : [];
  const additionalEmails =
    value.additionalEmails?.length
      ? value.additionalEmails
      : value.secondaryEmail.trim()
        ? [value.secondaryEmail.trim()]
        : [];

  const syncAdditionalPhones = (nextPhones: AdditionalPhone[]) => {
    onChange({
      ...value,
      additionalPhones: nextPhones,
      secondaryPhone: nextPhones[0] ? `${nextPhones[0].dialCode} ${nextPhones[0].number}`.trim() : "",
    });
  };

  const syncAdditionalEmails = (nextEmails: string[]) => {
    onChange({
      ...value,
      additionalEmails: nextEmails,
      secondaryEmail: nextEmails[0]?.trim() || "",
    });
  };

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

  const hasSocialData = value.socialPlatforms.length > 0 || (value.otherSocialEntries?.length ?? 0) > 0;
  const [usesSocialMedia, setUsesSocialMedia] = useState<"yes" | "no" | "">(hasSocialData ? "yes" : "");

  const setUseSocialMedia = (next: "yes" | "no") => {
    setUsesSocialMedia(next);
    if (next === "no") {
      onChange({ ...value, socialPlatforms: [], socialHandles: {}, otherSocialEntries: [] });
    }
  };

  const addExtraPlatform = (platform: SocialPlatform) => {
    if (!platform || value.socialPlatforms.includes(platform)) return;
    onChange({ ...value, socialPlatforms: [...value.socialPlatforms, platform] });
  };

  const addCustomPlatform = () => {
    onChange({
      ...value,
      otherSocialEntries: [...(value.otherSocialEntries ?? []), { platform: "", handle: "" }],
    });
  };

  const updateCustomPlatform = (index: number, key: "platform" | "handle", next: string) => {
    const entries = [...(value.otherSocialEntries ?? [])];
    entries[index] = { ...entries[index], [key]: next };
    onChange({ ...value, otherSocialEntries: entries });
  };

  const canContinue = true;

  return (
    <div className="flex flex-col gap-6">
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
          <div className="flex gap-2">
            <select
              value={matchedPrimaryDialCode}
              onChange={(e) => set("phone", `${e.target.value} ${primaryPhoneNumber}`.trim())}
              className="h-12 w-20 rounded-lg border border-[#e8e8e8] bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              aria-label={t("phone")}
            >
              {DIAL_CODES.map((item) => (
                <option key={`${item.label}-${item.value}`} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <InputGroup className="h-12 flex-1 rounded-lg border-[#e8e8e8] focus-within:ring-1 focus-within:ring-brand-500 focus-within:border-brand-500">
              <InputGroupAddon align="inline-start">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                id="phone"
                type="tel"
                value={primaryPhoneNumber}
                onChange={(e) => set("phone", `${matchedPrimaryDialCode} ${e.target.value}`.trim())}
                placeholder={t("phonePlaceholder")}
                autoComplete="tel"
                required
                className="h-12 text-[15px]"
              />
            </InputGroup>
          </div>
        </BrandField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <BrandField label="您还有其他电话号码吗？">
          <TabChoice
            name="has-other-phone"
            value={hasOtherPhone ? "yes" : "no"}
            columns={2}
            onChange={(next) => {
              const enabled = next === "yes";
              setHasOtherPhone(enabled);
              if (!enabled) {
                onChange({ ...value, additionalPhones: [], secondaryPhone: "" });
              } else if (additionalPhones.length === 0) {
                syncAdditionalPhones([{ dialCode: "+86", number: "" }]);
              }
            }}
            ariaLabel="您还有其他电话号码吗？"
            options={[
              { value: "yes", label: tCommon("yes") },
              { value: "no", label: tCommon("no") },
            ]}
          />
          {hasOtherPhone ? (
            <div className="mt-2 flex flex-col gap-2">
              {additionalPhones.map((phone, index) => (
                <div key={`${phone.dialCode}-${index}`} className="flex gap-2">
                  <select
                    value={phone.dialCode}
                    onChange={(e) => {
                      const next = [...additionalPhones];
                      next[index] = { ...phone, dialCode: e.target.value };
                      syncAdditionalPhones(next);
                    }}
                    className="h-12 w-20 rounded-lg border border-[#e8e8e8] bg-white px-2 text-sm"
                  >
                    {DIAL_CODES.map((item) => (
                      <option key={`${item.label}-${item.value}`} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <BrandInput
                    className="flex-1"
                    value={phone.number}
                    onChange={(e) => {
                      const next = [...additionalPhones];
                      next[index] = { ...phone, number: e.target.value };
                      syncAdditionalPhones(next);
                    }}
                    placeholder={t("secondaryPhonePlaceholder")}
                    autoComplete="tel"
                  />
                  {additionalPhones.length > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const next = additionalPhones.filter((_, i) => i !== index);
                        syncAdditionalPhones(next);
                      }}
                    >
                      -
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => syncAdditionalPhones([...additionalPhones, { dialCode: "+86", number: "" }])}
              >
                + 添加更多
              </Button>
            </div>
          ) : null}
        </BrandField>
        <BrandField label="您还有其他电子邮箱吗？">
          <TabChoice
            name="has-other-email"
            value={hasOtherEmail ? "yes" : "no"}
            columns={2}
            onChange={(next) => {
              const enabled = next === "yes";
              setHasOtherEmail(enabled);
              if (!enabled) {
                onChange({ ...value, additionalEmails: [], secondaryEmail: "" });
              } else if (additionalEmails.length === 0) {
                syncAdditionalEmails([""]);
              }
            }}
            ariaLabel="您还有其他电子邮箱吗？"
            options={[
              { value: "yes", label: tCommon("yes") },
              { value: "no", label: tCommon("no") },
            ]}
          />
          {hasOtherEmail ? (
            <div className="mt-2 flex flex-col gap-2">
              {additionalEmails.map((email, index) => (
                <div key={`${index}-${email}`} className="flex gap-2">
                  <BrandInput
                    type="email"
                    className="flex-1"
                    value={email}
                    onChange={(e) => {
                      const next = [...additionalEmails];
                      next[index] = e.target.value;
                      syncAdditionalEmails(next);
                    }}
                    placeholder={t("secondaryEmailPlaceholder")}
                    autoComplete="email"
                  />
                  {additionalEmails.length > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const next = additionalEmails.filter((_, i) => i !== index);
                        syncAdditionalEmails(next);
                      }}
                    >
                      -
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => syncAdditionalEmails([...additionalEmails, ""])}
              >
                + 添加更多
              </Button>
            </div>
          ) : null}
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
        <BrandField label="街道地址第2行（可选）" htmlFor="street2">
          <BrandInput
            id="street2"
            value={value.street2}
            onChange={(e) => set("street2", e.target.value)}
            placeholder="公寓、单元、楼层（可选）"
            autoComplete="address-line2"
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
            <BrandField label="街道地址第2行（可选）">
              <BrandInput
                value={value.mailingStreet2}
                onChange={(e) => set("mailingStreet2", e.target.value)}
                placeholder="公寓、单元、楼层（可选）"
                autoComplete="address-line2"
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
        <TabChoice
          name="uses-social-media"
          value={usesSocialMedia}
          columns={2}
          onChange={(next) => setUseSocialMedia(next as "yes" | "no")}
          ariaLabel={t("useSocialMedia")}
          options={[
            { value: "yes", label: tCommon("yes") },
            { value: "no", label: tCommon("no") },
          ]}
        />

        {usesSocialMedia === "yes" ? (
          <div className="mt-3 flex flex-col gap-4">
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
              <div className="flex flex-col gap-2">
                {value.socialPlatforms.map((platform) => {
                  const cfg = SOCIAL_CONFIG.find((c) => c.value === platform);
                  const label = cfg?.label ?? EXTRA_SOCIAL_OPTIONS.find((item) => item.value === platform)?.label ?? platform;
                  return (
                    <BrandInput
                      key={platform}
                      value={value.socialHandles[platform] ?? ""}
                      onChange={(e) => setHandle(platform, e.target.value)}
                      placeholder={t("socialHandlePlaceholder", { platform: label })}
                      aria-label={label}
                    />
                  );
                })}
              </div>
            ) : null}

            <BrandField label={t("otherPlatforms")}>
              <select
                className="h-12 rounded-lg border border-[#e8e8e8] bg-white px-3 text-[15px] focus:outline-none focus:ring-1 focus:ring-brand-500"
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  addExtraPlatform(e.target.value as SocialPlatform);
                  e.currentTarget.value = "";
                }}
              >
                <option value="">{t("otherPlatformsPlaceholder")}</option>
                {EXTRA_SOCIAL_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </BrandField>

            {(value.otherSocialEntries ?? []).length > 0 ? (
              <div className="flex flex-col gap-2">
                {(value.otherSocialEntries ?? []).map((entry, index) => (
                  <div key={`${index}-${entry.platform}`} className="grid gap-3 sm:grid-cols-2">
                    <BrandField label={t("customPlatformLabel")} required>
                      <BrandInput
                        value={entry.platform}
                        onChange={(e) => updateCustomPlatform(index, "platform", e.target.value)}
                        placeholder={t("customPlatformPlaceholder")}
                      />
                    </BrandField>
                    <BrandField label={t("customUsernameLabel")} required>
                      <BrandInput
                        value={entry.handle}
                        onChange={(e) => updateCustomPlatform(index, "handle", e.target.value)}
                        placeholder={t("customUsernamePlaceholder")}
                      />
                    </BrandField>
                  </div>
                ))}
              </div>
            ) : null}

            <Button type="button" variant="outline" onClick={addCustomPlatform}>
              + {t("addAnotherPlatform")}
            </Button>
          </div>
        ) : null}
      </BrandField>

      <Button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="mt-2 h-12 rounded-lg bg-brand-500 text-[15px] font-medium text-white hover:bg-brand-500/90"
      >
        {tCommon("continue")}
      </Button>
    </div>
  );
}
