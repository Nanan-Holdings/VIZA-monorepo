"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface ConfirmationCardProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onComplete: (result: { confirmed: boolean }) => void;
}

export function ConfirmationCard({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onComplete,
}: ConfirmationCardProps) {
  const t = useTranslations("applicationSteps");
  const resolvedConfirmLabel = confirmLabel ?? t("confirm");
  const resolvedCancelLabel = cancelLabel ?? t("cancel");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onComplete({ confirmed: false })}
          >
            {resolvedCancelLabel}
          </Button>
          <Button
            className="flex-1 bg-brand-500 hover:bg-brand-600 text-white"
            onClick={() => onComplete({ confirmed: true })}
          >
            {resolvedConfirmLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
