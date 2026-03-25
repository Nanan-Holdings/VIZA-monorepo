"use client";

import { useTranslations } from "next-intl";
import { XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DocumentType } from "./file-upload-card";

export interface DocumentChecklistCardProps {
  applicationId: string;
  missingDocuments: DocumentType[];
  onComplete?: (result: { acknowledged: true }) => void;
}

export function DocumentChecklistCard({ applicationId: _applicationId, missingDocuments, onComplete }: DocumentChecklistCardProps) {
  const t = useTranslations("applicationSteps");

  const DOC_LABELS: Record<DocumentType, string> = {
    passport_copy: t("documentChecklist.docs.passport_copy"),
    photo: t("documentChecklist.docs.photo"),
    flight_booking: t("documentChecklist.docs.flight_booking"),
    hotel_booking: t("documentChecklist.docs.hotel_booking"),
    travel_itinerary: t("documentChecklist.docs.travel_itinerary"),
    bank_statement: t("documentChecklist.docs.bank_statement"),
  };

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="font-heading text-base text-amber-700">
          {t("documentChecklist.missingDocuments", { count: missingDocuments.length })}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {t("documentChecklist.missingDescription")}
        </p>
        <ul className="flex flex-col gap-2">
          {missingDocuments.map((type) => (
            <li key={type} className="flex items-center gap-2 text-sm text-red-700">
              <XCircle className="h-4 w-4 shrink-0 text-red-500" />
              {DOC_LABELS[type]}
            </li>
          ))}
        </ul>
        {onComplete && (
          <Button
            variant="outline"
            className="mt-1"
            onClick={() => onComplete({ acknowledged: true })}
          >
            {t("documentChecklist.uploadNow")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
