"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Loader2, AlertCircle, Upload, CheckCircle, XCircle, FileText, Clock, FileX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

// =============================================================================
// Types
// =============================================================================

type DocumentType =
  | "passport_copy"
  | "photo"
  | "flight_booking"
  | "hotel_booking"
  | "travel_itinerary"
  | "bank_statement";

type DocumentStatus = "uploaded" | "validated" | "missing" | "rejected";

interface ApplicationDocument {
  id: string;
  document_type: DocumentType;
  storage_path: string | null;
  filename: string | null;
  status: DocumentStatus;
  rejection_reason: string | null;
  uploaded_at: string | null;
}

// =============================================================================
// Helpers
// =============================================================================

function LoadingState() {
  const t = useTranslations("documents");
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
      <p className="text-lg text-muted-foreground">{t("loading")}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  const t = useTranslations("documents");
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Empty className="max-w-lg">
        <EmptyHeader className="max-w-lg">
          <EmptyMedia variant="icon">
            <FileX />
          </EmptyMedia>
          <EmptyTitle>{message}</EmptyTitle>
          <EmptyDescription>
            {t("errors.completeApplicationFirst")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const t = useTranslations("documents");
  const config = {
    uploaded: { label: t("statusLabels.uploaded"), className: "bg-blue-100 text-blue-700", icon: <Clock className="w-3 h-3" /> },
    validated: { label: t("statusLabels.validated"), className: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3 h-3" /> },
    missing: { label: t("statusLabels.missing"), className: "bg-gray-100 text-gray-500", icon: <FileText className="w-3 h-3" /> },
    rejected: { label: t("statusLabels.rejected"), className: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function DocumentsPage() {
  const t = useTranslations("documents");

  const REQUIRED_DOCUMENTS: { type: DocumentType; label: string; description: string }[] = [
    { type: "passport_copy", label: t("requiredDocs.passport_copy.label"), description: t("requiredDocs.passport_copy.description") },
    { type: "photo", label: t("requiredDocs.photo.label"), description: t("requiredDocs.photo.description") },
    { type: "flight_booking", label: t("requiredDocs.flight_booking.label"), description: t("requiredDocs.flight_booking.description") },
    { type: "hotel_booking", label: t("requiredDocs.hotel_booking.label"), description: t("requiredDocs.hotel_booking.description") },
    { type: "travel_itinerary", label: t("requiredDocs.travel_itinerary.label"), description: t("requiredDocs.travel_itinerary.description") },
    { type: "bank_statement", label: t("requiredDocs.bank_statement.label"), description: t("requiredDocs.bank_statement.description") },
  ];

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Map<DocumentType, ApplicationDocument>>(new Map());
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingTypeRef = useRef<DocumentType | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError(t("errors.notAuthenticated"));
        setIsLoading(false);
        return;
      }

      // Get applicant_profile
      const { data: profile } = await supabase
        .from("applicant_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!profile) {
        setError(t("errors.noProfile"));
        setIsLoading(false);
        return;
      }

      // Get latest application
      const { data: application } = await supabase
        .from("applications")
        .select("id")
        .eq("applicant_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!application) {
        setError(t("errors.noApplication"));
        setIsLoading(false);
        return;
      }

      setApplicationId(application.id);

      // Fetch documents
      const { data: docs } = await supabase
        .from("application_documents")
        .select("*")
        .eq("application_id", application.id);

      const docMap = new Map<DocumentType, ApplicationDocument>();
      if (docs) {
        for (const doc of docs) {
          docMap.set(doc.document_type as DocumentType, doc as ApplicationDocument);
        }
      }

      setDocuments(docMap);
      setIsLoading(false);
    }

    fetchData();
  }, [t]);

  const handleUploadClick = (docType: DocumentType) => {
    uploadingTypeRef.current = docType;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const docType = uploadingTypeRef.current;
    if (!file || !docType || !applicationId) return;

    setUploading(docType);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(null); return; }

    const storagePath = `${user.id}/${applicationId}/${docType}/${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("application-documents")
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      setError(t("errors.uploadFailed", { message: uploadError.message }));
      setUploading(null);
      return;
    }

    // Upsert document record
    const existingDoc = documents.get(docType);
    if (existingDoc) {
      await supabase
        .from("application_documents")
        .update({
          storage_path: storagePath,
          filename: file.name,
          status: "uploaded",
          rejection_reason: null,
          uploaded_at: new Date().toISOString(),
        })
        .eq("id", existingDoc.id);
    } else {
      await supabase
        .from("application_documents")
        .insert({
          application_id: applicationId,
          document_type: docType,
          storage_path: storagePath,
          filename: file.name,
          status: "uploaded",
        });
    }

    // Refresh document for this type
    const { data: updated } = await supabase
      .from("application_documents")
      .select("*")
      .eq("application_id", applicationId)
      .eq("document_type", docType)
      .single();

    if (updated) {
      setDocuments((prev) => {
        const next = new Map(prev);
        next.set(docType, updated as ApplicationDocument);
        return next;
      });
    }

    setUploading(null);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const uploadedCount = Array.from(documents.values()).filter(
    (d) => d.status === "uploaded" || d.status === "validated"
  ).length;

  return (
    <div className="w-full bg-[#fcfcfc] text-left text-[#3d3d3d]">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 pb-12 px-4 sm:gap-12 sm:pb-16 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.section
          className="flex flex-col gap-4 pt-6 sm:pt-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="font-heading font-medium leading-[1.15] text-[32px] tracking-[-1.2px] text-[#3d3d3d] sm:text-[40px] sm:tracking-[-1.6px] lg:text-[48px] lg:tracking-[-1.92px]">
            {t("title")}
          </h1>

          {/* Progress summary */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="font-sans text-[15px] text-[#3d3d3d]">
                {t("documentsUploaded", { count: uploadedCount, total: REQUIRED_DOCUMENTS.length })}
              </p>
              <p className="font-sans text-[14px] text-[#989898]">
                {t("percentComplete", { pct: Math.round((uploadedCount / REQUIRED_DOCUMENTS.length) * 100) })}
              </p>
            </div>
            <div className="w-full h-2 bg-[#efefef] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-brand-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(uploadedCount / REQUIRED_DOCUMENTS.length) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        </motion.section>

        {/* Document Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REQUIRED_DOCUMENTS.map((reqDoc, index) => {
            const uploadedDoc = documents.get(reqDoc.type);
            const status: DocumentStatus = uploadedDoc?.status ?? "missing";
            const isUploading = uploading === reqDoc.type;
            const canUpload = status === "missing" || status === "rejected";

            return (
              <motion.div
                key={reqDoc.type}
                className="w-full rounded-xl border border-[#efefef] bg-white p-4 sm:p-6 flex flex-col gap-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.05 }}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <p className="font-heading font-medium text-[16px] text-[#3d3d3d] tracking-[-0.3px]">
                      {reqDoc.label}
                    </p>
                    <p className="font-sans text-[13px] text-[#989898] leading-[1.5]">
                      {reqDoc.description}
                    </p>
                  </div>
                  <StatusBadge status={status} />
                </div>

                {/* Filename if uploaded */}
                {uploadedDoc?.filename && (
                  <div className="flex items-center gap-2 bg-[#f5f5f5] rounded-md px-3 py-2">
                    <FileText className="w-4 h-4 text-[#989898] flex-shrink-0" />
                    <p className="font-sans text-[13px] text-[#3d3d3d] truncate">
                      {uploadedDoc.filename}
                    </p>
                  </div>
                )}

                {/* Rejection reason */}
                {status === "rejected" && uploadedDoc?.rejection_reason && (
                  <div className="bg-red-50 border border-red-100 rounded-md px-3 py-2">
                    <p className="font-sans text-[13px] text-red-700">
                      <span className="font-medium">{t("rejected")} </span>
                      {uploadedDoc.rejection_reason}
                    </p>
                  </div>
                )}

                {/* Upload button */}
                {canUpload && (
                  <button
                    onClick={() => handleUploadClick(reqDoc.type)}
                    disabled={isUploading}
                    className="flex items-center justify-center gap-2 w-full rounded-lg bg-brand-500 text-white py-2.5 px-4 font-sans font-medium text-[14px] hover:bg-brand-600 transition-colors disabled:opacity-60"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {isUploading ? t("uploading") : status === "rejected" ? t("reupload") : t("upload")}
                  </button>
                )}

                {/* Re-upload for validated/uploaded */}
                {!canUpload && (
                  <button
                    onClick={() => handleUploadClick(reqDoc.type)}
                    disabled={isUploading}
                    className="flex items-center justify-center gap-2 w-full rounded-lg border border-[#efefef] text-[#989898] py-2 px-4 font-sans font-medium text-[13px] hover:border-brand-500 hover:text-brand-500 transition-colors disabled:opacity-60"
                  >
                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {isUploading ? t("uploading") : t("replace")}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
