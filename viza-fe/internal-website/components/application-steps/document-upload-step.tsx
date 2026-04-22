"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileUploadCard, type DocumentType } from "./file-upload-card";

interface DocumentUploadStepProps {
  applicationId: string;
  documentTypes?: DocumentType[];
  onComplete: (uploadedPaths: Record<DocumentType, string>) => void;
}

export function DocumentUploadStep({ applicationId, documentTypes, onComplete }: DocumentUploadStepProps) {
  const t = useTranslations("applicationSteps");

  const REQUIRED_DOCUMENTS: { type: DocumentType; label: string }[] = [
    { type: "passport_copy", label: t("documentUpload.docs.passport_copy") },
    { type: "photo", label: t("documentUpload.docs.photo") },
    { type: "flight_booking", label: t("documentUpload.docs.flight_booking") },
    { type: "hotel_booking", label: t("documentUpload.docs.hotel_booking") },
    { type: "travel_itinerary", label: t("documentUpload.docs.travel_itinerary") },
    { type: "bank_statement", label: t("documentUpload.docs.bank_statement") },
  ];

  const docs = documentTypes
    ? REQUIRED_DOCUMENTS.filter((d) => documentTypes.includes(d.type))
    : REQUIRED_DOCUMENTS;

  const [uploadedPaths, setUploadedPaths] = useState<Partial<Record<DocumentType, string>>>({});

  const handleUploaded = (type: DocumentType, path: string) => {
    setUploadedPaths((prev) => ({ ...prev, [type]: path }));
  };

  const allUploaded = docs.every((d) => uploadedPaths[d.type]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">{t("documentUpload.title")}</CardTitle>
        <CardDescription>
          {t("documentUpload.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {docs.map((doc) => (
          <FileUploadCard
            key={doc.type}
            applicationId={applicationId}
            documentType={doc.type}
            label={doc.label}
            onComplete={(path) => handleUploaded(doc.type, path)}
          />
        ))}

        <BrandActionButton
          className="mt-2"
          disabled={!allUploaded}
          onClick={() => onComplete(uploadedPaths as Record<DocumentType, string>)}
        >
          {t("continue")}
        </BrandActionButton>
        {!allUploaded && (
          <p className="text-xs text-center text-muted-foreground">
            {t("documentUpload.uploadAllToContinue", { count: docs.length })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
