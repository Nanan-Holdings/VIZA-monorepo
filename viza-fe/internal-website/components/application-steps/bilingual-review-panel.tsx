"use client";

import { useEffect, useState } from "react";
import { CircleNotch as Loader2, ArrowsClockwise as RefreshCw } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ReviewEditButton } from "@/components/ui/review-edit-button";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { BrandInput } from "@/components/client/brand-field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { isChineseLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

export interface ReviewOfficialOption {
  value: string;
  label: string;
}

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
  optional?: boolean;
  issueSeverity?: "error" | "warning";
  issueMessage?: string;
  officialEditorKind?: "text" | "textarea" | "date" | "select";
  officialEditorValue?: string;
  officialOptions?: ReviewOfficialOption[];
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
  onEditSection?: (stepIndex: number, fieldName: string) => void;
}

function groupRows(rows: ReviewRow[]): Array<{
  id: string;
  section: string;
  rows: ReviewRow[];
  editStepIndex?: number;
  editFieldName?: string;
}> {
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
  return Array.from(grouped.entries()).map(([id, sectionRows]) => {
    const editTarget = sectionRows.find((row) => row.editStepIndex !== undefined);
    return {
      id,
      section: sectionRows[0]?.section ?? "",
      rows: sectionRows,
      editStepIndex: editTarget?.editStepIndex,
      editFieldName: editTarget?.fieldName,
    };
  });
}

function BilingualReviewRow({
  row,
  onSaveOfficialValue,
  onUpdated,
}: {
  row: ReviewRow;
  onSaveOfficialValue?: (fieldName: string, officialValue: string) => void | Promise<void>;
  onUpdated?: (fieldName: string, officialValue: string) => void;
}) {
  const t = useTranslations("applicationSteps.translation");
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const sourceLabel = row.sourceLabel ?? row.label;
  const officialLabel = row.officialLabel ?? row.label;
  const editorValue = row.officialEditorValue ?? row.officialValue;
  const [draft, setDraft] = useState(editorValue);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const canEditOfficialValue = row.editable && Boolean(onSaveOfficialValue);

  useEffect(() => {
    setDraft(editorValue);
  }, [editorValue]);

  const commitOfficialValue = async (nextValue: string = draft) => {
    if (!canEditOfficialValue || !onSaveOfficialValue || nextValue === editorValue || saving) return;

    setSaving(true);
    setSaveError(null);
    try {
      await onSaveOfficialValue(row.fieldName, nextValue);
      onUpdated?.(row.fieldName, nextValue);
    } catch {
      setSaveError(t("officialValueSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const editorIssueClassName = row.issueSeverity === "error"
    ? "border-red-300 text-red-700 focus-visible:border-red-500 focus-visible:ring-red-500"
    : row.issueSeverity === "warning"
      ? "border-amber-300 text-amber-900 focus-visible:border-amber-500 focus-visible:ring-amber-500"
      : undefined;
  const reviewRowClassName = cn(
    "block border-border sm:table-row",
    row.issueSeverity === "error"
      ? "bg-red-50 hover:bg-red-50"
      : row.issueSeverity === "warning"
        ? "bg-amber-50 hover:bg-amber-50"
        : "hover:bg-transparent",
  );

  const officialValueEditor = canEditOfficialValue ? (
    <div className="flex flex-col gap-1.5" lang="en">
      {row.officialEditorKind === "select" && row.officialOptions?.length ? (
        <Select
          value={draft}
          onValueChange={(value) => {
            setDraft(value);
            void commitOfficialValue(value);
          }}
          disabled={saving}
        >
          <SelectTrigger
            aria-label={officialLabel}
            className={cn(
              "h-12 w-full rounded-lg border-input bg-background text-right text-base shadow-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm",
              editorIssueClassName,
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {row.officialOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : row.officialEditorKind === "textarea" ? (
        <Textarea
          aria-label={officialLabel}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commitOfficialValue()}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(editorValue);
              event.currentTarget.blur();
            }
          }}
          disabled={saving}
          className={cn(
            "min-h-20 resize-y rounded-lg border-input bg-background text-right text-base shadow-xs focus-visible:border-brand-500 focus-visible:ring-1 focus-visible:ring-brand-500 sm:text-sm",
            editorIssueClassName,
          )}
        />
      ) : (
        <BrandInput
          aria-label={officialLabel}
          type="text"
          inputMode={row.officialEditorKind === "date" ? "numeric" : undefined}
          placeholder={row.officialEditorKind === "date" ? "DD/MM/YYYY" : undefined}
          lang={row.officialEditorKind === "date" ? "en-GB" : "en"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commitOfficialValue()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(editorValue);
              event.currentTarget.blur();
            }
          }}
          disabled={saving}
          className={cn("w-full text-right", editorIssueClassName)}
        />
      )}
      {saving || saveError ? (
        <div className="text-right text-xs" aria-live="polite">
          {saving ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {t("savingOfficialValue")}
          </span>
          ) : (
            <span className="text-destructive" role="alert">{saveError}</span>
          )}
        </div>
      ) : null}
    </div>
  ) : null;

  if (!isZh) {
    return (
      <TableRow
        className={reviewRowClassName}
        data-review-issue={row.issueSeverity}
      >
        <th
          scope="row"
          className="block w-full px-0 pb-1 pt-2 text-left align-top text-sm font-medium text-muted-foreground sm:table-cell sm:w-[56%] sm:py-2"
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
            ? "block w-full px-0 pb-2 pt-1 text-right align-top text-sm font-medium text-red-700 sm:table-cell sm:w-auto sm:py-2"
            : row.missing
              ? "block w-full px-0 pb-2 pt-1 text-right align-top text-sm font-medium text-red-600 sm:table-cell sm:w-auto sm:py-2"
            : row.optional
              ? "block w-full px-0 pb-2 pt-1 text-right align-top text-sm font-medium text-muted-foreground sm:table-cell sm:w-auto sm:py-2"
            : row.issueSeverity === "warning"
              ? "block w-full px-0 pb-2 pt-1 text-right align-top text-sm font-medium text-amber-900 sm:table-cell sm:w-auto sm:py-2"
              : "block w-full px-0 pb-2 pt-1 text-right align-top text-sm font-medium text-foreground sm:table-cell sm:w-auto sm:py-2"}
        >
          {officialValueEditor ?? (
            <span className="whitespace-pre-wrap break-words">{row.officialValue}</span>
          )}
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
      className={reviewRowClassName}
      data-review-issue={row.issueSeverity}
    >
      <th
        scope="row"
        className="block w-full px-0 pb-1 pt-2 text-left align-top font-normal sm:table-cell sm:w-[56%] sm:py-2"
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
      <TableCell className="block w-full px-0 pb-2 pt-1 text-right align-top sm:table-cell sm:w-auto sm:py-2">
        <span className={row.issueSeverity === "error"
          ? "block whitespace-pre-wrap break-words text-sm font-medium text-red-700"
          : row.missing
            ? "block whitespace-pre-wrap break-words text-sm font-medium text-red-600"
          : row.optional
            ? "block whitespace-pre-wrap break-words text-sm font-medium text-muted-foreground"
          : row.issueSeverity === "warning"
            ? "block whitespace-pre-wrap break-words text-sm font-medium text-amber-900"
            : "block whitespace-pre-wrap break-words text-sm font-medium text-foreground"}
        >
          {row.sourceValue}
        </span>
        {officialValueEditor ?? (
          <span
            lang="en"
            className={row.issueSeverity === "error"
              ? "mt-0.5 block whitespace-pre-wrap break-words text-sm leading-5 text-red-700"
              : row.missing
                ? "mt-0.5 block whitespace-pre-wrap break-words text-sm leading-5 text-red-600"
              : row.optional
                ? "mt-0.5 block whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground"
              : row.issueSeverity === "warning"
                ? "mt-0.5 block whitespace-pre-wrap break-words text-sm leading-5 text-amber-800"
                : "mt-0.5 block whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground"}
          >
            {row.officialValue}
          </span>
        )}
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
  onSaveOfficialValue,
  onUpdated,
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
              {section.editStepIndex !== undefined && section.editFieldName && onEditSection ? (
                <ReviewEditButton
                  onClick={() => onEditSection(section.editStepIndex!, section.editFieldName!)}
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
                    onSaveOfficialValue={onSaveOfficialValue}
                    onUpdated={onUpdated}
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
