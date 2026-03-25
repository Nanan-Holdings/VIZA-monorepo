"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface FormCardField {
  name: string;
  label: string;
  type: "text" | "select" | "date";
  required?: boolean;
  options?: string[];
  prefill?: string;
}

export interface FormCardProps {
  title: string;
  fields: FormCardField[];
  onComplete: (result: Record<string, string>) => void;
}

export function FormCard({ title, fields, onComplete }: FormCardProps) {
  const t = useTranslations("applicationSteps");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, f.prefill ?? ""]))
  );

  const set = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));

  const isValid = fields.filter((f) => f.required).every((f) => values[f.name]?.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => { e.preventDefault(); if (isValid) onComplete(values); }}
          className="flex flex-col gap-4"
        >
          {fields.map((field) => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </Label>
              {field.type === "select" ? (
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={values[field.name]}
                  onChange={set(field.name)}
                  required={field.required}
                >
                  <option value="">{t("select")}</option>
                  {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <Input
                  type={field.type}
                  value={values[field.name]}
                  onChange={set(field.name)}
                  required={field.required}
                />
              )}
            </div>
          ))}
          <Button type="submit" disabled={!isValid} className="mt-1 bg-brand-500 hover:bg-brand-600 text-white">
            {t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
