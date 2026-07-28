"use client";

import { useState } from "react";
import type { ExtractedPassport, ExtractedField } from "@/lib/passport/extract";

/**
 * Manual-confirm UI for OCR-extracted passport fields (DOC-002).
 *
 * Each row shows the value, a confidence badge, and an editable
 * input. Fields below the LOW_CONFIDENCE_THRESHOLD highlight amber
 * and pre-select the input so the applicant can correct quickly.
 */

export interface PassportConfirmProps {
  extracted: ExtractedPassport;
  onConfirm: (fields: Record<string, string>) => void;
  submitting?: boolean;
}

const LABELS: Record<string, string> = {
  passport_number: "Passport number",
  surname: "Surname",
  given_names: "Given names",
  nationality: "Nationality",
  passport_issuing_country: "Issuing country",
  date_of_birth: "Date of birth",
  passport_expiry_date: "Passport expiry",
  sex: "Sex",
};

const FIELD_ORDER: Array<[keyof ExtractedPassport, string]> = [
  ["surname", "surname"],
  ["givenNames", "given_names"],
  ["passportNumber", "passport_number"],
  ["nationality", "nationality"],
  ["issuingCountry", "passport_issuing_country"],
  ["dateOfBirth", "date_of_birth"],
  ["expiryDate", "passport_expiry_date"],
  ["sex", "sex"],
];

function pillClass(field: ExtractedField): string {
  if (field.needsConfirm) return "border-amber-200 bg-amber-50 text-amber-800";
  if (field.confidence >= 0.95) return "border-green-200 bg-green-50 text-green-700";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

export function PassportConfirm({
  extracted,
  onConfirm,
  submitting,
}: PassportConfirmProps) {
  const initial: Record<string, string> = {};
  for (const [k, formKey] of FIELD_ORDER) {
    const f = extracted[k] as ExtractedField | null;
    if (f) initial[formKey] = f.value;
  }
  const [values, setValues] = useState<Record<string, string>>(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm(values);
      }}
      className="space-y-3"
    >
      <p className="text-sm text-[#6b6b6b]">
        We extracted the fields below from your passport. Edit anything
        that looks wrong before confirming.
      </p>
      <ul className="space-y-2">
        {FIELD_ORDER.map(([k, formKey]) => {
          const f = extracted[k] as ExtractedField | null;
          if (!f) return null;
          return (
            <li key={formKey} className="flex items-center gap-3">
              <label className="w-40 text-sm text-[#6b6b6b]">
                {LABELS[formKey] ?? formKey}
              </label>
              <input
                value={values[formKey] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [formKey]: e.target.value }))
                }
                className={`flex-1 px-3 py-2 text-sm border rounded font-mono ${
                  f.needsConfirm ? "border-amber-400" : "border-[#d1d5db]"
                }`}
                autoFocus={f.needsConfirm}
              />
              <span
                className={`text-[10px] px-2 py-0.5 rounded border ${pillClass(f)}`}
                title={`source: ${f.source}`}
              >
                {(f.confidence * 100).toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
      {extracted.manualConfirmRequired ? (
        <p className="text-xs text-amber-700">
          Some fields are below our confidence threshold and need your
          eye. Highlighted rows are pre-selected.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Confirm and continue"}
      </button>
    </form>
  );
}
