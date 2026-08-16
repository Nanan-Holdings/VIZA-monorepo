"use client";

import { CircleNotch as Loader2, ArrowsClockwise as RefreshCw } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ReviewEditButton } from "@/components/ui/review-edit-button";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
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
  missing?: boolean;
  issueSeverity?: "error" | "warning";
  issueMessage?: string;
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

function groupRows(rows: ReviewRow[]): Array<{ id: string; section: string; rows: ReviewRow[]; editStepIndex?: number }> {
  const grouped = new Map<string, ReviewRow[]>();
  for (const row of rows) {
    // Display labels are not stable identifiers: separate source steps can
    // legitimately localize to the same section title. Include the edit target
    // in the grouping key so one section's Edit button can never inherit a
    // different step's destination.
    const groupKey = `${row.editStepIndex ?? "read-only"}:${row.section}`;
    const existing = grouped.get(groupKey) ?? [];
    existing.push(row);
    grouped.set(groupKey, existing);
  }
  return Array.from(grouped.entries()).map(([id, sectionRows]) => ({
    id,
    section: sectionRows[0]?.section ?? "",
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
      <TableRow
        className={row.issueSeverity === "error"
          ? "border-red-200 bg-red-50 hover:bg-red-50"
          : row.issueSeverity === "warning"
            ? "border-amber-200 bg-amber-50 hover:bg-amber-50"
            : "hover:bg-transparent"}
        data-review-issue={row.issueSeverity}
      >
        <th
          scope="row"
          className="w-[56%] px-0 py-2 text-left align-top text-sm font-medium text-muted-foreground"
        >
          <span className={row.issueSeverity === "error"
            ? "text-red-800"
            : row.issueSeverity === "warning"
              ? "text-amber-900"
              : undefined}
          >
            {officialLabel}
          </span>
        </th>
        <TableCell
          className={row.issueSeverity === "error"
            ? "px-0 py-2 text-right align-top text-sm font-medium text-red-700"
            : row.missing
              ? "px-0 py-2 text-right align-top text-sm font-medium text-red-600"
            : row.issueSeverity === "warning"
              ? "px-0 py-2 text-right align-top text-sm font-medium text-amber-900"
              : "px-0 py-2 text-right align-top text-sm font-medium text-foreground"}
        >
          <span className="whitespace-pre-wrap break-words">{row.officialValue}</span>
          {row.issueMessage ? (
            <span className={row.issueSeverity === "error"
              ? "mt-1 block text-xs leading-5 text-red-700"
              : "mt-1 block text-xs leading-5 text-amber-800"}
            >
              {row.issueMessage}
            </span>
          ) : null}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow
      className={row.issueSeverity === "error"
        ? "border-red-200 bg-red-50 hover:bg-red-50"
        : row.issueSeverity === "warning"
          ? "border-amber-200 bg-amber-50 hover:bg-amber-50"
          : "hover:bg-transparent"}
      data-review-issue={row.issueSeverity}
    >
      <th
        scope="row"
        className="w-[56%] px-0 py-2 text-left align-top font-normal"
      >
        <span className={row.issueSeverity === "error"
          ? "block text-sm font-medium text-red-800"
          : row.issueSeverity === "warning"
            ? "block text-sm font-medium text-amber-900"
            : "block text-sm font-medium text-foreground"}
        >
          {sourceLabel}
        </span>
        <span lang="en" className={row.issueSeverity === "error"
          ? "mt-0.5 block text-sm leading-5 text-red-700"
          : row.issueSeverity === "warning"
            ? "mt-0.5 block text-sm leading-5 text-amber-800"
            : "mt-0.5 block text-sm leading-5 text-muted-foreground"}
        >
          {officialLabel}
        </span>
      </th>
      <TableCell className="px-0 py-2 text-right align-top">
        <span className={row.issueSeverity === "error"
          ? "block whitespace-pre-wrap break-words text-sm font-medium text-red-700"
          : row.missing
            ? "block whitespace-pre-wrap break-words text-sm font-medium text-red-600"
          : row.issueSeverity === "warning"
            ? "block whitespace-pre-wrap break-words text-sm font-medium text-amber-900"
            : "block whitespace-pre-wrap break-words text-sm font-medium text-foreground"}
        >
          {row.sourceValue}
        </span>
        <span
          lang="en"
          className={row.issueSeverity === "error"
            ? "mt-0.5 block whitespace-pre-wrap break-words text-sm leading-5 text-red-700"
            : row.missing
              ? "mt-0.5 block whitespace-pre-wrap break-words text-sm leading-5 text-red-600"
            : row.issueSeverity === "warning"
              ? "mt-0.5 block whitespace-pre-wrap break-words text-sm leading-5 text-amber-800"
              : "mt-0.5 block whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground"}
        >
          {row.officialValue}
        </span>
        {row.issueMessage ? (
          <span className={row.issueSeverity === "error"
            ? "mt-1 block text-xs leading-5 text-red-700"
            : "mt-1 block text-xs leading-5 text-amber-800"}
          >
            {row.issueMessage}
          </span>
        ) : null}
      </TableCell>
    </TableRow>
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
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const sections = groupRows(rows);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {error ? (
        <ClientErrorAlert
          message={error}
          action={onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={retrying}
            >
              {retrying ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              {t("retryTranslation")}
            </Button>
          ) : undefined}
        />
      ) : null}

      {sections.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          {t("noReviewRows")}
        </p>
      ) : (
        sections.map((section) => (
          <section key={section.id}>
            <div className="flex min-h-8 items-center justify-between gap-3">
              <h3 className="font-heading text-sm font-semibold text-brand-500">
                {section.section}
              </h3>
              {section.editStepIndex !== undefined && onEditSection ? (
                <ReviewEditButton
                  onClick={() => onEditSection(section.editStepIndex!)}
                  label={isZh ? `修改${section.section}` : `Edit ${section.section}`}
                />
              ) : null}
            </div>
            <Table className="table-fixed">
              <TableBody>
                {section.rows.map((row) => (
                  <BilingualReviewRow
                    key={row.fieldName}
                    row={row}
                  />
                ))}
              </TableBody>
            </Table>
          </section>
        ))
      )}
    </div>
  );
}
