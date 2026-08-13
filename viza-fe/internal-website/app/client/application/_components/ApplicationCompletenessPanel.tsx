"use client";

import { AlertCircle, ArrowRight, CheckCircle2, FileUp, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ApplicationCompletenessMissingDocument,
  ApplicationCompletenessMissingField,
  ApplicationCompletenessResult,
} from "@/lib/application-completeness";

type ApplicationCompletenessPanelProps = {
  completeness: ApplicationCompletenessResult | null;
  checking?: boolean;
  isZh?: boolean;
  onGoToField: (item: ApplicationCompletenessMissingField) => void;
  onGoToDocument: (item: ApplicationCompletenessMissingDocument) => void;
  className?: string;
};

export function ApplicationCompletenessPanel({
  completeness,
  checking = false,
  isZh = true,
  onGoToField,
  onGoToDocument,
  className,
}: ApplicationCompletenessPanelProps) {
  if (!completeness && !checking) return null;

  const infoCount = completeness?.missingInfoCount ?? 0;
  const documentCount = completeness?.missingDocumentCount ?? 0;
  const complete = Boolean(completeness?.complete);

  return (
    <section
      className={cn(
        "rounded-lg border p-4 sm:p-5",
        complete
          ? "border-emerald-200 bg-emerald-50"
          : "border-amber-200 bg-amber-50",
        className,
      )}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {complete ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        ) : (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        )}
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "text-base font-semibold",
              complete ? "text-emerald-900" : "text-amber-900",
            )}
          >
            {checking
              ? isZh
                ? "正在检查申请完整性"
                : "Checking application completeness"
              : complete
                ? isZh
                  ? "资料已完整，可以继续提交"
                  : "Application is complete. You can continue."
                : isZh
                  ? `还缺 ${infoCount} 项信息、${documentCount} 份材料`
                  : `${infoCount} information item(s) and ${documentCount} document(s) still missing`}
          </h3>
          {!complete && (
            <p className="mt-1 text-sm text-amber-800">
              {isZh
                ? "缺失清单未清零前，系统不会开始官网自动填写或上传。"
                : "VIZA will not start official-site automation until this list is clear."}
            </p>
          )}
        </div>
      </div>

      {!complete && completeness && (
        <div className="mt-4 grid gap-4">
          {completeness.missingInfo.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-white p-3">
              <h4 className="mb-2 text-sm font-semibold text-amber-950">
                {isZh ? "缺失信息" : "Missing information"}
              </h4>
              <div className="space-y-2">
                {completeness.missingInfo.map((item) => (
                  <div
                    key={`${item.stepNumber}:${item.fieldName}`}
                    className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{isZh ? item.labelZh : item.labelEn}</p>
                      <p className="text-xs text-muted-foreground">
                        {isZh ? "所属步骤：" : "Step: "}
                        {isZh ? item.stepLabelZh : item.stepName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onGoToField(item)}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-brand-500 px-3 text-sm font-semibold text-white hover:bg-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                    >
                      <PencilLine className="h-4 w-4" />
                      {isZh ? "去填写" : "Fill"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completeness.missingDocuments.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-white p-3">
              <h4 className="mb-2 text-sm font-semibold text-amber-950">
                {isZh ? "缺失材料" : "Missing documents"}
              </h4>
              <div className="space-y-2">
                {completeness.missingDocuments.map((item) => (
                  <div
                    key={item.requirementKey}
                    className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{isZh ? item.labelZh : item.labelEn}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onGoToDocument(item)}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-brand-500 px-3 text-sm font-semibold text-white hover:bg-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                    >
                      <FileUp className="h-4 w-4" />
                      {isZh ? "去上传" : "Upload"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
