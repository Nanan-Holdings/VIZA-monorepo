"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabChoice } from "./tab-choice";
import type { SimplifiedUsContact } from "./types";

interface StepUsContactProps {
  value: SimplifiedUsContact;
  onChange: (value: SimplifiedUsContact) => void;
  onContinue: () => void;
}

const RELATIONSHIPS: Array<{ value: SimplifiedUsContact["relationship"]; key: string }> = [
  { value: "RELATIVE", key: "relative" },
  { value: "SPOUSE", key: "spouse" },
  { value: "FRIEND", key: "friend" },
  { value: "BUSINESS ASSOCIATE", key: "businessAssociate" },
  { value: "EMPLOYER", key: "employer" },
  { value: "SCHOOL OFFICIAL", key: "schoolOfficial" },
  { value: "OTHER", key: "other" },
];

const US_STATES: Array<{ value: string; label: string }> = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
].map((s) => ({ value: s, label: s }));

export function StepUsContact({ value, onChange, onContinue }: StepUsContactProps) {
  const t = useTranslations("simplifiedForm.usContact");
  const tCommon = useTranslations("simplifiedForm.common");

  const set = <K extends keyof SimplifiedUsContact>(key: K, next: SimplifiedUsContact[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </header>

      <BrandField label={t("contactType")}>
        <TabChoice
          name="us-contact-type"
          value={value.isOrganization ? "organization" : "person"}
          columns={2}
          onChange={(next) => set("isOrganization", next === "organization")}
          options={[
            { value: "person", label: t("typePerson") },
            { value: "organization", label: t("typeOrganization") },
          ]}
        />
      </BrandField>

      {value.isOrganization ? (
        <BrandField label={t("organizationName")}>
          <BrandInput
            value={value.organizationName}
            onChange={(e) => set("organizationName", e.target.value)}
            placeholder={t("organizationNamePlaceholder")}
          />
        </BrandField>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandField label={t("contactFirstName")}>
            <BrandInput
              value={value.contactFirstName}
              onChange={(e) => set("contactFirstName", e.target.value)}
              placeholder={t("contactFirstNamePlaceholder")}
            />
          </BrandField>
          <BrandField label={t("contactLastName")}>
            <BrandInput
              value={value.contactLastName}
              onChange={(e) => set("contactLastName", e.target.value)}
              placeholder={t("contactLastNamePlaceholder")}
            />
          </BrandField>
        </div>
      )}

      <BrandField label={t("relationship")}>
        <Select
          value={value.relationship}
          onValueChange={(v) => set("relationship", v as SimplifiedUsContact["relationship"])}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder={t("relationshipPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {RELATIONSHIPS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {t(`relationships.${r.key}` as never)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </BrandField>

      <BrandField label={t("street1")}>
        <BrandInput
          value={value.street1}
          onChange={(e) => set("street1", e.target.value)}
          placeholder={t("street1Placeholder")}
        />
      </BrandField>
      <BrandField label={t("street2")}>
        <BrandInput
          value={value.street2}
          onChange={(e) => set("street2", e.target.value)}
          placeholder={t("street2Placeholder")}
        />
      </BrandField>

      <div className="grid gap-4 sm:grid-cols-2">
        <BrandField label={t("city")}>
          <BrandInput
            value={value.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder={t("cityPlaceholder")}
          />
        </BrandField>
        <BrandField label={t("state")}>
          <Select value={value.state} onValueChange={(v) => set("state", v)}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder={t("statePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </BrandField>
      </div>

      <BrandField label={t("zip")}>
        <BrandInput
          value={value.zip}
          onChange={(e) => set("zip", e.target.value)}
          placeholder={t("zipPlaceholder")}
        />
      </BrandField>

      <div className="grid gap-4 sm:grid-cols-2">
        <BrandField label={t("phone")}>
          <BrandInput
            value={value.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder={t("phonePlaceholder")}
          />
        </BrandField>
        <BrandField label={t("email")}>
          <BrandInput
            type="email"
            value={value.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder={t("emailPlaceholder")}
          />
        </BrandField>
      </div>

      <Button onClick={onContinue} className="self-end" size="lg">
        {tCommon("continue")}
      </Button>
    </div>
  );
}
