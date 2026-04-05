"use client";

import { useState, useCallback } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Block Field Types (matching backend ApplicationBlockPayload)
// =============================================================================

export interface BlockField {
  name: string;
  label: string;
  type: "text" | "date" | "select" | "file";
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface ApplicationBlockPayload {
  blockType: string;
  title: string;
  description?: string;
  fields: BlockField[];
  saveTarget: string;
  applicationId?: string;
}

// =============================================================================
// Sub-field components
// =============================================================================

function TextField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: BlockField;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <input
      type="text"
      id={field.name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? ""}
      disabled={disabled}
      className={cn(
        "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white",
        "placeholder:text-gray-400 text-gray-800",
        "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    />
  );
}

function DateField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: BlockField;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <input
      type="date"
      id={field.name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white",
        "text-gray-800",
        "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    />
  );
}

function SelectField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: BlockField;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      id={field.name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white",
        "text-gray-800",
        "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      <option value="">Select...</option>
      {(field.options ?? []).map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function FileField({
  field,
  onChange,
  disabled,
}: {
  field: BlockField;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onChange(file.name);
    },
    [onChange]
  );

  return (
    <input
      type="file"
      id={field.name}
      onChange={handleFileChange}
      disabled={disabled}
      className={cn(
        "w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3",
        "file:rounded-md file:border-0 file:text-xs file:font-medium",
        "file:bg-brand-500/10 file:text-brand-600 hover:file:bg-brand-500/20",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    />
  );
}

// =============================================================================
// BlockMessage Component
// =============================================================================

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface BlockMessageProps {
  payload: ApplicationBlockPayload;
  /** Pre-filled values when loaded from DB (role=block messages) */
  prefillData?: Record<string, string>;
  /** Whether this block has already been submitted */
  alreadySaved?: boolean;
}

export function BlockMessage({
  payload,
  prefillData = {},
  alreadySaved = false,
}: BlockMessageProps) {
  const initialValues = Object.fromEntries(
    payload.fields.map((f) => [f.name, prefillData[f.name] ?? ""])
  );

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    alreadySaved ? "saved" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSaved = saveStatus === "saved";
  const isSaving = saveStatus === "saving";

  const handleFieldChange = useCallback(
    (fieldName: string, value: string) => {
      setValues((prev) => ({ ...prev, [fieldName]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate required fields
      for (const field of payload.fields) {
        if (field.required && !values[field.name]?.trim()) {
          setErrorMsg(`"${field.label}" is required.`);
          return;
        }
      }
      setErrorMsg(null);
      setSaveStatus("saving");

      try {
        const res = await fetch("/api/chat/save-block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            saveTarget: payload.saveTarget,
            applicationId: payload.applicationId,
            blockType: payload.blockType,
            data: values,
          }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(body.message ?? `HTTP ${res.status}`);
        }

        setSaveStatus("saved");
      } catch (err) {
        setSaveStatus("error");
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Failed to save. Please try again."
        );
      }
    },
    [payload, values]
  );

  return (
    <div className="flex gap-3">
      {/* Agent avatar */}
      <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-brand-500 text-sm">+</span>
      </div>

      {/* Block card */}
      <div
        className={cn(
          "flex-1 max-w-sm bg-white rounded-xl rounded-tl-md border shadow-sm overflow-hidden",
          isSaved ? "border-green-200" : "border-gray-100"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "px-4 py-3 border-b",
            isSaved
              ? "bg-green-50 border-green-100"
              : "bg-gray-50 border-gray-100"
          )}
        >
          <p
            className={cn(
              "text-sm font-medium",
              isSaved ? "text-green-800" : "text-gray-800"
            )}
          >
            {payload.title}
          </p>
          {payload.description && (
            <p className="text-xs text-gray-500 mt-0.5">{payload.description}</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
          {payload.fields.map((field) => (
            <div key={field.name} className="flex flex-col gap-1">
              <label
                htmlFor={field.name}
                className="text-xs font-medium text-gray-600"
              >
                {field.label}
                {field.required && (
                  <span className="text-red-400 ml-0.5">*</span>
                )}
              </label>

              {field.type === "text" && (
                <TextField
                  field={field}
                  value={values[field.name] ?? ""}
                  onChange={(v) => handleFieldChange(field.name, v)}
                  disabled={isSaved || isSaving}
                />
              )}
              {field.type === "date" && (
                <DateField
                  field={field}
                  value={values[field.name] ?? ""}
                  onChange={(v) => handleFieldChange(field.name, v)}
                  disabled={isSaved || isSaving}
                />
              )}
              {field.type === "select" && (
                <SelectField
                  field={field}
                  value={values[field.name] ?? ""}
                  onChange={(v) => handleFieldChange(field.name, v)}
                  disabled={isSaved || isSaving}
                />
              )}
              {field.type === "file" && (
                <FileField
                  field={field}
                  onChange={(v) => handleFieldChange(field.name, v)}
                  disabled={isSaved || isSaving}
                />
              )}
            </div>
          ))}

          {/* Error message */}
          {saveStatus === "error" && errorMsg && (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit / status */}
          {isSaved ? (
            <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium pt-1">
              <Check className="w-3.5 h-3.5" />
              Saved
            </div>
          ) : (
            <button
              type="submit"
              disabled={isSaving}
              className={cn(
                "w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
