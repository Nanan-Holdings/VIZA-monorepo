"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText as FileCheck2 } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { getClientApplicationStatus } from "@/app/actions/client-application-status";
import type { StatusApplication, StatusEvent, StatusFile } from "@/app/client/status/status-data";
import { ActionButton } from "@/components/ui/action-button";
import { AnimatedTabPill } from "@/components/ui/animated-tab-pill";
import { ApplicationFormPanel } from "@/components/ui/application-form-panel";

type PanelTab = "results" | "updates";

function formatDateTime(value: string | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function isPostSubmission(application: StatusApplication): boolean {
  return Boolean(
    application.submittedAt ||
      application.officialReference ||
      ["submitted", "approved", "rejected"].includes(application.state),
  );
}

export function uniqueFiles(files: StatusFile[]): StatusFile[] {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = file.href ?? file.reference;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function PostSubmissionInfoPanel({ applicationId }: { applicationId: string | null }) {
  const t = useTranslations("application.postSubmission");
  const tStatus = useTranslations("clientStatus");
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<PanelTab>("results");
  const [application, setApplication] = useState<StatusApplication | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!applicationId) return;
    void getClientApplicationStatus(applicationId).then((value) => {
      if (mounted) setApplication(value);
    });
    return () => {
      mounted = false;
    };
  }, [applicationId]);

  const files = useMemo(() => uniqueFiles(application?.files ?? []), [application]);
  if (!application || !isPostSubmission(application)) return null;

  const formatEvent = (event: StatusEvent) => {
    const key = event.eventType.toLowerCase();
    return tStatus.has(`events.${key}` as never)
      ? tStatus(`events.${key}` as never)
      : event.eventType.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  return (
    <ApplicationFormPanel className="overflow-hidden rounded-xl p-0">
      <div className="flex flex-col gap-3 border-b border-[#ececec] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-heading text-[20px] font-medium text-[#26364a]">{t("title")}</h2>
        <AnimatedTabPill
          variant="pill"
          tabs={[
            { id: "results", label: t("tabs.results") },
            { id: "updates", label: t("tabs.updates") },
          ]}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as PanelTab)}
        />
      </div>

      {activeTab === "results" ? (
        files.length > 0 || application.officialReference ? (
          <div>
            {application.officialReference ? (
              <div className="flex min-h-[76px] items-center gap-3 border-t border-[#ececec] px-5 py-4 first:border-t-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500"><FileCheck2 className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[#66758a]">{t("officialReference")}</p>
                  <p className="mt-1 break-all font-mono text-[14px] font-semibold text-[#26364a]">{application.officialReference}</p>
                </div>
              </div>
            ) : null}
            {files.map((file) => (
              <div key={`${file.key}-${file.reference}`} className="flex min-h-[76px] items-center gap-3 border-t border-[#ececec] px-5 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500"><FileCheck2 className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[#26364a]">{tStatus(`files.${file.key}`)}</p>
                  <p className="mt-1 text-[12px] text-[#8a94a6]">{formatDateTime(file.createdAt, locale)}</p>
                </div>
                {file.href ? (
                  <ActionButton size="sm" variant="outline" asChild>
                    <a href={file.href} target="_blank" rel="noreferrer">{t("download")}<Download /></a>
                  </ActionButton>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="px-6 py-10 text-center text-[14px] text-[#66758a]">{t("resultsEmpty")}</p>
        )
      ) : application.events.length > 0 ? (
        <div>
          {application.events.map((event) => (
            <div key={`${event.eventType}-${event.createdAt}`} className="flex min-h-[72px] items-center justify-between gap-4 border-t border-[#ececec] px-5 py-4 first:border-t-0">
              <p className="text-[14px] font-medium text-[#26364a]">{formatEvent(event)}</p>
              <p className="shrink-0 text-[12px] text-[#8a94a6]">{formatDateTime(event.createdAt, locale)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-6 py-10 text-center text-[14px] text-[#66758a]">{t("updatesEmpty")}</p>
      )}
    </ApplicationFormPanel>
  );
}
