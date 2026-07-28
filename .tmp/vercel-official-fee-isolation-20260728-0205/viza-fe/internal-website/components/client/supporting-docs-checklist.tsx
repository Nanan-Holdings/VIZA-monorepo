"use client";

import { useState } from "react";
import {
  uploadSupportingDoc,
  type ChecklistRow,
} from "@/app/actions/supporting-docs";

const STATUS_PILL: Record<ChecklistRow["status"], string> = {
  missing: "border-gray-200 bg-gray-50 text-gray-600",
  uploaded: "border-blue-200 bg-blue-50 text-blue-700",
  accepted: "border-green-200 bg-green-50 text-green-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
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
    <div className="space-y-4">
      <div className="text-sm text-[#6b6b6b]">
        {completedRequired}/{requiredCount} required documents uploaded
      </div>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.slotId}
            className="bg-white rounded-lg border border-[#efefef] shadow-sm p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[#232323]">
                    {row.label}
                    {row.required ? (
                      <span className="text-xs text-[#6b6b6b] ml-1">(required)</span>
                    ) : (
                      <span className="text-xs text-[#9ca3af] ml-1">(optional)</span>
                    )}
                  </p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_PILL[row.status]}`}
                  >
                    {row.status}
                  </span>
                </div>
                {row.description ? (
                  <p className="text-xs text-[#6b6b6b] mt-1">{row.description}</p>
                ) : null}
                {row.acceptedMimeHint ? (
                  <p className="text-xs text-[#9ca3af] mt-1">
                    Accepts {row.acceptedMimeHint} ·{" "}
                    {(row.maxBytes / 1024 / 1024).toFixed(1)} MB max
                  </p>
                ) : null}
                {row.staffComment ? (
                  <p className="text-xs text-amber-700 mt-1">
                    Staff note: {row.staffComment}
                  </p>
                ) : null}
                {errors[row.slotId] ? (
                  <p className="text-xs text-red-700 mt-1">
                    {errors[row.slotId]}
                  </p>
                ) : null}
              </div>
              <label className="text-xs text-brand-500 hover:underline cursor-pointer whitespace-nowrap">
                {busySlot === row.slotId
                  ? "Uploading…"
                  : row.status === "missing"
                    ? "Upload"
                    : "Replace"}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  disabled={busySlot === row.slotId}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(row, f);
                  }}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
