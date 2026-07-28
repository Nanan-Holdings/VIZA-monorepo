"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface DatePickerCardProps {
  label: string;
  fieldName: string;
  minDate?: string;
  maxDate?: string;
  prefill?: string;
  onComplete: (result: { fieldName: string; value: string }) => void;
}

export function DatePickerCard({ label, fieldName, minDate, maxDate, prefill, onComplete }: DatePickerCardProps) {
  const t = useTranslations("applicationSteps");
  const [value, setValue] = useState(prefill ?? "");

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">{label}</Label>
          </div>
          <Input
            type="date"
            value={value}
            min={minDate}
            max={maxDate}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button
            className="bg-brand-500 hover:bg-brand-600 text-white"
            disabled={!value}
            onClick={() => value && onComplete({ fieldName, value })}
          >
            {t("confirm")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
