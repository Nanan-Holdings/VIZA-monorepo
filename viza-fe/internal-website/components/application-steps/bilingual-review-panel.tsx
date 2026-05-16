"use client";

import { useState } from "react";
import { AlertCircle, Check, Loader2, Pencil, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const BACKEND_URL = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:8080";

export interface ReviewRow {
  section: string;
  fieldName: string;
  label: string;
  sourceValue: string;
  officialValue: string;
  badges: string[];
  warnings: string[];
  editable: boolean;
}

interface BilingualReviewPanelProps {
  applicationId: string;
  rows: ReviewRow[];
  loading?: boolean;
  error?: string | null;
  retrying?: boolean;
  onRetry?: () => void;
  onUpdated?: (fieldName: string, officialValue: string) => void;
}

function groupRows(rows: ReviewRow[]): Array<{ section: string; rows: ReviewRow[] }> {
  const grouped = new Map<string, ReviewRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.section) ?? [];
    existing.push(row);
    grouped.set(row.section, existing);
  }
  return Array.from(grouped.entries()).map(([section, sectionRows]) => ({
    section,
    rows: sectionRows,
  }));
}

function BilingualReviewRow({
  applicationId,
  row,
  onUpdated,
}: {
  applicationId: string;
  row: ReviewRow;
  onUpdated?: (fieldName: string, officialValue: string) => void;
}) {
  const t = useTranslations("applicationSteps.translation");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.officialValue);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!row.editable || draft === row.officialValue) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/applications/${applicationId}/translations/${encodeURIComponent(row.fieldName)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ translated_text: draft }),
        },
      );

      if (res.ok) {
        onUpdated?.(row.fieldName, draft);
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  return (
    <div className="border-b border-border/50 py-3 last:border-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[#3d3d3d]">{row.label}</span>
        {row.badges.map((badge) => (
          <Badge key={badge} variant="secondary" className="px-1.5 py-0 text-[10px]">
            {badge}
          </Badge>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-[#e8e8e8] bg-[#fafafa] p-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.04em] text-gray-500">
            {t("sourceColumn")}
          </p>
          <p className="break-words text-sm font-medium text-gray-800">{row.sourceValue}</p>
        </div>

        <div className="rounded-md border border-[#d7e0ee] bg-[#f7faff] p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#03346E]">
              {t("officialColumn")}
            </p>
            {row.editable && !editing && (
              <button
                type="button"
                onClick={() => {
                  setDraft(row.officialValue);
                  setEditing(true);
                }}
                className="text-[#03346E] transition-colors hover:text-[#02264f]"
                title={t("editTranslation")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                className="h-8 bg-white text-sm"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void save();
                  if (event.key === "Escape") {
                    setEditing(false);
                    setDraft(row.officialValue);
                  }
                }}
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ) : (
            <p className="break-words text-sm font-semibold text-[#1f2f46]">{row.officialValue}</p>
          )}
        </div>
      </div>

      {row.warnings.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {row.warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-700">
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function BilingualReviewPanel({
  applicationId,
  rows,
  loading,
  error,
  retrying,
  onRetry,
  onUpdated,
}: BilingualReviewPanelProps) {
  const t = useTranslations("applicationSteps.translation");
  const sections = groupRows(rows);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-[#d7e0ee] bg-[#f7faff] p-4">
        <p className="text-sm font-semibold text-[#03346E]">{t("bilingualTitle")}</p>
        <p className="mt-1 text-xs leading-5 text-gray-600">{t("bilingualHint")}</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="flex-1 text-sm text-amber-800">{error}</p>
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={retrying}
              className="shrink-0"
            >
              {retrying ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              {t("retryTranslation")}
            </Button>
          )}
        </div>
      )}

      {sections.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          {t("noReviewRows")}
        </p>
      ) : (
        sections.map((section) => (
          <div key={section.section} className="rounded-lg border border-border p-4">
            <h3 className="mb-3 font-heading text-sm font-semibold text-brand-500">
              {section.section}
            </h3>
            <div>
              {section.rows.map((row) => (
                <BilingualReviewRow
                  key={row.fieldName}
                  applicationId={applicationId}
                  row={row}
                  onUpdated={onUpdated}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
