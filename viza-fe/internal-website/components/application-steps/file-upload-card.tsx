"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { UploadCloud, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export type DocumentType =
  | "passport_copy"
  | "photo"
  | "flight_booking"
  | "hotel_booking"
  | "travel_itinerary"
  | "bank_statement";

export interface FileUploadCardProps {
  applicationId: string;
  documentType: DocumentType;
  label: string;
  onComplete?: (storagePath: string) => void;
}

export function FileUploadCard({ applicationId, documentType, label, onComplete }: FileUploadCardProps) {
  const t = useTranslations("applicationSteps");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setStatus("uploading");
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("uploadFailed"));

      const path = `${user.id}/${applicationId}/${documentType}/${file.name}`;
      const { error } = await supabase.storage
        .from("application-documents")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      setFileName(file.name);
      setStatus("done");
      onComplete?.(path);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("uploadFailed"));
      setStatus("error");
    }
  };

  return (
    <Card
      className={`border-2 transition-colors ${
        status === "done"
          ? "border-green-400 bg-green-50"
          : status === "error"
          ? "border-red-300 bg-red-50"
          : "border-dashed border-border hover:border-brand-400"
      }`}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className="shrink-0">
          {status === "uploading" && <Loader2 className="h-6 w-6 animate-spin text-brand-500" />}
          {status === "done" && <CheckCircle2 className="h-6 w-6 text-green-500" />}
          {status === "error" && <XCircle className="h-6 w-6 text-red-500" />}
          {status === "idle" && <UploadCloud className="h-6 w-6 text-muted-foreground" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{label}</p>
          {fileName && <p className="text-xs text-muted-foreground truncate">{fileName}</p>}
          {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={status === "uploading"}
          className="shrink-0"
        >
          {status === "done" ? t("replace") : t("upload")}
        </Button>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </CardContent>
    </Card>
  );
}
