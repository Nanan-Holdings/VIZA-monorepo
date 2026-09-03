"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CircleNotch as Loader2,
  Plus,
} from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useClientApplicationStatuses } from "@/lib/client/portal-data";
import type { StatusApplication } from "@/app/client/status/status-data";
import { buildApplicationLongFormHref } from "@/lib/client/recent-application-form";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { useRouteReady } from "@/lib/client/route-perf";

const LONG_FORM_PATH = "/client/application/long-form";
const DESTINATIONS_PATH = "/client/destinations";

/** States that mean "the applicant still has work to do in the form". */
const RESUMABLE_STATES = new Set([
  "not_started",
  "needs_payment",
  "needs_consent",
  "in_progress",
  "needs_documents",
  "needs_attention",
]);

/**
 * The Application tab.
 *
 * It used to redirect straight into whichever form was opened last, which meant an
 * applicant who wanted to start a *different* country landed inside an unfinished
 * application with no obvious way out. Now the tab asks first: resume one of the
 * applications already in flight, or start a new one.
 *
 * A deep link that already names an application (`?applicationId=…&country=…`) still
 * goes straight through — that is an explicit choice, not a guess.
 */
export default function ApplicationChooserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("application.chooser");
  const tShared = useTranslations("simplifiedForm.shared");

  const query = searchParams?.toString() ?? "";
  const hasExplicitTarget = Boolean(
    searchParams?.get("applicationId") || searchParams?.get("country"),
  );

  // Shared with Home and Status: a return visit renders the list already in
  // memory and refreshes it behind the applicant instead of showing skeletons.
  const {
    data: statuses,
    error: statusError,
  } = useClientApplicationStatuses({ enabled: !hasExplicitTarget });
  const applications: StatusApplication[] | null = useMemo(
    () => (statuses ? statuses.applications : statusError ? [] : null),
    [statuses, statusError],
  );
  const failed = Boolean(statusError);
  useRouteReady(applications !== null);

  useEffect(() => {
    if (hasExplicitTarget) {
      router.replace(`${LONG_FORM_PATH}${query ? `?${query}` : ""}`);
    }
  }, [hasExplicitTarget, query, router]);

  const resumable = useMemo(
    () => (applications ?? []).filter((application) => RESUMABLE_STATES.has(application.state)),
    [applications],
  );

  const countryName = useCallback(
    (application: StatusApplication) =>
      locale.startsWith("zh") ? application.countryNameZh : application.countryName,
    [locale],
  );

  const visaTypeLabel = useCallback(
    (application: StatusApplication) =>
      locale.startsWith("zh") ? application.visaTypeLabelZh : application.visaTypeLabel,
    [locale],
  );

  if (hasExplicitTarget) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
        <p className="text-lg text-muted-foreground">{tShared("loading")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-10">
      <h1 className="font-heading text-[28px] font-medium tracking-[-0.8px]">{t("title")}</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">{t("subtitle")}</p>

      {applications === null ? (
        <div className="mt-8 space-y-3" role="status" aria-label={tShared("loading")}>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {failed ? <ClientErrorAlert className="mt-6" message={t("loadFailed")} /> : null}

          {resumable.length > 0 && (
            <section className="mt-8">
              <h2 className="text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {t("resumeHeading")}
              </h2>
              <ul className="mt-3 space-y-3">
                {resumable.map((application) => (
                  <li key={application.key}>
                    <Link
                      href={buildApplicationLongFormHref({
                        applicationId: application.id,
                        country: application.country,
                        visaType: application.visaType,
                      })}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border-hairline bg-white p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-heading text-[17px] font-medium">
                          <span aria-hidden="true">{application.countryFlag}</span>
                          {countryName(application)}
                        </span>
                        <span className="mt-1 block truncate text-[13px] text-muted-foreground">
                          {visaTypeLabel(application)} ·{" "}
                          {t("progress", { percent: application.progressPercent })}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-brand-500">
                        {t("resume")}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {t("startHeading")}
            </h2>
            <Link
              href={DESTINATIONS_PATH}
              className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-dashed border-border-hairline bg-white p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-heading text-[17px] font-medium">
                  <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t("startNew")}
                </span>
                <span className="mt-1 block text-[13px] text-muted-foreground">
                  {resumable.length > 0 ? t("startNewHint") : t("startNewHintEmpty")}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
