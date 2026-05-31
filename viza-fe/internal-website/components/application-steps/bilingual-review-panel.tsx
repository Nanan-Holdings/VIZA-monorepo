"use client";

import { AlertCircle, Loader2, Pencil, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isChineseLocale } from "@/lib/i18n/locale";

export interface ReviewRow {
  section: string;
  fieldName: string;
  label: string;
  sourceLabel?: string;
  officialLabel?: string;
  sourceValue: string;
  officialValue: string;
  badges: string[];
  warnings: string[];
  editable: boolean;
  editStepIndex?: number;
}

interface BilingualReviewPanelProps {
  applicationId?: string;
  rows: ReviewRow[];
  loading?: boolean;
  error?: string | null;
  retrying?: boolean;
  onRetry?: () => void;
  onSaveOfficialValue?: (fieldName: string, officialValue: string) => void | Promise<void>;
  onUpdated?: (fieldName: string, officialValue: string) => void;
  onEditSection?: (stepIndex: number) => void;
}

function groupRows(rows: ReviewRow[]): Array<{ section: string; rows: ReviewRow[]; editStepIndex?: number }> {
  const grouped = new Map<string, ReviewRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.section) ?? [];
    existing.push(row);
    grouped.set(row.section, existing);
  }
  return Array.from(grouped.entries()).map(([section, sectionRows]) => ({
    section,
    rows: sectionRows,
    editStepIndex: sectionRows.find((row) => row.editStepIndex !== undefined)?.editStepIndex,
  }));
}

function BilingualReviewRow({
  row,
}: {
  row: ReviewRow;
}) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const sourceLabel = row.sourceLabel ?? row.label;
  const officialLabel = row.officialLabel ?? row.label;

  if (!isZh) {
    return (
      <div className="border-b border-border/50 py-4 last:border-0">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-semibold text-[#1f2f46]">{officialLabel}</p>
          <div className="min-h-12 rounded-lg border border-[#d7e0ee] bg-white px-3 py-3 text-sm font-medium text-[#1f2f46]">
            {row.officialValue}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border/50 py-4 last:border-0">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-semibold text-[#1f2f46]">{sourceLabel}</p>
          <div className="min-h-12 rounded-lg border border-[#e8e8e8] bg-white px-3 py-3 text-sm font-medium text-gray-800">
            {row.sourceValue}
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-sm font-semibold text-[#1f2f46]">{officialLabel}</p>
          <div className="min-h-12 rounded-lg border border-[#d7e0ee] bg-white px-3 py-3 text-sm font-medium text-[#1f2f46]">
            {row.officialValue}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BilingualReviewPanel({
  rows,
  loading,
  error,
  retrying,
  onRetry,
  onEditSection,
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
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-heading text-sm font-semibold text-brand-500">
                {section.section}
              </h3>
              {section.editStepIndex !== undefined && onEditSection ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 border-[#c9def6] bg-[#eef6ff] px-3 text-sm font-medium text-[#03346E] hover:bg-[#e2f0ff]"
                  onClick={() => onEditSection(section.editStepIndex!)}
                >
                  <Pencil className="mr-1 h-4 w-4" />
                  修改
                </Button>
              ) : null}
            </div>
            <div>
              {section.rows.map((row) => (
                <BilingualReviewRow
                  key={row.fieldName}
                  row={row}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
