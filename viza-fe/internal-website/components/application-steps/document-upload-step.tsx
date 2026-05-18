"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploadCard, type DocumentType } from "./file-upload-card";

interface DocumentUploadStepProps {
  applicationId: string;
  documentTypes?: DocumentType[];
  onComplete: (uploadedPaths: Record<DocumentType, string>) => void;
}

interface RequiredDocument {
  type: DocumentType;
  zh: string;
  en: string;
  description: string;
}

const REQUIRED_DOCUMENTS: RequiredDocument[] = [
  {
    type: "passport_copy",
    zh: "护照资料页（扫描件或照片）",
    en: "Passport bio page (scan or photo)",
    description: "个人资料页需清晰显示姓名、护照号、有效期。",
  },
  {
    type: "photo",
    zh: "近期护照尺寸照片",
    en: "Recent passport-size photo",
    description: "请使用近 6 个月内拍摄的白底证件照。",
  },
  {
    type: "flight_booking",
    zh: "航班预订确认",
    en: "Flight booking confirmation",
    description: "包含入境和离境计划的航班信息。",
  },
  {
    type: "hotel_booking",
    zh: "酒店 / 住宿预订",
    en: "Hotel / accommodation booking",
    description: "住宿名称、地址和入住日期需可核对。",
  },
  {
    type: "travel_itinerary",
    zh: "旅行行程",
    en: "Travel itinerary",
    description: "简要列出每日城市和主要安排。",
  },
  {
    type: "bank_statement",
    zh: "银行对账单（最近 3 个月）",
    en: "Bank statement (last 3 months)",
    description: "用于证明旅费和停留期间资金能力。",
  },
];

export function DocumentUploadStep({ applicationId, documentTypes, onComplete }: DocumentUploadStepProps) {
  const t = useTranslations("applicationSteps");
  const docs = documentTypes
    ? REQUIRED_DOCUMENTS.filter((document) => documentTypes.includes(document.type))
    : REQUIRED_DOCUMENTS;

  const [uploadedPaths, setUploadedPaths] = useState<Partial<Record<DocumentType, string>>>({});

  const handleUploaded = (type: DocumentType, path: string) => {
    setUploadedPaths((prev) => ({ ...prev, [type]: path }));
  };

  const allUploaded = docs.every((document) => uploadedPaths[document.type]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">文件上传 / Document Upload</CardTitle>
        <CardDescription>
          上传所需文件，并对照英文官方名称确认文件类型。 Upload the required documents and confirm each official English document name.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-lg border border-[#dfe5ee] bg-[#f7fafe] px-4 py-3">
          <div className="grid grid-cols-1 gap-2 text-xs font-semibold text-[#42506a] sm:grid-cols-[1fr_1fr]">
            <span>中文文件名称</span>
            <span>Official English document name</span>
          </div>
        </div>

        {docs.map((document) => (
          <FileUploadCard
            key={document.type}
            applicationId={applicationId}
            documentType={document.type}
            label={document.zh}
            secondaryLabel={document.en}
            description={document.description}
            onComplete={(path) => handleUploaded(document.type, path)}
          />
        ))}

        <BrandActionButton
          className="mt-2"
          disabled={!allUploaded}
          onClick={() => onComplete(uploadedPaths as Record<DocumentType, string>)}
        >
          {t("continue")} / Continue
        </BrandActionButton>
        {!allUploaded && (
          <p className="text-xs text-center text-muted-foreground">
            {t("documentUpload.uploadAllToContinue", { count: docs.length })} / Upload all {docs.length} documents to continue.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
