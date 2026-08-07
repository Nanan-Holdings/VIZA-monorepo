"use client";

import { useState } from "react";
import {
  uploadSupportingDoc,
  type ChecklistRow,
} from "@/app/actions/supporting-docs";
import {
  DocumentUploadField,
  type DocumentUploadStatus,
} from "@/components/ui/document-upload-field";
import { SupportingDocumentCard } from "@/components/ui/supporting-document-card";

const STATUS_FIELD: Record<ChecklistRow["status"], DocumentUploadStatus> = {
  missing: "missing",
  uploaded: "in_review",
  accepted: "approved",
  rejected: "rejected",
};

const STATUS_LABEL: Record<ChecklistRow["status"], string> = {
  missing: "Missing",
  uploaded: "In review",
  accepted: "Approved",
  rejected: "Rejected",
};

export function SupportingDocsChecklist({
  applicationId,
  initial,
}: {
  applicationId: string;
  initial: ChecklistRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});

  async function handleUpload(slot: ChecklistRow, file: File) {
    setBusySlot(slot.slotId);
    setErrors((e) => ({ ...e, [slot.slotId]: "" }));
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const chunk = 0x8000;
      let bin = "";
      for (let i = 0; i < buf.length; i += chunk) {
        bin += String.fromCharCode.apply(
          null,
          Array.from(buf.subarray(i, i + chunk)),
        );
      }
      const base64 = btoa(bin);
      const result = await uploadSupportingDoc({
        applicationId,
        slotId: slot.slotId,
        base64,
        filename: file.name,
      });
      if (!result.ok) {
        setErrors((e) => ({ ...e, [slot.slotId]: result.reason }));
        return;
      }
      setFileNames((names) => ({ ...names, [slot.slotId]: file.name }));
      setRows((rs) =>
        rs.map((r) =>
          r.slotId === slot.slotId
            ? { ...r, status: result.status, storagePath: result.storagePath }
            : r,
        ),
      );
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [slot.slotId]: err instanceof Error ? err.message : "upload failed",
      }));
    } finally {
      setBusySlot(null);
    }
  }

  const requiredCount = rows.filter((r) => r.required).length;
  const completedRequired = rows.filter(
    (r) => r.required && (r.status === "uploaded" || r.status === "accepted"),
  ).length;

  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <div className="mb-5 text-sm text-[#6b6b6b]">
        {completedRequired}/{requiredCount} required documents uploaded
      </div>
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        {rows.map((row) => {
          const busy = busySlot === row.slotId;
          return (
            <SupportingDocumentCard
              key={row.slotId}
              title={row.label}
              description={row.description}
              required={row.required}
              headerLayout="stacked"
              note={
                row.staffComment ? (
                  <p className="text-xs text-amber-700">
                    Staff note: {row.staffComment}
                  </p>
                ) : null
              }
            >
              <DocumentUploadField
                status={
                  busy
                    ? "uploading"
                    : row.status === "missing" && !row.required
                      ? "optional"
                      : STATUS_FIELD[row.status]
                }
                statusLabel={
                  busy
                    ? "Uploading…"
                    : row.status === "missing" && !row.required
                      ? "Not uploaded"
                      : STATUS_LABEL[row.status]
                }
                file={
                  row.status === "missing"
                    ? null
                    : { name: fileNames[row.slotId] ?? row.label, kind: "document" }
                }
                reason={errors[row.slotId] || null}
                dropLabel="Drop file or browse"
                acceptHint={
                  row.acceptedMimeHint
                    ? `${row.acceptedMimeHint} · ${(row.maxBytes / 1024 / 1024).toFixed(1)} MB max`
                    : `PDF, JPG or PNG · ${(row.maxBytes / 1024 / 1024).toFixed(1)} MB max`
                }
                removeLabel="Remove file"
                accept="application/pdf,image/jpeg,image/png"
                disabled={busy}
                inputAriaLabel={row.label}
                onFileSelected={(file) => void handleUpload(row, file)}
              />
            </SupportingDocumentCard>
          );
        })}
      </div>
    </section>
  );
}
